import type { EntityId } from "../types/runtime";
import { emitNpcKilledEvent, emitDamageDealtEvent } from "../integration/questIntegration";

export type UserDmgNpcFn = (idUser: EntityId, idNpc: EntityId) => number | string;

let installed = false;

export function installUserDmgNpcHook(originalFn: UserDmgNpcFn): UserDmgNpcFn {
    if (installed) {
        return originalFn;
    }
    installed = true;

    return function hookedUserDmgNpc(idUser: EntityId, idNpc: EntityId): number | string {
        const result = originalFn(idUser, idNpc);
        const npc = require("../vars").npcs[idNpc] as
            | { npcType?: number; map: number; pos: { x: number; y: number }; hp?: number }
            | undefined;

        if (npc && Number(npc.hp ?? 0) <= 0) {
            emitNpcKilledEvent(idUser, idNpc, Number(npc.npcType ?? 0), npc.map, { x: npc.pos.x, y: npc.pos.y });
        }

        if (result !== "¡Fallas!" && result !== 0) {
            const dmg = typeof result === "number" ? result : 0;
            if (dmg > 0) {
                emitDamageDealtEvent(idUser, "npc", idNpc, dmg);
            }
        }

        return result;
    };
}
