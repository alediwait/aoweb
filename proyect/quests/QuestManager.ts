// proyect/quests/QuestManager.ts

import * as fs from 'fs';
import * as path from 'path';
import { PlayerState, applyRewards, savePlayerState } from '../PlayerState';

/**
 * Defines the structure for a single quest.
 * @typedef {object} QuestDefinition
 * @property {string} id - Unique identifier for the quest.
 * @property {string} title - Display title of the quest.
 * @property {string} description - Detailed description shown to the player.
 * @property {string[]} [prerequisites] - Array of quest IDs that must be completed first.
 * @property {{xp: number, item_id: string}|{xp: number, gold: number}} reward - Rewards upon completion.
 * @property {string} questGiverNpcId - ID of the NPC that gives this quest.
 */

/**
 * The index containing all defined quests.
 * @typedef {QuestDefinition[]} QuestDefinitions
 */

const QUESTS_FILE_PATH = path.join(__dirname, '../data/quests.json');

/**
 * @type {QuestDefinitions} The loaded quest database.
 */
let questDatabase = [];

/**
 * Loads the quest definitions from the JSON file.
 * This function should be called once at application startup.
 * @returns {boolean} True if quests were loaded successfully, false otherwise.
 */
export function loadQuestData() {
    try {
        const data = fs.readFileSync(QUESTS_FILE_PATH, 'utf-8');
        questDatabase = JSON.parse(data);
        console.log(`[QuestManager] Successfully loaded ${questDatabase.length} quests.`);
        return true;
    } catch (error) {
        console.error("[QuestManager] Error loading quest data:", error);
        questDatabase = [];
        return false;
    }
}

/**
 * Retrieves a quest by its unique ID.
 * @param {string} questId - The ID of the quest to retrieve.
 * @returns {QuestDefinition | undefined} The quest definition or undefined if not found.
 */
export function getQuestById(questId) {
    return questDatabase.find(q => q.id === questId);
}

/**
 * Finds all available quests for a specific NPC.
 * @param {string} npcId - The ID of the NPC.
 * @returns {QuestDefinition[]} An array of quest definitions given by the NPC.
 */
export function getQuestsByNpc(npcId) {
    return questDatabase.filter(q => q.questGiverNpcId === npcId);
}

/**
 * Updates the player's quest status and persists changes to the PlayerState.
 * @param {string} playerId - The ID of the player.
 * @param {string} questId - The ID of the quest being updated.
 * @param {'ACTIVE' | 'COMPLETED' | 'FAILED'} status - The new status.
 * @param {PlayerState} playerState - The player's current state object.
 */
export function setQuestStatus(playerId: string, questId: string, status: 'ACTIVE' | 'COMPLETED' | 'FAILED', playerState: PlayerState) {
    playerState.quests.set(questId, status);
    console.log(`[QuestManager] Player ${playerId} updated status for quest ${questId} to ${status}.`);
    savePlayerState(playerState);
}

/**
 * Completes a quest, awarding rewards and updating the player's state.
 * @param {string} playerId - The ID of the player.
 * @param {string} questId - The ID of the quest to complete.
 * @param {PlayerState} playerState - The player's current state object.
 * @returns {boolean} True if the quest was successfully completed and rewards applied, false otherwise.
 */
export function completeQuest(playerId: string, questId: string, playerState: PlayerState): boolean {
    const quest = getQuestById(questId);

    if (!quest) {
        console.error(`[QuestManager] Cannot complete quest: Quest ID ${questId} not found.`);
        return false;
    }

    if (playerState.quests.get(questId) !== 'ACTIVE') {
        console.warn(`[QuestManager] Cannot complete quest: Quest ${questId} is not active. Current status: ${playerState.quests.get(questId)}`);
        return false;
    }

    console.log(`[QuestManager] Beginning completion sequence for: ${quest.title}`);

    // 1. Apply Rewards
    const rewards = quest.reward;
    if (!applyRewards(playerState, rewards)) {
        console.error("[QuestManager] Failed to apply rewards.");
        return false;
    }

    // 2. Update Status
    setQuestStatus(playerId, questId, 'COMPLETED', playerState);
    
    console.log(`[QuestManager] Quest ${quest.title} completed successfully!`);
    return true;
}