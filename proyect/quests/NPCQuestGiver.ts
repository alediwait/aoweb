// proyect/quests/NPCQuestGiver.ts

import { getQuestByNpc, getQuestsByNpc } from './QuestManager';
import { PlayerState, loadPlayerState, setQuestStatus, completeQuest } from '../PlayerState';

/**
 * Simulates the interaction process when a player talks to an NPC.
 * @param {string} npcId - The unique ID of the NPC (e.g., "N001").
 * @param {string} playerId - The unique ID of the player.
 * @param {PlayerState} playerState - The player's current state.
 * @returns {string} A message string detailing the outcome of the interaction.
 */
export function interactWithNpc(npcId, playerId, playerState) {
    console.log(`[NPCSystem] Player ${playerId} interacts with NPC ${npcId}.`);

    // Ensure state exists (Loading logic should ideally run before this function)
    if (!playerState) {
        console.error("[NPCSystem] !! ERROR: PlayerState not provided. Cannot track progress.");
        return "Error: Game state is unavailable.";
    }

    // 1. Check for potential quests
    const availableQuests = getQuestsByNpc(npcId);

    if (availableQuests.length === 0) {
        return "This NPC has nothing to tell you right now.";
    }

    // 2. Find available quests that are not currently active or completed
    const newQuestsToOffer = availableQuests.filter(quest => {
        const status = playerState.quests.get(quest.id);
        return status !== 'ACTIVE' && status !== 'COMPLETED';
    });


    if (newQuestsToOffer.length > 0) {
        // Offer the first available quest
        const primaryQuest = newQuestsToOffer[0];
        
        // 3. Give Quest (START)
        setQuestStatus(playerId, primaryQuest.id, 'ACTIVE', playerState);
        
        return `The NPC tells you about a quest: "${primaryQuest.title}". ${primaryQuest.description} Take on this challenge for the rewards: ${JSON.stringify(primaryQuest.reward)}.`;
    } else {
        return `You already know about every quest offered by ${npcId}.`;
    }
}

/**
 * Handles the process for a player to complete a quest.
 * @param {string} playerId - The ID of the player.
 * @param {string} questId - The ID of the quest being completed.
 * @param {PlayerState} playerState - The player's current state.
 * @returns {string} Feedback message.
 */
export function completeQuestInteraction(playerId, questId, playerState) {
    const quest = getQuestById(questId);
    if (!quest) {
        return `Cannot complete quest: Quest ID ${questId} not found in the system data.`;
    }
    
    if (!playerState) {
        return "Error: Cannot process completion, player state is missing.";
    }

    // This function wraps the completeQuest logic and provides conversational feedback
    const success = completeQuest(playerId, questId, playerState);

    if (success) {
        return `Congratulations! You completed "${quest.title}" and received rewards!`;
    } else {
        return `You cannot complete "${quest.title}" right now. Check the prerequisites or check your current quest status.`;
    }
}


/**
 * Example usage placeholder: Tiggering an NPC specific quest line.
 * @param {string} triggerNpcId - The NPC who initiates the sequence.
 * @param {PlayerState} playerState - The player's current state.
 */
export function triggerStoryline(triggerNpcId, playerState) {
    console.log(`[QuestSystem] Triggering story events related to ${triggerNpcId} for player ${playerState.id}...`);
    // Add logic here for NPC interactions that progress story segments
}