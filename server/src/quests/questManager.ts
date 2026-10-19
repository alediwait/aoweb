import type { EntityId } from "../types/runtime";
import { getCharacterById } from "../runtimeRegistry";
import * as registry from "./questRegistry";
import * as tracker from "./questTracker";
import { QuestDefinition } from "./questTypes";
import { emitQuestEvent } from "./questEvents";

export class QuestManager {
    static isNearQuestNpc(playerId: EntityId, npcId: number): boolean {
        const player = getCharacterById(playerId);
        if (!player) return false;
        const vars = require("../vars");
        return Object.values(vars.npcs as Record<string, any>).some((npc: any) => {
            if (!npc || npc.map !== player.map || npc.hp <= 0) return false;
            if (Number(npc.templateNpcIndex) !== npcId && String(npc.id) !== String(npcId)) return false;
            return Math.hypot(npc.pos.x - player.pos.x, npc.pos.y - player.pos.y) <= 6;
        });
    }

    /**
     * Starts a quest for a player and initializes their tracking state.
     */
    static startQuest(playerId: EntityId, questId: string): QuestDefinition | undefined {
        const definition = registry.getQuestDefinition(questId);
        if (!definition) {
            return undefined;
        }

        const player = getCharacterById(playerId);
        if (!player || !tracker.canStartQuest(playerId, questId, Number(player.level ?? 1))) {
            return undefined;
        }
        if (definition.startNpcId != null && !QuestManager.isNearQuestNpc(playerId, definition.startNpcId)) {
            return undefined;
        }

        const state = tracker.startQuest(playerId, questId);
        if (!state) {
            return undefined;
        }

        return definition;
    }

    /**
     * Updates progress for a specific objective in a player's active quest.
     */
    static updateProgress(playerId: EntityId, questId: string, objectiveId: string, amount: number): {
        newState: any,
        objectiveCompleted: boolean,
        questCompleted: boolean
    } {
        return tracker.updateObjectiveProgress(playerId, questId, objectiveId, amount);
    }

    /**
     * Completes a quest if all requirements are met.
     */
    static completeQuest(playerId: EntityId, questId: string): boolean {
        const state = tracker.completeQuest(playerId, questId);
        return !!state;
    }

    /**
     * Turns in a completed quest and awards the appropriate rewards to the player.
     */
    static turnInQuest(playerId: EntityId, questId: string): boolean {
        const currentState = tracker.getPlayerQuestState(playerId, questId);
        const definition = registry.getQuestDefinition(questId);
        const player = getCharacterById(playerId);
        if (!currentState || currentState.status !== "completed" || !definition || !player) {
            return false;
        }
        if (definition.endNpcId != null && !QuestManager.isNearQuestNpc(playerId, definition.endNpcId)) {
            return false;
        }

        const state = tracker.turnInQuest(playerId, questId);
        if (!state) {
            return false;
        }

        // Apply rewards
        for (const reward of definition.rewards) {
            switch (reward.type) {
                case "exp":
                    player.exp = (player.exp ?? 0) + reward.amount;
                    break;
                case "gold":
                    player.gold = require("../balance").clampGold((player.gold ?? 0) + reward.amount);
                    break;
                case "faction_score":
                    if (reward.faction === "armada" || reward.faction === "caos") {
                        require("../game").addFactionScore(playerId, reward.faction, reward.amount);
                    }
                    break;
                case "item":
                    // Inventory rewards are added by the game layer when it is available.
                    if (reward.itemId) {
                        const game = require("../game");
                        if (typeof game.grantQuestRewardItem === "function") {
                            game.grantQuestRewardItem(playerId, reward.itemId, reward.amount);
                        }
                    }
                    break;
                case "spell": {
                    const spellId = Number(reward.spellId);
                    const spellData = require("../vars").datSpell[spellId];
                    const spellRecord = player.spells ?? {};
                    const alreadyKnown = Object.values(spellRecord).some(
                        (slot: any) => Number(slot?.idSpell) === spellId,
                    );
                    if (spellId > 0 && spellData && !alreadyKnown) {
                        let slot = 0;
                        while (Object.prototype.hasOwnProperty.call(spellRecord, String(slot))) slot++;
                        spellRecord[String(slot)] = { idSpell: spellId };
                        player.spells = spellRecord;
                        require("../handleProtocol").aprenderSpell(playerId, slot);
                    }
                    break;
                }
                default:
                    break;
            }
        }

        const game = require("../game");
        const vars = require("../vars");
        const handleProtocol = require("../handleProtocol");
        const client = vars.clients[String(playerId)];
        game.checkUserLevel(playerId);
        if (client) {
            handleProtocol.actExp(player.exp ?? 0, client);
            handleProtocol.actGold(player.gold ?? 0, client);
        }
        void game.persistCharacterSnapshot(player, { connected: Boolean(player.connected) }).catch((error: unknown) => {
            require("../functions").dumpError(error);
        });

        return true;
    }

    /**
     * Fails a quest immediately.
     */
    static failQuest(playerId: EntityId, questId: string): void {
        tracker.failQuest(playerId, questId);
    }

    /**
     * Abandons an active quest.
     */
    static abandonQuest(playerId: EntityId, questId: string): boolean {
        return tracker.abandonQuest(playerId, questId);
    }

    /**
     * Resets a repeatable quest.
     */
    static resetQuest(playerId: EntityId, questId: string): boolean {
        return tracker.resetQuest(playerId, questId);
    }

    /**
     * Handles an incoming quest event and updates the corresponding player quest state.
     */
    static handleQuestEvent(playerId: EntityId, event: any): void {
        try {
            emitQuestEvent(playerId, event);
        } catch (error) {
            require("../functions").dumpError(error);
        }
    }
}
