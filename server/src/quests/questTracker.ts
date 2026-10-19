import type { EntityId } from "../types/runtime";
import type { PlayerQuestState, QuestDefinition, QuestObjective, QuestStatus } from "./questTypes";
import { getQuestDefinition } from "./questRegistry";

const playerQuests = new Map<string, Map<string, PlayerQuestState>>();

function getPlayerQuestMap(playerId: EntityId): Map<string, PlayerQuestState> {
    const key = String(playerId);
    let questMap = playerQuests.get(key);
    if (!questMap) {
        questMap = new Map();
        playerQuests.set(key, questMap);
    }
    return questMap;
}

export function getPlayerQuestState(playerId: EntityId, questId: string): PlayerQuestState | undefined {
    return getPlayerQuestMap(playerId).get(questId);
}

export function getPlayerQuests(playerId: EntityId): PlayerQuestState[] {
    return Array.from(getPlayerQuestMap(playerId).values());
}

export function getPlayerActiveQuests(playerId: EntityId): PlayerQuestState[] {
    return getPlayerQuests(playerId).filter((q) => q.status === "active");
}

export function getPlayerCompletedQuests(playerId: EntityId): PlayerQuestState[] {
    return getPlayerQuests(playerId).filter((q) => q.status === "completed" || q.status === "turned_in");
}

export function getPlayerTurnedInQuestIds(playerId: EntityId): string[] {
    return getPlayerQuests(playerId)
        .filter((q) => q.status === "turned_in")
        .map((q) => q.questId);
}

export function isQuestActive(playerId: EntityId, questId: string): boolean {
    const state = getPlayerQuestState(playerId, questId);
    return state?.status === "active";
}

export function isQuestCompleted(playerId: EntityId, questId: string): boolean {
    const state = getPlayerQuestState(playerId, questId);
    return state?.status === "completed" || state?.status === "turned_in";
}

export function isQuestTurnedIn(playerId: EntityId, questId: string): boolean {
    const state = getPlayerQuestState(playerId, questId);
    return state?.status === "turned_in";
}

export function canStartQuest(playerId: EntityId, questId: string, playerLevel: number): boolean {
    const definition = getQuestDefinition(questId);
    if (!definition) {
        return false;
    }

    if (playerLevel < definition.levelRequirement) {
        return false;
    }

    const existingState = getPlayerQuestState(playerId, questId);
    if (existingState) {
        if (existingState.status === "active") {
            return false;
        }
        if (existingState.status === "turned_in" && !definition.repeatable) {
            return false;
        }
    }

    if (definition.prerequisiteQuestIds) {
        for (const prereqId of definition.prerequisiteQuestIds) {
            if (!isQuestTurnedIn(playerId, prereqId)) {
                return false;
            }
        }
    }

    return true;
}

export function startQuest(playerId: EntityId, questId: string): PlayerQuestState | undefined {
    const definition = getQuestDefinition(questId);
    if (!definition) {
        return undefined;
    }

    const questMap = getPlayerQuestMap(playerId);

    const objectives: QuestObjective[] = definition.objectives.map((obj) => ({
        ...obj,
        currentAmount: 0,
    }));

    const state: PlayerQuestState = {
        questId,
        status: "active",
        objectives,
        startedAt: Date.now(),
        expiresAt: definition.timeLimitMinutes ? Date.now() + definition.timeLimitMinutes * 60 * 1000 : undefined,
    };

    questMap.set(questId, state);
    return state;
}

export function updateObjectiveProgress(
    playerId: EntityId,
    questId: string,
    objectiveId: string,
    progressAmount: number,
): { newState: PlayerQuestState | undefined; objectiveCompleted: boolean; questCompleted: boolean } {
    const state = getPlayerQuestState(playerId, questId);
    if (!state || state.status !== "active") {
        return { newState: undefined, objectiveCompleted: false, questCompleted: false };
    }

    const objective = state.objectives.find((obj) => obj.id === objectiveId);
    if (!objective) {
        return { newState: state, objectiveCompleted: false, questCompleted: false };
    }

    const previousAmount = objective.currentAmount;
    objective.currentAmount = Math.min(objective.requiredAmount, objective.currentAmount + progressAmount);
    const objectiveCompleted = previousAmount < objective.requiredAmount && objective.currentAmount >= objective.requiredAmount;

    const allRequiredObjectivesComplete = state.objectives
        .filter((obj) => !obj.optional)
        .every((obj) => obj.currentAmount >= obj.requiredAmount);

    if (allRequiredObjectivesComplete) {
        state.status = "completed";
        state.completedAt = Date.now();
    }

    return { newState: state, objectiveCompleted, questCompleted: allRequiredObjectivesComplete };
}

export function completeQuest(playerId: EntityId, questId: string): PlayerQuestState | undefined {
    const state = getPlayerQuestState(playerId, questId);
    if (!state || state.status !== "active") {
        return undefined;
    }

    const allRequiredObjectivesComplete = state.objectives
        .filter((obj) => !obj.optional)
        .every((obj) => obj.currentAmount >= obj.requiredAmount);

    if (!allRequiredObjectivesComplete) {
        return undefined;
    }

    state.status = "completed";
    state.completedAt = Date.now();
    return state;
}

export function turnInQuest(playerId: EntityId, questId: string): PlayerQuestState | undefined {
    const state = getPlayerQuestState(playerId, questId);
    if (!state || state.status !== "completed") {
        return undefined;
    }

    state.status = "turned_in";
    state.turnedInAt = Date.now();
    return state;
}

export function failQuest(playerId: EntityId, questId: string): PlayerQuestState | undefined {
    const state = getPlayerQuestState(playerId, questId);
    if (!state || state.status !== "active") {
        return undefined;
    }

    state.status = "failed";
    return state;
}

export function abandonQuest(playerId: EntityId, questId: string): boolean {
    const questMap = getPlayerQuestMap(playerId);
    const state = questMap.get(questId);
    if (!state || state.status !== "active") {
        return false;
    }

    questMap.delete(questId);
    return true;
}

export function resetQuest(playerId: EntityId, questId: string): boolean {
    const questMap = getPlayerQuestMap(playerId);
    const definition = getQuestDefinition(questId);
    if (!definition?.repeatable) {
        return false;
    }

    questMap.delete(questId);
    return true;
}

export function resetAllQuestsForPlayer(playerId: EntityId): void {
    playerQuests.delete(String(playerId));
}

export function restorePlayerQuests(playerId: EntityId, states: PlayerQuestState[]): void {
    const questMap = new Map<string, PlayerQuestState>();
    for (const rawState of states) {
        const definition = getQuestDefinition(rawState.questId);
        if (!definition || !Array.isArray(rawState.objectives)) continue;
        const state: PlayerQuestState = {
            ...rawState,
            startedAt: rawState.startedAt ? new Date(rawState.startedAt).getTime() : undefined,
            expiresAt: rawState.expiresAt ? new Date(rawState.expiresAt).getTime() : undefined,
            completedAt: rawState.completedAt ? new Date(rawState.completedAt).getTime() : undefined,
            turnedInAt: rawState.turnedInAt ? new Date(rawState.turnedInAt).getTime() : undefined,
            objectives: rawState.objectives.map((objective) => ({ ...objective })),
        };
        questMap.set(state.questId, state);
    }
    playerQuests.set(String(playerId), questMap);
}

export function checkExpiredQuests(playerId: EntityId): string[] {
    const questMap = getPlayerQuestMap(playerId);
    const now = Date.now();
    const expiredQuestIds: string[] = [];

    for (const [questId, state] of questMap.entries()) {
        if (state.status === "active" && state.expiresAt && now >= state.expiresAt) {
            state.status = "failed";
            expiredQuestIds.push(questId);
        }
    }

    return expiredQuestIds;
}

export function getQuestProgress(playerId: EntityId, questId: string): { current: number; required: number; percentage: number } | undefined {
    const state = getPlayerQuestState(playerId, questId);
    if (!state) {
        return undefined;
    }

    const definition = getQuestDefinition(questId);
    if (!definition) {
        return undefined;
    }

    const totalRequired = definition.objectives.reduce((sum, obj) => sum + obj.requiredAmount, 0);
    const totalCurrent = state.objectives.reduce((sum, obj) => sum + Math.min(obj.currentAmount, obj.requiredAmount), 0);

    return {
        current: totalCurrent,
        required: totalRequired,
        percentage: totalRequired > 0 ? Math.floor((totalCurrent / totalRequired) * 100) : 0,
    };
}

export function getSerializableQuestState(playerId: EntityId): PlayerQuestState[] {
    return getPlayerQuests(playerId).map((state) => ({
        ...state,
        objectives: state.objectives.map((obj) => ({ ...obj })),
    }));
}
