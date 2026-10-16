/**
 * Tipos del sistema de partículas custom sobre PixiJS 8.
 *
 * Diseño: emisores lógicos (EmitterConfig) que spawnean `Particle` de Pixi
 * dentro de `ParticleContainer` (un contenedor por textura/blend, todos los
 * píxeles comparten una única textura radial generada en `textures.ts`).
 * Cero dependencias nuevas, cero `new` por frame (pooling total).
 */

export type FXBlendPool = "add" | "normal" | "spark";

export type FXQualityLevel = "alto" | "medio" | "bajo";

export interface FXViewport {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface FXGlowSpec {
    /** Diámetro en px del halo. */
    size: number;
    color: number;
    alpha: number;
    /** Velocidad del pulso (rad/s). 0 = sin pulso. */
    pulseSpeed: number;
    /** Amplitud del pulso (0-1). */
    pulseAmount: number;
}

export interface EmitterConfig {
    /** Identificador del preset (ej. 'torch-flame'). */
    id: string;
    /** En qué pool/contenedor vive (una textura + un blend por pool). */
    pool: FXBlendPool;
    /** Techo de partículas vivas de este emisor. */
    maxParticles: number;
    /** Partículas por segundo (solo emisores loopeados). */
    spawnRate: number;
    /** Para bursts de un solo disparo (ignorado en loop). */
    burstCount?: number;
    /** Vida de cada partícula en ms [min, max]. */
    lifetime: [number, number];
    /** Velocidad inicial px/s [min, max]. */
    speed: [number, number];
    /**
     * Dirección base en radianes + dispersión.
     * Ej. llama: -PI/2 (hacia arriba) con spread 0.35.
     */
    angle: [number, number];
    /** Gravedad px/s². */
    gravity: { x: number; y: number };
    /** Fricción (1/s). v *= (1 - drag*dt). */
    drag: number;
    /** Radio del disco de spawn alrededor del ancla (px). */
    spawnRadius: number;
    /**
     * Segmento de spawn (coords relativas al ancla). Si está presente se
     * spawnea sobre la línea en vez del disco (ej. rayo divino vertical).
     */
    line?: { x1: number; y1: number; x2: number; y2: number };
    /** Tamaño inicial en px [min, max] (diámetro aprox). */
    sizeStart: [number, number];
    /** Multiplicador del tamaño inicial al morir (ej. humo crece: 2.6). */
    sizeEndMult: number;
    /** Alpha [inicio, fin]. */
    alpha: [number, number];
    /** Tinte lerp [inicio, fin] (hex). */
    color: [number, number];
    /** Amplitud del wobble senoidal (px). 0 = desactivado. */
    turbulence: number;
    /** Parpadeo 0-1 (brasas). 0 = desactivado. */
    flicker: number;
    /** Rotación inicial [min, max] rad + velocidad [min, max] rad/s. */
    rotation?: [number, number];
    rotationSpeed?: [number, number];
    /**
     * Movimiento orbital alrededor del ancla (meditación): ignora
     * velocidad/gravedad y gira sobre elipse (squash vertical 0.72).
     */
    orbit?: {
        radius: [number, number];
        angularSpeed: [number, number];
        verticalAmp: number;
        verticalFreq?: number;
    };
    /** Halo ADD pulsante opcional (antorchas, fogatas, auras). */
    glow?: FXGlowSpec;
    /** Margen extra (px) para no spawnear fuera de viewport. */
    cullMargin?: number;
}

/** Parámetros resueltos por partícula (una fila del pool SoA). */
export interface ResolvedSpawn {
    x: number;
    y: number;
    vx: number;
    vy: number;
    lifeMs: number;
    sizeStartPx: number;
    sizeEndMult: number;
    alphaStart: number;
    alphaEnd: number;
    colorStart: number;
    colorEnd: number;
    gravityX: number;
    gravityY: number;
    drag: number;
    turbulence: number;
    flicker: number;
    seed: number;
    rotation: number;
    rotationSpeed: number;
    orbit?: {
        centerX: number;
        centerY: number;
        radius: number;
        startAngle: number;
        angularSpeed: number;
        verticalAmp: number;
        verticalFreq: number;
    };
}

export interface FXStats {
    aliveAdd: number;
    aliveNormal: number;
    aliveSpark: number;
    aliveTotal: number;
    emitters: number;
    flashes: number;
    glows: number;
    dropped: number;
    quality: FXQualityLevel;
    qualityScale: number;
}
