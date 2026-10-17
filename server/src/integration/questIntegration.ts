import type { EntityId } from "../types/runtime";
import quests from "../quests";
import { getCharacterById } from "../runtimeRegistry";

export function initializeQuestIntegration(): void {
    quests.onQuestCompletion((playerId: EntityId, questId: string) => {
        const player = getCharacterById(playerId);
        if (!player) {
            return;
        }

        const definition = quests.getQuestDefinition(questId);
        if (!definition) {
            return;
        }

        for (const reward of definition.rewards) {
            switch (reward.type) {
                case "exp":
                    player.exp = (player.exp ?? 0) + reward.amount;
                    break;
                case "gold":
                    player.gold = (player.gold ?? 0) + reward.amount;
                    break;
                case "faction_score":
                    if (reward.faction === "armada") {
                        player.factionScoreArmada = (player.factionScoreArmada ?? 0) + reward.amount;
                    } else if (reward.faction === "caos") {
                        player.factionScoreCaos = (player.factionScoreCaos ?? 0) + reward.amount;
                    }
                    break;
                default:
                    break;
            }
        }
    });

    quests.onQuestProgress((playerId: EntityId, questId: string, objectiveId: string, newAmount: number) => {
        void playerId;
        void questId;
        void objectiveId;
        void newAmount;
    });
}

export function emitNpcKilledEvent(
    playerId: EntityId,
    npcId: EntityId,
    npcType: number,
    map: number,
    pos: { x: number; y: number },
): void {
    quests.emitQuestEvent(playerId, {
        type: "npc_killed",
        npcId,
        npcType,
        map,
        pos,
    });
}

export function emitItemCollectedEvent(playerId: EntityId, itemId: number, amount: number): void {
    quests.emitQuestEvent(playerId, {
        type: "item_collected",
        itemId,
        amount,
    });
}

export function emitNpcInteractedEvent(playerId: EntityId, npcId: EntityId, npcType: number): void {
    quests.emitQuestEvent(playerId, {
        type: "npc_interacted",
        npcId,
        npcType,
    });
}

export function emitLocationReachedEvent(playerId: EntityId, map: number, pos: { x: number; y: number }): void {
    quests.emitQuestEvent(playerId, {
        type: "location_reached",
        map,
        pos,
    });
}

export function emitPlayerKilledEvent(playerId: EntityId, victimId: EntityId, victimFaction: string): void {
    quests.emitQuestEvent(playerId, {
        type: "player_killed",
        victimId,
        victimFaction,
    });
}

export function emitItemCraftedEvent(playerId: EntityId, itemId: number, amount: number): void {
    quests.emitQuestEvent(playerId, {
        type: "item_crafted",
        itemId,
        amount,
    });
}

export function emitItemUsedEvent(playerId: EntityId, itemId: number): void {
    quests.emitQuestEvent(playerId, {
        type: "item_used",
        itemId,
    });
}

export function emitSpellCastEvent(playerId: EntityId, spellId: number): void {
    quests.emitQuestEvent(playerId, {
        type: "spell_cast",
        spellId,
    });
}

export function emitDamageDealtEvent(
    playerId: EntityId,
    targetType: "npc" | "player",
    targetId: EntityId,
    damage: number,
): void {
    quests.emitQuestEvent(playerId, {
        type: "damage_dealt",
        targetType,
        targetId,
        damage,
    });
}

export function emitDamageTakenEvent(
    playerId: EntityId,
    sourceType: "npc" | "player",
    sourceId: EntityId,
    damage: number,
): void {
    quests.emitQuestEvent(playerId, {
        type: "damage_taken",
        sourceType,
        sourceId,
        damage,
    });
}

export function emitLevelUpEvent(playerId: EntityId, newLevel: number): void {
    quests.emitQuestEvent(playerId, {
        type: "level_up",
        newLevel,
    });
}
