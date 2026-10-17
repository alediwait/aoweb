import type { EntityId } from "../types/runtime";
import npcAI from "./index";
import { handleNpcAttackedByPlayer } from "../integration/npcAIIntegration";

export type MarkNpcAggressorFn = (idNpc: EntityId, idUser: EntityId) => void;

let installed = false;

export function installMarkNpcAggressorHook(originalFn: MarkNpcAggressorFn): MarkNpcAggressorFn {
    if (installed) {
        return originalFn;
    }
    installed = true;

    return function hookedMarkNpcAggressor(idNpc: EntityId, idUser: EntityId): void {
        originalFn(idNpc, idUser);
        handleNpcAttackedByPlayer(idNpc, idUser);
    };
}
