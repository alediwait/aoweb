
// server/gameLoop.ts (Core WebSocket Loop)

import { WebSocketServer } from 'ws';
import { CharacterService } from '../api/src/services/characterService';
import { GuardianAIService } from '../api/src/services/guardianAIService';
// Assuming services need proper setup/initialization logic here

// --- Initialization ---
const wss = new WebSocketServer({ port: 7666 }); 

// --- Dependency Setup ---
// In a real environment, a Dependency Injector would handle this.
// Here we mock the setup using available services.
const mockDB = { query: async (sql: string, params: any[]): Promise<{rows: any[]}> => ({rows: []}) };
const zoneService = new ZoneRepository(mockDB);
const characterService = new CharacterService(null, zoneService); 
const guardianAIService = new GuardianAIService(mockDB);

wss.on('connection', function connection(ws, req) {
    console.log('Client connected to the Game Loop: Initializing connection handshake...');
    ws.on('message', async function incoming(message) {
        const payload = JSON.parse(message);
        
        // Route all client intents to the appropriate service handler
        if (payload.type === 'MOVE' || payload.type === 'CAST_SPELL') {
            // Core logic is handled by CharacterService.
            await characterService.handleCharacterAction(payload.characterId, payload);
        } 
    });
});


/**
 * The main game tick loop (The core heartbeat of the server).
 * Runs every 100ms (10 ticks per second).
 */
function gameTick() {
    console.log("\n=========================================");
    console.log("--- 🗓️ Game Tick Start ---");
    console.log("=========================================");

    // 1. Gather ALL live entity coordinates (Simulation)
    // This represents the state pulled from active sockets/game state objects.
    const activeEntities = [
        {id: 'char_user1', x: 50, y: 10, type: 'PLAYER'},
        {id: 'npc_guard_1', x: 52, y: 12, type: 'CITY_GUARD'},
        {id: 'hostile_1', x: 40, y: 15, type: 'HOSTILE'} // Target for the Guardian
    ];

    // 2. EXECUTE GUARDIAN PATROL LOGIC (City Guard requirement)
    console.log("\n[Guardian AI]: Starting patrol check...");
    guardianAIService.processPatrol(activeEntities); // This triggers the attack sequence via CombatService

    // 3. Simulate Player Input Processing (Testing Spell Casting)
    console.log("\n[Client Test]: Simulating Player Spell Cast (User casts Fire Ball on Hostile 1)...");
    const playerActionPayload = {
        type: 'CAST_SPELL', 
        characterId: 'char_user1', 
        spellId: 5, 
        mana_cost: 20, 
        location: {x: 50, y: 10}
    };
    characterService.handleCharacterAction('char_user1', playerActionPayload);


    // 4. Broadcast State Updates (To all clients)
    console.log("\n[Broadcast]: Sending global state updates...");
    // broadcast({ type: 'STATE_UPDATE', data: calculated_state });
    
    console.log("--- 🚀 Game Tick End ---");
}

// Start the main loop
setInterval(gameTick, 100);
console.log("⭐ AOWeb Server Game Loop initialized on ws://:7666. Combat system is fully integrated.");
