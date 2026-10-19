import type { EntityId } from "../types/runtime";
import type { QuestEvent, QuestObjective, QuestProgressCallback, QuestCompletionCallback } from "./questTypes";
import { getQuestDefinition } from "./questRegistry";
import {
    isQuestActive,
    updateObjectiveProgress,
    checkExpiredQuests,
    getPlayerActiveQuests,
    getPlayerQuestState,
} from "./questTracker";

type QuestEventListener = (playerId: EntityId, event: QuestEvent) => void;

const questEventListeners = new Set<QuestEventListener>();
const questProgressCallbacks = new Set<QuestProgressCallback>();
const questCompletionCallbacks = new Set<QuestCompletionCallback>();

export function emitQuestEvent(playerId: EntityId, event: QuestEvent): void {
    for (const questId of checkExpiredQuests(playerId)) {
        const state = getPlayerQuestState(playerId, questId);
        const objective = state?.objectives[0];
        if (objective && state) notifyProgress(playerId, questId, objective.id, state);
    }

    for (const listener of questEventListeners) {
        try {
            listener(playerId, event);
        } catch {
            // Isolated listener errors must never break gameplay systems.
        }
    }

    for (const quest of getPlayerActiveQuests(playerId)) {
        const definition = getQuestDefinition(quest.questId);
        if (!definition) continue;

        for (const objective of quest.objectives) {
            if (objective.currentAmount >= objective.requiredAmount) continue;
            const amount = getObjectiveProgressAmount(objective, event, definition.zoneRestriction);
            if (amount <= 0) continue;

            const result = updateObjectiveProgress(playerId, quest.questId, objective.id, amount);
            notifyProgress(playerId, quest.questId, objective.id, result.newState);
            if (result.questCompleted) notifyCompletion(playerId, quest.questId);
        }
    }

}

export function onQuestEvent(listener: QuestEventListener): () => void {
    questEventListeners.add(listener);
    return () => questEventListeners.delete(listener);
}

export function onQuestProgress(callback: QuestProgressCallback): () => void {
    questProgressCallbacks.add(callback);
    return () => questProgressCallbacks.delete(callback);
}

export function onQuestCompletion(callback: QuestCompletionCallback): () => void {
    questCompletionCallbacks.add(callback);
    return () => questCompletionCallbacks.delete(callback);
}

function sameId(left: unknown, right: unknown): boolean {
    return left !== undefined && right !== undefined && String(left) === String(right);
}

function sameName(left: string | undefined, right: string | undefined): boolean {
    return Boolean(left && right && left.trim().toLocaleLowerCase("es") === right.trim().toLocaleLowerCase("es"));
}

function getObjectiveProgressAmount(
    objective: QuestObjective,
    event: QuestEvent,
    zoneRestriction?: number[],
): number {
    switch (event.type) {
        case "npc_killed":
            return objective.type === "kill_npc" &&
                (!zoneRestriction?.length || zoneRestriction.includes(event.map)) &&
                (sameName(objective.targetName, event.npcName) ||
                    (!objective.targetName &&
                        (sameId(objective.targetId, event.npcId) || sameId(objective.targetId, event.npcType) ||
                            sameId(objective.targetId, event.npcTemplateId)))) ? 1 : 0;
        case "item_collected":
            return objective.type === "collect_item" && sameId(objective.targetId, event.itemId)
                ? Math.max(0, event.amount) : 0;
        case "npc_interacted":
            return objective.type === "talk_to_npc" &&
                (sameName(objective.targetName, event.npcName) ||
                    (!objective.targetName &&
                        (sameId(objective.targetId, event.npcId) || sameId(objective.targetId, event.npcType) ||
                            sameId(objective.targetId, event.npcTemplateId)))) ? 1 : 0;
        case "location_reached":
            return objective.type === "reach_location" &&
                (!zoneRestriction?.length || zoneRestriction.includes(event.map)) &&
                (objective.targetPosition
                    ? objective.targetPosition.map === event.map &&
                      Math.hypot(event.pos.x - objective.targetPosition.x, event.pos.y - objective.targetPosition.y) <=
                          (objective.targetPosition.radius ?? 2)
                    : !objective.targetId || sameId(objective.targetId, event.map)) ? 1 : 0;
        case "player_killed":
            return objective.type === "kill_player" &&
                (!objective.targetId || sameId(objective.targetId, event.victimId)) ? 1 : 0;
        case "item_crafted":
            return objective.type === "craft_item" && sameId(objective.targetId, event.itemId)
                ? Math.max(0, event.amount) : 0;
        case "item_used":
            return objective.type === "use_item" && sameId(objective.targetId, event.itemId) ? 1 : 0;
        case "spell_cast":
            return objective.type === "spell_cast" && sameId(objective.targetId, event.spellId) ? 1 : 0;
        case "damage_dealt":
            return objective.type === "deal_damage" &&
                (!objective.targetId || sameId(objective.targetId, event.targetId))
                ? Math.max(0, event.damage) : 0;
        case "damage_taken":
            return objective.type === "take_damage" &&
                (!objective.targetId || sameId(objective.targetId, event.sourceId))
                ? Math.max(0, event.damage) : 0;
        case "level_up":
            return objective.type === "reach_level" && event.newLevel >= Number(objective.targetId ?? 0) ? 1 : 0;
        case "quest_turned_in":
            return 0;
    }
}

function notifyProgress(
    playerId: EntityId,
    questId: string,
    objectiveId: string,
    state: { objectives: Array<{ id: string; currentAmount: number; requiredAmount: number }> } | undefined,
): void {
    const objective = state?.objectives.find((obj) => obj.id === objectiveId);
    if (!objective) {
        return;
    }

    for (const callback of questProgressCallbacks) {
        try {
            callback(playerId, questId, objectiveId, objective.currentAmount);
        } catch {
            // Isolated callback errors must never break gameplay systems.
        }
    }
}

function notifyCompletion(playerId: EntityId, questId: string): void {
    for (const callback of questCompletionCallbacks) {
        try {
            callback(playerId, questId);
        } catch {
            // Isolated callback errors must never break gameplay systems.
        }
    }
}

export function isQuestEligibleForProgress(playerId: EntityId, questId: string): boolean {
    return isQuestActive(playerId, questId);
}
