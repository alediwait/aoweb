import type { EntityId, Position } from "../types/runtime";
import { getCharacterById } from "../runtimeRegistry";
import { QuestManager } from "../quests/questManager";
import quests from "../quests";

const { onQuestCompletion } = quests;
const questPersistenceQueue = new Map<string, Promise<void>>();
const questJournalProximity = new Map<string, string>();

export function initializeQuestIntegration(): void {
    onQuestCompletion((playerId: EntityId, questId: string) => {
        const player = getCharacterById(playerId);
        if (!player) {
            return;
        }

        // Reward processing is now handled inside QuestManager.turnInQuest
        // This callback is for any additional side effects.
        persistPlayerQuestState(playerId, questId);
        sendQuestJournal(playerId);
    });

    quests.onQuestProgress((playerId, questId) => {
        persistPlayerQuestState(playerId, questId);
        sendQuestJournal(playerId);
    });
}

export async function loadPlayerQuests(playerId: EntityId, characterId: string): Promise<void> {
    try {
        const vars = require("../vars");
        const funct = require("../functions");
        const states = await funct.fetchUrl(`/internal/characters/${encodeURIComponent(characterId)}/quests`, {
            method: "GET",
            headers: { Authorization: vars.tokenAuth },
        });
        quests.restorePlayerQuests(playerId, Array.isArray(states) ? states : []);
    } catch (error) {
        const funct = require("../functions");
        funct.dumpError(error);
    }
}

export function persistPlayerQuestState(playerId: EntityId, questId: string): void {
    const player = getCharacterById(playerId) as ({ _id?: string } | undefined);
    if (!player?._id) return;
    const vars = require("../vars");
    const funct = require("../functions");
    const state = quests.getPlayerQuestState(playerId, questId);
    if (!state) return;
    const key = `${player._id}:${questId}`;
    const previous = questPersistenceQueue.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(async () => {
        await funct.fetchUrl(`/internal/characters/${encodeURIComponent(player._id!)}/quests/${encodeURIComponent(questId)}`, {
            method: "PUT",
            headers: {
                Authorization: vars.tokenAuth,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(state),
        });
    }).catch((error: unknown) => funct.dumpError(error));
    questPersistenceQueue.set(key, next);
    void next.finally(() => {
        if (questPersistenceQueue.get(key) === next) questPersistenceQueue.delete(key);
    });
}

export function deletePersistedPlayerQuest(playerId: EntityId, questId: string): void {
    const player = getCharacterById(playerId) as ({ _id?: string } | undefined);
    if (!player?._id) return;
    const vars = require("../vars");
    const funct = require("../functions");
    const key = `${player._id}:${questId}`;
    const previous = questPersistenceQueue.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(async () => {
        await funct.fetchUrl(`/internal/characters/${encodeURIComponent(player._id!)}/quests/${encodeURIComponent(questId)}`, {
            method: "DELETE",
            headers: { Authorization: vars.tokenAuth },
        });
    }).catch((error: unknown) => funct.dumpError(error));
    questPersistenceQueue.set(key, next);
    void next.finally(() => {
        if (questPersistenceQueue.get(key) === next) questPersistenceQueue.delete(key);
    });
}

export function getQuestJournal(playerId: EntityId): Array<{
    definition: unknown;
    state: unknown;
    canStart: boolean;
    nearStartNpc: boolean;
    canTurnIn: boolean;
}> {
    const player = getCharacterById(playerId) as ({ level?: number } | undefined);
    const QuestManager = require("../quests/questManager").QuestManager;
    return quests.getAllQuestDefinitions().map((definition) => {
        const nearStartNpc = definition.startNpcId == null || QuestManager.isNearQuestNpc(playerId, definition.startNpcId);
        const state = quests.getPlayerQuestState(playerId, definition.id) ?? null;
        return {
            definition,
            state,
            canStart: quests.canStartQuest(playerId, definition.id, Number(player?.level ?? 1)) && nearStartNpc,
            nearStartNpc,
            canTurnIn: state?.status === "completed" &&
                (definition.endNpcId == null || QuestManager.isNearQuestNpc(playerId, definition.endNpcId)),
        };
    });
}

export function sendQuestJournal(playerId: EntityId): void {
    const vars = require("../vars");
    const handleProtocol = require("../handleProtocol");
    const client = vars.clients[String(playerId)];
    if (!client || client.readyState !== client.OPEN) return;
    const entries = getQuestJournal(playerId);
    questJournalProximity.set(String(playerId), questJournalSignature(entries));
    handleProtocol.console(`__QUEST_JOURNAL__${JSON.stringify(entries)}`, "white", 0, 0, client);
}

export function syncQuestJournalProximity(playerId: EntityId): void {
    const entries = getQuestJournal(playerId);
    const signature = questJournalSignature(entries);
    if (questJournalProximity.get(String(playerId)) !== signature) sendQuestJournal(playerId);
}

function questJournalSignature(entries: Array<{ definition: any; canStart: boolean; canTurnIn: boolean }>): string {
    return entries.map((entry) => `${entry.definition.id}:${entry.canStart ? 1 : 0}:${entry.canTurnIn ? 1 : 0}`).join("|");
}

export function emitNpcKilledEvent(
    playerId: EntityId,
    npcId: EntityId,
    npcType: number,
    map: number,
    pos: { x: number; y: number },
    npcTemplateId?: number,
    npcName?: string,
): void {
    QuestManager.handleQuestEvent(playerId, {
        type: "npc_killed",
        npcId,
        npcType,
        npcTemplateId,
        npcName,
        map,
        pos,
    });
}

export function emitItemCollectedEvent(playerId: EntityId, itemId: number, amount: number): void {
    QuestManager.handleQuestEvent(playerId, {
        type: "item_collected",
        itemId,
        amount,
    });
}

export function emitNpcInteractedEvent(
    playerId: EntityId,
    npcId: EntityId,
    npcType: number,
    npcTemplateId?: number,
    npcName?: string,
): void {
    QuestManager.handleQuestEvent(playerId, {
        type: "npc_interacted",
        npcId,
        npcType,
        npcTemplateId,
        npcName,
    });
}

export function emitLocationReachedEvent(playerId: EntityId, map: number, pos: { x: number; y: number }): void {
    QuestManager.handleQuestEvent(playerId, {
        type: "location_reached",
        map,
        pos,
    });
}

export function emitPlayerKilledEvent(playerId: EntityId, victimId: EntityId, victimFaction: string): void {
    QuestManager.handleQuestEvent(playerId, {
        type: "player_killed",
        victimId,
        victimFaction,
    });
}

export function emitItemCraftedEvent(playerId: EntityId, itemId: number, amount: number): void {
    QuestManager.handleQuestEvent(playerId, {
        type: "item_crafted",
        itemId,
        amount,
    });
}

export function emitItemUsedEvent(playerId: EntityId, itemId: number): void {
    QuestManager.handleQuestEvent(playerId, {
        type: "item_used",
        itemId,
    });
}

export function emitSpellCastEvent(playerId: EntityId, spellId: number): void {
    QuestManager.handleQuestEvent(playerId, {
        type: "spell_cast",
        spellId,
    });
}

export function emitDamageDealtEvent(
    playerId: EntityId,
    targetType: "npc" | "player",
    targetId: EntityId,
    damage: number,
): void {
    QuestManager.handleQuestEvent(playerId, {
        type: "damage_dealt",
        targetType,
        targetId,
        damage,
    });
}

export function emitDamageTakenEvent(
    playerId: EntityId,
    sourceType: "npc" | "player",
    sourceId: EntityId,
    damage: number,
): void {
    QuestManager.handleQuestEvent(playerId, {
        type: "damage_taken",
        sourceType,
        sourceId,
        damage,
    });
}

export function emitLevelUpEvent(playerId: EntityId, newLevel: number): void {
    QuestManager.handleQuestEvent(playerId, {
        type: "level_up",
        newLevel,
    });
}
