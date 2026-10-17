import type { EntityId, Position } from "../types/runtime";
import {
    emitDamageDealtEvent,
    emitDamageTakenEvent,
    emitItemCollectedEvent,
    emitItemCraftedEvent,
    emitItemUsedEvent,
    emitLevelUpEvent,
    emitLocationReachedEvent,
    emitNpcInteractedEvent,
    emitNpcKilledEvent,
    emitPlayerKilledEvent,
    emitSpellCastEvent,
    initializeQuestIntegration,
} from "./questIntegration";
import {
    handleGuardSpellCast,
    handleNpcAttackedByPlayer,
    handleNpcDeathAggroClear,
    handlePlayerCrimeInGuardZone,
    initializeNPCAIIntegration,
    processNpcAIIntegrationTick,
} from "./npcAIIntegration";

export type IntegrationApi = {
    initialize: () => void;
    processTick: () => void;

    // Quest events
    emitNpcKilledEvent: (
        playerId: EntityId,
        npcId: EntityId,
        npcType: number,
        map: number,
        pos: { x: number; y: number },
    ) => void;
    emitItemCollectedEvent: (playerId: EntityId, itemId: number, amount: number) => void;
    emitNpcInteractedEvent: (playerId: EntityId, npcId: EntityId, npcType: number) => void;
    emitLocationReachedEvent: (playerId: EntityId, map: number, pos: { x: number; y: number }) => void;
    emitPlayerKilledEvent: (playerId: EntityId, victimId: EntityId, victimFaction: string) => void;
    emitItemCraftedEvent: (playerId: EntityId, itemId: number, amount: number) => void;
    emitItemUsedEvent: (playerId: EntityId, itemId: number) => void;
    emitSpellCastEvent: (playerId: EntityId, spellId: number) => void;
    emitDamageDealtEvent: (playerId: EntityId, targetType: "npc" | "player", targetId: EntityId, damage: number) => void;
    emitDamageTakenEvent: (playerId: EntityId, sourceType: "npc" | "player", sourceId: EntityId, damage: number) => void;
    emitLevelUpEvent: (playerId: EntityId, newLevel: number) => void;

    // NPC AI events
    handleNpcAttackedByPlayer: (npcId: EntityId, attackerId: EntityId) => void;
    handlePlayerCrimeInGuardZone: (criminalId: EntityId, mapId: number, pos: Position) => void;
    handleGuardSpellCast: (npcId: EntityId) => number | undefined;
    handleNpcDeathAggroClear: (npcId: EntityId) => void;
};

const integration = {} as IntegrationApi;

integration.initialize = function () {
    initializeQuestIntegration();
    initializeNPCAIIntegration();
};

integration.processTick = function () {
    processNpcAIIntegrationTick();
};

integration.emitNpcKilledEvent = emitNpcKilledEvent;
integration.emitItemCollectedEvent = emitItemCollectedEvent;
integration.emitNpcInteractedEvent = emitNpcInteractedEvent;
integration.emitLocationReachedEvent = emitLocationReachedEvent;
integration.emitPlayerKilledEvent = emitPlayerKilledEvent;
integration.emitItemCraftedEvent = emitItemCraftedEvent;
integration.emitItemUsedEvent = emitItemUsedEvent;
integration.emitSpellCastEvent = emitSpellCastEvent;
integration.emitDamageDealtEvent = emitDamageDealtEvent;
integration.emitDamageTakenEvent = emitDamageTakenEvent;
integration.emitLevelUpEvent = emitLevelUpEvent;

integration.handleNpcAttackedByPlayer = handleNpcAttackedByPlayer;
integration.handlePlayerCrimeInGuardZone = handlePlayerCrimeInGuardZone;
integration.handleGuardSpellCast = handleGuardSpellCast;
integration.handleNpcDeathAggroClear = handleNpcDeathAggroClear;

export default integration;
