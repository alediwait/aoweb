import type { EntityId } from "../types/runtime";

export type MarkNpcAggressorFn = (idNpc: EntityId, idUser: EntityId) => void;

export function installMarkNpcAggressorHook(originalFn: MarkNpcAggressorFn): MarkNpcAggressorFn {
    return originalFn;
}
