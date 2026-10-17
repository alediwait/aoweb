/**
 * Efectos 100% partículas para hechizos (reemplazo de los FX por imagen).
 *
 * La clave es el spellId (NO el fxGrh: hay colisiones, ej. fx7 lo usan 7
 * hechizos y fx3 Toxina y Ojo del Demiurgo). Tabla explícita por hechizo +
 * fallback por flags para hechizos futuros. La espectacularidad escala con
 * el maná (y con daño >= 1000 directo a máximo).
 */

export type SpellArchetype =
    | "fire"
    | "electric"
    | "ice"
    | "poison"
    | "holy"
    | "heal"
    | "dark"
    | "arcane"
    | "bind"
    | "cleanse"
    | "shimmer"
    | "summon"
    | "drain"
    | "nature"
    | "earth";

export interface SpellLike {
    spellId?: number | null;
    name?: string | null;
    desc?: string | null;
    manaRequired?: number | null;
    minHp?: number | null;
    maxHp?: number | null;
    subeHp?: number | null;
    paraliza?: number | null;
    inmoviliza?: number | null;
    invisibilidad?: number | null;
    revivir?: number | null;
    removerParalisis?: number | null;
    subeAg?: number | null;
    subeFz?: number | null;
}

export interface SpellFXSpec {
    arch: SpellArchetype;
    colors: { start: number; end: number };
    /** Rayos quebrados extra (eléctricos y cataclismos). */
    bolts: number;
    /** Rayo divino vertical (resurrección, ira divina). */
    ray: boolean;
    /** Trauma de shake 0-1 (0 = sin shake). */
    shake: number;
    /** Segunda explosión de humo (fuego/explosiones). */
    smoke: boolean;
    /** Columna dorada ascendente (invocaciones, grandes curas, buffs). */
    rise: boolean;
}

export interface ResolvedSpellFX extends SpellFXSpec {
    /** Multiplicador global por maná (0.8 – 2.4). */
    scale: number;
}

interface SpellTableEntry {
    arch: SpellArchetype;
    colors: { start: number; end: number };
    bolts?: number;
    ray?: boolean;
    shake?: number;
    smoke?: boolean;
    rise?: boolean;
}

// Tabla explícita por spellId (47 hechizos). Ritmo: daño directo y control
// con maná alto pegan más fuerte visualmente (ver autoShake/autoScale).
const SPELL_FX_TABLE: Record<number, SpellTableEntry> = {
    1: { arch: "cleanse", colors: { start: 0xe8fff0, end: 0x4ade80 } },
    2: { arch: "arcane", colors: { start: 0xf9a8ff, end: 0x60a5fa } },
    3: { arch: "heal", colors: { start: 0xd8ffe8, end: 0x2dd47a } },
    4: { arch: "poison", colors: { start: 0xd8ff9a, end: 0x3fae2a }, smoke: true },
    5: { arch: "heal", colors: { start: 0xfff3c0, end: 0x4ade80 }, rise: true },
    6: { arch: "arcane", colors: { start: 0xb8ffe8, end: 0x38b6ff }, smoke: true },
    7: { arch: "electric", colors: { start: 0xffffff, end: 0x6ab8ff }, bolts: 1 },
    8: { arch: "arcane", colors: { start: 0xc084fc, end: 0x60a5fa }, smoke: true },
    9: { arch: "bind", colors: { start: 0xe8fbff, end: 0x38e1ff }, smoke: true, shake: 0.4  },
    10: { arch: "cleanse", colors: { start: 0xffffff, end: 0x7ef9c6 } },
    11: { arch: "holy", colors: { start: 0xfffbe8, end: 0xffc44d }, ray: true, rise: true },
    12: { arch: "poison", colors: { start: 0xd8c8ff, end: 0x5a8a2a } },
    13: { arch: "poison", colors: { start: 0xe0ff9a, end: 0x2a9a3a } },
    14: { arch: "shimmer", colors: { start: 0xffffff, end: 0x9adcff } },
    15: { arch: "fire", colors: { start: 0xffe08a, end: 0xff4400 }, smoke: true },
    16: { arch: "nature", colors: { start: 0xe8ff9a, end: 0x2fae4a }, rise: true },
    17: { arch: "dark", colors: { start: 0xd8b8ff, end: 0x5a1aff }, rise: true },
    18: { arch: "arcane", colors: { start: 0xb8ffe8, end: 0x38e1ff }, rise: true },
    19: { arch: "bind", colors: { start: 0xd8d8d8, end: 0x5a6a7a } },
    20: { arch: "arcane", colors: { start: 0xffd8a8, end: 0xff6a1a }, rise: true },
    21: { arch: "bind", colors: { start: 0xc8b8d8, end: 0x5a4a6a } },
    22: { arch: "summon", colors: { start: 0xffd8a8, end: 0xcc2200 }, smoke: true, rise: true, shake: 0.4 },
    23: { arch: "electric", colors: { start: 0xffffff, end: 0x6ab8ff }, bolts: 3, shake: 0.9, smoke: true },
    24: { arch: "bind", colors: { start: 0xd8f0ff, end: 0x2a9adf } },
    25: { arch: "fire", colors: { start: 0xfff3b0, end: 0xff3300 }, smoke: true, shake: 0.9 },
    26: { arch: "summon", colors: { start: 0xffe08a, end: 0xcc4400 }, smoke: true, rise: true, shake: 0.5 },
    27: { arch: "ice", colors: { start: 0xe8fbff, end: 0x2a9adf } },
    28: { arch: "earth", colors: { start: 0xe8d8a8, end: 0x7a5a2a }, smoke: true },
    29: { arch: "holy", colors: { start: 0xfffbe8, end: 0xffd34d } },
    30: { arch: "dark", colors: { start: 0x8a8a9a, end: 0x2a2a3a } },
    31: { arch: "dark", colors: { start: 0xd8b8ff, end: 0x7a2bff } },
    32: { arch: "holy", colors: { start: 0xffffff, end: 0xffc44d }, ray: true, bolts: 4, shake: 0.9 },
    33: { arch: "dark", colors: { start: 0xc8a8ff, end: 0x4a1a8a }, rise: true },
    34: { arch: "earth", colors: { start: 0xe8c890, end: 0x7a3a10 }, smoke: true },
    35: { arch: "arcane", colors: { start: 0xd8d8ff, end: 0x8a8aff } },
    36: { arch: "electric", colors: { start: 0xe8f4ff, end: 0x4a9adf }, bolts: 2 },
    37: { arch: "arcane", colors: { start: 0xfff2c0, end: 0xff8a2a } },
    38: { arch: "cleanse", colors: { start: 0xe8fff4, end: 0x4ade80 } },
    39: { arch: "bind", colors: { start: 0xe8fbff, end: 0x38e1ff } },
    40: { arch: "heal", colors: { start: 0xfffbe8, end: 0xffd34d }, rise: true },
    41: { arch: "cleanse", colors: { start: 0xffffff, end: 0x7ef9c6 } },
    42: { arch: "shimmer", colors: { start: 0xffffff, end: 0xb8c8ff } },
    43: { arch: "holy", colors: { start: 0xfffbe8, end: 0xffd34d } },
    44: { arch: "nature", colors: { start: 0xe8ff9a, end: 0x2fae4a } },
    45: { arch: "drain", colors: { start: 0xff9a9a, end: 0x8a0a2a } },
    46: { arch: "summon", colors: { start: 0xffd8a8, end: 0xcc4400 } },
    47: { arch: "holy", colors: { start: 0xfffbe8, end: 0xffd34d } },
};

function spellMana(spell: SpellLike): number {
    return Math.max(0, Number(spell.manaRequired ?? 0) || 0);
}

function spellMaxDamage(spell: SpellLike): number {
    return Math.max(
        Number(spell.minHp ?? 0) || 0,
        Number(spell.maxHp ?? 0) || 0,
    );
}

/** Escala espectáculo por maná (0.8–2.4); daño >= 1000 va directo al tope. */
export function spellIntensityScale(spell: SpellLike): number {
    if (spellMaxDamage(spell) >= 1000) {
        return 2.4;
    }
    return Math.min(2.4, Math.max(0.8, 0.8 + spellMana(spell) / 450));
}

function autoShake(spell: SpellLike): number {
    if (spellMaxDamage(spell) >= 1000) {
        return 0.6;
    }
    const mana = spellMana(spell);
    if (mana >= 800) {
        return 0.55;
    }
    if (mana >= 400) {
        return 0.4;
    }
    if (mana >= 150) {
        return 0.25;
    }
    return 0;
}

function fallbackEntry(spell: SpellLike): SpellTableEntry {
    if (Number(spell.revivir ?? 0) > 0) {
        return {
            arch: "holy",
            colors: { start: 0xfffbe8, end: 0xffc44d },
            ray: true,
            rise: true,
        };
    }
    if (Number(spell.invisibilidad ?? 0) > 0) {
        return {
            arch: "shimmer",
            colors: { start: 0xffffff, end: 0x9adcff },
        };
    }
    if (Number(spell.paraliza ?? 0) > 0 || Number(spell.inmoviliza ?? 0) > 0) {
        return {
            arch: "bind",
            colors: { start: 0xe8fbff, end: 0x38e1ff },
        };
    }
    if (Number(spell.removerParalisis ?? 0) > 0) {
        return {
            arch: "cleanse",
            colors: { start: 0xffffff, end: 0x7ef9c6 },
        };
    }
    if (Number(spell.subeAg ?? 0) > 0) {
        return {
            arch: "arcane",
            colors: { start: 0xb8ffe8, end: 0x38e1ff },
            rise: true,
        };
    }
    if (Number(spell.subeFz ?? 0) > 0) {
        return {
            arch: "arcane",
            colors: { start: 0xffd8a8, end: 0xff6a1a },
            rise: true,
        };
    }
    if (Number(spell.subeHp ?? 0) === 1) {
        return {
            arch: "heal",
            colors: { start: 0xd8ffe8, end: 0x2dd47a },
        };
    }
    if (Number(spell.subeHp ?? 0) === 2) {
        return {
            arch: "arcane",
            colors: { start: 0xf9a8ff, end: 0x60a5fa },
        };
    }
    return {
        arch: "arcane",
        colors: { start: 0xd8c8ff, end: 0x7a5cff },
    };
}

/** Arquetipos utilitarios: nunca shake automático (solo override explícito). */
const QUIET_ARCHETYPES: ReadonlySet<SpellArchetype> = new Set([
    "shimmer",
    "cleanse",
    "heal",
    "nature",
]);

export function resolveSpellFX(spell: SpellLike): ResolvedSpellFX {
    const id = Number(spell.spellId ?? 0);
    const entry = id > 0 ? (SPELL_FX_TABLE[id] ?? null) : null;
    const base = entry ?? fallbackEntry(spell);
    const shake =
        base.shake ??
        (QUIET_ARCHETYPES.has(base.arch) ? 0 : autoShake(spell));
    return {
        arch: base.arch,
        colors: base.colors,
        bolts: base.bolts ?? 0,
        ray: base.ray ?? false,
        shake,
        smoke: base.smoke ?? false,
        rise: base.rise ?? false,
        scale: spellIntensityScale(spell),
    };
}

export interface SpellPlayBurst {
    preset: string;
    scale: number;
    colors: { start: number; end: number };
}

export interface SpellPlay {
    bursts: SpellPlayBurst[];
    flashColor: number;
    flashSize: number;
    bolts: number;
    boltColor: number;
    ray: boolean;
}

/** Convierte un spec resuelto en la composición concreta a ejecutar. */
export function buildSpellPlay(resolved: ResolvedSpellFX): SpellPlay {
    const scale = resolved.scale;
    const mainPreset =
        resolved.arch === "fire"
            ? "impact-fire"
            : resolved.arch === "heal"
              ? "heal"
              : "impact-physical";
    const bursts: SpellPlayBurst[] = [
        { preset: mainPreset, scale, colors: resolved.colors },
    ];
    if (resolved.smoke) {
        bursts.push({ preset: "impact-smoke", scale: scale * 0.9, colors: { start: 0x777777, end: 0x222222 } });
    }
    if (resolved.rise) {
        bursts.push({ preset: "levelup", scale: scale * 0.7, colors: resolved.colors });
    }
    return {
        bursts,
        flashColor: resolved.colors.start,
        flashSize: Math.min(110, 46 * scale),
        bolts: resolved.bolts + (scale >= 1.8 && resolved.bolts > 0 ? 1 : 0),
        boltColor: resolved.colors.start,
        ray: resolved.ray,
    };
}
