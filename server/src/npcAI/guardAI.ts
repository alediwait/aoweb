import type { EntityId, Position } from "../types/runtime";
import {
    type NpcAIState,
    canNpcCastSpell,
    clearNpcAggro,
    getNpcAIState,
    isNpcAggro,
    recordSpellCast,
    setNpcAggro,
    setNpcAIState,
    setNpcBehavior,
    shouldNpcAggroOnCrime,
    shouldNpcFightBack,
    npcAIBehaviors,
} from "./npcAI";

export type GuardSpellType = "offensive" | "defensive" | "healing" | "crowd_control";

export type GuardSpell = {
    spellId: number;
    type: GuardSpellType;
    cooldownMs: number;
    lastCastAt: number;
    minHpPctToCast: number;
    range: number;
};

export type GuardZone = {
    mapId: number;
    centerX: number;
    centerY: number;
    radius: number;
    name: string;
};

export type GuardAIConfig = {
    spellCooldownMs: number;
    aggroMemoryMs: number;
    leashRadius: number;
    assistNearbyGuards: boolean;
    allyAssistRadius: number;
};

const DEFAULT_GUARD_CONFIG: GuardAIConfig = {
    spellCooldownMs: 6000,
    aggroMemoryMs: 30000,
    leashRadius: 20,
    assistNearbyGuards: true,
    allyAssistRadius: 10,
};

const guardZones: GuardZone[] = [
    { mapId: 1, centerX: 50, centerY: 50, radius: 25, name: "Ciudad Capital" },
    { mapId: 2, centerX: 40, centerY: 40, radius: 20, name: "Pueblo Norte" },
    { mapId: 3, centerX: 60, centerY: 60, radius: 20, name: "Puerto Sur" },
];

const guardSpellBook = new Map<string, GuardSpell[]>();

let guardConfig: GuardAIConfig = { ...DEFAULT_GUARD_CONFIG };

export function configureGuardAI(newConfig: Partial<GuardAIConfig>): void {
    guardConfig = { ...guardConfig, ...newConfig };
}

export function registerGuardZone(zone: GuardZone): void {
    const existing = guardZones.findIndex((z) => z.mapId === zone.mapId && z.name === zone.name);
    if (existing >= 0) {
        guardZones[existing] = zone;
    } else {
        guardZones.push(zone);
    }
}

export function getGuardZones(): GuardZone[] {
    return [...guardZones];
}

export function isInGuardZone(mapId: number, pos: Position): boolean {
    return guardZones.some((zone) => {
        if (zone.mapId !== mapId) {
            return false;
        }
        const dx = Math.abs(pos.x - zone.centerX);
        const dy = Math.abs(pos.y - zone.centerY);
        return dx <= zone.radius && dy <= zone.radius;
    });
}

export function getGuardZoneForPosition(mapId: number, pos: Position): GuardZone | undefined {
    return guardZones.find((zone) => {
        if (zone.mapId !== mapId) {
            return false;
        }
        const dx = Math.abs(pos.x - zone.centerX);
        const dy = Math.abs(pos.y - zone.centerY);
        return dx <= zone.radius && dy <= zone.radius;
    });
}

export function registerGuardSpells(npcId: EntityId, spells: GuardSpell[]): void {
    guardSpellBook.set(String(npcId), spells.map((s) => ({ ...s })));
}

export function getGuardSpells(npcId: EntityId): GuardSpell[] {
    return guardSpellBook.get(String(npcId)) ?? [];
}

export function initializeGuardAI(npcId: EntityId, homePosition: Position): NpcAIState {
    const state = setNpcAIState(npcId, {
        behavior: "guard",
        aggroOnAttack: true,
        aggroOnCrime: true,
        canCastSpells: true,
        spellIds: getGuardSpells(npcId).map((s) => s.spellId),
        spellCooldownMs: guardConfig.spellCooldownMs,
        lastSpellCastAt: 0,
        aggroMemoryMs: guardConfig.aggroMemoryMs,
        currentTargetId: null,
        currentTargetKind: null,
        lastAttackerId: null,
        lastAttackAt: 0,
        homePosition,
        leashRadius: guardConfig.leashRadius,
        assistNearbyAllies: guardConfig.assistNearbyGuards,
        allyAssistRadius: guardConfig.allyAssistRadius,
    });

    setNpcBehavior(npcId, "guard");
    return state;
}

export function handleGuardAttacked(npcId: EntityId, attackerId: EntityId): void {
    const state = getNpcAIState(npcId);
    if (!state || state.behavior !== "guard") {
        return;
    }

    setNpcAggro(npcId, attackerId, "player");
    alertNearbyGuards(npcId, attackerId);
}

export function handleGuardCrimeWitnessed(npcId: EntityId, criminalId: EntityId): void {
    const state = getNpcAIState(npcId);
    if (!state || state.behavior !== "guard") {
        return;
    }

    if (!shouldNpcAggroOnCrime(npcId)) {
        return;
    }

    setNpcAggro(npcId, criminalId, "player");
    alertNearbyGuards(npcId, criminalId);
}

export function handleGuardProtectedTargetAttacked(npcId: EntityId, attackerId: EntityId): void {
    const state = getNpcAIState(npcId);
    if (!state || state.behavior !== "guard") {
        return;
    }

    setNpcAggro(npcId, attackerId, "player");
    alertNearbyGuards(npcId, attackerId);
}

export function shouldGuardAttackPlayer(npcId: EntityId): boolean {
    const state = getNpcAIState(npcId);
    if (!state || state.behavior !== "guard") {
        return false;
    }

    if (!isNpcAggro(npcId)) {
        return false;
    }

    return shouldNpcFightBack(npcId);
}

export function getGuardSpellToCast(npcId: EntityId, targetHpPct: number): number | undefined {
    const state = getNpcAIState(npcId);
    if (!state || !state.canCastSpells) {
        return undefined;
    }

    const spells = getGuardSpells(npcId);
    if (spells.length === 0) {
        return undefined;
    }

    const now = Date.now();

    const healingSpells = spells.filter(
        (s) =>
            s.type === "healing" &&
            targetHpPct <= s.minHpPctToCast &&
            now - s.lastCastAt >= s.cooldownMs &&
            canNpcCastSpell(npcId, s.spellId),
    );

    if (healingSpells.length > 0) {
        const spell = healingSpells[0];
        spell.lastCastAt = now;
        recordSpellCast(npcId);
        return spell.spellId;
    }

    const offensiveSpells = spells.filter(
        (s) =>
            s.type === "offensive" &&
            now - s.lastCastAt >= s.cooldownMs &&
            canNpcCastSpell(npcId, s.spellId),
    );

    if (offensiveSpells.length > 0) {
        const spell = offensiveSpells[Math.floor(Math.random() * offensiveSpells.length)];
        spell.lastCastAt = now;
        recordSpellCast(npcId);
        return spell.spellId;
    }

    const crowdControlSpells = spells.filter(
        (s) =>
            s.type === "crowd_control" &&
            now - s.lastCastAt >= s.cooldownMs &&
            canNpcCastSpell(npcId, s.spellId),
    );

    if (crowdControlSpells.length > 0) {
        const spell = crowdControlSpells[Math.floor(Math.random() * crowdControlSpells.length)];
        spell.lastCastAt = now;
        recordSpellCast(npcId);
        return spell.spellId;
    }

    return undefined;
}

export function getGuardSpellToCastById(npcId: EntityId, targetHpPct: number): number | undefined {
    return getGuardSpellToCast(npcId, targetHpPct);
}

export function processGuardAITick(npcId: EntityId): void {
    const state = getNpcAIState(npcId);
    if (!state || state.behavior !== "guard") {
        return;
    }

    if (!isNpcAggro(npcId)) {
        return;
    }

    const vars = require("../vars");
    const npc = vars.npcs[npcId];
    if (!npc) {
        return;
    }

    // Call the GuardBehavior strategy tick
    const strategy = (npcAIBehaviors as any)?.[npcId] ?? npcAIBehaviors.guard;
    if (strategy) {
        strategy.tick(npc, state);
    }

    const now = Date.now();
    if (now - state.lastAttackAt > state.aggroMemoryMs) {
        clearNpcAggro(npcId);
        return;
    }

    if (state.homePosition) {
        const dx = Math.abs(npc.pos.x - state.homePosition.x);
        const dy = Math.abs(npc.pos.y - state.homePosition.y);
        if (dx > state.leashRadius || dy > state.leashRadius) {
            clearNpcAggro(npcId);
        }
    }
}

function alertNearbyGuards(guardId: EntityId, attackerId: EntityId): void {
    const vars = require("../vars");
    const guard = vars.npcs[guardId];
    if (!guard) {
        return;
    }

    for (const otherNpcId in vars.npcs) {
        if (String(otherNpcId) === String(guardId)) {
            continue;
        }

        const otherNpc = vars.npcs[otherNpcId];
        if (!otherNpc || otherNpc.map !== guard.map) {
            continue;
        }

        const otherState = getNpcAIState(otherNpcId);
        if (!otherState || otherState.behavior !== "guard") {
            continue;
        }

        const distance = Math.abs(otherNpc.pos.x - guard.pos.x) + Math.abs(otherNpc.pos.y - guard.pos.y);
        if (distance > guardConfig.allyAssistRadius) {
            continue;
        }

        setNpcAggro(otherNpcId, attackerId);
    }
}

export function resetGuardAI(): void {
    guardSpellBook.clear();
    guardZones.length = 0;
    guardConfig = { ...DEFAULT_GUARD_CONFIG };
}
