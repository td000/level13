// A class that checks raw user input from the DOM and passes game-related actions to PlayerActionFunctions
define(['ash',
        'game/GlobalSignals',
        'game/constants/GameConstants',
        'game/constants/UIConstants',
        'game/constants/ItemConstants',
        'game/constants/PlayerActionConstants',
        'game/constants/PositionConstants',
        'game/helpers/ui/UIPopupManager',
        'game/vos/ResourcesVO'],
function (Ash, GlobalSignals, GameConstants, UIConstants, ItemConstants, PlayerActionConstants, PositionConstants, UIPopupManager, ResourcesVO) {
    var UIFunctions = Ash.Class.extend({
        
        playerActions: null,
        gameState: null,
        saveSystem: null,
        cheatSystem: null,
        
        popupManager: null,
        changeLogHelper: null,
        
        elementIDs: {
            tabs: {
                bag: "switch-bag",
                followers: "switch-followers",
                projects: "switch-projects",
                map: "switch-map",
                trade: "switch-trade",
                in: "switch-in",
                out: "switch-out",
                upgrades: "switch-upgrades",
                blueprints: "switch-blueprints",
                world: "switch-world"
            },
        },
        
        names: {
            resources: {
                stamina: "stamina",
                resource_metal: "metal",
                resource_fuel: "fuel",
                resource_rope: "rope",
                resource_food: "food",
                resource_water: "water",
                resource_concrete: "concrete",
                resource_herbs: "herbs",
                resource_medicine: "medicine",
                resource_tools: "tools",
                item_exploration_1: "lock pick",
                rumours: "rumours",
                evidence: "evidence",
            }
        },
        
        constructor: function (playerActions, gameState, saveSystem, cheatSystem, changeLogHelper) {
            this.playerActions = playerActions;
            this.gameState = gameState;
            this.saveSystem = saveSystem;
            this.cheatSystem = cheatSystem;

            this.generateElements();
            this.registerListeners();
            
            this.popupManager = new UIPopupManager(this.gameState, this.playerActions.playerActionResultsHelper, this);
            this.changeLogHelper = changeLogHelper;
        },
        
        registerListeners: function () {
            var elementIDs = this.elementIDs;
            var gameState = this.gameState;
            var playerActions = this.playerActions;
            var uiFunctions = this;
            
            $(window).resize(this.onResize);
            
            // Switch tabs
            var onTabClicked = this.onTabClicked;
            $.each($("#switch-tabs li"), function () {
                $(this).click(function () {
                    if (!($(this).hasClass("disabled"))) {
                        onTabClicked(this.id, gameState, uiFunctions);
                    }
                });
            });
            
            // Collapsible divs
            this.registerCollapsibleContainerListeners("");
            
            // Steppers and stepper buttons
            this.registerStepperListeners("");
            
            // Action buttons buttons
            this.registerActionButtonListeners("");
            
            // Meta/non-action buttons
            var saveSystem = this.saveSystem;
            $("#btn-save").click(function (e) {saveSystem.save() });
            $("#btn-restart").click(function (e) {
                uiFunctions.showConfirmation(
                    "Do you want to restart the game? Your progress will be lost.",
                    function () {
                        uiFunctions.restart();
                    });
            });
            $("#btn-more").click(function (e) {
                var wasVisible = $("#game-options-extended").is(":visible");
                $("#game-options-extended").toggle();
                $(this).text(wasVisible ? "more" : "less");
                GlobalSignals.elementToggledSignal.dispatch($(this), !wasVisible);
            });
            $("#btn-importexport").click(function (e) {
                gtag('event', 'screen_view', { 'screen_name' : "popup-manage-save" });
                uiFunctions.showManageSave();
            });
            $("#btn-info").click(function (e) {
                gtag('event', 'screen_view', { 'screen_name' : "popup-game-info" });
                uiFunctions.showInfoPopup("Level 13", uiFunctions.getGameInfoDiv());
            });
            
            $("#in-assign-workers input.amount").change(function (e) {
                var scavengers = parseInt($("#stepper-scavenger input").val());
                var trappers = parseInt($("#stepper-trapper input").val());
                var waters = parseInt($("#stepper-water input").val());
                var ropers = parseInt($("#stepper-rope input").val());
                var chemists = parseInt($("#stepper-fuel input").val());
                var apothecaries = parseInt($("#stepper-medicine input").val());
                var smiths = parseInt($("#stepper-smith input").val());
                var concrete = parseInt($("#stepper-concrete input").val());
                var soldiers = parseInt($("#stepper-soldier input").val());
                playerActions.assignWorkers(scavengers, trappers, waters, ropers, chemists, apothecaries, smiths, concrete, soldiers);
            });
            
            // Buttons: In: Other
            $("#btn-header-rename").click(function(e) {
                var prevCampName = playerActions.getNearestCampName();
                uiFunctions.showInput(
                    "Rename Camp",
                    "Give your camp a new name",
                    prevCampName,
                    function (input) {
                        playerActions.setNearestCampName(input);
                    });
            });
            
            // Cheats
            if (GameConstants.isCheatsEnabled) {
                $("#btn-cheats").click(function (e) {
                    gtag('event', 'screen_view', { 'screen_name' : "popup-cheats" });
                    var cheatListDiv = uiFunctions.cheatSystem.getCheatListDiv();
                    uiFunctions.showInput("Cheats", "Enter cheat<br/>" + cheatListDiv, "", function (input) {
                        uiFunctions.cheatSystem.applyCheat(input)
                    });
                });
            }
        },
        
        registerActionButtonListeners: function (scope) {
            var uiFunctions = this;
            var gameState = this.gameState;
            var playerActions = this.playerActions;
            
            // All action buttons
            $.each($(scope + " button.action"), function () {
                var $element = $(this);
                if ($element.hasClass("click-bound")) {
                    console.log("WARN: trying to bind click twice! id: " + $element.attr("id"));
                    return;
                }
                $element.addClass("click-bound");
                $element.click(function (e) {
                    var action = $(this).attr("action");
                    if (!action) {
                        console.log("WARN: No action mapped for button.");
                        return;   
                    }
                    
                    GlobalSignals.actionButtonClickedSignal.dispatch(action);

                    var param = null;
                    var actionIDParam = playerActions.playerActionsHelper.getActionIDParam(action);
                    if (actionIDParam) param = actionIDParam;
                    var isProject = $(this).hasClass("action-level-project");
                    if (isProject) param = $(this).attr("sector");

                    var locationKey = uiFunctions.getLocationKey($(this));
                    var isStarted = playerActions.startAction(action, param);
                    if (!isStarted)
                        return;

                    var baseId = playerActions.playerActionsHelper.getBaseActionID(action);
                    var duration = PlayerActionConstants.getDuration(baseId);
                    if (duration > 0) {
                        uiFunctions.gameState.setActionDuration(action, locationKey, duration);
                        uiFunctions.startButtonDuration($(this), duration);
                    }
                });
            });
            
            // Special actions
            $(scope + "#out-action-fight-confirm").click(function (e) {
                playerActions.fightHelper.startFight();
            });
            $(scope + "#out-action-fight-close").click(function (e) {
                playerActions.fightHelper.endFight();
            });
            $(scope + "#out-action-fight-next").click(function (e) {
                playerActions.fightHelper.endFight();
            });
            $(scope + "#out-action-fight-cancel").click(function (e) {
                playerActions.flee();
                playerActions.fightHelper.endFight();
            });
            $(scope + "#inn-popup-btn-cancel").click(function (e) {                
                uiFunctions.popupManager.closePopup("inn-popup");
            });
            $(scope + "#incoming-caravan-popup-cancel").click(function (e) {
                uiFunctions.popupManager.closePopup("incoming-caravan-popup");
            });
            $(scope + " button[action='leave_camp']").click(function (e) {
                gameState.uiStatus.leaveCampItems = {};
                gameState.uiStatus.leaveCampRes = {};
                
                var selectedResVO = new ResourcesVO();
                $.each($("#embark-resources tr"), function () {
                    var resourceName = $(this).attr("id").split("-")[2];
                    var selectedVal = parseInt($(this).children("td").children(".stepper").children("input").val());
                    selectedResVO.setResource(resourceName, selectedVal);
                    gameState.uiStatus.leaveCampRes[resourceName] = selectedVal;
                });
                
                var selectedItems = {};
                $.each($("#embark-items tr"), function () {
                    var itemID = $(this).attr("id").split("-")[2];
                    var selectedVal = parseInt($(this).children("td").children(".stepper").children("input").val());
                    gameState.uiStatus.leaveCampItems[itemID] = selectedVal;
                    selectedItems[itemID] = selectedVal;
                });
                
                playerActions.updateCarriedItems(selectedItems);
                playerActions.moveResFromCampToBag(selectedResVO);
                playerActions.leaveCamp();
            });
            
            // Buttons: Bag: Item details
            // some in UIOoutBagSystem
        },
        
        registerCollapsibleContainerListeners: function (scope) {
            var sys = this;
            $(scope + " .collapsible-header").click(function () {
                var wasVisible = $(this).next(".collapsible-content").is(":visible");
                sys.toggleCollapsibleContainer($(this), !wasVisible);
            });
            $.each($(scope + " .collapsible-header"), function () {
                sys.toggleCollapsibleContainer($(this), false);
            });
        },
        
        registerStepperListeners: function (scope) {
            var sys = this;
            $(scope + " .stepper button").click(function (e) { sys.onStepperButtonClicked(this, e);});
            $(scope + ' .stepper input.amount').change(function () { sys.onStepperInputChanged(this) });
            $(scope + " .stepper input.amount").focusin(function () {
                $(this).data('oldValue', $(this).val());
            });
            $(scope + ' .stepper input.amount').trigger("change");
            
            // All number inputs
            $(scope + " input.amount").keydown(this.onNumberInputKeyDown);
        },
        
        generateElements: function () {
            this.generateTabBubbles();
            this.generateResourceIndicators();
            this.generateSteppers("body");
            this.generateButtonOverlays("body");
            this.generateCallouts("body");
            
            // building project info
            $.each($("#out-improvements tr"), function () {
                var actionName = $(this).find("button.action-build").attr("action");
                if (actionName) {
                    var costSource = PlayerActionConstants.getCostSource(actionName);
                    if (costSource == PlayerActionConstants.COST_SOURCE_CAMP) {
                        var infotd = $(this).find("td")[2];
                        $(infotd).html("<span class='p-meta'></span>");
                    }
                }
            });
            
            // equipment stats labels
            for (var bonusKey in ItemConstants.itemBonusTypes) {
                var bonusType = ItemConstants.itemBonusTypes[bonusKey];
                var div = "<div id='stats-equipment-" + bonusKey + "' class='stats-indicator stats-indicator-secondary'>";
                div += "<span class='label'>" + UIConstants.getItemBonusName(bonusType).replace(" ", "<br/>") + "</span>";
                div += "<br/>";
                div += "<span class='value'/></div>";
                $("#container-equipment-stats").append(div);
            }
            
            // cheats
            if (GameConstants.isCheatsEnabled) {
                $("#game-options-extended li:first-child").before("<li><button class='btn-meta' id='btn-cheats'>Cheats</button></li>")
            }
        },
        
        generateTabBubbles: function () {
            $("#switch li").append("<div class='bubble'>1</div>");
        },
        
        generateResourceIndicators: function () {
            for (var key in resourceNames) {
                var name = resourceNames[key];
                var isSupplies = name === resourceNames.food || name === resourceNames.water;
                $("#statsbar-resources").append(UIConstants.createResourceIndicator(name, false, "resources-" + name, true, true));
                $("#bag-resources").append(UIConstants.createResourceIndicator(name, false, "resources-bag-" + name, true, true));
                
                var indicatorEmbark = UIConstants.createResourceIndicator(name, true, "embark-resources-" + name, true, false);
                $("#embark-resources").append(
                    "<tr id='embark-assign-" + name + "'>" + 
                    "<td>" + indicatorEmbark + "</td>" +
                    "<td><div class='stepper' id='stepper-embark-" + name + "'></div></td>" +
                    "</tr>"
                );
            }
        },
        
        generateCallouts: function (scope) {
            // Info callouts
            $(scope + " .info-callout-target").wrap('<div class="callout-container"></div>');
            $(scope + " .info-callout-target").after(function () {
                var description = $(this).attr("description");
                var content = description;
                content = '<div class="callout-arrow-up"></div><div class="info-callout-content">' + content + "</div>";
                return '<div class="info-callout">' + content + '</div>'
            });
            
            // Button callouts
            var uiFunctions = this;
            $(scope + " div.container-btn-action").wrap('<div class="callout-container"></div>');
            $(scope + " div.container-btn-action").after(function () {
                var action = $($(this).children("button")[0]).attr("action");
                if (action === "take_all" || action === "accept_inventory" || action === "use_in_inn_cancel" || action === "fight")
                    return "";
                return uiFunctions.generateActionButtonCallout(action);
            });
            
            GlobalSignals.calloutsGeneratedSignal.dispatch();
        },
        
        generateActionButtonCallout: function (action) {
            var playerActionsHelper = this.playerActions.playerActionsHelper;
            var baseActionId = playerActionsHelper.getBaseActionID(action);
            var costFactor =  playerActionsHelper.getCostFactor(action);

            var content = "";
            var enabledContent = "";
            var disabledContent = "";

            // always visible: description
            var description = playerActionsHelper.getDescription(action);
            if (description) {
                content += "<span>" + description + "</span>";
            }

            // visible if button is enabled: costs & risks
            var costs = playerActionsHelper.getCosts(action, costFactor);
            var hasCosts = action && costs && Object.keys(costs).length > 0;
            if (hasCosts) {
                if (content.length > 0 || enabledContent.length) enabledContent += "<hr/>";
                for (var key in costs) {
                    var itemName = key.replace("item_", "");
                    var item = ItemConstants.getItemByID(itemName);
                    var name = (this.names.resources[key] ? this.names.resources[key] : item !== null ? item.name : key).toLowerCase();
                    var value = costs[key];
                    enabledContent += "<span class='action-cost action-cost-" + key + "'>" + name + ": <span class='action-cost-value'>" + UIConstants.getDisplayValue(value) + "</span></span><br/>";
                }
            }

            var duration = PlayerActionConstants.getDuration(baseActionId);
            if (duration > 0) {
                if (content.length > 0 || enabledContent.length) enabledContent += "<hr/>";
                enabledContent += "<span class='action-duration'>duration: " + Math.round(duration * 100)/100 + "s</span>";
            }
            
            var injuryRiskMax = PlayerActionConstants.getInjuryProbability(action, 0);
            var inventoryRiskMax = PlayerActionConstants.getLoseInventoryProbability(action, 0);
            var fightRiskMax = PlayerActionConstants.getRandomEncounterProbability(baseActionId, 0);
            var fightRiskMin = PlayerActionConstants.getRandomEncounterProbability(baseActionId, 100);
            if (injuryRiskMax > 0 || inventoryRiskMax > 0 || fightRiskMax > 0) {
                if (content.length > 0 || enabledContent.length) enabledContent += "<hr/>";
                var inventoryRiskLabel = action === "despair" ? "lose items" : "lose an item";
                if (injuryRiskMax > 0) 
                    enabledContent += "<span class='action-risk action-risk-injury warning'>injury: <span class='action-risk-value'></span>%</span>";
                if (inventoryRiskMax > 0) 
                    enabledContent += "<span class='action-risk action-risk-inventory warning'>" + inventoryRiskLabel + ": <span class='action-risk-value'></span>%</span>";
                if (fightRiskMax > 0)
                    enabledContent += "<span class='action-risk action-risk-fight warning'>fight: <span class='action-risk-value'></span>%</span>";
            }
            
            // visible if button is disabled: disabled reason
            if (content.length > 0 || enabledContent.length > 0) {
                if (content.length > 0) disabledContent += "<hr/>";
                disabledContent += "<span class='btn-disabled-reason action-cost-blocker'></span>";
            }
            
            if (enabledContent.length > 0) {
                content += "<span class='btn-callout-content-enabled'>" + enabledContent + "</span>";
            }
            
            if (disabledContent.length > 0) {
                content += "<span class='btn-callout-content-disabled' style='display:none'>" + disabledContent + "</span>";
            }

            if (content.length > 0) {
                return '<div class="btn-callout"><div class="callout-arrow-up"></div><div class="btn-callout-content">' + content + '</div></div>';
            } else {
                console.log("WARN: No callout could be created for action button with action " + action + ". No content for callout.");
                return "";
            }
        },
        
        generateSteppers: function (scope) {
            $(scope + " .stepper").append("<button type='button' class='btn-glyph' data-type='minus' data-field=''>-</button>");
            $(scope + " .stepper").append("<input class='amount' type='text' min='0' max='100' autocomplete='false' value='0' name='' tabindex='1'></input>");
            $(scope + " .stepper").append("<button type='button' class='btn-glyph' data-type='plus' data-field=''>+</button>");
            $(scope + " .stepper button").attr("data-field", function (i, val) {
                return $(this).parent().attr("id") + "-input";
            });
            $(scope + " .stepper button").attr("action", function (i, val) {
                return $(this).parent().attr("id") + "-" + $(this).attr("data-type");
            });
            $(scope + " .stepper input").attr("name", function (i, val) {
                return $(this).parent().attr("id") + "-input";
            });
        },
        
        generateButtonOverlays: function (scope) {
            $(scope + " button.action").append("<div class='cooldown-action' style='display:none' />");
            $(scope + " button.action").append("<div class='cooldown-duration' style='display:none' />");
            $(scope + " button.action").wrap("<div class='container-btn-action' />");
            $(scope + " div.container-btn-action").append("<div class='cooldown-reqs' />");
        },
        
        /**
         * Resets cooldown for an action. Should be called directly after an action is completed and any relevant popup is closed.
         * @param {type} action action
         */
        completeAction: function (action) {
            var button = $("button[action='" + action + "']");
            var baseId = this.playerActions.playerActionsHelper.getBaseActionID(action);
//            var cooldown = PlayerActionConstants.getCooldown(baseId);
            var cooldown = PlayerActionConstants.getCooldown(baseId) / 3;
            if (cooldown > 0) {
                var locationKey = this.getLocationKey($(button));
                this.gameState.setActionCooldown(action, locationKey, cooldown);
                this.startButtonCooldown($(button), cooldown);
            }
        },
        
        showGame: function () {
            $(".sticky-footer").css("display", "block");
            $("#grid-main").css("display", "block");
            $("#unit-main").css("display", "block");
            $(".loading-content").css("display", "none");
            GlobalSignals.gameShownSignal.dispatch();
        },
        
        hideGame: function (showLoading) {
            if (showLoading)
                $(".loading-content").css("display", "block");
            $("#unit-main").css("display", "none");
            $(".sticky-footer").css("display", "none");
            $("#grid-main").css("display", "none");
        },
        
        restart: function () {            
            $("#log ul").empty();
            this.onTabClicked(this.elementIDs.tabs.out, this.gameState, this);
            this.saveSystem.restart();
        },
        
        onResize: function () {
            GlobalSignals.windowResizedSignal.dispatch();
        },
        
        getGameInfoDiv: function () {
            var html = "";
            html += "<span id='changelog-version'>version " + this.changeLogHelper.getCurrentVersionNumber() + "<br/>updated " + this.changeLogHelper.getCurrentVersionDate() + "</span>";
            html += "<p>Note that this game is still in development and many features are incomplete and unbalanced. Updates might break saves. Feedback and bug reports are appreciated!</p>";
            html += "<p><a href='https://github.com/nroutasuo/level13' target='github'>github</a> | ";
            html += "<a href='https://www.reddit.com/r/level13' target='reddit'>reddit</a> | ";
            html += "<a href='https://sayat.me/level13' target='sayatme'>sayat.me</a></p>";
            html += "<h4 class='infobox-scrollable-header'>Changelog</h4>";
            html += "<div id='changelog' class='infobox infobox-scrollable'>" + this.changeLogHelper.getChangeLogHTML() + "</div>";
            return html;
        },
        
        onTabClicked: function (tabID, gameState, uiFunctions) {
            $("#switch-tabs li").removeClass("selected");
            $("#switch-tabs li#" + tabID).addClass("selected");
            $("#tab-header h2").text(tabID);
            
            gtag('event', 'screen_view', { 'screen_name' : tabID });
            
            var transition = !(gameState.uiStatus.currentTab === tabID);
            var transitionTime = transition ? 200 : 0;
            gameState.uiStatus.currentTab = tabID;
            
            $.each($(".tabelement"), function () {
                uiFunctions.slideToggleIf($(this), null, $(this).attr("data-tab") === tabID, transitionTime, 200);
            });
            
            GlobalSignals.tabChangedSignal.dispatch(tabID);
        },
        
        onStepperButtonClicked: function(button, e) {
            e.preventDefault();    
            var fieldName = $(button).attr('data-field');
            var type = $(button).attr('data-type');
            var input = $("input[name='"+fieldName+"']");
            var currentVal = parseInt(input.val());
            if (!isNaN(currentVal)) {
                if(type == 'minus') {
                    var min = input.attr('min');
                    if(currentVal > min) {
                        input.val(currentVal - 1).change();
                    }
                } else if(type == 'plus') {
                    var max = input.attr('max');
                    if(currentVal < max) {
                        input.val(currentVal + 1).change();
                    }
                }
            } else {
                console.log("WARN: invalid stepper input value [" + fieldName + "]");
                input.val(0);
            }
        },
        
        onStepperInputChanged: function(input) {
            var minValue =  parseInt($(input).attr('min'));
            var maxValue =  parseInt($(input).attr('max'));
            var valueCurrent = parseInt($(input).val());
            var name = $(input).attr('name');
            
            if (isNaN(valueCurrent)) {
                $(this).val($(this).data('oldValue'));
                return;
            }
            
            this.updateStepperButtons("#" + $(input).parent().attr("id"));
        },
        
        onNumberInputKeyDown: function (e) {
            // Allow: backspace, delete, tab, escape, enter and .
            if ($.inArray(e.keyCode, [46, 8, 9, 27, 13, 190]) !== -1 ||
            // Allow: Ctrl+A
            (e.keyCode == 65 && e.ctrlKey === true) || 
            // Allow: home, end, left, right
            (e.keyCode >= 35 && e.keyCode <= 39)) {
                return;
            }                
            // Ensure that it's a number and stop the keypress
            if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                e.preventDefault();
            }
        },
        
        onTextInputKeyDown: function(e) {
            // Allow: backspace, delete, tab, escape and enter
            if ($.inArray(e.keyCode, [46, 8, 9, 27, 13, 110]) !== -1 ||
                 // Allow: Ctrl+A
                (e.keyCode == 65 && e.ctrlKey === true) || 
                 // Allow: home, end, left, right
                (e.keyCode >= 35 && e.keyCode <= 39)) {
                    // let it happen, don't do anything
                     return;
            }
        },
        
        onTextInputKeyUp: function(e) {
            var value = $(e.target).val();
            value = value.replace(/[&\/\\#,+()$~%.'":*?<>{}\[\]=]/g,'_');
            $(e.target).val(value)
        },
        
        onPlayerMoved: function() {
            var uiFunctions = this;
            var cooldownLeft;
            var cooldownTotal;
            var durationLeft;
            var durationTotal;
            $.each($("button.action"), function() {
                var action = $(this).attr("action");
                var baseId = uiFunctions.playerActions.playerActionsHelper.getBaseActionID(action);
                if (action) {
                    var locationKey = uiFunctions.getLocationKey($(this));
                    cooldownTotal = PlayerActionConstants.getCooldown(action);
                    cooldownLeft = Math.min(cooldownTotal, uiFunctions.gameState.getActionCooldown(action, locationKey) / 1000);
                    durationTotal = PlayerActionConstants.getDuration(baseId);
                    durationLeft = Math.min(durationTotal, uiFunctions.gameState.getActionDuration(action, locationKey) / 1000);
                    if (cooldownLeft > 0) uiFunctions.startButtonCooldown($(this), cooldownTotal, cooldownLeft);
                    else uiFunctions.stopButtonCooldown($(this));
                    if (durationLeft > 0) uiFunctions.startButtonDuration($(this), cooldownTotal, durationLeft);
                }
            });
        },
        
        slideToggleIf: function(element, replacement, show, durationIn, durationOut) {
            var visible = this.isElementToggled(element);            
            var toggling = ($(element).attr("data-toggling") == "true");
            var sys = this;
            
            if (show && (visible == false || visible == null) && !toggling) {
				if(replacement) sys.toggle(replacement, false);
                $(element).attr("data-toggling", "true");
				$(element).slideToggle(durationIn, function () {
                    sys.toggle(element, true);
                    $(element).attr("data-toggling", "false");
                });
			} else if (!show && (visible == true || visible == null) && !toggling) {
                $(element).attr("data-toggling", "true");
				$(element).slideToggle(durationOut, function () {
					if(replacement) sys.toggle(replacement, true);
                    sys.toggle(element, false);
                    $(element).attr("data-toggling", "false");
				});
			}
        },
        
        toggleCollapsibleContainer: function (element, show) {
            var $element = typeof(element) === "string" ? $(element) : element;
            if (show) {
                var group = $element.parents(".collapsible-container-group");
                if (group.length > 0) {
                    var sys = this;
                    $.each($(group).find(".collapsible-header"), function () {
                        var $child = $(this);
                        if ($child[0] !== $element[0]) {
                            sys.toggleCollapsibleContainer($child, false);
                        }
                    });
                }
            }
            $element.toggleClass("collapsible-collapsed", !show);
            $element.toggleClass("collapsible-open", show);
            this.slideToggleIf($element.next(".collapsible-content"), null, show, 300, 200);
            GlobalSignals.elementToggledSignal.dispatch($element, show);
        },
        
        tabToggleIf: function(element, replacement, show, durationIn, durationOut) {
            var visible = $(element).is(":visible");
            var toggling = ($(element).attr("data-toggling") == "true");
            var sys = this;
            
            if (show && !visible && !toggling) {
				if(replacement) sys.toggle(replacement, false);
                $(element).attr("data-toggling", "true");
				$(element).fadeToggle(durationIn, function () {
                    sys.toggle(element, true);
                    $(element).attr("data-toggling", "false");
                });
			} else if (!show && visible && !toggling) {
                $(element).attr("data-toggling", "true");
				$(element).fadeToggle(durationOut, function () {
					if(replacement) sys.toggle(replacement, true);
                    sys.toggle(element, false);
                    $(element).attr("data-toggling", "false");
				});
			}
        },
        
        toggle: function (element, show) {
            var $element = typeof(element) === "string" ? $(element) : element;
            if (($element).length === 0)
                return;
            if (typeof(show) === "undefined")
                show = false;
            if (show === null)
                show = false;
            if (!show)
                show = false;
            if (this.isElementToggled($element) === show)
                return;
            $element.attr("data-visible", show);
            $element.toggle(show);
            GlobalSignals.elementToggledSignal.dispatch(element, show);
        },
        
        isElementToggled: function (element) {
            var $element = typeof(element) === "string" ? $(element) : element;
            if (($element).length === 0)
                return false;
            
            // if several elements, return their value if all agree, otherwise null
            if (($element).length > 1) {
                var previousIsToggled = null;
                var currentIsToggled = null;
                for (var i = 0; i < ($element).length; i++) {
                    previousIsToggled = currentIsToggled;
                    currentIsToggled = this.isElementToggled($(($element)[i]));
                    if (i > 0 && previousIsToggled !== currentIsToggled) return null;
                }
                return currentIsToggled;
            }
            
            var visible = true;
            var visibletag = ($element.attr("data-visible"));
            
            if (typeof visibletag !== typeof undefined) {
                visible = (visibletag == "true");
            } else {
                visible = null;
            }
            return visible;
        },
        
        isElementVisible: function (element) {
            var $element = typeof(element) === "string" ? $(element) : element;
            var toggled = this.isElementToggled(element);
            if (toggled === false)
                return false;
            return (($element).is(":visible"));
        },
        
        stopButtonCooldown: function (button) {
            $(button).children(".cooldown-action").stop(true, true);
            $(button).attr("data-hasCooldown", "false");
            $(button).children(".cooldown-action").css("display", "none");
            $(button).children(".cooldown-action").css("width", "100%");
        },
        
        startButtonCooldown: function (button, cooldown, cooldownLeft) {
            var action = $(button).attr("action");
            if (!cooldownLeft) cooldownLeft = cooldown;
            var uiFunctions = this;
            var startingWidth = (cooldownLeft/cooldown * 100);
            $(button).attr("data-hasCooldown", "true");
            $(button).children(".cooldown-action").stop(true, false).css("display", "inherit").css("width", startingWidth + "%").animate(
                { width: 0 },
                cooldownLeft * 1000,
                'linear',
                function() {
                    uiFunctions.stopButtonCooldown($(this).parent());
                }
            );
        },
        
        stopButtonDuration: function (button, complete) {
            $(button).children(".cooldown-duration").stop(true, true);
            $(button).children(".cooldown-duration").css("display", "none");
            $(button).children(".cooldown-duration").css("width", "0%");
            $(button).attr("data-isInProgress", "false");
        },
        
        startButtonDuration: function (button, duration, durationLeft) {
            if (!durationLeft) durationLeft = duration;
            var uiFunctions = this;
            var startingWidth = (1-durationLeft/duration) * 100;
            $(button).attr("data-isInProgress", "true");
            $(button).children(".cooldown-duration").stop(true, false).css("display", "inherit").css("width", startingWidth + "%").animate(
                { width: '100%' },
                durationLeft * 1000,
                'linear',
                function() {
                    uiFunctions.stopButtonDuration($(this).parent(), true);
                }
            );
        },
        
        getLocationKey: function(button) {
            var action = $(button).attr("action");
            var isLocationAction = PlayerActionConstants.isLocationAction(action);
            var playerPos = this.playerActions.playerPositionNodes.head.position;
            return this.gameState.getActionLocationKey(isLocationAction, playerPos);
        },
        
        updateStepper: function (id, val, min, max) {
            var $input = $(id + " input");
            var oldVal = parseInt($input.val());
            var oldMin =  parseInt($input.attr('min'));
            var oldMax =  parseInt($input.attr('max'));
            if (oldVal === val && oldMin === min && oldMax === max) return;
            $input.attr("min", min);
            $input.attr("max", max);
            $input.val(val)
            this.updateStepperButtons(id);
        },
        
        updateStepperButtons: function (id) {
            var $input = $(id + " input");
            var name = $input.attr('name');
            var minValue =  parseInt($input.attr('min'));
            var maxValue =  parseInt($input.attr('max'));
            var valueCurrent = parseInt($input.val());
            
            var decEnabled = false;
            var incEnabled = false;
            if(valueCurrent > minValue) {
                decEnabled = true;
            } else {
                $input.val(minValue);
            }
            if(valueCurrent < maxValue) {
                incEnabled = true;
            } else {
                $input.val(maxValue);
            }
            
            var decBtn = $(".btn-glyph[data-type='minus'][data-field='" + name + "']");
            decBtn.toggleClass("btn-disabled", !decEnabled);
            decBtn.toggleClass("btn-disabled-basic", !decEnabled);
            decBtn.attr("disabled", !decEnabled);
            var incBtn = $(".btn-glyph[data-type='plus'][data-field='" + name + "']");
            incBtn.toggleClass("btn-disabled", !incEnabled);
            incBtn.toggleClass("btn-disabled-basic", !incEnabled);
            incBtn.attr("disabled", !incEnabled);
        },
        
        showTab: function (tabID) {
            this.onTabClicked(tabID, this.gameState, this);
        },
        
        showFight: function () {
            this.showSpecialPopup("fight-popup");
        },
        
        showInnPopup: function (availableFollowers) {
            $("table#inn-popup-options-followers").empty();
            $("table#inn-popup-options-followers").append("<tr></tr>");
            for (var i = 0; i < availableFollowers.length; i++) {
                var td = "<td id='td-item-use_in_inn_select-" + availableFollowers[i].id + "'>";
                td += UIConstants.getItemDiv(null, availableFollowers[i], false, UIConstants.getItemCallout(availableFollowers[i]), true);
                td += "</td>";
                $("table#inn-popup-options-followers tr").append(td);
            }
            $("table#inn-popup-options-followers").append("<tr></tr>");
            for (var j = 0; j < availableFollowers.length; j++) {
                var td = "<td>";
                td += "<button class='action btn-narrow' action='use_in_inn_select_" + availableFollowers[j].id + "' followerID='" + availableFollowers[j].id + "'>Recruit</button>";
                td += "</td>";
                $($("table#inn-popup-options-followers tr")[1]).append(td);
            }
			this.generateButtonOverlays("#inn-popup-options-followers");
            this.showSpecialPopup("inn-popup");
        },
        
        showIncomingCaravanPopup: function () {
            this.showSpecialPopup("incoming-caravan-popup");
        },
        
        showManageSave: function () {            
            this.showSpecialPopup("manage-save-popup");
        },
        
        showSpecialPopup: function (popupID) {
            if ($("#" + popupID).is(":visible")) return;
            $("#" + popupID).wrap("<div class='popup-overlay' style='display:none'></div>");
            var uiFunctions = this;
            $(".popup-overlay").fadeIn(200, function () {
                uiFunctions.popupManager.onResize();
                GlobalSignals.popupOpenedSignal.dispatch(popupID);
                uiFunctions.gameState.isPaused = true;
                $("#" + popupID).fadeIn(200, function () {
                    uiFunctions.toggle("#" + popupID, true);
                    uiFunctions.popupManager.onResize();
                });
                GlobalSignals.elementToggledSignal.dispatch(("#" + popupID), true);
            });
            this.generateCallouts("#" + popupID); 
        },
        
        showInfoPopup: function (title, msg, buttonLabel, resultVO) {
            if (!buttonLabel) buttonLabel = "Continue";
            this.popupManager.showPopup(title, msg, buttonLabel, false, resultVO);
            this.generateCallouts(".popup");
        },
        
        showResultPopup: function (title, msg, resultVO, callback) {
            this.popupManager.showPopup(title, msg, "Continue", false, resultVO, callback);
            this.generateCallouts(".popup");
        },
        
        showConfirmation: function (msg, callback) {
            var uiFunctions = this;
            var okCallback = function(e) {
                uiFunctions.popupManager.closePopup("common-popup");
                callback();
            };
            var cancelCallback = function() {
                uiFunctions.popupManager.closePopup("common-popup");
            };
            this.popupManager.showPopup("Confirmation", msg, "Confirm", "Cancel", null, okCallback, cancelCallback);
            this.generateCallouts(".popup");
        },
        
        showQuestionPopup: function (title, msg, buttonLabel, cancelButtonLabel, callbackOK, callbackNo) {
            var uiFunctions = this;
            var okCallback = function(e) {
                uiFunctions.popupManager.closePopup("common-popup");
                callbackOK();
            };
            var cancelCallback = function() {
                uiFunctions.popupManager.closePopup("common-popup");
                if (callbackNo) callbackNo();
            };
            this.popupManager.showPopup(title, msg, buttonLabel, "Cancel", null, okCallback, cancelCallback);
            this.generateCallouts(".popup");
        },
        
        showInput: function(title, msg, defaultValue, callback) {
            var okCallback = function () {
                var input = $("#common-popup input").val();
                callback(input);
            };
            this.popupManager.showPopup(title, msg, "Confirm", "Cancel", null, okCallback);
            this.generateCallouts(".popup");
            
            var uiFunctions = this;
            var maxChar = 40;
            this.toggle("#common-popup-input-container", true);
            $("#common-popup-input-container input").attr("maxlength", maxChar);
            
            $("#common-popup input").val(defaultValue);
            $("#common-popup input").keydown( uiFunctions.onTextInputKeyDown);
            $("#common-popup input").keyup( uiFunctions.onTextInputKeyUp);
        },
    });

    return UIFunctions;
});
