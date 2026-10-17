
// api/src/services/characterService.ts

import { SpellRepository } from '../repositories/spellRepository';
import { ZoneRepository } from '../repositories/zoneRepository';
import { CombatService } from '../../server/services/combatService'; // Import the Combat Service

/**
 * Central service for character state management, coordinating spell and zone checks.
 */
export class CharacterService {
    private spellRepo: SpellRepository;
    private zoneRepo: ZoneRepository;

    constructor(spellRepo: SpellRepository, zoneRepo: ZoneRepository) {
        this.spellRepo = spellRepo;
        this.zoneRepo = zoneRepo;
    }

    /**
     * Main function for handling character actions.
     * @param charId The ID of the character making the move/action.
     * @param actionPayload A JSON object describing the action (e.g., {type: 'attack', spellId: 5} or {type: 'move'}).
     */
    async handleCharacterAction(charId: string, actionPayload: any): Promise<any> {
        if (actionPayload.type === 'CAST_SPELL') {
            const spellId = actionPayload.spellId;
            
            // 1. Check Spell Eligibility (Mana/Cooldowns)
            const successful = await this.spellRepo.canCastSpell(charId, spellId);
            if (!successful) {
                return { success: false, message: "Cannot afford or cooldown on this spell." };
            }

            // 2. EXECUTE COMBAT & Update State
            // Use the CombatService to determine success/damage first.
            const combatResult = await CombatService.resolveCombat(charId, 'N/A', spellId); 
            
            if (combatResult.success) {
                // Only update the persistence layer (mana/cooldowns) if the combat was successful.
                await this.spellRepo.applySpellEffect(charId, spellId, actionPayload.mana_cost);
                // Broadcast the final success message
                return { success: true, message: `Spell cast successful! ${combatResult.message}` };
            } else {
                return { success: false, message: `Combat failed: ${combatResult.message}` };
            }
        } 
        
        // --- Added City Zone Awareness (Triggers Guardian monitoring) ---
        // When a character moves, check if they are entering or remaining in a protected zone.
        const currentLoc = actionPayload.location || {x: 0, y: 0};
        const zoneName = await this.zoneRepo.isCoordinateInZone(currentLoc.x, currentLoc.y);
        
        if (zoneName) {
            console.log(`[CharacterService] Character ${charId} is in protected city zone: ${zoneName}. Guardian alerted.`);
        }

        // Add handling for other actions like 'MOVE' or 'INTERACT'
        return { success: true, message: "Action processed." };
    }
}