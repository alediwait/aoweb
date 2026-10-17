import type { EntityId, Position } from "../types/runtime";

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

const npcAIStates = new Map<string, NpcAIState>();
let config: NpcAIConfig = { ...DEFAULT_CONFIG };

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

export function setNpcAggro(npcId: EntityId, attackerId: EntityId): void {
    const state = setNpcAIState(npcId, {
        currentTargetId: attackerId,
        lastAttackerId: attackerId,
        lastAttackAt: Date.now(),
    });

    if (state.assistNearbyAllies) {
        alertNearbyAllies(npcId, attackerId, state.allyAssistRadius);
    }
}

export function clearNpcAggro(npcId: EntityId): void {
    setNpcAIState(npcId, {
        currentTargetId: null,
        lastAttackerId: null,
        lastAttackAt: 0,
    });
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
        if (otherState && (otherState.behavior === "guard" || otherState.behavior === "defensive")) {
            setNpcAggro(otherNpcId, attackerId);
        }
    }
}

export function getNpcAITickIntervalMs(): number {
    return 500;
}

export function processNpcAITick(): void {
    const now = Date.now();

    for (const [npcId, state] of npcAIStates.entries()) {
        if (state.currentTargetId && now - state.lastAttackAt > state.aggroMemoryMs) {
            clearNpcAggro(npcId);
        }
    }
}

export function resetNpcAI(): void {
    npcAIStates.clear();
    config = { ...DEFAULT_CONFIG };
}
