Manual de efectos visuales (efectos.md)
Dónde y cómo cambiar los efectos de hechizos y meditaciones: tamaño, color, duración, comportamiento. Todo es 100% partículas sobre PixiJS 8, sin sprites.

1. Mapa rápido: qué se toca para qué
Quiero cambiar…	Archivo	Servidor o frontend
Color, tamaño, rayos, shake, humo de un hechizo	frontend/components/game/rendering/fx/spellFx.ts (tabla SPELL_FX_TABLE)	Frontend
Comportamiento base de partículas (vida, velocidad, gravedad, órbita, tamaños)	frontend/components/game/rendering/fx/presets.ts	Frontend
Paleta y escala de cada tier de meditación + rayos sí/no	frontend/components/game/rendering/entityOverlays.ts (MEDITATION_TIERS)	Frontend
Regla maná → espectacularidad (escala/shake automáticos)	spellFx.ts (spellIntensityScale, autoShake)	Frontend
Presupuestos de calidad (cuántas partículas según ALTO/MEDIO/BAJO)	frontend/components/game/config/fxQuality.ts (FX_PARTICLE_BUDGET, FX_QUALITY_SCALE)	Frontend
Datos del hechizo (maná, daño, descripción)	api/src/jsons/spells.json (+ espejo server/jsons/spells.json, se sincronizan a DB/public/init/spells.json)	Servidor + datos
Enviar un hechizo nuevo al cliente	Nada (si tiene spellId válido, el spellVisual ya lo trae)	—
Regla de oro: el 99% de los ajustes visuales son solo frontend. El servidor solo define qué hechizo se lanzó y cuánto maná/daño tiene; el cliente decide cómo se ve.

2. Hechizos
2.1 Cambiar UN hechizo (caso más común)
Abrí frontend/components/game/rendering/fx/spellFx.ts, tabla SPELL_FX_TABLE (una línea por hechizo, ids 1–47). Ejemplo real:

23: { arch: "electric", colors: { start: 0xffffff, end: 0x6ab8ff }, bolts: 3, shake: 0.5 },
25: { arch: "fire", colors: { start: 0xfff3b0, end: 0xff3300 }, smoke: true, bolts: 3, shake: 0.7 },
Campos disponibles por hechizo:

Campo	Qué hace	Ejemplo
arch	Arquetipo base (forma del efecto). Ver §2.2	"fire", "heal", "dark"
colors.start / end	Tinte inicial → final de las partículas (hex). Es lo que más cambia el look	{ start: 0xffffff, end: 0x6ab8ff }
bolts	Cantidad de rayos quebrados extra (0 = ninguno). Solo suma +1 si la escala ≥1.8	bolts: 3 (Descarga Eléctrica)
ray	true = rayo divino vertical + burst dorado (resurrección, ira divina)	ray: true
shake	Trauma de screen shake 0–1. Si lo omitís, se calcula solo por maná (§2.3)	shake: 0.5
smoke	true = segunda explosión de humo gris (fuego, tierra, explosiones)	smoke: true
rise	true = columna dorada ascendente (invocaciones, grandes curas, buffs)	rise: true
Recetas típicas:

Descarga más espectacular: bolts: 5 (o subirle el maná en spells.json, que escala todo solo).
Apocalipsis de otro color (ej. fuego verde vil): colors: { start: 0xeaffb0, end: 0x2a9900 }.
Curación más grande sin tocar maná: agregá rise: true y/o duplicá su escala efectiva subiendo manaRequired en spells.json.
Quitar el shake a un hechizo: shake: 0.
2.2 Arquetipos (arch)
El arquetipo define la forma del efecto (qué preset de burst usa + flash). Valores: fire, electric, ice, poison, holy, heal, dark, arcane, bind, cleanse, shimmer, summon, drain, nature, earth.

fire → explosión ígnea + humo opcional + flash naranja.
electric → burst blanco-azulado + rayos + flash pálido.
heal → burst verde de destellos ascendentes.
El resto → burst genérico teñido con tus colors + flash de tu color inicial.
Si ningún arquetipo te sirve, la composición final se arma en buildSpellPlay() (mismo archivo): ahí se decide qué bursts/flash/rayos ejecuta cada arquetipo.

2.3 Escala automática por maná (tamaño, duración percibida, shake)
No hace falta tocar nada por hechizo: en spellFx.ts,

spellIntensityScale(): escala global 0.8 → 2.4 según manaRequired (0.8 + mana/450); daño ≥1000 va directo a 2.4. Esa escala multiplica cantidad y tamaño de partículas y el tamaño del destello (flashSize, tope 110px).
autoShake(): shake 0 / 0.25 / 0.4 / 0.55 / 0.6 por tramos de maná (≥150/400/800) o daño ≥1000. Los arquetipos utilitarios (shimmer, cleanse, heal, nature, en QUIET_ARCHETYPES) nunca tiemblan salvo shake explícito.
O sea: subirle el maná a un hechizo en spells.json lo vuelve automáticamente más espectacular. Si querés desafinar esa regla, tocá estas dos funciones.

2.4 Comportamiento fino de las partículas (vida, velocidad, gravedad…)
En frontend/components/game/rendering/fx/presets.ts están los emisores base que usan los hechizos: impact-physical, impact-fire, impact-smoke, heal, levelup, divine-ray, etc. Cada preset es un EmitterConfig:

Campo del preset	Efecto práctico
spawnRate / burstCount	Cuántas partículas por segundo (loops) o por explosión (bursts)
lifetime: [min, max]	Duración de cada partícula en ms
speed: [min, max] + angle: [base, dispersión] + gravity + drag	Velocidad, dirección, caída/fricción
sizeStart: [min, max] + sizeEndMult	Tamaño inicial y a cuánto se achica/agranda al morir
alpha: [inicio, fin]	Transparencia inicial → final (casi siempre termina en 0)
color: [inicio, fin]	Tinte (los hechizos lo pisan con sus colors)
spawnRadius / line	Nacen en un disco o sobre una línea (el rayo divino usa línea vertical)
turbulence / flicker	Bamboleo orgánico / parpadeo (brasas, chispas)
orbit: { radius, angularSpeed, verticalAmp }	Giro alrededor del ancla (meditación)
glow	Halo pulsante detrás (fuego grande, auras)
⚠️ Los presets se comparten entre efectos: si agrandás impact-fire, cambia en todos los hechizos de fuego. Para un comportamiento exclusivo, creá un preset nuevo (copiá uno y cambiale el id) y referencialo desde buildSpellPlay() o la tabla.

2.5 Hechizo nuevo (de punta a punta)
Agregalo en api/src/jsons/spells.json (y que llegue a spells.json del cliente vía el sync de game-data). Con eso el paquete spellVisual ya trae su spellId.
Agregá su fila en SPELL_FX_TABLE con arquetipo y colores. Si lo omitís, igual se ve: el fallback por flags (fallbackEntry(): daño→arcano, cura→verde, paralizar→celeste, etc.).
Si es de NPC y se castea desde el servidor por la vía animFX (server/src/protocol.ts), seguirá viéndose el sprite legacy (pendiente documentado, no rompe nada).
3. Meditaciones
Todo vive en frontend/components/game/rendering/entityOverlays.ts. Sin sprites: los fxGrh 4/5/6/16/34 del servidor (chica/mediana/grande/xgrande/xxgrande) derivan directo a 4 loops de partículas. No toques el servidor para cambiar el look.

3.1 Paleta y tamaño por tier (MEDITATION_TIERS)
34: {
    scale: 1.5,
    colors: {
        orbit: { start: 0xffffff, end: 0xffd34d },
        inner: { start: 0xffffff, end: 0xffe08a },
        rise:  { start: 0xfffbe8, end: 0xffb800 },
        spark: { start: 0xffffff, end: 0xffe08a },
    },
    lightning: true,
},
scale: multiplica tamaño de partícula, radio de órbitas y halo (0.7 → 1.5 según tier).
colors.orbit/inner/rise/spark: tinte inicial → final de cada una de las 4 capas (órbita exterior, órbita interior contrarrotante, columna ascendente, destellos). Para cambiar el color de un tier, tocá acá.
lightning: true: rayos quebrados alrededor (hoy solo tier 34). Para dárselos a otro tier, poné true. La frecuencia está en MEDITATION_BOLT_INTERVAL_MS (650ms).
3.2 Comportamiento de las 4 capas (presets meditate-*)
En presets.ts: meditate-orbit, meditate-orbit-inner, meditate-rise, meditate-spark.

Más grande/denso: subí spawnRate y orbit.radius (ej. radius: [16,30] → [22,40]).
Giro más rápido/lento: orbit.angularSpeed (negativo = sentido contrario; el interior va en contra a propósito).
Columna más alta: meditate-rise: speed y lifetime (más vida = llega más alto).
Ancla: el aura se centra en el torso vía resolveEntityAnchor() (usa bodyMetrics, ignora a propósito los offsets legacy del fxsDB, que desplazaban el efecto metros fuera del cuerpo). No tocar salvo bug de posición.
3.3 Rayos de la meditación máxima
FXManager.boltStrike(x, y, color) (frontend/components/game/rendering/fx/FXManager.ts): dibuja el rayo en un pool de 6 Graphics reutilizados con rama secundaria, parpadeo y destello en el impacto. Para cambiarlos: color/tamaño del trazo en drawBolt() (mismo archivo), duración en BOLT_LIFE_MS (150ms), cantidad simultánea en BOLT_POOL_SIZE.

4. Límites globales y performance (no tocar salvo que sepas por qué)
config/fxQuality.ts: FX_PARTICLE_BUDGET (1500/900/400 partículas vivas) y FX_QUALITY_SCALE (1/0.6/0.3). El auto-escalado por FPS vive en Engine.updateFX().
FXManager.ts: backpressure (si se supera el budget, los bursts salen a mitad) y culling por viewport (fuera de pantalla no se spawnea).
ParticlePool.ts: pooling total, cero allocations por frame. Si agregás un array de estado nuevo, acordate de copiarlo en killAt() (swap-remove) como hacen orbitOn/ocx/ocy/….
Texturas: solo 3 (soft, smoke, spark en fx/textures.ts); todo lo demás es tint+scale+alpha. No agregues texturas salvo necesidad real.
5. Probar los cambios
cd frontend && npx tsc --noEmit        # tipos
cd frontend && npx eslint <archivos>  # lint
cd server   && npx tsc --noEmit        # si tocaste servidor/datos
En el juego: window.__aowebFX.getStats() en consola (partículas vivas, emisores, drops) y ?fxStress=800 en la URL para prueba de carga.
dropped > 0 sostenido = estás pasado de budget: bajá spawnRate/burstCount o la escala del hechizo.
6. Referencia de archivos
frontend/components/game/rendering/fx/
  spellFx.ts        ← QUÉ se ve por hechizo (tabla 1–47, escala por maná, shake)
  presets.ts        ← CÓMO se comportan las partículas (vida, velocidad, tamaño…)
  FXManager.ts      ← motor (loops, bursts, rayos, rayo divino, budgets)
  ParticlePool.ts   ← pooling + integración (balística/orbital)
  textures.ts       ← las 3 texturas compartidas
frontend/components/game/rendering/entityOverlays.ts
  MEDITATION_TIERS  ← paleta/escala/rayos por tier de meditación
  playSpellImpact() ← impacto de hechizo sobre el ancla
  resolveEntityAnchor() ← ancla al torso
frontend/components/game/config/fxQuality.ts  ← budgets + calidad + shake on/off
server/src/protocol.ts (sendSpellImpactToAreaViewers) ← el spellId viaja al cliente
server/src/handleProtocol.ts (spellVisual, bit 1<<4) ← formato del paquete











V2:

# Manual de efectos visuales (efectos.md)

Dónde y cómo cambiar los efectos de hechizos y meditaciones: tamaño, color, duración, comportamiento. Todo es 100% partículas sobre PixiJS 8, sin sprites.

> **Regla de oro:** El 99% de los ajustes visuales son solo frontend. El servidor solo define qué hechizo se lanzó y cuánto maná/daño tiene; el cliente decide cómo se ve.

---

## 1. Mapa rápido: qué se toca para qué

| Quiero cambiar… | Archivo | Servidor o frontend |
| :--- | :--- | :--- |
| **Color, tamaño, rayos, shake, humo** de un hechizo | `frontend/components/game/rendering/fx/spellFx.ts` (`SPELL_FX_TABLE`) | Frontend |
| **Comportamiento base de partículas** (vida, velocidad, gravedad, órbita, tamaños) | `frontend/components/game/rendering/fx/presets.ts` | Frontend |
| **Paleta y escala de cada tier** de meditación + rayos sí/no | `frontend/components/game/rendering/entityOverlays.ts` (`MEDITATION_TIERS`) | Frontend |
| **Regla maná → espectacularidad** (escala/shake automáticos) | `spellFx.ts` (`spellIntensityScale`, `autoShake`) | Frontend |
| **Presupuestos de calidad** (cuántas partículas según ALTO/MEDIO/BAJO) | `frontend/components/game/config/fxQuality.ts` (`FX_PARTICLE_BUDGET`, `FX_QUALITY_SCALE`) | Frontend |
| **Datos del hechizo** (maná, daño, descripción) | `api/src/jsons/spells.json` (+ espejo `server/jsons/spells.json`, se sincronizan a `DB/public/init/spells.json`) | Servidor + datos |
| **Enviar un hechizo nuevo al cliente** | *Nada* (si tiene `spellId` válido, el `spellVisual` ya lo trae) | — |

---

## 2. Hechizos

### 2.1 Cambiar UN hechizo (caso más común)
Abrí `frontend/components/game/rendering/fx/spellFx.ts`, tabla `SPELL_FX_TABLE` (una línea por hechizo, IDs 1–47). 

**Ejemplo real:**
```ts
23: { arch: "electric", colors: { start: 0xffffff, end: 0x6ab8ff }, bolts: 3, shake: 0.5 },
25: { arch: "fire", colors: { start: 0xfff3b0, end: 0xff3300 }, smoke: true, bolts: 3, shake: 0.7 },