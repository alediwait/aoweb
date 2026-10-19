import type { EntityId } from "../types/runtime";
import { emitDamageTakenEvent } from "../integration/questIntegration";

export type NpcAttackUserFn = (idNpc: EntityId, targetPressure: Map<EntityId, number>) => void;

let installed = false;

export function installNpcAttackUserQuestHook(originalFn: NpcAttackUserFn): NpcAttackUserFn {
    if (installed) {
        return originalFn;
    }
    installed = true;

    return function hookedNpcAttackUserQuest(
        this: ThisParameterType<NpcAttackUserFn>,
        idNpc: EntityId,
        targetPressure: Map<EntityId, number>,
    ): void {
        const vars = require("../vars");
        const npc = vars.npcs[String(idNpc)];
        const targetId = npc?.currentTargetId;
        const target = targetId ? vars.personajes[String(targetId)] : undefined;
        const hpBefore = Number(target?.hp ?? 0);
        // npcAttackUser relies on its Npcs instance as `this` (for movement helpers).
        // Preserve the receiver through the quest wrapper so chasing still works.
        originalFn.call(this, idNpc, targetPressure);

        if (target && Number(target.hp) < hpBefore) {
            emitDamageTakenEvent(String(targetId), "npc", idNpc, hpBefore - Number(target.hp));
        }
    };
}
