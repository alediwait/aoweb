import type { EntityId, Position } from "../types/runtime";
import { getCharacterById } from "../runtimeRegistry";
import { getGuardSpells, isInGuardZone } from "./guardAI";
import { canNpcCastSpell, recordSpellCast } from "./npcAI";

const vars = require("../vars");
const getSpellData = require("../loadSpells").getSpellData;

function isValidTarget(targetId: EntityId, targetKind?: "player" | "npc" | null): boolean {
    if (targetKind === "npc") {
        return Number(vars.npcs[targetId]?.hp ?? 0) > 0;
    }
    if (targetKind === "player") {
        const characterTarget = getCharacterById(targetId);
        return Boolean(characterTarget && Number(characterTarget.hp) > 0 && !characterTarget.cerrado);
    }

    return Number(vars.npcs[targetId]?.hp ?? 0) > 0 || Boolean(getCharacterById(targetId));
}

/**
 * Abstract Base Strategy for NPC Behavior
 */
export abstract class NpcBehaviorStrategy {
    abstract tick(npc: any, state: any): void;
    abstract handleAttack(npc: any, state: any, attackerId: EntityId): void;
    abstract selectSpell(npc: any, state: any, target: any): number | undefined;

    protected calculateHeading(pos1: Position, pos2: Position): number {
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        if (Math.abs(dx) > Math.abs(dy)) {
            return dx > 0 ? 1 : 3; // right or left
        } else {
            return dy > 0 ? 0 : 2; // up or down
        }
    }
}

/**
 * Strategy for NPCs that are generally passive (merchants, villagers).
 */
export class PassiveBehavior extends NpcBehaviorStrategy {
    tick(npc: any, state: any): void {
        void npc;
        void state;
        // Passive NPCs just idle - no AI decisions needed
        // Actual movement/combat handled by npcAttackUser
    }

    handleAttack(npc: any, state: any, attackerId: EntityId): void {
        void npc;
        void state;
        void attackerId;
        // Passive NPCs do nothing by default when attacked
    }

    selectSpell(npc: any, state: any, target: any): number | undefined {
        void npc;
        void state;
        void target;
        return undefined;
    }
}

/**
 * Strategy for NPCs that are meant to defend themselves.
 * Used for non-hostile NPCs that fight back when attacked by Hostiles.
 */
export class DefensiveBehavior extends NpcBehaviorStrategy {
    tick(npc: any, state: any): void {
        // Defensive NPCs: AI state updates only
        // Actual combat handled by npcAttackUser
        // This tick can be used for target validation, spell cooldown updates, etc.
        if (state.currentTargetId) {
            if (!isValidTarget(state.currentTargetId, state.currentTargetKind)) {
                // Target dead or invalid, clear target
                state.currentTargetId = null;
                state.currentTargetKind = null;
                state.lastAttackerId = null;
            }
        }
    }

    handleAttack(npc: any, state: any, attackerId: EntityId): void {
        void npc;
        const attacker = vars.npcs[attackerId];
        // If attacked by a hostile NPC (monster/hostile), enter a defensive stance
        // npcType 0 = comun (monsters), 6 = dragon
        if (attacker && (attacker.npcType === 0 || attacker.npcType === 6)) {
            state.currentTargetId = attackerId;
            state.currentTargetKind = "npc";
            state.lastAttackerId = attackerId;
            state.lastAttackAt = Date.now();
        }
    }

    selectSpell(npc: any, state: any, target: any): number | undefined {
        void state;
        void target;
        // Defensive NPCs can use spells if they have them
        const now = Date.now();
        const availableSpells = (npc.spells ?? []).filter((slot: any) => {
            if (Number(slot?.idSpell ?? 0) <= 0 || !getSpellData(Number(slot.idSpell))) {
                return false;
            }
            const cooldownMs = Math.max(0, Number(slot.cooldownSeconds ?? 0)) * 1000;
            return now - Number(slot.lastUsedAt ?? 0) >= cooldownMs;
        });

        if (availableSpells.length === 0) return undefined;

        // Prefer healing if low HP
        const healingSpells = availableSpells.filter((slot: any) => {
            const datSpell = getSpellData(Number(slot.idSpell));
            return Boolean(datSpell?.subeHp === 1 && npc.hp < npc.maxHp * 0.5);
        });

        if (healingSpells.length > 0) {
            return healingSpells[0].idSpell;
        }

        // Otherwise offensive
        const offensiveSpells = availableSpells.filter((slot: any) => {
            const datSpell = getSpellData(Number(slot.idSpell));
            return Boolean(datSpell?.paraliza || datSpell?.inmoviliza || datSpell?.subeHp === 2);
        });

        if (offensiveSpells.length > 0) {
            return offensiveSpells[Math.floor(Math.random() * offensiveSpells.length)].idSpell;
        }

        return undefined;
    }
}

/**
 * Strategy for Hostile NPCs (monsters).
 */
export class AggressiveBehavior extends NpcBehaviorStrategy {
    tick(npc: any, state: any): void {
        // Aggressive NPCs: AI state updates only
        // Actual combat handled by npcAttackUser
        if (state.currentTargetId) {
            if (!isValidTarget(state.currentTargetId, state.currentTargetKind)) {
                // Target dead or invalid, clear target
                state.currentTargetId = null;
                state.currentTargetKind = null;
                state.lastAttackerId = null;
            }
        }
    }

    handleAttack(npc: any, state: any, attackerId: EntityId): void {
        void npc;
        // Aggressive NPCs immediately target anyone who attacks them
        state.currentTargetId = attackerId;
        state.currentTargetKind = vars.personajes[String(attackerId)] ? "player" : "npc";
        state.lastAttackerId = attackerId;
        state.lastAttackAt = Date.now();
    }

    selectSpell(npc: any, state: any, target: any): number | undefined {
        void state;
        void target;
        const now = Date.now();
        const availableSpells = (npc.spells ?? []).filter((slot: any) => {
            if (Number(slot?.idSpell ?? 0) <= 0 || !getSpellData(Number(slot.idSpell))) {
                return false;
            }
            const cooldownMs = Math.max(0, Number(slot.cooldownSeconds ?? 0)) * 1000;
            return now - Number(slot.lastUsedAt ?? 0) >= cooldownMs;
        });

        if (availableSpells.length === 0) return undefined;

        // Prefer healing if low HP
        const healingSpells = availableSpells.filter((slot: any) => {
            const datSpell = getSpellData(Number(slot.idSpell));
            return Boolean(datSpell?.subeHp === 1 && npc.hp < npc.maxHp * 0.5);
        });

        if (healingSpells.length > 0) {
            return healingSpells[0].idSpell;
        }

        // Offensive spells
        const offensiveSpells = availableSpells.filter((slot: any) => {
            const datSpell = getSpellData(Number(slot.idSpell));
            return Boolean(datSpell?.paraliza || datSpell?.inmoviliza || datSpell?.subeHp === 2);
        });

        if (offensiveSpells.length > 0) {
            return offensiveSpells[Math.floor(Math.random() * offensiveSpells.length)].idSpell;
        }

        return undefined;
    }
}

/**
 * Strategy for City Guards.
 * Features: Zone-based neutrality, immediate aggro on player attack, and spellcasting.
 */
export class GuardBehavior extends NpcBehaviorStrategy {
    constructor(private config: { guardZoneCheck?: boolean } = {}) {
        super();
        this.guardZoneCheck = config.guardZoneCheck ?? true;
    }

    private guardZoneCheck: boolean;

    tick(npc: any, state: any): void {
        // Check if NPC is in a guard zone
        if (this.guardZoneCheck) {
            const inZone = isInGuardZone(npc.map, npc.pos);
            if (!inZone) {
                // NPC left the guard zone - could reset behavior
            }
        }

        // Validate current target
        if (state.currentTargetId) {
            if (!isValidTarget(state.currentTargetId, state.currentTargetKind)) {
                state.currentTargetId = null;
                state.currentTargetKind = null;
                state.lastAttackerId = null;
            }
        }
    }

    handleAttack(npc: any, state: any, attackerId: EntityId): void {
        // Guards aggro immediately if the player attacks them
        if (vars.personajes[String(attackerId)]) {
            state.currentTargetId = attackerId;
            state.currentTargetKind = "player";
            state.lastAttackerId = attackerId;
            state.lastAttackAt = Date.now();
        }
    }

    selectSpell(npc: any, state: any, target: any): number | undefined {
        const targetHpPct = target.maxHp > 0 ? (target.hp / target.maxHp) * 100 : 100;
        const spells = getGuardSpells(npc.id);
        if (spells.length === 0) {
            return undefined;
        }

        const now = Date.now();

        const healingSpells = spells.filter(
            (s) =>
                s.type === "healing" &&
                targetHpPct <= s.minHpPctToCast &&
                now - s.lastCastAt >= s.cooldownMs &&
                canNpcCastSpell(npc.id, s.spellId),
        );

        if (healingSpells.length > 0) {
            const spell = healingSpells[0];
            spell.lastCastAt = now;
            recordSpellCast(npc.id);
            return spell.spellId;
        }

        const offensiveSpells = spells.filter(
            (s) =>
                s.type === "offensive" &&
                now - s.lastCastAt >= s.cooldownMs &&
                canNpcCastSpell(npc.id, s.spellId),
        );

        if (offensiveSpells.length > 0) {
            const spell = offensiveSpells[Math.floor(Math.random() * offensiveSpells.length)];
            spell.lastCastAt = now;
            recordSpellCast(npc.id);
            return spell.spellId;
        }

        const crowdControlSpells = spells.filter(
            (s) =>
                s.type === "crowd_control" &&
                now - s.lastCastAt >= s.cooldownMs &&
                canNpcCastSpell(npc.id, s.spellId),
        );

        if (crowdControlSpells.length > 0) {
            const spell = crowdControlSpells[Math.floor(Math.random() * crowdControlSpells.length)];
            spell.lastCastAt = now;
            recordSpellCast(npc.id);
            return spell.spellId;
        }

        return undefined;
    }
}
