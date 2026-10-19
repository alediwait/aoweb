import { installUserDmgNpcHook } from "./hookUserDmgNpc";
import { installNpcAttackUserQuestHook } from "./hookNpcAttackUser";

let questHooksInstalled = false;

export function installQuestHooks(): void {
    if (questHooksInstalled) {
        return;
    }
    questHooksInstalled = true;

    try {
        const game = require("../game");
        if (game && typeof game.userDmgNpc === "function") {
            game.userDmgNpc = installUserDmgNpcHook(game.userDmgNpc);
        }
    } catch {
        // Game module not yet available — hooks will be installed on next call.
    }

    try {
        const npcs = require("../npcs");
        if (npcs && typeof npcs.npcAttackUser === "function") {
            npcs.npcAttackUser = installNpcAttackUserQuestHook(npcs.npcAttackUser);
        }
    } catch {
        // NPC module not yet available — hooks will be installed on next call.
    }
}

export function areQuestHooksInstalled(): boolean {
    return questHooksInstalled;
}
