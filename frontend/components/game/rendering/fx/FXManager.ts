import { Container, Sprite, type Application } from "pixi.js";
import { ParticlePool } from "./ParticlePool";
import { ensureFXTextures, type FXTextureSet } from "./textures";
import { getFXPreset } from "./presets";
import {
    FX_PARTICLE_BUDGET,
    FX_QUALITY_SCALE,
} from "../../config/fxQuality";
import type {
    EmitterConfig,
    FXQualityLevel,
    FXStats,
    ResolvedSpawn,
} from "./types";

/**
 * Fachada del sistema de partículas.
 *
 * - 3 pools globales (`ParticleContainer`): ADD suave, NORMAL humo, SPARK brasas.
 * - Emisores loopeados con ancla dinámica (`getPos`, ideal para seguir entidades).
 * - Bursts de un disparo, trail de proyectiles, flashes de impacto y halos.
 * - Culling por viewport a nivel de emisor + backpressure por budget global.
 *
 * Uso futuro: `fx.loop('torch-flame', () => tileToWorld(...))`,
 * `fx.burst('impact-fire', x, y)`. Ver `presets.ts` para añadir efectos.
 */

interface ActiveEmitter {
    id: number;
    config: EmitterConfig;
    getPos: () => { x: number; y: number } | null;
    spawnAcc: number;
    elapsedMs: number;
    durationMs: number | null;
    scale: number;
    glow: Sprite | null;
    glowBaseAlpha: number;
}

interface ActiveFlash {
    sprite: Sprite;
    ageMs: number;
    lifeMs: number;
    growMult: number;
    startAlpha: number;
}

const FLASH_POOL_SIZE = 24;
const VIEWPORT_MARGIN = 160;

function randRange(min: number, max: number): number {
    return min + Math.random() * Math.max(0, max - min);
}

function pickPool(
    pools: { add: ParticlePool; normal: ParticlePool; spark: ParticlePool },
    kind: EmitterConfig["pool"],
): ParticlePool {
    if (kind === "normal") {
        return pools.normal;
    }
    if (kind === "spark") {
        return pools.spark;
    }
    return pools.add;
}

export class FXManager {
    private readonly app: Application;
    private readonly parent: Container;
    private textures: FXTextureSet | null = null;
    private pools: {
        add: ParticlePool;
        normal: ParticlePool;
        spark: ParticlePool;
    } | null = null;
    private readonly flashLayer = new Container();
    private readonly glowLayer = new Container();
    private readonly flashes: ActiveFlash[] = [];
    private readonly flashFree: Sprite[] = [];
    private readonly emitters = new Map<number, ActiveEmitter>();
    private nextEmitterId = 1;
    private disposed = false;

    quality: FXQualityLevel = "alto";
    qualityScale = 1;
    /** Contador de spawns descartados (pool lleno / over budget). */
    dropped = 0;

    constructor(app: Application, parent: Container) {
        this.app = app;
        this.parent = parent;
        const textures = ensureFXTextures(app);
        if (!textures) {
            return;
        }
        this.textures = textures;
        this.pools = {
            add: new ParticlePool(textures.soft, textures.size, "add", 2048),
            normal: new ParticlePool(
                textures.smoke,
                textures.size,
                "normal",
                512,
            ),
            spark: new ParticlePool(textures.spark, textures.size, "add", 512),
        };
        // Orden de render: humo debajo, fuego/chispas encima, flashes y halos arriba.
        this.pools.normal.attachTo(parent);
        this.pools.add.attachTo(parent);
        this.pools.spark.attachTo(parent);
        this.flashLayer.blendMode = "add";
        parent.addChild(this.flashLayer);
        this.glowLayer.blendMode = "add";
        parent.addChild(this.glowLayer);
        for (let i = 0; i < FLASH_POOL_SIZE; i += 1) {
            const sprite = new Sprite(textures.soft);
            sprite.anchor.set(0.5);
            sprite.visible = false;
            this.flashLayer.addChild(sprite);
            this.flashFree.push(sprite);
            this.flashes.push({
                sprite,
                ageMs: 0,
                lifeMs: 0,
                growMult: 1,
                startAlpha: 0,
            });
        }
    }

    get ready(): boolean {
        return this.pools !== null && !this.disposed;
    }

    setQuality(q: FXQualityLevel): void {
        this.quality = q;
        this.qualityScale = FX_QUALITY_SCALE[q] ?? 1;
    }

    private resolveConfig(
        config: string | EmitterConfig,
    ): EmitterConfig | null {
        if (typeof config === "string") {
            return getFXPreset(config);
        }
        return config;
    }

    private spawnOne(
        pool: ParticlePool,
        config: EmitterConfig,
        x: number,
        y: number,
        scale: number,
    ): boolean {
        const dirBase = config.angle[0];
        const spread = config.angle[1];
        const dir = dirBase + (Math.random() - 0.5) * 2 * spread;
        const speed = randRange(config.speed[0], config.speed[1]) * scale;
        const dist = Math.sqrt(Math.random()) * config.spawnRadius * scale;
        const ang = Math.random() * Math.PI * 2;
        const rot = config.rotation
            ? randRange(config.rotation[0], config.rotation[1])
            : 0;
        const spawn: ResolvedSpawn = {
            x: x + Math.cos(ang) * dist,
            y: y + Math.sin(ang) * dist,
            vx: Math.cos(dir) * speed,
            vy: Math.sin(dir) * speed,
            lifeMs: randRange(config.lifetime[0], config.lifetime[1]),
            sizeStartPx:
                randRange(config.sizeStart[0], config.sizeStart[1]) * scale,
            sizeEndMult: config.sizeEndMult,
            alphaStart: config.alpha[0],
            alphaEnd: config.alpha[1],
            colorStart: config.color[0],
            colorEnd: config.color[1],
            gravityX: config.gravity.x,
            gravityY: config.gravity.y,
            drag: config.drag,
            turbulence: config.turbulence * scale,
            flicker: config.flicker,
            seed: Math.random(),
            rotation: rot,
            rotationSpeed: config.rotationSpeed
                ? randRange(config.rotationSpeed[0], config.rotationSpeed[1])
                : 0,
        };
        const ok = pool.spawn(spawn);
        if (!ok) {
            this.dropped += 1;
        }
        return ok;
    }

    private aliveTotal(): number {
        if (!this.pools) {
            return 0;
        }
        return (
            this.pools.add.alive +
            this.pools.normal.alive +
            this.pools.spark.alive
        );
    }

    private viewport(): { x: number; y: number; w: number; h: number } {
        const screenW = this.app.screen.width;
        const screenH = this.app.screen.height;
        return {
            x: -this.parent.x - VIEWPORT_MARGIN,
            y: -this.parent.y - VIEWPORT_MARGIN,
            w: screenW + VIEWPORT_MARGIN * 2,
            h: screenH + VIEWPORT_MARGIN * 2,
        };
    }

    private inViewport(
        view: { x: number; y: number; w: number; h: number },
        x: number,
        y: number,
        margin: number,
    ): boolean {
        return (
            x >= view.x - margin &&
            x <= view.x + view.w + margin &&
            y >= view.y - margin &&
            y <= view.y + view.h + margin
        );
    }

    /**
     * Emisor loopeado anclado a una posición dinámica.
     * `getPos` devuelve null cuando el ancla muere (el emisor se auto-killea).
     * Devuelve handle (>0) o 0 si falla.
     */
    loop(
        config: string | EmitterConfig,
        getPos: () => { x: number; y: number } | null,
        opts?: { durationMs?: number; scale?: number },
    ): number {
        const resolved = this.resolveConfig(config);
        if (!resolved || !this.ready || !this.pools || !this.textures) {
            return 0;
        }
        const id = this.nextEmitterId++;
        let glow: Sprite | null = null;
        let glowBaseAlpha = 0;
        if (resolved.glow && this.glowLayer.children.length < 48) {
            glow = new Sprite(this.textures.soft);
            glow.anchor.set(0.5);
            glow.tint = resolved.glow.color;
            glowBaseAlpha = resolved.glow.alpha;
            glow.alpha = glowBaseAlpha;
            const s = (resolved.glow.size * (opts?.scale ?? 1)) / this.textures.size;
            glow.scale.set(Math.max(0.05, s));
            this.glowLayer.addChild(glow);
        }
        this.emitters.set(id, {
            id,
            config: resolved,
            getPos,
            spawnAcc: 0,
            elapsedMs: 0,
            durationMs: opts?.durationMs ?? null,
            scale: opts?.scale ?? 1,
            glow,
            glowBaseAlpha,
        });
        return id;
    }

    /** Burst de un disparo (impactos, heal, levelup...). */
    burst(
        config: string | EmitterConfig,
        x: number,
        y: number,
        countScale = 1,
    /** Tinte override para reutilizar presets con colores de hechizo. */
    colors?: { start: number; end: number },
    ): void {
        const resolved = this.resolveConfig(config);
        if (!resolved || !this.ready || !this.pools) {
            return;
        }
        const effective: EmitterConfig = colors
            ? { ...resolved, color: [colors.start, colors.end] }
            : resolved;
        let count = Math.round(
            (effective.burstCount ?? effective.maxParticles) *
                this.qualityScale *
                countScale,
        );
        if (this.aliveTotal() > FX_PARTICLE_BUDGET[this.quality]) {
            count = Math.ceil(count / 2);
        }
        count = Math.max(count > 0 ? 1 : 0, count);
        const pool = pickPool(this.pools, effective.pool);
        for (let i = 0; i < count; i += 1) {
            this.spawnOne(pool, effective, x, y, 1);
        }
        // Los impactos de fuego llevan su humo.
        if (effective.id === "impact-fire") {
            const smoke = getFXPreset("impact-smoke");
            if (smoke && this.pools) {
                const n = Math.max(2, Math.round(7 * this.qualityScale));
                for (let i = 0; i < n; i += 1) {
                    this.spawnOne(this.pools.normal, smoke, x, y, 1);
                }
            }
        }
    }

    /**
     * Tick de trail para proyectiles (lo llama el visual del proyectil por
     * frame). Spawnea 1-2 partículas detrás de la posición actual.
     */
    trailTick(
        x: number,
        y: number,
        dirX: number,
        dirY: number,
        trailColor: number,
        endColor: number,
        magnitude: number,
    ): void {
        if (!this.ready || !this.pools) {
            return;
        }
        if (this.aliveTotal() > FX_PARTICLE_BUDGET[this.quality]) {
            this.dropped += 1;
            return;
        }
        const mag = Math.max(0.65, Math.min(2.5, magnitude));
        const n = 1 + (Math.random() < 0.35 + mag * 0.12 ? 1 : 0);
        for (let i = 0; i < n; i += 1) {
            const back = 8 + i * 5;
            const spawn: ResolvedSpawn = {
                x: x - dirX * back + (Math.random() - 0.5) * 9,
                y: y - dirY * back + (Math.random() - 0.5) * 9,
                vx: -dirX * 22 * mag + (Math.random() - 0.5) * 26,
                vy: -dirY * 22 * mag + (Math.random() - 0.5) * 26,
                lifeMs: 220 + Math.random() * 160,
                sizeStartPx: (3.5 + Math.random() * 2.5) * (0.75 + mag * 0.35),
                sizeEndMult: 0.3,
                alphaStart: 0.9,
                alphaEnd: 0,
                colorStart: i === 0 ? trailColor : endColor,
                colorEnd: endColor,
                gravityX: 0,
                gravityY: 0,
                drag: 1.8,
                turbulence: 2,
                flicker: 0,
                seed: Math.random(),
                rotation: 0,
                rotationSpeed: 0,
            };
            if (!this.pools.add.spawn(spawn)) {
                this.dropped += 1;
            }
        }
    }

    /** Destello de impacto (sprite ADD de vida corta, pool propio). */
    flash(x: number, y: number, color: number, sizePx: number): void {
        if (!this.ready || !this.textures) {
            return;
        }
        const slot = this.flashes.find((f) => f.lifeMs <= 0);
        if (!slot) {
            return;
        }
        slot.sprite.visible = true;
        slot.sprite.x = x;
        slot.sprite.y = y;
        slot.sprite.tint = color;
        const s = Math.max(0.05, sizePx / this.textures.size);
        slot.sprite.scale.set(s);
        slot.sprite.alpha = 0.85;
        slot.ageMs = 0;
        slot.lifeMs = 150;
        slot.growMult = 2.1;
        slot.startAlpha = 0.85;
    }

    kill(id: number): void {
        const emitter = this.emitters.get(id);
        if (!emitter) {
            return;
        }
        if (emitter.glow && !emitter.glow.destroyed) {
            if (emitter.glow.parent) {
                emitter.glow.parent.removeChild(emitter.glow);
            }
            emitter.glow.destroy();
        }
        this.emitters.delete(id);
    }

    killAll(): void {
        for (const id of [...this.emitters.keys()]) {
            this.kill(id);
        }
    }

    update(deltaMs: number): void {
        if (!this.ready || !this.pools) {
            return;
        }
        const dt = Math.min(Math.max(0, deltaMs), 100);
        const view = this.viewport();
        const budget = FX_PARTICLE_BUDGET[this.quality];
        const overBudget = this.aliveTotal() > budget;

        for (const emitter of this.emitters.values()) {
            const pos = emitter.getPos();
            if (!pos) {
                this.kill(emitter.id);
                continue;
            }
            emitter.elapsedMs += dt;
            if (
                emitter.durationMs !== null &&
                emitter.elapsedMs >= emitter.durationMs
            ) {
                this.kill(emitter.id);
                continue;
            }
            // Halo sigue al ancla + pulso.
            if (emitter.glow && !emitter.glow.destroyed) {
                emitter.glow.x = pos.x;
                emitter.glow.y = pos.y;
                const spec = emitter.config.glow;
                if (spec && spec.pulseSpeed > 0) {
                    emitter.glow.alpha =
                        emitter.glowBaseAlpha *
                        (1 +
                            spec.pulseAmount *
                                Math.sin(
                                    (emitter.elapsedMs / 1000) *
                                        spec.pulseSpeed,
                                ));
                }
            }
            // Culling: fuera de viewport no spawnea (las vivas siguen su curso).
            const margin = emitter.config.cullMargin ?? 64;
            if (!this.inViewport(view, pos.x, pos.y, margin)) {
                emitter.spawnAcc = 0;
                continue;
            }
            if (overBudget || emitter.config.spawnRate <= 0) {
                continue;
            }
            const pool = pickPool(this.pools, emitter.config.pool);
            emitter.spawnAcc +=
                emitter.config.spawnRate * this.qualityScale * (dt / 1000);
            // Tope anti-deuda (tab suspendido, etc.): máx media segundo.
            emitter.spawnAcc = Math.min(
                emitter.spawnAcc,
                emitter.config.spawnRate * 0.5,
            );
            // Respeto al techo por emisor.
            let guard = 0;
            while (emitter.spawnAcc >= 1 && guard < 32) {
                emitter.spawnAcc -= 1;
                guard += 1;
                this.spawnOne(pool, emitter.config, pos.x, pos.y, emitter.scale);
            }
        }

        // Flashes.
        for (const flash of this.flashes) {
            if (flash.lifeMs <= 0) {
                continue;
            }
            flash.ageMs += dt;
            const t = flash.ageMs / Math.max(1, flash.lifeMs);
            if (t >= 1) {
                flash.lifeMs = 0;
                flash.sprite.visible = false;
                continue;
            }
            const s = flash.sprite.scale.x;
            flash.sprite.scale.set(s * (1 + (flash.growMult - 1) * (dt / 150)));
            flash.sprite.alpha = flash.startAlpha * (1 - t);
        }

        this.pools.add.update(dt);
        this.pools.normal.update(dt);
        this.pools.spark.update(dt);
    }

    getStats(): FXStats {
        return {
            aliveAdd: this.pools?.add.alive ?? 0,
            aliveNormal: this.pools?.normal.alive ?? 0,
            aliveSpark: this.pools?.spark.alive ?? 0,
            aliveTotal: this.aliveTotal(),
            emitters: this.emitters.size,
            flashes: this.flashes.filter((f) => f.lifeMs > 0).length,
            glows: this.glowLayer.children.length,
            dropped:
                this.dropped +
                (this.pools?.add.droppedSpawns ?? 0) +
                (this.pools?.normal.droppedSpawns ?? 0) +
                (this.pools?.spark.droppedSpawns ?? 0),
            quality: this.quality,
            qualityScale: this.qualityScale,
        };
    }

    /** Prueba de estrés manual: `?fxStress=800` o desde consola. */
    stressAt(x: number, y: number, n: number): void {
        if (!this.ready) {
            return;
        }
        const fire = getFXPreset("spell-fire");
        const impact = getFXPreset("impact-fire");
        for (let i = 0; i < n; i += 1) {
            const jx = x + (Math.random() - 0.5) * 320;
            const jy = y + (Math.random() - 0.5) * 320;
            if (i % 3 === 0 && impact && this.pools) {
                this.spawnOne(
                    pickPool(this.pools, impact.pool),
                    impact,
                    jx,
                    jy,
                    1,
                );
            } else if (fire && this.pools) {
                this.spawnOne(pickPool(this.pools, fire.pool), fire, jx, jy, 1);
            }
        }
    }

    dispose(): void {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.killAll();
        this.pools?.add.destroy();
        this.pools?.normal.destroy();
        this.pools?.spark.destroy();
        this.pools = null;
        for (const flash of this.flashes) {
            if (!flash.sprite.destroyed) {
                flash.sprite.destroy();
            }
        }
        this.flashes.length = 0;
        this.flashFree.length = 0;
        if (this.flashLayer.parent) {
            this.flashLayer.parent.removeChild(this.flashLayer);
        }
        if (!this.flashLayer.destroyed) {
            this.flashLayer.destroy({ children: true });
        }
        if (this.glowLayer.parent) {
            this.glowLayer.parent.removeChild(this.glowLayer);
        }
        if (!this.glowLayer.destroyed) {
            this.glowLayer.destroy({ children: true });
        }
        this.textures = null;
    }
}
