import { Pool } from 'pg';
import type { PlayerQuestState } from '../../server/src/quests/questTypes';

export interface QuestsRepository {
    getQuestsByCharacter(characterId: string): Promise<PlayerQuestState[]>;
    getQuestByCharacter(characterId: string, questId: string): Promise<PlayerQuestState | null>;
    upsertQuest(characterId: string, state: PlayerQuestState): Promise<void>;
    deleteQuest(characterId: string, questId: string): Promise<void>;
}

export class QuestsRepositoryImpl implements QuestsRepository {
    constructor(private pool: Pool) {}

    async getQuestsByCharacter(characterId: string): Promise<PlayerQuestState[]> {
        const { rows } = await this.pool.query(
            'SELECT quest_id as "questId", status, objectives, started_at as "startedAt", expires_at as "expiresAt", completed_at as "completedAt", turned_in_at as "turnedInAt" FROM character_quests WHERE character_id = $1',
            [characterId]
        );
        return rows.map(row => ({
            ...row,
            questId: row.questId
        }));
    }

    async getQuestByCharacter(characterId: string, questId: string): Promise<PlayerQuestState | null> {
        const { rows } = await this.pool.query(
            'SELECT quest_id as "questId", status, objectives, started_at as "startedAt", expires_at as "expiresAt", completed_at as "completedAt", turned_in_at as "turnedInAt" FROM character_quests WHERE character_id = $1 AND quest_id = $2',
            [characterId, questId]
        );
        return rows[0] ? { ...rows[0], questId: rows[0].questId } : null;
    }

    async upsertQuest(characterId: string, state: PlayerQuestState): Promise<void> {
        await this.pool.query(
            `INSERT INTO character_quests (character_id, quest_id, status, objectives, started_at, expires_at, completed_at, turned_in_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (character_id, quest_id)
             DO UPDATE SET
                status = EXCLUDED.status,
                objectives = EXCLUDED.objectives,
                started_at = EXCLUDED.started_at,
                expires_at = EXCLUDED.expires_at,
                completed_at = EXCLUDED.completed_at,
                turned_in_at = EXCLUDED.turned_in_at,
                updated_at = NOW()`,
            [
                characterId,
                state.questId,
                state.status,
                JSON.stringify(state.objectives),
                state.startedAt ? new Date(state.startedAt) : null,
                state.expiresAt ? new Date(state.expiresAt) : null,
                state.completedAt ? new Date(state.completedAt) : null,
                state.turnedInAt ? new Date(state.turnedInAt) : null
            ]
        );
    }

    async deleteQuest(characterId: string, questId: string): Promise<void> {
        await this.pool.query('DELETE FROM character_quests WHERE character_id = $1 AND quest_id = $2', [characterId, questId]);
    }
}
