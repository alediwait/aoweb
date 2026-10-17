// proyect/PlayerState.ts

/**
 * Defines the structure for a player's persisted state.
 */
export interface PlayerState {
    id: string;
    inventory: Map<string, number>; // Item ID -> Quantity
    quests: Map<string, 'ACTIVE' | 'COMPLETED' | 'FAILED'>; // Quest ID -> Status
    experience: number;
    gold: number;
}

/**
 * Initializes a new player state.
 * @param playerId Unique ID of the player.
 * @returns A newly instantiated PlayerState object.
 */
export function createInitialPlayerState(playerId: string): PlayerState {
    return {
        id: playerId,
        inventory: new Map<string, number>(),
        quests: new Map<string, 'ACTIVE' | 'COMPLETED' | 'FAILED'>(),
        experience: 0,
        gold: 0,
    };
}

/**
 * Loads the player state from persistence (Database/File).
 * NOTE: This is a placeholder. A real game would interface with a database or file system here.
 * @param playerId The player's ID.
 * @returns The loaded state, or a newly created default state if none is found.
 */
export function loadPlayerState(playerId: string): PlayerState {
    console.log(`[PlayerState] Attempting to load state for player ${playerId}...`);
    // TODO: Implement database/file loading logic here.
    // For now, we return a fresh state object for demonstration.
    return createInitialPlayerState(playerId);
}

/**
 * Saves the current player state to persistence.
 * @param state The PlayerState object to save.
 * @returns Boolean indicating success.
 */
export function savePlayerState(state: PlayerState): boolean {
    console.log(`[PlayerState] Saving state for player ${state.id}. XP: ${state.experience}, Gold: ${state.gold}.`);
    // TODO: Implement database/file saving logic here.
    return true;
}

/**
 * Applies rewards (XP, Gold, Items) to the player's current state.
 * @param state The state object to modify.
 * @param rewards Object containing rewards.
 * @returns true if rewards were applied, false otherwise.
 */
export function applyRewards(state: PlayerState, rewards: { xp: number, item_id?: string, gold?: number}): boolean {
    // 1. Apply XP
    state.experience = (state.experience || 0) + (rewards.xp || 0);
    
    // 2. Apply Gold
    if (typeof rewards.gold === 'number') {
        state.gold = (state.gold || 0) + rewards.gold;
    }

    // 3. Apply Items
    if (rewards.item_id) {
        let currentCount = state.inventory.get(rewards.item_id) || 0;
        state.inventory.set(rewards.item_id, currentCount + 1);
        console.log(`[PlayerState] Added 1 to ${rewards.item_id}. New count: ${currentCount + 1}`);
    }
    return true;
}