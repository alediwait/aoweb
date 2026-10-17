import type { EntityId } from "../types/runtime";
import { installMarkNpcAggressorHook } from "./hookMarkNpcAggressor";
import { installNpcAttackUserHook } from "./hookNpcAttackUser";
import { installNpcDeathHook } from "./hookNpcDeath";

let hooksInstalled = false;

export function installNpcAIHooks(): void {
    if (hooksInstalled) {
        return;
    }
    hooksInstalled = true;

    try {
        const game = require("../game");
        if (game && typeof game.markNpcAggressor === "function") {
            game.markNpcAggressor = installMarkNpcAggressorHook(game.markNpcAggressor);
        }
    } catch {
        // Game module not yet available — hooks will be installed on next call.
    }

    try {
        const npcs = require("../npcs");
        if (npcs) {
            if (typeof npcs.npcAttackUser === "function") {
                npcs.npcAttackUser = installNpcAttackUserHook(npcs.npcAttackUser);
            }
            if (typeof npcs.muereNpc === "function") {
                npcs.muereNpc = installNpcDeathHook(npcs.muereNpc);
            }
        }
    } catch {
        // NPC module not yet available — hooks will be installed on next call.
    }
}

export function areNpcAIHooksInstalled(): boolean {
    return hooksInstalled;
}

export type { EntityId };
