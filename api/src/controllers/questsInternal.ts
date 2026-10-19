import { Request, Response } from "express";
import pool from "../db";
import { QuestsRepositoryImpl } from "../repositories/quests";

const questsRepo = new QuestsRepositoryImpl(pool);

export async function getQuestsForCharacter(request: Request, response: Response) {
    try {
        const characterId = request.params.characterId;
        if (!characterId) {
            response.status(400).json({ error: "characterId es requerido" });
            return;
        }
        const quests = await questsRepo.getQuestsByCharacter(characterId);
        response.json(quests);
    } catch (error) {
        console.error("Failed to load quests for character", error);
        response.status(500).json({ error: "Internal server error" });
    }
}

export async function saveQuestForCharacter(request: Request, response: Response) {
    try {
        const characterId = request.params.characterId;
        const state = request.body;
        if (!characterId || !state) {
            response.status(400).json({ error: "Datos insuficientes" });
            return;
        }
        await questsRepo.upsertQuest(characterId, state);
        response.json({ ok: true });
    } catch (error) {
        console.error("Failed to save quest for character", error);
        response.status(500).json({ error: "Internal server error" });
    }
}

export async function deleteQuestForCharacter(request: Request, response: Response) {
    try {
        const characterId = request.params.characterId;
        const questId = request.params.questId;
        if (!characterId || !questId) {
            response.status(400).json({ error: "characterId y questId son requeridos" });
            return;
        }
        await questsRepo.deleteQuest(characterId, questId);
        response.json({ ok: true });
    } catch (error) {
        console.error("Failed to delete quest for character", error);
        response.status(500).json({ error: "Internal server error" });
    }
}
