import type { EntityId } from "../types/runtime";
import npcAI from "./index";

export type ProcessPendingMovementsFn = () => void;

let installed = false;

export function installProcessPendingMovementsHook(originalFn: ProcessPendingMovementsFn): ProcessPendingMovementsFn {
    if (installed) {
        return originalFn;
    }
    installed = true;

    return function hookedProcessPendingMovements(): void {
        activateGuardsForCombat();
        originalFn();
    };
}

function activateGuardsForCombat(): void {
    try {
        const vars = require("../vars");
        const now = Date.now();

        for (const npcId in vars.npcs) {
            const npc = vars.npcs[npcId] as
                | {
                      npcType?: number;
                      movement?: number;
                      lastAggressorId?: EntityId;
                      lastAggressedAt?: number;
                      currentTargetId?: EntityId;
                      hp: number;
                  }
                | undefined;

            if (!npc || npc.hp <= 0) {
                continue;
            }

            const npcType = Number(npc.npcType ?? 0);
            const isGuard = npcType === 2 || npcType === 8;

            if (!isGuard) {
                continue;
            }

            const wasAttacked =
                npc.lastAggressorId &&
                npc.lastAggressedAt &&
                now - npc.lastAggressedAt < 15000;

            if (wasAttacked && npc.movement !== 3) {
                npc.movement = 3;
            }

            if (!wasAttacked && npc.movement === 3 && !npc.currentTargetId) {
                const state = npcAI.getNpcAIState(npcId);
                if (state?.behavior === "guard") {
                    npc.movement = 0;
                }
            }
        }
    } catch {
        // Silently fail — never break the game loop
    }
}
