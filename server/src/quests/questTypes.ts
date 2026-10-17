import type { EntityId } from "../types/runtime";

export type QuestStatus = "available" | "active" | "completed" | "turned_in" | "failed";

export type QuestObjectiveType =
    | "kill_npc"
    | "collect_item"
    | "talk_to_npc"
    | "reach_location"
    | "kill_player"
    | "craft_item"
    | "use_item"
    | "escort_npc";

export type QuestRewardType = "exp" | "gold" | "item" | "faction_score" | "spell";

export type QuestObjective = {
    id: string;
    type: QuestObjectiveType;
    targetId?: EntityId | number;
    targetName?: string;
    requiredAmount: number;
    currentAmount: number;
    description: string;
    optional?: boolean;
};

export type QuestReward = {
    type: QuestRewardType;
    amount: number;
    itemId?: number;
    faction?: "armada" | "caos";
};

export type QuestDefinition = {
    id: string;
    name: string;
    description: string;
    levelRequirement: number;
    objectives: QuestObjective[];
    rewards: QuestReward[];
    prerequisiteQuestIds?: string[];
    repeatable?: boolean;
    timeLimitMinutes?: number;
    startNpcId?: number;
    endNpcId?: number;
    zoneRestriction?: number[];
};

export type PlayerQuestState = {
    questId: string;
    status: QuestStatus;
    objectives: QuestObjective[];
    startedAt?: number;
    expiresAt?: number;
    completedAt?: number;
    turnedInAt?: number;
};

export type QuestEvent =
    | { type: "npc_killed"; npcId: EntityId; npcType: number; map: number; pos: { x: number; y: number } }
    | { type: "item_collected"; itemId: number; amount: number }
    | { type: "npc_interacted"; npcId: EntityId; npcType: number }
    | { type: "location_reached"; map: number; pos: { x: number; y: number } }
    | { type: "player_killed"; victimId: EntityId; victimFaction: string }
    | { type: "item_crafted"; itemId: number; amount: number }
    | { type: "item_used"; itemId: number }
    | { type: "spell_cast"; spellId: number }
    | { type: "damage_dealt"; targetType: "npc" | "player"; targetId: EntityId; damage: number }
    | { type: "damage_taken"; sourceType: "npc" | "player"; sourceId: EntityId; damage: number }
    | { type: "quest_turned_in"; questId: string }
    | { type: "level_up"; newLevel: number };

export type QuestProgressCallback = (playerId: EntityId, questId: string, objectiveId: string, newAmount: number) => void;

export type QuestCompletionCallback = (playerId: EntityId, questId: string) => void;
