import type { EntityId, Position } from "../types/runtime";
import { PassiveBehavior } from "./strategies";
import { DefensiveBehavior } from "./strategies";
import { AggressiveBehavior } from "./strategies";
import { GuardBehavior } from "./strategies";

const vars = require("../vars");

export type NpcAIBehavior = "passive" | "defensive" | "aggressive" | "guard";

export type NpcAIState = {
    behavior: NpcAIBehavior;
    aggroOnAttack: boolean;
    aggroOnCrime: boolean;
    canCastSpells: boolean;
    spellIds: number[];
    spellCooldownMs: number;
    lastSpellCastAt: number;
    aggroMemoryMs: number;
    currentTargetId: EntityId | null;
    currentTargetKind: "player" | "npc" | null;
    lastAttackerId: EntityId | null;
    lastAttackAt: number;
    homePosition: Position | null;
    leashRadius: number;
    assistNearbyAllies: boolean;
    allyAssistRadius: number;
};

export type NpcAIConfig = {
    defaultBehavior: NpcAIBehavior;
    aggroMemoryMs: number;
    leashRadius: number;
    assistNearbyAllies: boolean;
    allyAssistRadius: number;
};

const DEFAULT_CONFIG: NpcAIConfig = {
    defaultBehavior: "passive",
    aggroMemoryMs: 15000,
    leashRadius: 15,
    assistNearbyAllies: true,
    allyAssistRadius: 8,
};

// Strategy instances for all behavior types
export const npcAIBehaviors = {
    passive: new PassiveBehavior(),
    defensive: new DefensiveBehavior(),
    aggressive: new AggressiveBehavior(),
    guard: new GuardBehavior({ guardZoneCheck: true }),
};

const npcAIStates = new Map<string, NpcAIState>();
let config: NpcAIConfig = { ...DEFAULT_CONFIG };
let lastNpcAITickAt = 0;

export function configureNpcAI(newConfig: Partial<NpcAIConfig>): void {
    config = { ...config, ...newConfig };
}

export function getNpcAIState(npcId: EntityId): NpcAIState | undefined {
    return npcAIStates.get(String(npcId));
}

export function setNpcAIState(npcId: EntityId, state: Partial<NpcAIState>): NpcAIState {
    const key = String(npcId);
    const existing = npcAIStates.get(key) ?? createDefaultNpcAIState();
    const updated = { ...existing, ...state };
    npcAIStates.set(key, updated);
    return updated;
}

export function removeNpcAIState(npcId: EntityId): void {
    npcAIStates.delete(String(npcId));
}

export function createDefaultNpcAIState(): NpcAIState {
    return {
        behavior: config.defaultBehavior,
        aggroOnAttack: false,
        aggroOnCrime: false,
        canCastSpells: false,
        spellIds: [],
        spellCooldownMs: 8000,
        lastSpellCastAt: 0,
        aggroMemoryMs: config.aggroMemoryMs,
        currentTargetId: null,
        currentTargetKind: null,
        lastAttackerId: null,
        lastAttackAt: 0,
        homePosition: null,
        leashRadius: config.leashRadius,
        assistNearbyAllies: config.assistNearbyAllies,
        allyAssistRadius: config.allyAssistRadius,
    };
}

export function isNpcAggro(npcId: EntityId): boolean {
    const state = getNpcAIState(npcId);
    if (!state) {
        return false;
    }

    if (state.currentTargetId) {
        return true;
    }

    if (state.lastAttackerId && Date.now() - state.lastAttackAt < state.aggroMemoryMs) {
        return true;
    }

    return false;
}

export function setNpcAggro(npcId: EntityId, attackerId: EntityId, targetKind?: "player" | "npc"): void {
    const attackerKind = targetKind ?? (vars.personajes[String(attackerId)] ? "player" : "npc");
    const state = setNpcAIState(npcId, {
        currentTargetId: attackerId,
        currentTargetKind: attackerKind,
        lastAttackerId: attackerId,
        lastAttackAt: Date.now(),
    });

    // Also sync with NPC object for compatibility with existing combat system
    const npc = vars.npcs[npcId];
    if (npc) {
        npc.currentTargetId = attackerId;
        npc.lastAggressorId = attackerId;
        npc.lastAggressedAt = Date.now();
        activateNpcCombatMovement(npc);
    }

    const strategy = npcAIBehaviors[state.behavior];
    if (strategy) {
        strategy.handleAttack(npc, state, attackerId);
    }

    if (state.assistNearbyAllies) {
        alertNearbyAllies(npcId, attackerId, state.allyAssistRadius);
    }
}

export function clearNpcAggro(npcId: EntityId): void {
    setNpcAIState(npcId, {
        currentTargetId: null,
        currentTargetKind: null,
        lastAttackerId: null,
        lastAttackAt: 0,
    });

    // Also sync with NPC object
    const npc = vars.npcs[npcId];
    if (npc) {
        npc.currentTargetId = 0;
        npc.lastAggressorId = 0;
        npc.lastAggressedAt = 0;
        restoreNpcMovement(npc);
    }
}

export function canNpcCastSpell(npcId: EntityId, spellId: number): boolean {
    const state = getNpcAIState(npcId);
    if (!state?.canCastSpells) {
        return false;
    }

    if (!state.spellIds.includes(spellId)) {
        return false;
    }

    return Date.now() - state.lastSpellCastAt >= state.spellCooldownMs;
}

export function recordSpellCast(npcId: EntityId): void {
    const state = getNpcAIState(npcId);
    if (state) {
        state.lastSpellCastAt = Date.now();
    }
}

export function getNpcBehavior(npcId: EntityId): NpcAIBehavior {
    return getNpcAIState(npcId)?.behavior ?? config.defaultBehavior;
}

export function setNpcBehavior(npcId: EntityId, behavior: NpcAIBehavior): void {
    setNpcAIState(npcId, { behavior });
}

export function shouldNpcFightBack(npcId: EntityId): boolean {
    const state = getNpcAIState(npcId);
    if (!state) {
        return false;
    }

    if (state.behavior === "aggressive" || state.behavior === "guard") {
        return true;
    }

    if (state.behavior === "defensive" && state.aggroOnAttack) {
        return true;
    }

    return false;
}

export function shouldNpcAggroOnCrime(npcId: EntityId): boolean {
    const state = getNpcAIState(npcId);
    return state?.aggroOnCrime ?? false;
}

function alertNearbyAllies(npcId: EntityId, attackerId: EntityId, radius: number): void {
    const vars = require("../vars");
    const attackerKind = vars.personajes[String(attackerId)] ? "player" : "npc";
    const npc = vars.npcs[npcId];
    if (!npc) {
        return;
    }

    for (const otherNpcId in vars.npcs) {
        if (String(otherNpcId) === String(npcId)) {
            continue;
        }

        const otherNpc = vars.npcs[otherNpcId];
        if (!otherNpc || otherNpc.map !== npc.map) {
            continue;
        }

        const distance = Math.abs(otherNpc.pos.x - npc.pos.x) + Math.abs(otherNpc.pos.y - npc.pos.y);
        if (distance > radius) {
            continue;
        }

        const otherState = getNpcAIState(otherNpcId);
        if (
            otherState &&
            (otherState.behavior === "guard" || otherState.behavior === "defensive") &&
            (String(otherState.currentTargetId) !== String(attackerId) || otherState.currentTargetKind !== attackerKind)
        ) {
            setNpcAggro(otherNpcId, attackerId, attackerKind);
        }
    }
}

function activateNpcCombatMovement(npc: any): void {
    if (npc.movement !== 3 && npc.npcAiPreviousMovement === undefined) {
        npc.npcAiPreviousMovement = npc.movement;
    }
    npc.movement = 3;
}

function restoreNpcMovement(npc: any): void {
    if (npc.npcAiPreviousMovement !== undefined) {
        npc.movement = npc.npcAiPreviousMovement;
        delete npc.npcAiPreviousMovement;
    }
}

export function getNpcAITickIntervalMs(): number {
    return 500;
}

export function processNpcAITick(): void {
    const now = Date.now();
    if (now - lastNpcAITickAt < getNpcAITickIntervalMs()) return;
    lastNpcAITickAt = now;

    for (const [npcId, state] of npcAIStates.entries()) {
        const npc = vars.npcs[npcId];
        const hadTarget = Boolean(state.currentTargetId);

        if (state.currentTargetKind === "player" && state.currentTargetId) {
            const player = vars.personajes[String(state.currentTargetId)];
            const visionX = Math.max(1, Number(vars.areaVisionRangeX ?? 15));
            const visionY = Math.max(1, Number(vars.areaVisionRangeY ?? 15));
            const playerStillVisible = Boolean(
                npc &&
                    player &&
                    player.hp > 0 &&
                    !player.cerrado &&
                    player.map === npc.map &&
                    Math.abs(player.pos.x - npc.pos.x) <= visionX &&
                    Math.abs(player.pos.y - npc.pos.y) <= visionY,
            );

            if (!playerStillVisible) {
                clearNpcAggro(npcId);
            }
        }

        const strategy = npcAIBehaviors[state.behavior];
        if (strategy) {
            strategy.tick(npc, state);
        }
        if (hadTarget && !state.currentTargetId && npc) {
            restoreNpcMovement(npc);
            npc.currentTargetId = 0;
        }
        // Clear aggro memory if it has expired
        if (state.currentTargetId && now - state.lastAttackAt > state.aggroMemoryMs) {
            clearNpcAggro(npcId);
        }
    }

    // Neutral city NPCs and guards defend themselves from nearby monsters.
    // Players remain neutral unless they attack first.
    const hostileNpcsByMap = new Map<number, any[]>();
    for (const hostileId in vars.npcs) {
        const hostile = vars.npcs[hostileId];
        if (!hostile || hostile.hp <= 0 || (Number(hostile.npcType) !== 0 && Number(hostile.npcType) !== 6)) continue;
        const list = hostileNpcsByMap.get(hostile.map) ?? [];
        list.push(hostile);
        hostileNpcsByMap.set(hostile.map, list);
    }

    for (const npcId in vars.npcs) {
        const npc = vars.npcs[npcId];
        if (!npc || npc.hp <= 0 || !npc.pos) continue;

        const state = getNpcAIState(npcId);
        if (!state || (state.behavior !== "passive" && state.behavior !== "defensive" && state.behavior !== "guard")) {
            continue;
        }
        if (state.currentTargetId) {
            if (state.currentTargetKind === "player") continue;
            const currentNpcTarget = vars.npcs[state.currentTargetId];
            if (currentNpcTarget && currentNpcTarget.hp > 0) continue;
            state.currentTargetId = null;
            state.currentTargetKind = null;
            state.lastAttackerId = null;
            npc.currentTargetId = 0;
            restoreNpcMovement(npc);
        }

        const hostile = (hostileNpcsByMap.get(npc.map) ?? []).find((candidate: any) =>
            String(candidate.id) !== String(npcId) &&
            Math.abs(candidate.pos.x - npc.pos.x) + Math.abs(candidate.pos.y - npc.pos.y) <= 8,
        );
        if (!hostile) continue;

        state.currentTargetId = hostile.id;
        state.currentTargetKind = "npc";
        state.lastAttackerId = hostile.id;
        state.lastAttackAt = now;
        npc.currentTargetId = hostile.id;
        activateNpcCombatMovement(npc);
    }
}

export function resetNpcAI(): void {
    npcAIStates.clear();
    config = { ...DEFAULT_CONFIG };
    lastNpcAITickAt = 0;
}
