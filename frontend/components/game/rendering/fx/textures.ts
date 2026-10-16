import { Graphics, Texture, type Application } from "pixi.js";

/**
 * Texturas procedurales compartidas por todo el sistema de partículas.
 *
 * PixiJS 8 exige UNA textura por ParticleContainer, así que todo el sistema
 * usa 3 texturas blancas y varía apariencia vía `tint` + `scale` + `alpha`:
 *  - soft:  punto radial suave (fuego, magia, trails, flashes, glows)
 *  - smoke: mancha irregular (humo, polvo)
 *  - spark: diamante (brasas, chispas)
 *
 * Se generan una vez con el renderer (generateTexture) y se cachean.
 */

export interface FXTextureSet {
    /** Tamaño en px de cada textura (para convertir tamaño px -> escala). */
    size: number;
    soft: Texture;
    smoke: Texture;
    spark: Texture;
}

const FX_TEXTURE_SIZE = 64;
const FX_SPARK_SIZE = 32;

let cachedApp: Application | null = null;
let cachedSet: FXTextureSet | null = null;

function makeSoftGraphics(size: number): Graphics {
    const g = new Graphics();
    const rings = 10;
    // Anillos concéntricos de alpha decreciente ≈ gradiente radial.
    for (let i = rings; i >= 1; i -= 1) {
        const t = i / rings;
        g.circle(size / 2, size / 2, (size / 2) * t).fill({
            color: 0xffffff,
            alpha: 0.16 * (1 - t) + 0.02,
        });
    }
    g.circle(size / 2, size / 2, size * 0.16).fill({
        color: 0xffffff,
        alpha: 1,
    });
    return g;
}

function makeSmokeGraphics(size: number): Graphics {
    const g = new Graphics();
    const cx = size / 2;
    const cy = size / 2;
    // Varias manchas desplazadas para irregularidad.
    const blobs: Array<[number, number, number, number]> = [
        [0, 0, 0.5, 0.5],
        [-0.12, 0.08, 0.34, 0.38],
        [0.13, -0.09, 0.32, 0.36],
        [0.05, 0.14, 0.28, 0.3],
        [-0.08, -0.13, 0.26, 0.28],
    ];
    for (const [ox, oy, r, a] of blobs) {
        g.circle(cx + ox * size, cy + oy * size, (size / 2) * r).fill({
            color: 0xffffff,
            alpha: a,
        });
    }
    return g;
}

function makeSparkGraphics(size: number): Graphics {
    const g = new Graphics();
    const c = size / 2;
    g.moveTo(c - size * 0.08, c)
        .lineTo(c, c - size * 0.5)
        .lineTo(c + size * 0.08, c)
        .lineTo(c, c + size * 0.5)
        .closePath()
        .fill({ color: 0xffffff, alpha: 1 });
    g.circle(c, c, size * 0.09).fill({ color: 0xffffff, alpha: 1 });
    return g;
}

/**
 * Genera (una vez por Application) el set de texturas de partículas.
 * Devuelve null si el renderer no está listo.
 */
export function ensureFXTextures(app: Application): FXTextureSet | null {
    if (cachedSet && cachedApp === app) {
        return cachedSet;
    }
    if (!app.renderer) {
        return null;
    }

    const build = (
        graphics: Graphics,
    ): Texture => {
        const texture = app.renderer.generateTexture(graphics);
        graphics.destroy();
        return texture;
    };

    cachedApp = app;
    cachedSet = {
        size: FX_TEXTURE_SIZE,
        soft: build(makeSoftGraphics(FX_TEXTURE_SIZE)),
        smoke: build(makeSmokeGraphics(FX_TEXTURE_SIZE)),
        spark: build(makeSparkGraphics(FX_SPARK_SIZE)),
    };
    return cachedSet;
}

export function destroyFXTextures(): void {
    if (!cachedSet) {
        return;
    }
    for (const texture of [cachedSet.soft, cachedSet.smoke, cachedSet.spark]) {
        if (!texture.destroyed) {
            texture.destroy(true);
        }
    }
    cachedSet = null;
    cachedApp = null;
}
