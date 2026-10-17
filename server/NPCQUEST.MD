# NPC AI & Quest System — Developer Guide

> Modular, event-driven extensions for AOWeb game server.
> Zero core-file modifications required — all logic lives in dedicated modules.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Quest System](#quest-system)
   - [Quest Definitions](#quest-definitions)
   - [Starting a Quest](#starting-a-quest)
   - [Tracking Progress](#tracking-progress)
   - [Turning In Quests](#turning-in-quests)
   - [Quest Events](#quest-events)
   - [Built-in Quests](#built-in-quests)
3. [NPC AI System](#npc-ai-system)
   - [Behavior Types](#behavior-types)
   - [Guard AI](#guard-ai)
   - [Defensive NPCs](#defensive-npcs)
   - [Aggressive NPCs](#aggressive-npcs)
4. [Integration Hooks](#integration-hooks)
5. [API Reference](#api-reference)

---

## Architecture Overview

```
server/src/
├── quests/                  # Quest system (isolated module)
│   ├── questTypes.ts        # Type definitions
│   ├── questRegistry.ts     # Quest definitions database
│   ├── questTracker.ts      # Player quest state tracking
│   ├── questEvents.ts       # Event-driven progression engine
│   ├── hookUserDmgNpc.ts    # Hook: player damages NPC
│   ├── hooks.ts             # Hook installer
│   └── index.ts             # Public API facade
│
├── npcAI/                   # NPC AI system (isolated module)
│   ├── npcAI.ts             # Base AI state machine
│   ├── guardAI.ts           # City Guard AI (zones, spells, aggro)
│   ├── hookMarkNpcAggressor.ts  # Hook: player attacks NPC
│   ├── hookNpcAttackUser.ts     # Hook: NPC attacks player
│   ├── hookNpcDeath.ts          # Hook: NPC dies
│   ├── hooks.ts             # Hook installer
│   └── index.ts             # Public API facade
│
├── integration/             # Bridge between modules and core
│   ├── questIntegration.ts  # Quest event emitters
│   ├── npcAIIntegration.ts  # NPC AI event handlers
│   └── index.ts             # Unified integration API
│
└── hooks.ts                 # Master hook installer (import this)
```

**Key Principle:** Import `src/hooks.ts` once at server startup to activate all hooks. No existing core files are modified.

---

## Quest System

### Quest Definitions

Quests are defined as data — add new quests by calling `registerQuest()`:

```typescript
import { registerQuest } from "./quests/questRegistry";

registerQuest({
    id: "my_custom_quest",
    name: "My Custom Quest",
    description: "Do something cool.",
    levelRequirement: 5,
    objectives: [
        {
            id: "kill_enemies",
            type: "kill_npc",
            targetId: 5,           // NPC type or specific NPC ID
            targetName: "Enemy",
            requiredAmount: 10,
            currentAmount: 0,
            description: "Elimina 10 enemigos",
        },
        {
            id: "collect_loot",
            type: "collect_item",
            targetId: 100,         // Item ID
            targetName: "Loot",
            requiredAmount: 5,
            currentAmount: 0,
            description: "Recolecta 5 botines",
        },
    ],
    rewards: [
        { type: "exp", amount: 500 },
        { type: "gold", amount: 200 },
        { type: "item", amount: 1, itemId: 42 },
        { type: "faction_score", amount: 50, faction: "armada" },
    ],
    prerequisiteQuestIds: ["previous_quest_id"],  // Optional
    repeatable: false,                            // Optional
    timeLimitMinutes: 30,                         // Optional
    startNpcId: 1,                                // Optional
    endNpcId: 1,                                  // Optional
    zoneRestriction: [1, 2, 3],                   // Optional
});
```

### Starting a Quest

```typescript
import quests from "./quests";

// Check if player can start
if (quests.canStartQuest(playerId, "my_custom_quest", playerLevel)) {
    const state = quests.startQuest(playerId, "my_custom_quest");
    // state.status === "active"
}
```

### Tracking Progress

Progress is **automatic** via hooks. When a player kills an NPC, collects an item, etc., the quest system updates objectives:

```typescript
// Manual progress update (if needed)
const result = quests.updateObjectiveProgress(playerId, "my_custom_quest", "kill_enemies", 1);
// result.objectiveCompleted — true if this update completed the objective
// result.questCompleted     — true if all objectives are now done

// Get progress percentage
const progress = quests.getQuestProgress(playerId, "my_custom_quest");
// { current: 5, required: 10, percentage: 50 }
```

### Turning In Quests

```typescript
// When all objectives complete, quest status becomes "completed"
if (quests.isQuestCompleted(playerId, "my_custom_quest")) {
    const state = quests.turnInQuest(playerId, "my_custom_quest");
    // Rewards are automatically applied via onQuestCompletion callback
    // state.status === "turned_in"
}
```

### Quest Events

The system listens for these events (emitted automatically via hooks):

| Event | Trigger |
|-------|---------|
| `npc_killed` | Player kills an NPC |
| `item_collected` | Player collects/picks up an item |
| `npc_interacted` | Player talks to an NPC |
| `location_reached` | Player enters a map/zone |
| `player_killed` | Player kills another player |
| `item_crafted` | Player crafts an item |
| `item_used` | Player uses an item |
| `spell_cast` | Player casts a spell |
| `damage_dealt` | Player deals damage |
| `damage_taken` | Player takes damage |
| `level_up` | Player levels up |

### Built-in Quests

| Quest ID | Name | Level | Objectives |
|----------|------|-------|------------|
| `kill_rats_sewers` | Plaga en las Alcantarillas | 1 | Kill 10 rats |
| `collect_herbs` | Hierbas para el Curandero | 2 | Collect 15 herbs |
| `clear_wolves_forest` | Lobos en el Bosque | 5 | Kill 8 wolves |
| `bandit_hunt` | Cazar Bandidos | 8 | Kill 5 bandits |
| `craft_swords` | Forjando Espadas | 10 | Craft 3 swords |
| `reach_citadel` | Viaje a la Ciudadela | 3 | Reach the Citadel |
| `pvp_hunter` | Cazador de Criminales | 15 | Kill 3 criminals |
| `gather_ore` | Mineral para la Forja | 4 | Collect 20 iron ore |
| `slay_undead` | Purga de No-Muertos | 12 | Kill 12 skeletons |
| `dragon_slayer` | El Cazador de Dragones | 20 | Kill a dragon |

---

## NPC AI System

### Behavior Types

| Behavior | Description |
|----------|-------------|
| `passive` | Never attacks, never retaliates |
| `defensive` | Neutral until attacked, then fights back |
| `aggressive` | Attacks players on sight |
| `guard` | City guard — neutral until crime/attack in zone |

### Guard AI

Guards protect city zones and respond to crimes.

```typescript
import npcAI from "./npcAI";

// 1. Define guard zones
npcAI.registerGuardZone({
    mapId: 1,
    centerX: 50,
    centerY: 50,
    radius: 25,
    name: "Ciudad Capital",
});

// 2. Register guard spells
npcAI.registerGuardSpells(guardNpcId, [
    { spellId: 10, type: "offensive", cooldownMs: 5000, lastCastAt: 0, minHpPctToCast: 100, range: 8 },
    { spellId: 15, type: "healing", cooldownMs: 10000, lastCastAt: 0, minHpPctToCast: 50, range: 5 },
    { spellId: 20, type: "crowd_control", cooldownMs: 8000, lastCastAt: 0, minHpPctToCast: 100, range: 6 },
]);

// 3. Initialize guard AI (called automatically when guard is attacked,
//    or call manually when guard NPC spawns)
npcAI.initializeGuardAI(guardNpcId, { x: guardNpc.pos.x, y: guardNpc.pos.y });
```

**Guard Behavior:**
- Neutral to players by default
- Aggro immediately if a player attacks the guard
- Aggro if a player commits a crime (attacks another player) within the guard zone
- Alert nearby guards within `allyAssistRadius` tiles
- Cast spells during combat (offensive, healing, crowd control)
- Leash back to home position if target escapes beyond `leashRadius`

### Defensive NPCs

Non-hostile NPCs that fight back when attacked:

```typescript
import npcAI from "./npcAI";

// When NPC spawns (or via hook):
npcAI.setNpcAIState(npcId, {
    behavior: "defensive",
    aggroOnAttack: true,
    aggroMemoryMs: 15000,
    leashRadius: 10,
});
```

### Aggressive NPCs

NPCs that attack players on sight:

```typescript
import npcAI from "./npcAI";

npcAI.setNpcAIState(npcId, {
    behavior: "aggressive",
    aggroOnAttack: true,
    aggroMemoryMs: 30000,
    leashRadius: 20,
});
```

---

## Integration Hooks

### Quick Start (Server Entry Point)

```typescript
// In server.ts or at the end of initialization:
import { installAllHooks } from "./hooks";

// This activates ALL hooks — quest tracking + NPC AI
installAllHooks();
```

### What Hooks Are Installed

| Hook | Original Function | Added Behavior |
|------|-------------------|----------------|
| `markNpcAggressor` | `game.markNpcAggressor` | Triggers guard AI when guard is attacked |
| `npcAttackUser` | `npcs.npcAttackUser` | Processes guard AI tick |
| `muereNpc` | `npcs.muereNpc` | Cleans up NPC AI state on death |
| `userDmgNpc` | `game.userDmgNpc` | Emits quest events (npc_killed, damage_dealt) |

### Manual Event Emission

If you need to emit quest events from custom code:

```typescript
import integration from "./integration";

// When an NPC dies
integration.emitNpcKilledEvent(playerId, npcId, npcType, map, pos);

// When an item is collected
integration.emitItemCollectedEvent(playerId, itemId, amount);

// When a player is killed
integration.emitPlayerKilledEvent(killerId, victimId, victimFaction);

// When a location is reached
integration.emitLocationReachedEvent(playerId, map, pos);

// When an item is crafted
integration.emitItemCraftedEvent(playerId, itemId, amount);
```

---

## API Reference

### Quest API (`quests`)

```typescript
// Definitions
quests.getQuestDefinition(questId)              // Get quest definition
quests.getAllQuestDefinitions()                 // List all quests
quests.getAvailableQuestsForLevel(level)        // Quests available at level
quests.getQuestsByStartNpc(npcId)               // Quests starting at NPC
quests.isQuestRegistered(questId)               // Check if quest exists
quests.reloadQuestDefinitions(definitions)       // Hot-reload quests

// Player State
quests.getPlayerQuestState(playerId, questId)     // Get quest state
quests.getPlayerQuests(playerId)                 // All player quests
quests.getPlayerActiveQuests(playerId)          // Active quests only
quests.getPlayerCompletedQuests(playerId)       // Completed/turned-in quests
quests.getSerializableQuestState(playerId)      // For client sync

// Lifecycle
quests.canStartQuest(playerId, questId, level)  // Check eligibility
quests.startQuest(playerId, questId)             // Start quest
quests.completeQuest(playerId, questId)          // Force complete
quests.turnInQuest(playerId, questId)            // Turn in for rewards
quests.failQuest(playerId, questId)              // Mark as failed
quests.abandonQuest(playerId, questId)           // Abandon quest
quests.resetQuest(playerId, questId)             // Reset repeatable quest

// Status
quests.isQuestActive(playerId, questId)         // Is quest active?
quests.isQuestCompleted(playerId, questId)       // Is quest completed?
quests.isQuestTurnedIn(playerId, questId)        // Is quest turned in?

// Progress
quests.updateObjectiveProgress(playerId, questId, objectiveId, amount)
quests.checkExpiredQuests(playerId)             // Check time-limited quests
quests.getQuestProgress(playerId, questId)       // { current, required, percentage }

// Events
quests.onQuestEvent(listener)                   // Listen for quest events
quests.onQuestProgress(callback)                // Listen for progress updates
quests.onQuestCompletion(callback)              // Listen for completions
quests.emitQuestEvent(playerId, event)          // Emit custom event
```

### NPC AI API (`npcAI`)

```typescript
// Base AI
npcAI.configureNpcAI(config)                    // Global AI config
npcAI.getNpcAIState(npcId)                      // Get AI state
npcAI.setNpcAIState(npcId, partialState)        // Update AI state
npcAI.removeNpcAIState(npcId)                   // Clean up on NPC death
npcAI.getNpcBehavior(npcId)                     // Get behavior type
npcAI.setNpcBehavior(npcId, behavior)           // Set behavior
npcAI.isNpcAggro(npcId)                         // Is NPC aggroed?
npcAI.setNpcAggro(npcId, attackerId)            // Set aggro target
npcAI.shouldNpcFightBack(npcId)                 // Will NPC retaliate?
npcAI.processNpcAITick()                        // Process all NPC AI ticks

// Guard AI
npcAI.configureGuardAI(config)                  // Guard-specific config
npcAI.registerGuardZone(zone)                   // Add guard zone
npcAI.getGuardZones()                           // List guard zones
npcAI.isInGuardZone(mapId, pos)                 // Check if position is guarded
npcAI.registerGuardSpells(npcId, spells)        // Assign spells to guard
npcAI.getGuardSpells(npcId)                     // Get guard's spells
npcAI.initializeGuardAI(npcId, homePos)         // Initialize guard
npcAI.handleGuardAttacked(npcId, attackerId)    // Guard was attacked
npcAI.handleGuardCrimeWitnessed(npcId, criminalId) // Crime in zone
npcAI.shouldGuardAttackPlayer(npcId)            // Should guard attack?
npcAI.getGuardSpellToCast(npcId, targetHpPct)   // Get next spell to cast
npcAI.processGuardAITick(npcId)                 // Process guard AI tick
```

---

## Configuration

### Default NPC AI Config

```typescript
{
    defaultBehavior: "passive",
    aggroMemoryMs: 15000,      // How long NPC remembers attacker
    leashRadius: 15,           // Max distance from home before de-aggro
    assistNearbyAllies: true,  // Alert nearby allies when attacked
    allyAssistRadius: 8,       // Radius to alert allies
}
```

### Default Guard AI Config

```typescript
{
    spellCooldownMs: 6000,     // Global spell cooldown
    aggroMemoryMs: 30000,      // How long guard remembers criminal
    leashRadius: 20,           // Max patrol distance from home
    assistNearbyGuards: true,  // Alert nearby guards
    allyAssistRadius: 10,      // Radius to alert other guards
}
```

---

## NPC Type Reference

| Type | Name | Description |
|------|------|-------------|
| 0 | `comun` | Common NPC (passive) |
| 1 | `sacerdote` | Priest |
| 2 | `guardia` | **City Guard** (uses Guard AI) |
| 3 | `entrenador` | Trainer |
| 4 | `banquero` | Banker |
| 5 | `noble` | Noble |
| 6 | `dragon` | Dragon |
| 7 | `timbero` | Lumberjack |
| 8 | `guardiaCaos` | **Chaos Guard** (uses Guard AI) |
| 9 | `sacerdoteNewbie` | Newbie Priest |
| 10 | `comerciante` | Merchant |
| 12 | `subastador` | Auctioneer |

---

## Common Patterns

### Making a Non-Hostile NPC Fight Back

```typescript
// When NPC spawns or via admin command:
npcAI.setNpcAIState(npcId, {
    behavior: "defensive",
    aggroOnAttack: true,
    aggroMemoryMs: 15000,
    leashRadius: 10,
});
```

### Creating a New Guard Zone

```typescript
npcAI.registerGuardZone({
    mapId: 50,
    centerX: 30,
    centerY: 30,
    radius: 15,
    name: "Northern Outpost",
});
```

### Adding a Custom Quest

```typescript
import { registerQuest } from "./quests/questRegistry";

registerQuest({
    id: "custom_boss_hunt",
    name: "Boss Hunt",
    description: "Defeat the boss.",
    levelRequirement: 25,
    objectives: [
        {
            id: "kill_boss",
            type: "kill_npc",
            targetId: 99,
            targetName: "Boss",
            requiredAmount: 1,
            currentAmount: 0,
            description: "Defeat the boss",
        },
    ],
    rewards: [
        { type: "exp", amount: 10000 },
        { type: "gold", amount: 5000 },
        { type: "item", amount: 1, itemId: 999 },
    ],
});
```

### Listening for Quest Completions

```typescript
import quests from "./quests";

quests.onQuestCompletion((playerId, questId) => {
    console.log(`Player ${playerId} completed quest ${questId}`);
    // Send notification, update UI, etc.
});
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Guard doesn't aggro when attacked | Ensure `installAllHooks()` was called at startup |
| Guard doesn't cast spells | Register spells with `npcAI.registerGuardSpells()` |
| Quest progress not updating | Check that `userDmgNpc` hook is installed |
| NPC AI state lost on respawn | Re-initialize AI state in respawn handler |
| Guard zone not working | Verify map ID and coordinates with `npcAI.isInGuardZone()` |
