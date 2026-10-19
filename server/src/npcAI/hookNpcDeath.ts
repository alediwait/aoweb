import type { EntityId } from "../types/runtime";
import npcAI from "./index";

export type MuereNpcFn = (idNpc: EntityId) => void;

let installed = false;

export function installNpcDeathHook(originalFn: MuereNpcFn): MuereNpcFn {
    if (installed) {
        return originalFn;
    }
    installed = true;

    return function hookedMuereNpc(this: ThisParameterType<MuereNpcFn>, idNpc: EntityId): void {
        npcAI.removeNpcAIState(idNpc);
        originalFn.call(this, idNpc);
    };
}
