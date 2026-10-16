export {};

const funct = require("./functions");

/**
 * Golpe crítico universal (v1).
 * - 5% base tanto en melee (min_hit/max_hit) como en hechizos.
 * - Solo se tira si el golpe YA acertó; multiplica el daño tras armadura base.
 * - Los atacantes NPC no critican (dificultad estable en PvE).
 */

const CRIT_BASE_CHANCE_PCT = 5;
const CRIT_MAX_CHANCE_PCT = 30;
const CRIT_MELEE_MULT = 1.5;
const CRIT_SPELL_MULT = 1.4;
const CRIT_KIND_MELEE = 0;
const CRIT_KIND_SPELL = 1;

const clampCritChance = (chance: number): number => {
    if (!Number.isFinite(chance)) {
        return CRIT_BASE_CHANCE_PCT;
    }

    return Math.max(5, Math.min(CRIT_MAX_CHANCE_PCT, chance));
};

const rollCrit = (chancePct?: number): boolean => {
    const chance = clampCritChance(Number(chancePct ?? CRIT_BASE_CHANCE_PCT));
    return funct.randomIntFromInterval(1, 100) <= chance;
};

const applyCritMultiplier = (damage: number, kind: number): number => {
    const mult = kind === CRIT_KIND_SPELL ? CRIT_SPELL_MULT : CRIT_MELEE_MULT;
    return Math.max(1, Math.floor(Number(damage) * mult));
};

module.exports = {
    CRIT_BASE_CHANCE_PCT,
    CRIT_MAX_CHANCE_PCT,
    CRIT_MELEE_MULT,
    CRIT_SPELL_MULT,
    CRIT_KIND_MELEE,
    CRIT_KIND_SPELL,
    clampCritChance,
    rollCrit,
    applyCritMultiplier,
};
