import type { QuestDefinition } from "./questTypes";

const questDefinitions = new Map<string, QuestDefinition>();

function registerQuest(definition: QuestDefinition): void {
    questDefinitions.set(definition.id, definition);
}

export function getQuestDefinition(questId: string): QuestDefinition | undefined {
    return questDefinitions.get(questId);
}

export function getAllQuestDefinitions(): QuestDefinition[] {
    return Array.from(questDefinitions.values());
}

export function getAvailableQuestsForLevel(level: number): QuestDefinition[] {
    return getAllQuestDefinitions().filter((quest) => quest.levelRequirement <= level);
}

export function getQuestsByStartNpc(npcId: number): QuestDefinition[] {
    return getAllQuestDefinitions().filter((quest) => quest.startNpcId === npcId);
}

export function isQuestRegistered(questId: string): boolean {
    return questDefinitions.has(questId);
}

export function reloadQuestDefinitions(definitions: QuestDefinition[]): void {
    questDefinitions.clear();
    for (const definition of definitions) {
        registerQuest(definition);
    }
}

// ─── Built-in Quest Definitions ───────────────────────────────────────────────

registerQuest({
    id: "kill_rats_sewers",
    name: "Plaga en las Alcantarillas",
    description: "Las ratas de las alcantarillas se han multiplicado. Elimina 10 ratas para limpiar la zona.",
    levelRequirement: 1,
    objectives: [
        {
            id: "kill_rats",
            type: "kill_npc",
            targetId: 1,
            targetName: "Rata",
            requiredAmount: 10,
            currentAmount: 0,
            description: "Elimina 10 ratas",
        },
    ],
    rewards: [
        { type: "exp", amount: 100 },
        { type: "gold", amount: 50 },
    ],
    startNpcId: 1,
    endNpcId: 1,
    zoneRestriction: [1],
});

registerQuest({
    id: "collect_herbs",
    name: "Hierbas para el Curandero",
    description: "El curandero necesita hierbas medicinales para sus pociones. Recolecta 15 hierbas.",
    levelRequirement: 2,
    objectives: [
        {
            id: "collect_herbs",
            type: "collect_item",
            targetId: 100,
            targetName: "Hierba Medicinal",
            requiredAmount: 15,
            currentAmount: 0,
            description: "Recolecta 15 hierbas medicinales",
        },
    ],
    rewards: [
        { type: "exp", amount: 150 },
        { type: "gold", amount: 75 },
        { type: "item", amount: 1, itemId: 36 },
    ],
    startNpcId: 1,
    endNpcId: 1,
});

registerQuest({
    id: "clear_wolves_forest",
    name: "Lobos en el Bosque",
    description: "Los lobos están atacando a los viajeros. Elimina 8 lobos del bosque.",
    levelRequirement: 5,
    objectives: [
        {
            id: "kill_wolves",
            type: "kill_npc",
            targetId: 2,
            targetName: "Lobo",
            requiredAmount: 8,
            currentAmount: 0,
            description: "Elimina 8 lobos",
        },
    ],
    rewards: [
        { type: "exp", amount: 300 },
        { type: "gold", amount: 150 },
        { type: "faction_score", amount: 25, faction: "armada" },
    ],
    startNpcId: 2,
    endNpcId: 2,
    zoneRestriction: [10],
});

registerQuest({
    id: "bandit_hunt",
    name: "Cazar Bandidos",
    description: "Los bandidos están asaltando a los mercaderes. Elimina 5 bandidos.",
    levelRequirement: 8,
    objectives: [
        {
            id: "kill_bandits",
            type: "kill_npc",
            targetId: 3,
            targetName: "Bandido",
            requiredAmount: 5,
            currentAmount: 0,
            description: "Elimina 5 bandidos",
        },
    ],
    rewards: [
        { type: "exp", amount: 500 },
        { type: "gold", amount: 300 },
        { type: "faction_score", amount: 50, faction: "armada" },
    ],
    startNpcId: 2,
    endNpcId: 2,
});

registerQuest({
    id: "dragon_slayer",
    name: "El Cazador de Dragones",
    description: "Un dragón aterroriza la región. Solo los más valientes pueden enfrentarlo.",
    levelRequirement: 20,
    objectives: [
        {
            id: "kill_dragon",
            type: "kill_npc",
            targetId: 6,
            targetName: "Dragón",
            requiredAmount: 1,
            currentAmount: 0,
            description: "Elimina al dragón",
        },
    ],
    rewards: [
        { type: "exp", amount: 5000 },
        { type: "gold", amount: 2000 },
        { type: "item", amount: 1, itemId: 402 },
        { type: "faction_score", amount: 200, faction: "armada" },
    ],
    startNpcId: 5,
    endNpcId: 5,
    prerequisiteQuestIds: ["clear_wolves_forest", "bandit_hunt"],
});

registerQuest({
    id: "craft_swords",
    name: "Forjando Espadas",
    description: "El herrero necesita que forjes 3 espadas para la milicia.",
    levelRequirement: 10,
    objectives: [
        {
            id: "craft_swords",
            type: "craft_item",
            targetId: 403,
            targetName: "Espada de Plata",
            requiredAmount: 3,
            currentAmount: 0,
            description: "Forja 3 espadas de plata",
        },
    ],
    rewards: [
        { type: "exp", amount: 400 },
        { type: "gold", amount: 200 },
    ],
    startNpcId: 3,
    endNpcId: 3,
});

registerQuest({
    id: "reach_citadel",
    name: "Viaje a la Ciudadela",
    description: "Llega a la Ciudadela para reunirte con el Comandante.",
    levelRequirement: 3,
    objectives: [
        {
            id: "reach_citadel",
            type: "reach_location",
            requiredAmount: 1,
            currentAmount: 0,
            description: "Llega a la Ciudadela (Mapa 1, Posición 50,50)",
        },
    ],
    rewards: [
        { type: "exp", amount: 200 },
        { type: "gold", amount: 100 },
    ],
    startNpcId: 1,
    endNpcId: 5,
});

registerQuest({
    id: "pvp_hunter",
    name: "Cazador de Criminales",
    description: "Elimina 3 criminales para mantener la paz en el reino.",
    levelRequirement: 15,
    objectives: [
        {
            id: "kill_criminals",
            type: "kill_player",
            requiredAmount: 3,
            currentAmount: 0,
            description: "Elimina 3 criminales",
        },
    ],
    rewards: [
        { type: "exp", amount: 1000 },
        { type: "gold", amount: 500 },
        { type: "faction_score", amount: 100, faction: "armada" },
    ],
    startNpcId: 5,
    endNpcId: 5,
});

registerQuest({
    id: "gather_ore",
    name: "Mineral para la Forja",
    description: "Recolecta 20 minerales de hierro para la forja real.",
    levelRequirement: 4,
    objectives: [
        {
            id: "collect_iron",
            type: "collect_item",
            targetId: 36,
            targetName: "Mineral de Hierro",
            requiredAmount: 20,
            currentAmount: 0,
            description: "Recolecta 20 minerales de hierro",
        },
    ],
    rewards: [
        { type: "exp", amount: 250 },
        { type: "gold", amount: 125 },
    ],
    startNpcId: 3,
    endNpcId: 3,
});

registerQuest({
    id: "slay_undead",
    name: "Purga de No-Muertos",
    description: "Los no-muertos han resurgido. Elimina 12 esqueletos.",
    levelRequirement: 12,
    objectives: [
        {
            id: "kill_skeletons",
            type: "kill_npc",
            targetId: 4,
            targetName: "Esqueleto",
            requiredAmount: 12,
            currentAmount: 0,
            description: "Elimina 12 esqueletos",
        },
    ],
    rewards: [
        { type: "exp", amount: 800 },
        { type: "gold", amount: 400 },
        { type: "faction_score", amount: 75, faction: "armada" },
    ],
    startNpcId: 2,
    endNpcId: 2,
});
