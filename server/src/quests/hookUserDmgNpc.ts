import type { EntityId } from "../types/runtime";
import { emitDamageDealtEvent } from "../integration/questIntegration";

export type UserDmgNpcFn = (idUser: EntityId, idNpc: EntityId) => number | string;

let installed = false;

export function installUserDmgNpcHook(originalFn: UserDmgNpcFn): UserDmgNpcFn {
    if (installed) {
        return originalFn;
    }
    installed = true;

    return function hookedUserDmgNpc(idUser: EntityId, idNpc: EntityId): number | string {
        const result = originalFn(idUser, idNpc);
        if (result !== "¡Fallas!" && result !== 0) {
            const dmg = typeof result === "number" ? result : 0;
            if (dmg > 0) {
                emitDamageDealtEvent(idUser, "npc", idNpc, dmg);
            }
        }

        return result;
    };
}
