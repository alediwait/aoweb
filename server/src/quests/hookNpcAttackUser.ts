import type { EntityId } from "../types/runtime";
import { emitDamageTakenEvent } from "../integration/questIntegration";

export type NpcAttackUserFn = (idNpc: EntityId, targetPressure: Map<EntityId, number>) => void;

let installed = false;

export function installNpcAttackUserQuestHook(originalFn: NpcAttackUserFn): NpcAttackUserFn {
    if (installed) {
        return originalFn;
    }
    installed = true;

    return function hookedNpcAttackUserQuest(idNpc: EntityId, targetPressure: Map<EntityId, number>): void {
        originalFn(idNpc, targetPressure);
    };
}
