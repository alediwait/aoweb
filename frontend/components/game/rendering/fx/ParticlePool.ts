import {
    Particle,
    ParticleContainer,
    Texture,
    type Container,
} from "pixi.js";
import type { ResolvedSpawn } from "./types";

/**
 * Pool de partículas con estado SoA (sin allocs por frame).
 *
 * - Un pool = un `ParticleContainer` = una textura + un blendMode.
 * - Las partículas vivas son siempre `particleChildren[0..aliveCount)`.
 * - Muerte O(1) por swap-remove; un solo `container.update()` por frame.
 * - Culling a nivel de emisor (lo hace FXManager); el pool solo integra.
 */

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function lerpColorNumber(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 255;
    const ag = (a >> 8) & 255;
    const ab = a & 255;
    const br = (b >> 16) & 255;
    const bg = (b >> 8) & 255;
    const bb = b & 255;
    const r = Math.round(lerp(ar, br, t));
    const g = Math.round(lerp(ag, bg, t));
    const bl = Math.round(lerp(ab, bb, t));
    return ((r << 16) | (g << 8) | bl) >>> 0;
}

export class ParticlePool {
    readonly capacity: number;
    readonly container: ParticleContainer<Particle>;
    aliveCount = 0;
    droppedSpawns = 0;

    private readonly textureSize: number;
    private readonly free: Particle[] = [];
    // Estado SoA paralelo a particleChildren[0..aliveCount).
    private readonly age: Float32Array;
    private readonly life: Float32Array;
    private readonly vx: Float32Array;
    private readonly vy: Float32Array;
    private readonly gravX: Float32Array;
    private readonly gravY: Float32Array;
    private readonly drag: Float32Array;
    private readonly sizeStart: Float32Array;
    private readonly sizeEndMult: Float32Array;
    private readonly alphaStart: Float32Array;
    private readonly alphaEnd: Float32Array;
    private readonly colorStart: Uint32Array;
    private readonly colorEnd: Uint32Array;
    private readonly turb: Float32Array;
    private readonly flicker: Float32Array;
    private readonly seed: Float32Array;
    private readonly rotSpeed: Float32Array;
    // Órbita (meditación): centro fijo al spawnear + ángulo integrado.
    private readonly orbitOn: Uint8Array;
    private readonly ocx: Float32Array;
    private readonly ocy: Float32Array;
    private readonly oradius: Float32Array;
    private readonly oangle: Float32Array;
    private readonly ospeed: Float32Array;
    private readonly oyAmp: Float32Array;
    private readonly oyFreq: Float32Array;

    constructor(
        texture: Texture,
        textureSize: number,
        blendMode: "add" | "normal",
        capacity: number,
    ) {
        this.capacity = capacity;
        this.textureSize = textureSize;
        this.container = new ParticleContainer<Particle>({
            texture,
            dynamicProperties: {
                position: true,
                rotation: true,
                color: true,
                vertex: true,
            },
        });
        this.container.blendMode = blendMode;
        // Pre-alloc: objetos Particle + estado. Cero `new` en caliente.
        for (let i = 0; i < capacity; i += 1) {
            this.free.push(
                new Particle({
                    texture,
                    anchorX: 0.5,
                    anchorY: 0.5,
                }),
            );
        }
        this.age = new Float32Array(capacity);
        this.life = new Float32Array(capacity);
        this.vx = new Float32Array(capacity);
        this.vy = new Float32Array(capacity);
        this.gravX = new Float32Array(capacity);
        this.gravY = new Float32Array(capacity);
        this.drag = new Float32Array(capacity);
        this.sizeStart = new Float32Array(capacity);
        this.sizeEndMult = new Float32Array(capacity);
        this.alphaStart = new Float32Array(capacity);
        this.alphaEnd = new Float32Array(capacity);
        this.colorStart = new Uint32Array(capacity);
        this.colorEnd = new Uint32Array(capacity);
        this.turb = new Float32Array(capacity);
        this.flicker = new Float32Array(capacity);
        this.seed = new Float32Array(capacity);
        this.rotSpeed = new Float32Array(capacity);
        this.orbitOn = new Uint8Array(capacity);
        this.ocx = new Float32Array(capacity);
        this.ocy = new Float32Array(capacity);
        this.oradius = new Float32Array(capacity);
        this.oangle = new Float32Array(capacity);
        this.ospeed = new Float32Array(capacity);
        this.oyAmp = new Float32Array(capacity);
        this.oyFreq = new Float32Array(capacity);
    }

    get alive(): number {
        return this.aliveCount;
    }

    attachTo(parent: Container): void {
        if (this.container.parent !== parent) {
            parent.addChild(this.container);
        }
    }

    spawn(s: ResolvedSpawn): boolean {
        if (this.aliveCount >= this.capacity) {
            this.droppedSpawns += 1;
            return false;
        }
        const particle = this.free.pop();
        if (!particle) {
            this.droppedSpawns += 1;
            return false;
        }
        const i = this.aliveCount;
        this.age[i] = 0;
        this.life[i] = Math.max(1, s.lifeMs);
        this.vx[i] = s.vx;
        this.vy[i] = s.vy;
        this.gravX[i] = s.gravityX;
        this.gravY[i] = s.gravityY;
        this.drag[i] = s.drag;
        this.sizeStart[i] = s.sizeStartPx;
        this.sizeEndMult[i] = s.sizeEndMult;
        this.alphaStart[i] = s.alphaStart;
        this.alphaEnd[i] = s.alphaEnd;
        this.colorStart[i] = s.colorStart >>> 0;
        this.colorEnd[i] = s.colorEnd >>> 0;
        this.turb[i] = s.turbulence;
        this.flicker[i] = s.flicker;
        this.seed[i] = s.seed;
        this.rotSpeed[i] = s.rotationSpeed;
        if (s.orbit) {
            this.orbitOn[i] = 1;
            this.ocx[i] = s.orbit.centerX;
            this.ocy[i] = s.orbit.centerY;
            this.oradius[i] = s.orbit.radius;
            this.oangle[i] = s.orbit.startAngle;
            this.ospeed[i] = s.orbit.angularSpeed;
            this.oyAmp[i] = s.orbit.verticalAmp;
            this.oyFreq[i] = s.orbit.verticalFreq;
            particle.x = s.orbit.centerX + Math.cos(s.orbit.startAngle) * s.orbit.radius;
            particle.y = s.orbit.centerY + Math.sin(s.orbit.startAngle) * s.orbit.radius * 0.72;
        } else {
            this.orbitOn[i] = 0;
            particle.x = s.x;
            particle.y = s.y;
        }
        const baseScale = Math.max(0.01, s.sizeStartPx / this.textureSize);
        particle.scaleX = baseScale;
        particle.scaleY = baseScale;
        particle.rotation = s.rotation;
        particle.alpha = s.alphaStart;
        particle.tint = s.colorStart;
        // Se guarda la posición base en x/y del propio Particle y se
        // integra escribiendo sobre él (menos arrays que mantener).
        particle.anchorX = 0.5;
        particle.anchorY = 0.5;

        this.container.particleChildren.push(particle);
        this.aliveCount += 1;
        return true;
    }

    private killAt(index: number): void {
        const children = this.container.particleChildren;
        const last = this.aliveCount - 1;
        const dead = children[index];
        if (index !== last) {
            const moved = children[last];
            children[index] = moved;
            this.age[index] = this.age[last];
            this.life[index] = this.life[last];
            this.vx[index] = this.vx[last];
            this.vy[index] = this.vy[last];
            this.gravX[index] = this.gravX[last];
            this.gravY[index] = this.gravY[last];
            this.drag[index] = this.drag[last];
            this.sizeStart[index] = this.sizeStart[last];
            this.sizeEndMult[index] = this.sizeEndMult[last];
            this.alphaStart[index] = this.alphaStart[last];
            this.alphaEnd[index] = this.alphaEnd[last];
            this.colorStart[index] = this.colorStart[last];
            this.colorEnd[index] = this.colorEnd[last];
            this.turb[index] = this.turb[last];
            this.flicker[index] = this.flicker[last];
            this.seed[index] = this.seed[last];
            this.rotSpeed[index] = this.rotSpeed[last];
            this.orbitOn[index] = this.orbitOn[last];
            this.ocx[index] = this.ocx[last];
            this.ocy[index] = this.ocy[last];
            this.oradius[index] = this.oradius[last];
            this.oangle[index] = this.oangle[last];
            this.ospeed[index] = this.ospeed[last];
            this.oyAmp[index] = this.oyAmp[last];
            this.oyFreq[index] = this.oyFreq[last];
        }
        children.pop();
        this.aliveCount = last;
        if (dead) {
            this.free.push(dead);
        }
    }

    update(deltaMs: number): void {
        if (this.aliveCount === 0) {
            return;
        }
        const dt = Math.min(deltaMs, 100) / 1000;
        const children = this.container.particleChildren;
        for (let i = this.aliveCount - 1; i >= 0; i -= 1) {
            const nextAge = this.age[i] + deltaMs;
            if (nextAge >= this.life[i]) {
                this.killAt(i);
                continue;
            }
            this.age[i] = nextAge;
            const t = nextAge / this.life[i];
            const p = children[i];
            if (!p) {
                continue;
            }
            // Integración: orbital (meditación) o balística.
            const wob =
                this.turb[i] *
                Math.sin(nextAge * 0.006 + this.seed[i] * 6.283);
            if (this.orbitOn[i] === 1) {
                const nextAngle = this.oangle[i] + this.ospeed[i] * dt;
                this.oangle[i] = nextAngle;
                p.x =
                    this.ocx[i] +
                    Math.cos(nextAngle) * this.oradius[i] +
                    wob * dt * 4;
                p.y =
                    this.ocy[i] +
                    Math.sin(nextAngle) * this.oradius[i] * 0.72 +
                    Math.sin(nextAge * 0.004 * this.oyFreq[i] + this.seed[i] * 6.283) *
                        this.oyAmp[i];
            } else {
                const dragK = 1 - Math.min(0.95, this.drag[i] * dt);
                const nvx = (this.vx[i] + this.gravX[i] * dt) * dragK;
                const nvy = (this.vy[i] + this.gravY[i] * dt) * dragK;
                this.vx[i] = nvx;
                this.vy[i] = nvy;
                p.x += nvx * dt + wob * dt * 8;
                p.y += nvy * dt + Math.cos(nextAge * 0.005 + this.seed[i] * 6.283) * this.turb[i] * 0.6 * dt * 8;
            }
            p.rotation += this.rotSpeed[i] * dt;
            // Apariencia.
            const baseScale =
                Math.max(0.01, this.sizeStart[i] / this.textureSize) *
                lerp(1, this.sizeEndMult[i], t);
            p.scaleX = baseScale;
            p.scaleY = baseScale;
            let alpha = lerp(this.alphaStart[i], this.alphaEnd[i], t);
            if (this.flicker[i] > 0) {
                alpha *=
                    1 -
                    this.flicker[i] *
                        Math.abs(
                            Math.sin(
                                nextAge * 0.02 + this.seed[i] * 6.283,
                            ),
                        );
            }
            p.alpha = Math.max(0, Math.min(1, alpha));
            p.tint = lerpColorNumber(this.colorStart[i], this.colorEnd[i], t);
        }
        this.container.update();
    }

    clear(): void {
        const children = this.container.particleChildren;
        for (let i = 0; i < this.aliveCount; i += 1) {
            const p = children[i];
            if (p) {
                this.free.push(p);
            }
        }
        children.length = 0;
        this.aliveCount = 0;
        this.container.update();
    }

    destroy(): void {
        this.clear();
        this.free.length = 0;
        if (this.container.parent) {
            this.container.parent.removeChild(this.container);
        }
        this.container.destroy();
    }
}
