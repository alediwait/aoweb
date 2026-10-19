# AI-STATE: QUEST-NPC-ENHANCEMENTS

## TARGET_STATE
- Persistence: `QuestTracker` $\rightarrow$ `API` $\rightarrow$ `PostgreSQL` (character_quests)
- Quest-Events: `Combat` $\rightarrow$ `QuestIntegration` $\rightarrow$ `QuestTracker`
- AI-Logic: `npcAttackUser` $\rightarrow$ `shouldNpcFightBack` $\rightarrow$ `TargetSelection`
- Guard-AI: `ProtectedTarget` $\rightarrow$ `CrimeEvent` $\rightarrow$ `GuardAggro`

## WORK_GRAPH
### [S1] QUEST_PERSISTENCE
- [x] DB Schema: `character_quests` table
- [x] API Repo: `QuestsRepositoryImpl`
- [x] API Ctrl: `questsInternal.ts`
- [ ] Server-Link: `questTracker.ts` $\rightarrow$ `API` (fetch/save)
- [ ] Init: `server/src/server.ts` $\rightarrow$ `initializeQuestIntegration()`

### [S2] COMBAT_HOOKS
- [x] Melee-Damage: `npcs.ts` $\rightarrow$ `emitDamageDealtEvent`
- [ ] Spell-Damage: `PlayerCast` $\rightarrow$ `emitDamageDealtEvent` (Location: TBD, likely `game.ts` or `spells.ts`)
- [ ] NPC-Death: `npcs.ts:muereNpc` $\rightarrow$ `emitNpcKilledEvent`

### [S3] AI_REFINEMENT
- [x] Neutrality: `npcAttackUser` $\rightarrow$ `shouldNpcFightBack`
- [ ] Guard-Protected: `NPC-Attack` $\rightarrow$ `ProtectedTargetCheck` $\rightarrow$ `GuardAggro`
- [ ] Guard-Magic: `npcAttackUser` $\rightarrow$ `handleGuardSpellCast`

## CURRENT_CURSOR
- File: `server/src/npcs.ts`
- Last Action: Attempted `emitDamageDealtEvent` in melee loop.
- Next Step: `emitNpcKilledEvent` in `muereNpc` + find player spell damage location.

## DEPENDENCIES
- `api/src/repositories/quests.ts` (Implemented)
- `api/src/controllers/questsInternal.ts` (Implemented)
- `server/src/integration/questIntegration.ts` (Existing skeleton)
