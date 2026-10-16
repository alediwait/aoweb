import type { FXQualityLevel } from "../rendering/fx/types";

export type { FXQualityLevel };

/**
 * Calidad de efectos: budgets + detección + auto-escalado por FPS.
 *
 * - Manual: localStorage 'aoweb-fx-quality' = alto|medio|bajo.
 * - Auto: heurística inicial (DPR, memoria, móvil) + EMA de FPS en runtime
 *   (lo aplica Engine.updateFX cada ~2s).
 */

export const FX_QUALITY_STORAGE_KEY = "aoweb-fx-quality";

/** Multiplicador de spawnRate por nivel. */
export const FX_QUALITY_SCALE: Record<FXQualityLevel, number> = {
    alto: 1,
    medio: 0.6,
    bajo: 0.3,
};

/** Techo global de partículas vivas (backpressure, ver UPDATE2026 §2.4). */
export const FX_PARTICLE_BUDGET: Record<FXQualityLevel, number> = {
    alto: 1500,
    medio: 900,
    bajo: 400,
};

const QUALITY_ORDER: FXQualityLevel[] = ["bajo", "medio", "alto"];

export function stepQualityDown(q: FXQualityLevel): FXQualityLevel {
    const i = QUALITY_ORDER.indexOf(q);
    return QUALITY_ORDER[Math.max(0, i - 1)];
}

export function stepQualityUp(q: FXQualityLevel): FXQualityLevel {
    const i = QUALITY_ORDER.indexOf(q);
    return QUALITY_ORDER[Math.min(QUALITY_ORDER.length - 1, i + 1)];
}

function readManualQuality(): FXQualityLevel | null {
    try {
        const raw = window.localStorage.getItem(FX_QUALITY_STORAGE_KEY);
        if (raw === "alto" || raw === "medio" || raw === "bajo") {
            return raw;
        }
    } catch {
        // localStorage no disponible (SSR): ignorar.
    }
    return null;
}

export function setManualFXQuality(q: FXQualityLevel | null): void {
    try {
        if (q === null) {
            window.localStorage.removeItem(FX_QUALITY_STORAGE_KEY);
        } else {
            window.localStorage.setItem(FX_QUALITY_STORAGE_KEY, q);
        }
    } catch {
        // Ignorar.
    }
}

export const SCREEN_SHAKE_STORAGE_KEY = "aoweb-screen-shake";

/** Shake activado salvo override manual u OS con reduced-motion. */
export function detectScreenShakeEnabled(): boolean {
    if (typeof window === "undefined") {
        return true;
    }
    try {
        const raw = window.localStorage.getItem(SCREEN_SHAKE_STORAGE_KEY);
        if (raw === "0") {
            return false;
        }
        if (raw === "1") {
            return true;
        }
        if (
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
            return false;
        }
    } catch {
        // Ignorar y usar default.
    }
    return true;
}

export function setScreenShakeEnabled(enabled: boolean): void {
    try {
        window.localStorage.setItem(
            SCREEN_SHAKE_STORAGE_KEY,
            enabled ? "1" : "0",
        );
    } catch {
        // Ignorar.
    }
}

function isCoarsePointerMobile(): boolean {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
        return false;
    }
    const ua = navigator.userAgent || "";
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

/** Calidad inicial: override manual > heurística de dispositivo > alto. */
export function detectFXQuality(): FXQualityLevel {
    const manual = typeof window !== "undefined" ? readManualQuality() : null;
    if (manual) {
        return manual;
    }
    if (typeof window === "undefined") {
        return "alto";
    }
    try {
        const nav = navigator as Navigator & {
            deviceMemory?: number;
        };
        if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) {
            return "bajo";
        }
        if (isCoarsePointerMobile()) {
            return "medio";
        }
        const dpr =
            typeof window.devicePixelRatio === "number"
                ? window.devicePixelRatio
                : 1;
        if (dpr >= 3 && isCoarsePointerMobile()) {
            return "bajo";
        }
    } catch {
        // Ignorar y usar default.
    }
    return "alto";
}
