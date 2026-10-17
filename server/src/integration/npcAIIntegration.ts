import type { EntityId, Position } from "../types/runtime";
import npcAI from "../npcAI";
import { getCharacterById } from "../runtimeRegistry";

export function initializeNPCAIIntegration(): void {
    npcAI.registerGuardZone({
        mapId: 1,
        centerX: 50,
        centerY: 50,
        radius: 25,
        name: "Ciudad Capital",
    });
}

export function handleNpcAttackedByPlayer(npcId: EntityId, attackerId: EntityId): void {
    const npc = getNpcFromVars(npcId);
    if (!npc) {
        return;
    }

    const npcType = Number(npc.npcType ?? 0);
    const isGuardType = npcType === 2 || npcType === 8;

    let state = npcAI.getNpcAIState(npcId);

    if (!state && isGuardType) {
        state = npcAI.initializeGuardAI(npcId, { x: npc.pos.x, y: npc.pos.y });
    }

    if (!state) {
        return;
    }

    if (state.behavior === "guard") {
        npcAI.handleGuardAttacked(npcId, attackerId);
        return;
    }

    if (state.behavior === "defensive" && state.aggroOnAttack) {
        npcAI.setNpcAggro(npcId, attackerId);
        return;
    }

    if (state.behavior === "aggressive") {
        npcAI.setNpcAggro(npcId, attackerId);
    }
}

export function handlePlayerCrimeInGuardZone(
    criminalId: EntityId,
    mapId: number,
    pos: Position,
): void {
    if (!npcAI.isInGuardZone(mapId, pos)) {
        return;
    }

    const vars = require("../vars");
    for (const npcId in vars.npcs) {
        const npc = vars.npcs[npcId];
        if (!npc || npc.map !== mapId) {
            continue;
        }

        if (Number(npc.npcType ?? 0) !== 2 && Number(npc.npcType ?? 0) !== 8) {
            continue;
        }

        const distance = Math.abs(npc.pos.x - pos.x) + Math.abs(npc.pos.y - pos.y);
        if (distance > 15) {
            continue;
        }

        const state = npcAI.getNpcAIState(npcId);
        if (!state) {
            npcAI.initializeGuardAI(npcId, { x: npc.pos.x, y: npc.pos.y });
        }

        npcAI.handleGuardCrimeWitnessed(npcId, criminalId);
    }
}

export function handleGuardSpellCast(npcId: EntityId): number | undefined {
    const state = npcAI.getNpcAIState(npcId);
    if (!state || state.behavior !== "guard") {
        return undefined;
    }

    if (!npcAI.shouldGuardAttackPlayer(npcId)) {
        return undefined;
    }

    const vars = require("../vars");
    const npc = vars.npcs[npcId];
    if (!npc) {
        return undefined;
    }

    const targetId = state.currentTargetId;
    if (!targetId) {
        return undefined;
    }

    const target = getCharacterById(targetId);
    if (!target) {
        return undefined;
    }

    const maxHp = Number(target.maxHp ?? 0);
    const hp = Number(target.hp ?? 0);
    const targetHpPct = maxHp > 0 ? (hp / maxHp) * 100 : 100;
    return npcAI.getGuardSpellToCast(npcId, targetHpPct);
}

export function handleNpcDeathAggroClear(npcId: EntityId): void {
    npcAI.removeNpcAIState(npcId);
}

export function processNpcAIIntegrationTick(): void {
    npcAI.processNpcAITick();
}

function getNpcFromVars(npcId: EntityId): { npcType?: number; pos: Position; map: number } | undefined {
    const vars = require("../vars");
    return vars.npcs[npcId] as { npcType?: number; pos: Position; map: number } | undefined;
}
