import type { EntityId } from "../types/runtime";
import type {
    PlayerQuestState,
    QuestDefinition,
    QuestEvent,
    QuestObjective,
    QuestReward,
    QuestStatus,
} from "./questTypes";
import { emitQuestEvent, onQuestCompletion, onQuestEvent, onQuestProgress } from "./questEvents";
import {
    abandonQuest,
    canStartQuest,
    checkExpiredQuests,
    completeQuest,
    failQuest,
    getPlayerActiveQuests,
    getPlayerCompletedQuests,
    getPlayerQuestState,
    getPlayerQuests,
    getPlayerTurnedInQuestIds,
    getQuestProgress,
    getSerializableQuestState,
    isQuestActive,
    isQuestCompleted,
    isQuestTurnedIn,
    resetAllQuestsForPlayer,
    restorePlayerQuests,
    resetQuest,
    startQuest,
    turnInQuest,
    updateObjectiveProgress,
} from "./questTracker";
import {
    getAllQuestDefinitions,
    getAvailableQuestsForLevel,
    getQuestDefinition,
    getQuestsByStartNpc,
    isQuestRegistered,
    reloadQuestDefinitions,
} from "./questRegistry";

export type QuestsApi = {
    // Quest definitions
    getQuestDefinition: (questId: string) => QuestDefinition | undefined;
    getAllQuestDefinitions: () => QuestDefinition[];
    getAvailableQuestsForLevel: (level: number) => QuestDefinition[];
    getQuestsByStartNpc: (npcId: number) => QuestDefinition[];
    isQuestRegistered: (questId: string) => boolean;
    reloadQuestDefinitions: (definitions: QuestDefinition[]) => void;

    // Player quest state
    getPlayerQuestState: (playerId: EntityId, questId: string) => PlayerQuestState | undefined;
    getPlayerQuests: (playerId: EntityId) => PlayerQuestState[];
    getPlayerActiveQuests: (playerId: EntityId) => PlayerQuestState[];
    getPlayerCompletedQuests: (playerId: EntityId) => PlayerQuestState[];
    getPlayerTurnedInQuestIds: (playerId: EntityId) => string[];
    getSerializableQuestState: (playerId: EntityId) => PlayerQuestState[];
    getQuestProgress: (
        playerId: EntityId,
        questId: string,
    ) => { current: number; required: number; percentage: number } | undefined;

    // Quest lifecycle
    canStartQuest: (playerId: EntityId, questId: string, playerLevel: number) => boolean;
    startQuest: (playerId: EntityId, questId: string) => PlayerQuestState | undefined;
    completeQuest: (playerId: EntityId, questId: string) => PlayerQuestState | undefined;
    turnInQuest: (playerId: EntityId, questId: string) => PlayerQuestState | undefined;
    failQuest: (playerId: EntityId, questId: string) => PlayerQuestState | undefined;
    abandonQuest: (playerId: EntityId, questId: string) => boolean;
    resetQuest: (playerId: EntityId, questId: string) => boolean;
    resetAllQuestsForPlayer: (playerId: EntityId) => void;
    restorePlayerQuests: (playerId: EntityId, states: PlayerQuestState[]) => void;

    // Quest status checks
    isQuestActive: (playerId: EntityId, questId: string) => boolean;
    isQuestCompleted: (playerId: EntityId, questId: string) => boolean;
    isQuestTurnedIn: (playerId: EntityId, questId: string) => boolean;

    // Quest progression
    updateObjectiveProgress: (
        playerId: EntityId,
        questId: string,
        objectiveId: string,
        progressAmount: number,
    ) => { newState: PlayerQuestState | undefined; objectiveCompleted: boolean; questCompleted: boolean };
    checkExpiredQuests: (playerId: EntityId) => string[];

    // Event system
    emitQuestEvent: (playerId: EntityId, event: QuestEvent) => void;
    onQuestEvent: (listener: (playerId: EntityId, event: QuestEvent) => void) => () => void;
    onQuestProgress: (
        callback: (playerId: EntityId, questId: string, objectiveId: string, newAmount: number) => void,
    ) => () => void;
    onQuestCompletion: (callback: (playerId: EntityId, questId: string) => void) => () => void;
};

const quests = {} as QuestsApi;

quests.getQuestDefinition = getQuestDefinition;
quests.getAllQuestDefinitions = getAllQuestDefinitions;
quests.getAvailableQuestsForLevel = getAvailableQuestsForLevel;
quests.getQuestsByStartNpc = getQuestsByStartNpc;
quests.isQuestRegistered = isQuestRegistered;
quests.reloadQuestDefinitions = reloadQuestDefinitions;

quests.getPlayerQuestState = getPlayerQuestState;
quests.getPlayerQuests = getPlayerQuests;
quests.getPlayerActiveQuests = getPlayerActiveQuests;
quests.getPlayerCompletedQuests = getPlayerCompletedQuests;
quests.getPlayerTurnedInQuestIds = getPlayerTurnedInQuestIds;
quests.getSerializableQuestState = getSerializableQuestState;
quests.getQuestProgress = getQuestProgress;

quests.canStartQuest = canStartQuest;
quests.startQuest = startQuest;
quests.completeQuest = completeQuest;
quests.turnInQuest = turnInQuest;
quests.failQuest = failQuest;
quests.abandonQuest = abandonQuest;
quests.resetQuest = resetQuest;
quests.resetAllQuestsForPlayer = resetAllQuestsForPlayer;
quests.restorePlayerQuests = restorePlayerQuests;

quests.isQuestActive = isQuestActive;
quests.isQuestCompleted = isQuestCompleted;
quests.isQuestTurnedIn = isQuestTurnedIn;

quests.updateObjectiveProgress = updateObjectiveProgress;
quests.checkExpiredQuests = checkExpiredQuests;

quests.emitQuestEvent = emitQuestEvent;
quests.onQuestEvent = onQuestEvent;
quests.onQuestProgress = onQuestProgress;
quests.onQuestCompletion = onQuestCompletion;

export type { PlayerQuestState, QuestDefinition, QuestEvent, QuestObjective, QuestReward, QuestStatus };

export default quests;
