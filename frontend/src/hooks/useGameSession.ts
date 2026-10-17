
// frontend/src/hooks/useGameSession.ts

import { useEffect, useState, useCallback } from 'react';
import { usePixiContext } from '../utils/usePixiContext'; // Assumptions: Context hook for Pixi engine
// Assuming the WebSocket URI is configured globally or passed in.
const WS_URL = "ws://localhost:7666";

/**
 * Custom hook to centralize WebSocket connection, message processing, and state management
 * based on authoritative server events.
 * @returns {Object} An object containing the current game state and state update handlers.
 */
export const useGameSession = () => {
    const [gameState, setGameState] = useState({
        characters: {},
        statusEffects: {}, // { charId: [{type: 'BURN', remaining: 5, value: 5}] }
        lastcombatResult: null, // {damage: 120, statusEffects: [...], ...}
        isDespawning: false, // For the 'death' state
    });
    
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        let ws;
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log("WebSocket connected successfully to the Game Server.");
            setIsConnected(true);
            // Optionally send initial authentication payload here
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            // The server must broadcast a standardized 'EVENT' type packet.
            switch (data.type) {
                case 'STATE_UPDATE':
                    // General position updates handled by a dedicated state reducer/logic.
                    setGameState(prev => ({ ...prev, characters: data.characters }));
                    break;
                case 'COMBAT_EVENT':
                    // Primary handler for damage, status, and combat messages.
                    handleCombatEvent(data.combatPayload);
                    break;
                case 'EVENT_DEATH_IMMINENT':
                    // Handles the 'shout' requirement (visual/audio alert)
                    console.warn(`🚨 GUI ALERT: ${data.npcId} is critically low on health! Show shout.`);
                    setGameState(prev => ({ ...prev, isDespawning: true, lastcombatResult: data }));
                    // Trigger local alert system here (e.g., a loud UI notification)
                    break;
                default:
                    console.log("Received unknown server event:", data.type);
            }
        };

        ws.onclose = (event) => {
            console.warn(`WebSocket disconnected. Code: ${event.code}`);
            setIsConnected(false);
            setGameState(prev => ({ ...prev, isDespawning: false, lastcombatResult: null }));
        };

        // Cleanup function
        return () => {
            ws.close();
        };
    }, []);

    /**
     * Processes the incoming combat data packet from the server.
     * @param payload The detailed combat outcome data.
     */
    const handleCombatEvent = useCallback((payload: {damage: number, message: string, statusEffects: Array<any>}) => {
        // 1. Update global combat state
        setGameState(prev => ({ 
            ...prev, 
            lastcombatResult: { damage: payload.damage, statusEffects: payload.statusEffects, message: payload.message }
        }));

        // 2. Update status effect tracking (DoTs/HoTs handled here)
        const newStatusEffects = { ...gameState.statusEffects };
        const targetId = payload.targetId; // Assuming the server includes this
        
        if (targetId) {
           // Logic to merge new status effects onto existing ones, updating duration/value.
           console.log(`[Client] Processing ${payload.statusEffects.length} status effects.`);
        }
    }, [gameState.statusEffects]);


    return {
        gameState,
        isConnected,
        handleCombatEvent // Expose the handler for component consumption
    };
};
