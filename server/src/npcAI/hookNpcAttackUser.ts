import type { EntityId } from "../types/runtime";
import npcAI from "./index";

export type NpcAttackUserFn = (idNpc: EntityId, targetPressure: Map<EntityId, number>) => void;

let installed = false;

export function installNpcAttackUserHook(originalFn: NpcAttackUserFn): NpcAttackUserFn {
    if (installed) {
        return originalFn;
    }
    installed = true;

    return function hookedNpcAttackUser(idNpc: EntityId, targetPressure: Map<EntityId, number>): void {
        const npc = require("../vars").npcs[idNpc] as { npcType?: number; pos: { x: number; y: number }; map: number } | undefined;

        if (npc && (Number(npc.npcType ?? 0) === 2 || Number(npc.npcType ?? 0) === 8)) {
            npcAI.processGuardAITick(idNpc);
        }

        originalFn(idNpc, targetPressure);
    };
}
