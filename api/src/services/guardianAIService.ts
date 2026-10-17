
// server/services/guardianAIService.ts

import { ZoneRepository } from '../repositories/zoneRepository';
import { Database } from '../config/database';
import { CombatService } from './combatService'; // Import the new combat service

/**
 * Central service for Guardian AI patrols and threat assessments.
 * This logic runs periodically on the backend (server/game loop).
 */
export class GuardianAIService {
    private zoneRepo: ZoneRepository;
    private db: Database;

    constructor(databaseClient: Database) {
        this.db = databaseClient;
        this.zoneRepo = new ZoneRepository(databaseClient);
    }

    /**
     * Main patrol loop function. Should be called every game tick.
     * @param activeCoordinates List of all physical entity locations (e.g., [{id: 'char1', x: 10, y: 5}, ...]).
     * @returns {Array<string>} List of unique IDs of NPCs/Guardians that have acted.
     */
    async processPatrol(activeCoordinates: Array<{id: string, x: number, y: number}>): Promise<Array<string>> {
        const activatedEntities: Array<string> = [];

        // 1. Get all protected zones (loading the area definitions).
        const zones = await this.zoneRepo.loadActiveZones();
        
        if (zones.length === 0) {
            console.warn("[Guardian AI] No active city zones found. Skipping patrol check.");
            return [];
        }

        // 2. Iterate through every monitored coordinate to determine current zone.
        for (const coord of activeCoordinates) {
            // Check if the entity's location is inside any protected city zone.
            const cityName = await this.zoneRepo.isCoordinateInZone(coord.x, coord.y);

            if (cityName) {
                // Triggers Guardian logic for this area.
                await this._checkForThreatsInZone(coord.id, cityName, activeCoordinates);
            }
        }

        return activeCoordinates.map(c => c.id).filter(id => {
            // Logic to filter activated entities
            return activatedEntities.includes(id); 
        });
    }

    /**
     * Checks a designated area for hostile entities and triggers engagement if found.
     * @param coordinatorId ID of the entity in the zone (e.g., a city marker or persistent guardian).
     * @param cityName The name of the city.
     * @param allEntities List of all entity coordinates.
     */
    private async _checkForThreatsInZone(coordinatorId: string, cityName: string, allEntities: Array<{id: string, x: number, y: number}>): Promise<void> {
        const hostileEntities = allEntities.filter(entity => {
            // Complex logic check: Is the entity hostile and NOT a friendly NPC/City Guard?
            return !['FRIENDLY', 'CITY_GUARD'].includes(entity.type); 
        });

        if (hostileEntities.length > 0) {
            console.error(`🚨 [WARNING] Threat detected in ${cityName} near entity ${coordinatorId}! Engaging ${hostileEntities.length} hostiles.`);
            
            for (const hostile of hostileEntities) {
                // EXECUTE COMBAT: Use the central CombatService authority.
                await this.executeAttackSimulation(coordinatorId, hostile.id);
            }
        }
    }

    /**
     * Simulates the attack sequence, which must use the core combat engine.
     */
    async executeAttackSimulation(attackerId: string, targetId: string) {
        // It's crucial to pass null for spellId if it's a physical attack (melee)
        // or pass a defined ID if it's a ranged spell.
        const result = await CombatService.resolveCombat(attackerId, targetId, null);
        
        if (result.success) {
            console.log(`[CombatSystem] Guardian ${attackerId} attacked ${targetId}. Result: ${result.message}`);
        } else {
            console.warn(`[CombatSystem] Guardian ${attackerId} failed to attack ${targetId}. Reason: ${result.message}`);
        }
    }
}