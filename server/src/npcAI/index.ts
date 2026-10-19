import type { EntityId, Position } from "../types/runtime";
import {
    type NpcAIBehavior,
    type NpcAIConfig,
    type NpcAIState,
    configureNpcAI,
    createDefaultNpcAIState,
    getNpcAIState,
    getNpcBehavior,
    getNpcAITickIntervalMs,
    isNpcAggro,
    processNpcAITick,
    removeNpcAIState,
    resetNpcAI,
    setNpcAggro,
    setNpcAIState,
    setNpcBehavior,
    shouldNpcFightBack,
} from "./npcAI";
import {
    type GuardAIConfig,
    type GuardSpell,
    type GuardSpellType,
    type GuardZone,
    configureGuardAI,
    getGuardSpellToCast,
    getGuardSpells,
    getGuardZones,
    handleGuardAttacked,
    handleGuardCrimeWitnessed,
    handleGuardProtectedTargetAttacked,
    initializeGuardAI,
    isInGuardZone,
    processGuardAITick,
    registerGuardSpells,
    registerGuardZone,
    resetGuardAI,
    shouldGuardAttackPlayer,
} from "./guardAI";

export type NpcAIApi = {
    // Base NPC AI
    configureNpcAI: (config: Partial<NpcAIConfig>) => void;
    getNpcAIState: (npcId: EntityId) => NpcAIState | undefined;
    setNpcAIState: (npcId: EntityId, state: Partial<NpcAIState>) => NpcAIState;
    removeNpcAIState: (npcId: EntityId) => void;
    createDefaultNpcAIState: () => NpcAIState;
    getNpcBehavior: (npcId: EntityId) => NpcAIBehavior;
    setNpcBehavior: (npcId: EntityId, behavior: NpcAIBehavior) => void;
    isNpcAggro: (npcId: EntityId) => boolean;
    setNpcAggro: (npcId: EntityId, attackerId: EntityId, targetKind?: "player" | "npc") => void;
    shouldNpcFightBack: (npcId: EntityId) => boolean;
    processNpcAITick: () => void;
    getNpcAITickIntervalMs: () => number;
    resetNpcAI: () => void;

    // Guard AI
    configureGuardAI: (config: Partial<GuardAIConfig>) => void;
    registerGuardZone: (zone: GuardZone) => void;
    getGuardZones: () => GuardZone[];
    isInGuardZone: (mapId: number, pos: Position) => boolean;
    registerGuardSpells: (npcId: EntityId, spells: GuardSpell[]) => void;
    getGuardSpells: (npcId: EntityId) => GuardSpell[];
    initializeGuardAI: (npcId: EntityId, homePosition: Position) => NpcAIState;
    handleGuardAttacked: (npcId: EntityId, attackerId: EntityId) => void;
    handleGuardCrimeWitnessed: (npcId: EntityId, criminalId: EntityId) => void;
    handleGuardProtectedTargetAttacked: (npcId: EntityId, attackerId: EntityId) => void;
    shouldGuardAttackPlayer: (npcId: EntityId) => boolean;
    getGuardSpellToCast: (npcId: EntityId, targetHpPct: number) => number | undefined;
    processGuardAITick: (npcId: EntityId) => void;
    resetGuardAI: () => void;
};

const npcAI = {} as NpcAIApi;

// Base NPC AI
npcAI.configureNpcAI = configureNpcAI;
npcAI.getNpcAIState = getNpcAIState;
npcAI.setNpcAIState = setNpcAIState;
npcAI.removeNpcAIState = removeNpcAIState;
npcAI.createDefaultNpcAIState = createDefaultNpcAIState;
npcAI.getNpcBehavior = getNpcBehavior;
npcAI.setNpcBehavior = setNpcBehavior;
npcAI.isNpcAggro = isNpcAggro;
npcAI.setNpcAggro = setNpcAggro;
npcAI.shouldNpcFightBack = shouldNpcFightBack;
npcAI.processNpcAITick = processNpcAITick;
npcAI.getNpcAITickIntervalMs = getNpcAITickIntervalMs;
npcAI.resetNpcAI = resetNpcAI;

// Guard AI
npcAI.configureGuardAI = configureGuardAI;
npcAI.registerGuardZone = registerGuardZone;
npcAI.getGuardZones = getGuardZones;
npcAI.isInGuardZone = isInGuardZone;
npcAI.registerGuardSpells = registerGuardSpells;
npcAI.getGuardSpells = getGuardSpells;
npcAI.initializeGuardAI = initializeGuardAI;
npcAI.handleGuardAttacked = handleGuardAttacked;
npcAI.handleGuardCrimeWitnessed = handleGuardCrimeWitnessed;
npcAI.handleGuardProtectedTargetAttacked = handleGuardProtectedTargetAttacked;
npcAI.shouldGuardAttackPlayer = shouldGuardAttackPlayer;
npcAI.getGuardSpellToCast = getGuardSpellToCast;
npcAI.processGuardAITick = processGuardAITick;
npcAI.resetGuardAI = resetGuardAI;

export type { NpcAIBehavior, NpcAIConfig, NpcAIState, GuardAIConfig, GuardSpell, GuardSpellType, GuardZone };

export default npcAI;
