// A class responds to player actions parsed by the UIFunctions
define(['ash',
    'game/constants/OccurrenceConstants',
    'game/constants/LogConstants',
    'game/nodes/LogNode',
    'game/nodes/sector/CampNode',
    'game/nodes/tribe/TribeUpgradesNode',
    'game/components/common/PositionComponent',
    'game/components/common/ResourcesComponent',
    'game/components/type/LevelComponent',
    'game/components/sector/events/RaidComponent',
    'game/components/sector/improvements/SectorImprovementsComponent',
    'game/components/common/CampComponent',
], function (Ash, OccurrenceConstants, LogConstants, LogNode,
    CampNode, TribeUpgradesNode,
    PositionComponent, ResourcesComponent, LevelComponent, RaidComponent,
    SectorImprovementsComponent, CampComponent) {
    
    var OccurrenceFunctions = Ash.System.extend({
        
		gameState: null,
		uiFunctions: null,
		resourcesHelper: null,
		upgradeEffectsHelper: null,
		
		engine: null,
        logNodes: null,
		campNodes: null,
        tribeUpgradeNodes: null,
	
        constructor: function (gameState, uiFunctions, resourcesHelper, upgradeEffectsHelper) {
			this.gameState = gameState;
			this.uiFunctions = uiFunctions;
			this.resourcesHelper = resourcesHelper;
            this.upgradeEffectsHelper = upgradeEffectsHelper;
        },

        addToEngine: function (engine) {
            this.engine = engine;
            this.logNodes = engine.getNodeList(LogNode),
			this.campNodes = engine.getNodeList(CampNode);
            this.tribeUpgradeNodes = engine.getNodeList(TribeUpgradesNode);
        },

        removeFromEngine: function (engine) {
            this.engine = null;
			this.campNodes = null;
            this.tribeUpgradeNodes = null;
        },
        
        onEnterLevel: function (levelEntity) {
            var levelComponent = levelEntity.get(LevelComponent);
            var levelVO = levelComponent.levelVO;
            if (!levelVO.isCampable) {
                var msg = "This level seems eerily devoid of any signs of recent human activity.";
                this.addLogMessage(LogConstants.MSG_ID_ENTER_LEVEL, msg);
            }
        },
	
		onEnterNewSector: function (sectorEntity) {
		},
	
		onScoutSector: function (sectorEntity) {
		},
	
		onEndRaid: function (sectorEntity) {
			var improvements = sectorEntity.get(SectorImprovementsComponent);
			var raidComponent = sectorEntity.get(RaidComponent);
			var soldiers = sectorEntity.get(CampComponent).assignedWorkers.soldier;
            var fortificationUpgradeLevel = this.upgradeEffectsHelper.getBuildingUpgradeLevel(improvementNames.fortification, this.tribeUpgradeNodes.head.upgrades);
			raidComponent.victory = OccurrenceConstants.getRaidDanger(improvements, soldiers, fortificationUpgradeLevel) < 0;//Math.random()*100;
			if (!raidComponent.victory) {
                var campResources = this.resourcesHelper.getCurrentCampStorage(sectorEntity).resources;
                var amountFactor = 1 / this.resourcesHelper.getNumCampsInTradeNetwork(sectorEntity);
                
                // select resources (names)
				var selectedResources = [];
				var maxSelectedResources = 1 + Math.floor(Math.random() * 3);
				var largestSelectedAmount = 0;
				for (var key in resourceNames) {
					var name = resourceNames[key];
					var campAmount = campResources.getResource(name);
					if (selectedResources.length < maxSelectedResources) {
						selectedResources.push(name);
						largestSelectedAmount = Math.max(largestSelectedAmount, campAmount);
					} else if (campAmount > largestSelectedAmount) {
						selectedResources.pop();
						selectedResources.push(name);
						largestSelectedAmount = Math.max(largestSelectedAmount, campAmount);
					}
				}
			
                // select amounts
				for(var i in selectedResources) {
					var name = selectedResources[i];
					var campAmount = campResources.getResource(name);
					var lostAmount = campAmount * amountFactor * (0.25 + 0.25 * Math.random());
					if (lostAmount >= 5) {
                        campResources.setResource(name, campAmount - lostAmount);
                        raidComponent.resourcesLost.addResource(name, lostAmount);
					}
				}
			}
		},
        
        addLogMessage: function (msgID, msg, replacements, values) {
            var logComponent = this.logNodes.head.logMessages;
            logComponent.addMessage(msgID, msg, replacements, values);
        },
	
    });

    return OccurrenceFunctions;
});
