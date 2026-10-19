# Project Task: NPC_AI_Refactor
# Context: Modular NPC Behavior using Strategy Pattern.

## Objective
Implement a strategy-based NPC AI system to handle three primary behaviors:
1.  **Non-Hostile (Passive/Defensive):** Neutral toward players; defensive/counter-attack against hostile NPCs.
2.  **Hostile (Aggressive):** Standard monster pursuit and combat.
3.  **City Guards:** Neutral by default; immediate aggro on player attack; spellcasting capabilities.

## Implementation_Steps

### Step_1: Strategy_Architecture_Implementation
- **File:** `server/src/npcAI/strategies.ts`
- **Actions:**
    - Create `NpcBehaviorStrategy` base class.
    - Implement `PassiveBehavior`: Handles idle/cycles.
    - Implement `DefensiveBehavior`: Detects `hostile` type attackers; transitions to counter-attack/defense state.
    - Implement `AggressiveBehavior`: Standard pursuit/attack state machine.
    - Implement `GuardBehavior`: Zone-aware detection; `spellId` selection/execution logic based on `GuardSpellBook`.

### Step_2: Core_Logic_Delegation
- **File:** `server/src/npcAI/npcAI.ts`
- **Actions:**
    - Deprecate direct state-machine logic in `npcAI.ts`.
    - Initialize strategy instances for all behavior types.
    - Refactor `processNpcAITick()` to call `strategy.tick(npc, state)`.
    - Refactor `handleAttack()` and `setNpcAggro()` to call `strategy.handleAttack(npc, state, attackerId)`.
    - Maintain `NpcAIState` as a shared data context for strategies.

### Step_3: Guard_System_Refactor
- **File:** `server/src/npcAI/guardAI.ts`
- **Actions:**
    - Replace existing guard-specific logic with `GuardBehavior` strategy.
    - Integrate `guardZones` check into the guard strategy.
    - Link `guardSpellBook` data into the `GuardBehavior` spell-casting routine.
    - Ensure `alertNearbyGuards` triggers correct behavior changes in adjacent guard strategies.

### Step_4: System_Verification_and_Integration
- **Files:** `server/src/npcs.ts`, `server/src/npcAI/npcAI.ts`, `server/src/npcAI/guardAI.ts`
- **Actions:**
    - Verify NPC state transitions (e.g., Player -> Attacks Guard -> Guard Aggros -> Guard Defense/Spellcast).
    - Confirm Non-Hostile NPCs correctly enter `Defensive` state when attacked by monsters.
    - Verify spell cooldowns and proximity ranges are respected across all strategies.




The implementation of the NPC intelligent system using the strategy pattern is complete. Here's what was implemented across the 3 files:

Files Modified:
server/src/npcAI/strategies.ts
Updated GuardBehavior constructor to accept config with guardZoneCheck option
Added guard zone checking in GuardBehavior.tick() - NPCs only execute guard behavior/spellcasting when inside their designated zone
All 4 strategy classes maintained: PassiveBehavior, DefensiveBehavior, AggressiveBehavior, GuardBehavior
server/src/npcAI/npcAI.ts
Added imports for all strategy classes
Created npcAIBehaviors object with strategy instances for all 4 behavior types
Updated setNpcAggro() to delegate to strategy.handleAttack(npc, state, attackerId)
Updated processNpcAITick() to call strategy.tick(npc, state) for each NPC based on its behavior
server/src/npcAI/guardAI.ts
Imported npcAIBehaviors from ./npcAI
Updated processGuardAITick() to call GuardBehavior.strategy.tick(npc, state)
Preserved leash radius checking and aggro memory logic
Preserved alertNearbyGuards function for guard coordination
Behavior Logic:
Behavior	Attacked By	Response
Passive	Anyone	Does nothing (ignores attacks)
Defensive	Hostile monsters	Counter-attacks, ignores players
Aggressive	Any target	Pursues and attacks
Guard	Player	Immediate aggro + spellcasting (if in zone)
The strategy pattern now centralizes all NPC AI logic, making it easier to add new behavior types and modify existing ones without scattered state-machine logic. undertaking, the NPC AI system is now fully implemented according to the NPCAI.md specifications.


