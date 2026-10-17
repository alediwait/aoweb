# Basic State Tracking Implementation Plan

The goal is to securely link player actions (like completing a quest or interacting with an item) to persistent changes in the player's state.

## 1. Player Data Model (REQUIRED CORE CHANGE)

Before tracking anything, you need a central, persistent place to store player data.

*   **Action:** Create or modify a `Player.ts` or `GameState.ts` file. (If this module doesn't exist, it must be created.)
*   **Content:** Define a class or interface `PlayerState` that holds:
    *   `id: string` (User's unique ID)
    *   `inventory: Map<string, number>` (Item ID -> Quantity)
    *   `quests: Map<string, 'ACTIVE' | 'COMPLETED' | 'FAILED'>` (Quest ID -> Status)
    *   `experience: number`
    *   `gold: number`
*   **Functionality:** Implement `loadPlayerState(playerId: string)` and `savePlayerState(state: PlayerState)` to handle persistence (e.g., saving to a database or local file).

## 2. Updating `QuestManager.ts` (The Source of Truth)

The quest manager needs access to and the ability to modify the player's state.

*   **Dependency:** Import or accept the `PlayerState` object/service into `QuestManager.ts`.
*   **Function Changes:**
    *   Rename `saveQuestProgress` to `setQuestStatus(playerId, questId, status)` and make it accept the `PlayerState` object.
    *   Add a new function: `completeQuest(playerId: string, questId: string)`:
        *   Checks if the quest is marked 'ACTIVE'.
        *   Calculates rewards using `getQuestById()`.
        *   Calls a new `PlayerState.applyRewards(rewards)` method (see step 3).
        *   Updates the player's state: `quests.set(questId, 'COMPLETED')` and calls `savePlayerState()`.

## 3. Implementing Reward Logic (The Core Mechanic)

This logic should live either in `QuestManager.ts` or a new `RewardSystem.ts` utility class to keep it clean.

*   **New Function:** `applyRewards(state: PlayerState, rewards: {xp: number, item_id?: string, gold?: number})`
*   **Logic:**
    *   **XP:** `state.experience += rewards.xp`.
    *   **Gold:** `state.gold = (state.gold || 0) + (rewards.gold || 0)`.
    *   **Items:** If `rewards.item_id` exists:
        *   Check the `PlayerState.inventory`.
        *   Increment the quantity for `rewards.item_id`.
        *   If the item does not exist, initialize it with a count of 1.
*   **Persistence:** Call `savePlayerState(state)` at the end of the reward application.

## 4. Updating `NPCQuestGiver.ts` (The Trigger)

The NPC interaction needs to utilize the full cycle.

*   **Update `interactWithNpc()`:**
    1.  **On Quest Acceptance (New):** When setting quest status to 'ACTIVE', the system must ensure the player is assigned or initialized with a unique `playerState` object.
    2.  **On Quest Completion (Primary):** When the player triggers the completion (e.g., talking to a reward NPC or completing a quest objective):
        *   Call `QuestManager.completeQuest(playerId, questId)`.
        *   The `interactWithNpc` function should now handle the final message and state change.

### Summary Flow for Quest Completion:

1.  **Player Action:** Player fulfills objective and talks to a designated 'Reward' NPC (or finds a waypoint).
2.  **Call System:** `interactWithNpc(RewardNpcId, playerId)` is called.
3.  **QuestManager:** Determines the active quest via `getQuestById()`.
4.  **Completes:** Calls `completeQuest(playerId, questId)` within `QuestManager`.
5.  **Reward System:** `completeQuest` calls `applyRewards(...)`.
6.  **State Update:** `applyRewards` updates `PlayerState` (inventory, gold, xp).
7.  **Persistence:** `PlayerState` is saved using `savePlayerState()`.




How to Implement Usage in Your Main Game Loop
Since this is a multi-module change, the primary change to your existing game logic will be how you initialize and pass the player's state object (PlayerState) to these functions.

Here is the conceptual flow you must follow in your main game loop or initialization file:

1. Initialization (Before Game Start):

// 1. Get/Initialize Player State
const PLAYER_ID = "unique_player_id_123"; 
let currentPlayerState = loadPlayerState(PLAYER_ID); // Load from DB/file
// If loadPlayerState failed or returned empty, you might need to initialize it:
if (!currentPlayerState) {
    currentPlayerState = createInitialPlayerState(PLAYER_ID);
}

// 2. Load Quest Data
loadQuestData(); // In QuestManager.ts
2. Player Interaction (Talking to an NPC):

// When player talks to an NPC (e.g., N001)
const NPC_ID = "N001";
const interactionMessage = interactWithNpc(NPC_ID, PLAYER_ID, currentPlayerState);
displayMessage(interactionMessage);

// !!! IMPORTANT: If state was modified, save it !!!
savePlayerState(currentPlayerState); 
3. Quest Completion (Triggered by Player):

// When player achieves the objective and talks to the reward giver
const QUEST_TO_COMPLETE = "tutorial_001";
const completionMessage = completeQuestInteraction(PLAYER_ID, QUEST_TO_COMPLETE, currentPlayerState);
displayMessage(completionMessage);

// !!! IMPORTANT: If state was modified, save it !!!
savePlayerState(currentPlayerState); 
This robust structure achieves the goal of minimal necessary change—you simply swap out old simple function calls for calls that manage and pass the PlayerState object.

Let me know if you want to tackle the next step: integrating database persistence or defining a simple starting file to demonstrate all these calls working together!