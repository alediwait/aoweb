import type { EntityId } from "../types/runtime";
import type { QuestEvent, QuestProgressCallback, QuestCompletionCallback } from "./questTypes";
import { getQuestDefinition } from "./questRegistry";
import { isQuestActive, updateObjectiveProgress, checkExpiredQuests, getPlayerActiveQuests } from "./questTracker";

type QuestEventListener = (playerId: EntityId, event: QuestEvent) => void;

const questEventListeners = new Set<QuestEventListener>();
const questProgressCallbacks = new Set<QuestProgressCallback>();
const questCompletionCallbacks = new Set<QuestCompletionCallback>();

export function emitQuestEvent(playerId: EntityId, event: QuestEvent): void {
    for (const listener of questEventListeners) {
        try {
            listener(playerId, event);
        } catch {
            // Isolated listener errors must never break gameplay systems.
        }
    }

    switch (event.type) {
        case "npc_killed":
            handleKillNpcEvent(playerId, event.npcId, event.npcType);
            break;
        case "item_collected":
            handleItemEvent(playerId, event.itemId, event.amount);
            break;
        case "npc_interacted":
            handleNpcInteractionEvent(playerId, event.npcId, event.npcType);
            break;
        case "location_reached":
            handleLocationReachedEvent(playerId, event.map, event.pos.x, event.pos.y);
            break;
        case "player_killed":
            handlePlayerKilledEvent(playerId);
            break;
        case "item_crafted":
            handleItemEvent(playerId, event.itemId, event.amount);
            break;
        default:
            break;
    }

    checkExpiredQuests(playerId);
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

function handleKillNpcEvent(playerId: EntityId, npcId: EntityId, npcType: number): void {
    for (const quest of getPlayerActiveQuests(playerId)) {
        const definition = getQuestDefinition(quest.questId);
        if (!definition) {
            continue;
        }

        const objective = quest.objectives.find(
            (obj) =>
                obj.type === "kill_npc" &&
                (obj.targetId === npcId || obj.targetId === npcType) &&
                obj.currentAmount < obj.requiredAmount,
        );

        if (!objective) {
            continue;
        }

        const result = updateObjectiveProgress(playerId, quest.questId, objective.id, 1);
        notifyProgress(playerId, quest.questId, objective.id, result.newState);
        if (result.questCompleted) {
            notifyCompletion(playerId, quest.questId);
        }
    }
}

function handleItemEvent(playerId: EntityId, itemId: number, amount: number): void {
    for (const quest of getPlayerActiveQuests(playerId)) {
        const objective = quest.objectives.find(
            (obj) =>
                (obj.type === "collect_item" || obj.type === "craft_item") &&
                obj.targetId === itemId &&
                obj.currentAmount < obj.requiredAmount,
        );

        if (!objective) {
            continue;
        }

        const result = updateObjectiveProgress(playerId, quest.questId, objective.id, amount);
        notifyProgress(playerId, quest.questId, objective.id, result.newState);
        if (result.questCompleted) {
            notifyCompletion(playerId, quest.questId);
        }
    }
}

function handleNpcInteractionEvent(playerId: EntityId, npcId: EntityId, npcType: number): void {
    for (const quest of getPlayerActiveQuests(playerId)) {
        const objective = quest.objectives.find(
            (obj) =>
                obj.type === "talk_to_npc" &&
                (obj.targetId === npcId || obj.targetId === npcType) &&
                obj.currentAmount < obj.requiredAmount,
        );

        if (!objective) {
            continue;
        }

        const result = updateObjectiveProgress(playerId, quest.questId, objective.id, 1);
        notifyProgress(playerId, quest.questId, objective.id, result.newState);
        if (result.questCompleted) {
            notifyCompletion(playerId, quest.questId);
        }
    }
}

function handleLocationReachedEvent(playerId: EntityId, map: number, x: number, y: number): void {
    for (const quest of getPlayerActiveQuests(playerId)) {
        const definition = getQuestDefinition(quest.questId);
        if (!definition) {
            continue;
        }

        if (definition.zoneRestriction && !definition.zoneRestriction.includes(map)) {
            continue;
        }

        const objective = quest.objectives.find(
            (obj) => obj.type === "reach_location" && obj.currentAmount < obj.requiredAmount,
        );

        if (!objective) {
            continue;
        }

        const result = updateObjectiveProgress(playerId, quest.questId, objective.id, 1);
        notifyProgress(playerId, quest.questId, objective.id, result.newState);
        if (result.questCompleted) {
            notifyCompletion(playerId, quest.questId);
        }
    }
}

function handlePlayerKilledEvent(playerId: EntityId): void {
    for (const quest of getPlayerActiveQuests(playerId)) {
        const objective = quest.objectives.find(
            (obj) => obj.type === "kill_player" && obj.currentAmount < obj.requiredAmount,
        );

        if (!objective) {
            continue;
        }

        const result = updateObjectiveProgress(playerId, quest.questId, objective.id, 1);
        notifyProgress(playerId, quest.questId, objective.id, result.newState);
        if (result.questCompleted) {
            notifyCompletion(playerId, quest.questId);
        }
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
