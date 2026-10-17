import { installNpcAIHooks } from "./npcAI/hooks";
import { installQuestHooks } from "./quests/hooks";

let allHooksInstalled = false;

export function installAllHooks(): void {
    if (allHooksInstalled) {
        return;
    }
    allHooksInstalled = true;
    installNpcAIHooks();
    installQuestHooks();
}

export function areAllHooksInstalled(): boolean {
    return allHooksInstalled;
}
