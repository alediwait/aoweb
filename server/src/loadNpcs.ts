export {};
import { buildNpcRespawnKey, getNpcRespawnCooldown, initializeNpcRespawnCooldowns } from "./npcRespawnCooldowns";
import { loadAllMapNpcPlacements, replaceAllMapNpcPlacements } from "./mapNpcStorage";
const { initializeNpcTemplatesFromApi } = require("./gameDataSync");
const game = require("./game");
const vars = require("./vars");
const npcs = require("./npcs");
const login = require("./login");

const _ = require("lodash");

class LoadNpcs {
    constructor() {}

    async initialize() {
        await this.load();

        console.log("NPCS Cargados.");
    }

    load() {
        return new Promise(async (resolve: any, reject: any) => {
            vars.datNpc = {};

            try {
                const result = await initializeNpcTemplatesFromApi();
                console.log(
                    `[GAME DATA] NPC templates hidratados desde DB: ${result.loadedTemplates}. Version aplicada: ${result.currentVersion}.`,
                );
                if (result.loadedTemplates <= 0) {
                    reject(new Error("No se pudieron cargar NPCs desde la API."));
                    return;
                }
            } catch (error) {
                reject(error);
                return;
            }

            const cooldownKeys = initializeNpcRespawnCooldowns((npc: any) => {
                this.createNpcInMap(npc, true, true);
            });

            const npcsInMap = loadAllMapNpcPlacements();

            npcsInMap.map((npc: any) => {
                if (cooldownKeys.has(buildNpcRespawnKey(npc))) {
                    return;
                }

                this.createNpcInMap(npc, true);
            });

            resolve(true);
        });
    }

    createNpcInMap(npc: any, skipRespawnCooldownCheck = false, forceRandomSpawn = false) {
        const { x, y, mapNum, npcIndex } = npc;

        if (!vars.mapData[mapNum]) return;

        if (!skipRespawnCooldownCheck && getNpcRespawnCooldown({ mapNum, x, y, npcIndex })) {
            return;
        }

        let tmpNPC = _.cloneDeep(npcs.createNpc());

        tmpNPC.id = login.createId();
        tmpNPC.templateNpcIndex = Number(npcIndex);
        tmpNPC.spawnMapNum = Number(mapNum);
        tmpNPC.spawnOrigin = {
            x: parseInt(x),
            y: parseInt(y),
        };
        tmpNPC.map = mapNum;

        const datNpc = vars.datNpc[npcIndex];

        tmpNPC.pos.x = parseInt(x);
        tmpNPC.pos.y = parseInt(y);
        tmpNPC.nameCharacter = datNpc.name;
        tmpNPC.color = "white";
        tmpNPC.isNpc = true;
        tmpNPC.idBody = datNpc.idBody;
        tmpNPC.idHead = datNpc.idHead;
        tmpNPC.movement = Number.isInteger(Number(npc.movement)) ? Number(npc.movement) : datNpc.movement;
        tmpNPC.npcType = parseInt(datNpc.npcType);
        tmpNPC.exp = datNpc.exp;
        if (datNpc.gold) tmpNPC.gold = datNpc.gold;
        tmpNPC.hp = datNpc.hp;
        tmpNPC.maxHp = datNpc.maxHp;
        tmpNPC.minHit = datNpc.minHit;
        tmpNPC.maxHit = datNpc.maxHit;
        tmpNPC.def = datNpc.def;
        tmpNPC.defM = datNpc.defM ?? datNpc.magicDef ?? 0;
        tmpNPC.magicDef = datNpc.magicDef ?? datNpc.defM ?? 0;
        tmpNPC.magicResistance = datNpc.magicResistance ?? 0;
        tmpNPC.poderAtaque = datNpc.poderAtaque;
        tmpNPC.poderEvasion = datNpc.poderEvasion;
        tmpNPC.snd1 = datNpc.snd1 ?? 0;
        tmpNPC.snd2 = datNpc.snd2 ?? 0;
        tmpNPC.soundClose = datNpc.soundClose ?? 0;
        tmpNPC.spellCastIntervalMs = datNpc.spellCastIntervalMs ?? 0;
        tmpNPC.spellRange = datNpc.spellRange ?? 0;
        tmpNPC.spells = Array.isArray(datNpc.spells)
            ? datNpc.spells
                  .filter((spell: any) => Number(spell?.idSpell ?? 0) > 0)
                  .map((spell: any) => ({
                      idSpell: Number(spell.idSpell),
                      cooldownSeconds: Math.max(0, Number(spell.cooldownSeconds ?? 0)),
                      lastUsedAt: 0,
                  }))
            : [];
        if (datNpc.drop) tmpNPC.drop = datNpc.drop;
        if (datNpc.objs) tmpNPC.objs = datNpc.objs;
        tmpNPC.aguaValida = datNpc.aguaValida;
        tmpNPC.tierraInvalida = datNpc.tierraInvalida ?? 0;
        if (datNpc.desc) tmpNPC.desc = datNpc.desc;

        if (forceRandomSpawn) {
            const respawnPos = game.respawnNpc(mapNum, Boolean(tmpNPC.aguaValida), Boolean(tmpNPC.tierraInvalida));
            tmpNPC.pos.x = respawnPos.posNewX;
            tmpNPC.pos.y = respawnPos.posNewY;
        } else if (
            !game.validInitialNpcSpawn(
                tmpNPC.pos,
                mapNum,
                Boolean(tmpNPC.aguaValida),
                Number(tmpNPC.movement ?? 0),
                Boolean(tmpNPC.tierraInvalida),
            )
        ) {
            const respawnPos = game.respawnNpc(mapNum, Boolean(tmpNPC.aguaValida), Boolean(tmpNPC.tierraInvalida));
            tmpNPC.pos.x = respawnPos.posNewX;
            tmpNPC.pos.y = respawnPos.posNewY;
        }

        const clan = vars.clanNpc[tmpNPC.npcType];

        if (clan) {
            tmpNPC.clan = clan;
        }

        vars.npcs[tmpNPC.id] = tmpNPC;
        vars.npcs[tmpNPC.id].cooldownAtaque = +Date.now() + 4000;
        vars.areaNpc[tmpNPC.id] = [];

        vars.mapData[mapNum][tmpNPC.pos.y][tmpNPC.pos.x].id = tmpNPC.id;

        // Initialize NPC AI behavior based on npcType
        this.initializeNpcAI(tmpNPC);
    }

    initializeNpcAI(npc: any) {
        const npcAI = require("./npcAI/npcAI");
        const guardAI = require("./npcAI/guardAI");

        // Determine behavior based on npcType
        // 0: comun (monsters), 6: dragon - aggressive
        // 2: guardia, 8: guardiaCaos - guard
        // Others: passive (merchants, NPCs)
        // Defensive behavior for neutral NPCs that should fight back vs monsters
        let behavior: "passive" | "defensive" | "aggressive" | "guard" = "passive";

        switch (npc.npcType) {
            case 0: // comun - monsters
            case 6: // dragon
                behavior = "aggressive";
                break;
            case 2: // guardia
            case 8: // guardiaCaos
                behavior = "guard";
                break;
            // Add explicit case for NPCs that should be defensive (if any specific types)
            default:
                // Check if this is a neutral NPC that should defend itself
                // For now, default to passive
                behavior = "passive";
                break;
        }

        // Allow defensive behavior for NPCs that should fight back vs monsters
        // This can be extended based on NPC data
        if (behavior === "passive" && npc.poderAtaque > 0 && npc.minHit > 0) {
            // NPCs with attack power but not marked as aggressive could be defensive
            // behavior = "defensive";
        }

        const homePosition = { x: npc.pos.x, y: npc.pos.y };

        // Use type assertion to avoid TypeScript narrowing issues
        const b = behavior as "passive" | "defensive" | "aggressive" | "guard";

        if (b === "guard") {
            guardAI.initializeGuardAI(npc.id, homePosition);
        } else {
            const state = npcAI.createDefaultNpcAIState();
            state.behavior = b;
            state.homePosition = homePosition;
            state.leashRadius = 15;
            state.aggroMemoryMs = 15000;
            if (b === "defensive") {
                state.aggroOnAttack = true;
            }
            if (b === "aggressive") {
                state.aggroMemoryMs = 30000;
                state.leashRadius = 20;
            }
            npcAI.setNpcAIState(npc.id, state);
        }
    }

    createJsonNpcsInMap() {
        return new Promise((resolve: any) => {
            const arNpcInMap: Array<{ mapNum: number; y: number; x: number; npcIndex: number }> = [];

            for (let mapNum = 1; mapNum < 291; mapNum++) {
                for (let mapaY = 1; mapaY <= 100; mapaY++) {
                    for (let mapaX = 1; mapaX <= 100; mapaX++) {
                        if (!vars.mapa[mapNum]) break;

                        const npcIndex = vars.mapa[mapNum][mapaY][mapaX].npcIndex;

                        if (npcIndex) {
                            arNpcInMap.push({
                                mapNum: mapNum,
                                y: mapaY,
                                x: mapaX,
                                npcIndex: npcIndex,
                            });
                        }
                    }
                }
            }

            replaceAllMapNpcPlacements(arNpcInMap);

            resolve(true);
        });
    }
}

module.exports = LoadNpcs;
