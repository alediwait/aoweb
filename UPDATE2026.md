# UPDATE2026 — Plan de Evolución Técnica AOWeb

> Fecha: octubre 2026.
> Base: `Infraestructura.md` (octubre 2026) + auditoría de código `server/`, `api/`, `frontend/`.
> Autor: Arquitectura + Frontend/GameDev.
> Objetivo: (1) efectos visuales / partículas inmersivas manteniendo 60 FPS, (2) combate más dinámico/táctico con atributos y progresión rediseñados.

> **Addendum implementación (16-oct-2026):** la base de la Fase 1 (emitter custom
> sobre PixiJS 8, opción A del §2.1) ya está implementada y compila (`tsc` +
> `eslint` limpios). Archivos: `frontend/components/game/rendering/fx/`
> (`types.ts`, `textures.ts`, `ParticlePool.ts`, `presets.ts`, `FXManager.ts`),
> `frontend/components/game/config/fxQuality.ts`; integración en
> `engine/Engine.ts` (`ensureFXManager/updateFX` en el loop + dispose),
> `rendering/effectsRenderer.ts` (`createSpellProjectileVisualFX` con trail GPU
> + impacto de llegada, fallback legacy si no hay manager) y
> `rendering/entityOverlays.ts` (usa V2 automáticamente + helpers
> `renderFireLoop/renderImpactBurstAtTile/renderImpactBurstAtWorld/killParticleLoop/getParticleStats`).
> Debug: `window.__aowebFX` (stats) y `?fxStress=N`. Pendiente de Fase 1:
> cablear antorchas/fogatas del mapa a `renderFireLoop` y QA de FPS en
> dispositivo real.

---

## 1. Resumen del estado actual

### 1.1 Arquitectura general

AOWeb es un MMORPG browser-based inspirado en Argentum Online, organizado como **monorepo con 3 apps + PostgreSQL**:

| Módulo | Carpeta | Stack | Puerto | Rol |
|---|---|---|---|---|
| API | `api/` | Express 5.1 + `pg` + Zod 4, TS | `3001` dev / `3100` prod | REST autoritativa de persistencia: cuentas, personajes (5 variantes de save), clanes, mercado, arenas, ranking, wiki, game-data versionado |
| Server juego | `server/` | Node 24 + `ws`, sin acceso directo a DB | `7666` | Mundo autoritativo en tiempo real: movimiento/visibilidad, combate, NPCs/respawn, crafting/smelting/pesca/minado, retos, arenas, cárceles, safe zones, anti-flood |
| Frontend | `frontend/` | Next.js 16 App Router + React 19 + **PixiJS 8.22** + Tailwind 4 + Howler | `3000` | Web client; `/play` = motor PixiJS; `app/api/*` = BFF con cookie httpOnly |
| DB | `database/aoweb.sql` + `api/schema.sql` | PostgreSQL 18, 30 tablas | `5432` | Fuente de verdad persistente |

Flujo canónico:

```
Browser :3000 ──HTTP(cookie)──> BFF /api/* ──fetch──> API :3001 ──pg──> PG :5432
Browser :3000 ──WS(game-ticket un solo uso)──> Server :7666 ──HTTP(Authorization: TOKEN_AUTH)──> API :3001
```

Reglas invariantes actuales que el plan respeta:

1. Frontend nunca toca la DB; server nunca toca la DB (todo vía `/internal/*` + `/character_save/*` + `/game-ticket/consume`).
2. Server es autoritativo en combate/posición/exp; el cliente solo predice cooldowns y targeting.
3. Game-data (objs, NPCs, balance, spells, recetas) hace `sync` incremental por `sinceVersion` contra `game_balance` / `data_revisions`.
4. Despliegue blue/green por servicio (`docker-compose.blue/green.yml`).

### 1.2 Render y efectos visuales — estado real auditado

- **Motor:** `new PIXI.Application()` en `frontend/components/game/core/useRendererBootstrap.ts:338-351` (`antialias:false`, `resolution:min(dpr,2)`), loop en `frontend/components/game/engine/Engine.ts:2042-2058` con `delta=min(elapsedMS,100)`.
- **Capas:** `mapContainer{ground,below,rowContainers(object|character|above)}` + `roofContainer` + `entityFXOverlayContainer` + `dialogOverlayContainer` + `playerContainer`. Z-index por fila (`rendering/mapLayers.ts`, `rendering/rowLayerContainers.ts`). Todo con `Sprite|AnimatedSprite|Graphics|Container|Text` puros.
- **Efectos hoy (3 mecanismos, sin librería de partículas):**
  - `rendering/entityOverlays.ts:240-406 renderEntityFX`: **un solo** `Sprite|AnimatedSprite` por entidad (`Engine.ts:608 entityEffects: Map<id,Sprite>`), frames precortados de `fxsDB→graphicsDB`, `alpha 0.75`, expiración por `setTimeout` o fin de frames. Persistentes hardcodeados `{4,5,6,16,34}`.
  - `entityOverlays.ts:417-520 renderProjectileVisual`: un sprite con interpolación lineal en `Engine.updateProjectileVisuals():2147-2191`, `durationMs=clamp(dist/1.1,90,280)`.
  - `rendering/effectsRenderer.ts:191-404 createSpellProjectileVisual`: único "mini-emisor" — núcleo de 3 `Graphics` vectoriales + partículas `Graphics` circulares (radio 1.5–3.3, emisión ~12 ms, vida 240 ms, pool global 256, `GraphicsContext` compartido por color).
- **Deuda/limitaciones:** 0 usos de `blendMode/Filter/Shader/ParticleContainer`; sin emitter parametrizable; sin stacking de FX (sobrescribe si mismo `graphicId`); trayectoria lineal sin easing/gravedad; FX del overlay sin culling; cada partícula `Graphics` = draw call propia (no escala a fuego con cientos de partículas); fuego persistente por tile/objeto no existe como concepto.

### 1.3 Combate, atributos y progresión — estado real auditado

- **Físico (server autoritativo, `server/src/game.ts`):**
  - Daño arma: `calcularDmg:7569-7622` → `floor((3*dmgArma + (dmgMaxArma/5)*max(0,fuerza-15) + dmgUser)*modClase)`, con `dmgUser=random(minHit,maxHit)`, `minHit/maxHit` derivados de nivel (§ abajo).
  - Hit chance: `50 + (poderAtaque-evasion)*0.4`, clamp 5–95 (`game.ts:417,7650,7853-7855`); NPC espejo clamp 10–90 (`npcs.ts:2010,2483`).
  - `poderAtaqueArma:8568-8591` = `(skillArma + 3*agilidad)*modClase + 2.5*max(level-12,0)`; skill = wrestling/proyectiles/apu/armas según arma.
  - `poderEvasion:8512-8526` = `(tacticas + tacticas/33*agilidad)*modEvasion + 2.5*max(level-12,0)`; escudo suma `poderEvasionEscudo:8538-8556` y bloqueo post-fallo `probRechazo=shieldChance%*(defensa/(defensa+tacticas))*0.7` clamp 5–75 (`8129-8148`).
  - Absorción por parte del cuerpo (`7878-7936`): casco o cuerpo+escudo, `random(minDef,maxDef)`, `dmg=max(1,dmg-absorbe)`. Vs NPC: `dmg-=npc.def`, mín 1.
  - Apuñalar (`356-410,8254-8349`): prob/daño por clase (asesino 24 % / ×1.35; guerrero 8 % / ×1.4, etc.), requiere `arma.apu && (apu>=10 || asesino)`. Caso especial Espada Mata Dragones = one-shot a `npcType==dragon` (`7657-7677`).
- **Magia (`game.ts:732-797,7018-7562`, 47 spells en `api/src/jsons/spells.json`):** `base=random(minHp,maxHp)` → `+round(base*3*level/100)` → `×(1+magicDamageBonus%)` → `×modDmgMagia[clase]`; mitigación por `magicDef + max(0,diffSkill*2) - penetration`, menos `defM` (NPC) o `itemResist+modResistenciaMagica` (PJ). Hostil = `paraliza||inmoviliza||subeHp==2`; soporte = cura/revivir/remover/invis/buffs. Buffs fuerza/agilidad con timers en `runtimeTiming`.
- **Atributos:** DB `characters(attr_fuerza,attr_agilidad,attr_inteligencia,attr_constitucion,...)` (`api/schema.sql:13-81`); runtime `GameCharacter` + `bkAttr*` y buffs con cap `bk*2` (`game.ts:236-328,808-869`); creación por raza en `api/src/lib/characterCreation.ts:192-287` (humano 19/19/18/18/20, elfo 18/20/20/19/19, etc.; carisma solo existe en creación, no persiste). **Skills no persisten:** todos = `getSimulatedSkill=min(100,level*3)` (`game.ts:8358-8462`). Cliente no calcula daño (`useCombatController.ts:364-440` solo cooldowns + targeting).
- **EXP/niveles (`server/src/balance.ts:5-89`, `game.ts:6837-6905,2311-2357`):** `MAX_LEVEL=50`, curva legacy `base 300; ×1.4 (<15), ×1.35 (<21), ×1.3 (<33), ×1.225 (<41), ×1.25` con floor por paso (idéntica en `characterCreation.ts:107-139`). Stats por nivel por clase (`vida/manaInicial/multMana/hitPre36/hitPost36`, ej. mago 7.5/8.33/2.65/1/1, guerrero 10.5/0/0/3/2). Reparto: 30 % del `npc.exp` proporcional al daño (`min(dmg,hpRestante)*(exp*0.3/maxHp)`), resto al matar; party split `floor(exp/n)+bonus`; `multiplicadorExp/dobleExp/partyExpBonusPct` en `vars.ts`/`runtime_settings`. `checkUserLevel` sube en bucle, recalcula `maxHp/mana/minHit/maxHit`, full heal.
- **Balance vivo:** `balanceData.ts:32-62` ← `balance.json:118-217` ← tabla `game_balance(id=1)`; hay divergencias código-vs-seed (ej. `modEscudo`, `modEvasion[1]`) que deben reconciliarse antes de tocar fórmulas.

**Conclusión del diagnóstico:** el juego funciona y es coherente con AO clásico, pero (a) visualmente está limitado a sprite-sheets estáticos sin partículas GPU, y (b) el combate es plano: atributos con poco peso (fuerza solo suma si >15, agilidad lineal, inteligencia/constitución casi solo mana/vida), sin críticos, sin posturas, sin stamina/foco, sin rendimientos decrecientes, con curva EXP legacy exponencial pura y skills simulados que anulan la progresión horizontal.

---

## 2. Plan técnico — sistema de partículas y efectos visuales

### 2.1 Decisión de librería (evaluación contra stack PixiJS 8 + Next 16)

| Opción | Veredicto | Motivo |
|---|---|---|
| **A. Emitter custom sobre PixiJS 8 (`ParticleContainer` + `Sprite` + textura radial generada + `blendMode: ADD`) — RECOMENDADO** | ✅ Adoptar | Cero dependencias nuevas, compatible con Pixi 8 (donde `ParticleContainer` sigue existiendo y `blendMode` es `ADD`), máximo control de pooling/culling/batching, funciona con WebGL1/2, tamaño bundle +0 KB. Suficiente para fuego, humo, brasas, impactos, AoE, auras. |
| B. `@pixi/particle-emitter@5` (emitter de `smoke`, mantenido por comunidad) | ⚠️ Alternativa válida | API declarativa (JSON de emisor), acelera prototipo. Contras: +~40 KB, última versión estable pensada para Pixi 7 (requiere validar contra Pixi 8.22: `emit` + `update(delta)` siguen válidos pero `ParticleContainer` cambió de props), menos control de culling por fila. Usar solo si el equipo prefiere config JSON sobre código. |
| C. Three.js / WebGL crudo / shaders fullscreen | ❌ Rechazado | Rompe el batching 2D, obliga a segundo canvas/contexto,consume VRAM y complica z-order por fila y techos. Solo justificable para distorsión de calor fullscreen — y eso se logra más barato con un `DisplacementFilter` puntual de Pixi. |
| D. Canvas2D overlay / DOM | ❌ Rechazado | Doble raster, sin sincronía con cámara/zoom del motor, peor perf que GPU sprites. |

**Decisión: opción A**, con puerta abierta a B como sintaxis de configuración (importar solo el schema JSON, no el runtime, si se quiere).

Stack concreto:

- Texturas procedurales generadas una vez: `makeRadialTexture(size, inner, outer)` (núcleo blanco→transparente), `makeSmokeTexture`, `makeSparkTexture` vía `PIXI.Graphics` → `renderer.generateTexture()`, cacheadas en `TextureCache` (reutilizar patrón de `animatedTextureCache`).
- Emisión en `ParticleContainer({ dynamic: true })` por capa FX, `blendMode = 'add'` para fuego/chispas/magia, `normal` para humo/polvo.
- Update en CPU con **arrays tipados / pooling** (SoA: `x,y,vx,vy,life,age,size,alpha,rot`), máximo N por emisor; sin `new` por frame (sin `Math.random` con alloc: usar `Math.random()` escalar, no objetos).
- Opcional Fase 3: `BlurFilter`/`GlowFilter` solo en impactos grandes y `DisplacementFilter` sutil para heat-haze en antorchas (con toggle por calidad).

### 2.2 Arquitectura de componentes (dónde vive cada pieza)

Nuevos ficheros (todos bajo `frontend/components/game/` para no romper imports):

```
rendering/fx/
  textures.ts        # makeRadialTexture(), makeSmokeTexture(), cache + generateTexture(renderer)
  types.ts           # FXDescriptor, EmitterConfig, ParticleBudget, QualityLevel
  ParticlePool.ts    # pool SoA + ParticleContainer wrapper (spawn/update/cull/kill)
  Emitters.ts        # FireEmitter, SmokeEmitter, EmberEmitter, ImpactBurst, AuraEmitter, TrailEmitter
  FXManager.ts       # façade: playFireAt(tile|entity), playImpact(), playSpell(), stopLooping(id)
  presets.ts         # FUEGO_ANTORCHA, FUEGO_HECHIZO, HUMO, BRASAS, IMPACTO_FISICO, CURA, VENENO, AURA_BUFF...
rendering/
  entityOverlays.ts  # MOD: delegar a FXManager, permitir stacking (ver 2.3)
  effectsRenderer.ts  # MOD: proyectiles usan TrailEmitter en vez de Graphics por partícula
  rowLayerContainers.ts # MOD: fxParticleOverlayContainer + helpers por fila
engine/Engine.ts     # MOD: registrar FXManager.update(delta) en loop + dispose
config/fxQuality.ts  # NUEVO: AUTO/ALTO/MEDIO/BAJO + detección (dpr, deviceMemory, fps)
session/incomingUiPackets.ts # MOD: nuevos paquetes fx (ver 2.3) con fallback a animFX legacy
```

Contrato de datos (cliente):

```ts
// rendering/fx/types.ts
type Blend = 'add' | 'normal';
interface EmitterConfig {
  id: string;                 // 'torch-fire' | 'spell-fireball' | ...
  maxParticles: number;       // presupuesto (ej. 120)
  spawnRate: number;          // partículas/seg (ej. 60)
  lifetime: [number, number]; // ms [min,max]
  velocity: { speed:[number,number]; angle:[number,number]; gravity:{x:number;y:number}; drag:number };
  size: { start:[number,number]; end:number; easing:'linear'|'outCubic' };
  alpha: { start:number; end:number };
  color: { start:number; end:number };  // tinte lerp (ej. 0xFFD34D -> 0xFF4400)
  blend: Blend;
  looping: boolean;
  durationMs?: number;        // si no looping
  cullRadiusPx: number;
  sortByRow: boolean;         // true = contenedor por fila, false = overlay global
}
interface FXDescriptor {
  kind: 'fire'|'smoke'|'embers'|'impact'|'projectile-trail'|'aura'|'heal'|'custom';
  anchor: { type:'tile'|'entity'|'screen'; map:number; x:number; y:number; entityId?:number };
  configId: string;           // preset en presets.ts
  scale?: number; durationMs?: number; tint?: number;
}
```

Protocolo (server→cliente, compatible hacia atrás):

- Mantener `animFX`, `spellVisual`, `spellProjectile`, `createProjectile` actuales.
- Añadir (reutilizando `aowProtocol.ts` + `packetQueue`):
  - `fxSpawn (id, descriptor)` — genérico, reemplazo futuro de los 4 anteriores.
  - `fxKill (id)` — detener emisor loopeado (apagar fuego, fin de aura).
  - `fxQuality (level)` — el server puede forzar calidad baja en eventos masivos (opcional; por defecto el cliente decide).
- El cliente que no conozca `fxSpawn` ignora el paquete (compatibilidad con clientes viejos); el server sigue enviando `animFX` legacy en paralelo durante 1 release (dual-send con flag `FX_DUAL_SEND`).

Fuego "más vivo" — receta concreta (antorchas, fogatas, hechizos de fuego):

- 3 emisores compuestos por foco: `llama` (ADD, 60–90 p/s, vida 500–900 ms, vel Y −40…−90 px/s, tamaño 14→2, color `#FFE08A→#FF5A00→#7A1500` con lerp por edad) + `humo` (NORMAL, 8–12 p/s, vida 1.4–2.2 s, deriva +viento, alpha 0.28→0) + `brasas` (ADD, 6–10 p/s, vida 0.8–1.6 s, gravedad −20, parpadeo por `sin(age*k)`).
- Variación orgánica: `spawn jitter` en radio 4–6 px, `angle jitter ±18°`, `turbulence = sin(time*3 + seed)*6px` aplicado en update (barato, sin ruido Perlin).
- Luz: sprite radial grande (`alpha 0.10–0.16`, ADD) pulsante `scale = base*(1+0.06*sin(t*7))` — vende el fuego sin iluminado real.
- Sonido: enganchar loop de Howler existente (`crackle`) con volumen por distancia (ya existe `lib/sound.ts`; solo añadir atenuación).

### 2.3 Cambios necesarios en código existente

1. `Engine.entityEffects: Map<id,Sprite>` → `Map<id, Set<FXHandle>>` (stacking: aura + quemadura + impacto coexisten). `renderEntityFX` deja de sobrescribir si `graphicId` coincide; `clearEntityFX(id, graphicId?)` acepta borrado selectivo. Estimación: ~80 líneas.
2. `effectsRenderer.createSpellProjectileVisual`: sustituir emisión de `Graphics` por `TrailEmitter` (misma firma, mismo `updateVisual(progress,x,y)`). Mantiene interpolación actual en Fase 1; en Fase 2 se añade easing/curva (`easeOutCubic` + arco parabólico `h=24px` para flechas/hechizos).
3. `rowLayerContainers`: nuevo `fxParticleOverlayContainer: Container` + `getFXRowContainer(row)` (un `ParticleContainer` por cada ~4 filas para equilibrar batching vs sorting; no uno por fila — demasiados draw calls — ni uno global — se rompe oclusión por `ABOVE`/`ROOF`).
4. `Engine.loop`: `fxManager.update(deltaMs, cameraView)` después de `updateProjectileVisuals`, antes de `updateCamera`. `Engine.destroy`: `fxManager.dispose()` + `textureCache.clearFX()`.
5. Culling: cada emisor registra AABB; si `!intersects(viewport, cullRadius)` → `skip update + visible=false` (los FX overlay hoy no hacen culling — corregir aquí).

### 2.4 Rendimiento — presupuesto y garantías de FPS

Presupuesto (objetivo 60 FPS en portátil medio 2022+, 30 FPS mínimo en móvil):

| Escenario | Partículas vivas máx | Draw calls FX extra | Notas |
|---|---|---|---|
| 1 antorcha en viewport | ~120 | 2–3 | llama(90)+humo(15)+brasas(12)+luz(1) |
| 10 focos visibles (mapa ciudad) | ~600–900 | 6–10 | `ParticleContainer` por grupo de filas batea en ~2 calls por contenedor (ADD + NORMAL) |
| Combate 5v5 con AoE | +400 burst (vida <600 ms) | +2–4 transitorios | bursts se liberan al pool inmediatamente |
| Techo global | **1500 (ALTO) / 900 (MEDIO) / 400 (BAJO)** | — | `FXManager` aplica backpressure: si se supera, reduce `spawnRate ×0.5` y acorta `lifetime ×0.7` antes de dropear emisores (nunca freeze) |

Optimizaciones obligatorias:

1. **Pooling total:** pre-alloc en `ParticlePool` (`Float32Array`), `spawn` reutiliza slots muertos; cero `new Sprite/Graphics` por frame (hoy `effectsRenderer.ts:267-376` alloca por tick — eliminar).
2. **Texturas compartidas:** 3–5 texturas radiales para todo; prohibido `generateTexture` por emisor.
3. **Batching:** `ParticleContainer` (no `Container` con `Graphics` sueltos); separar ADD vs NORMAL en contenedores distintos para no romper batch.
4. **Culling + LOD por distancia:** fuera de viewport no se actualiza; a >600 px del jugador `spawnRate ×0.4`; a >1000 px solo `luz` (1 sprite).
5. **Cap de DPR:** `resolution=min(dpr,2)` ya existe; en calidad BAJO forzar `1`; desactivar `DisplacementFilter`/blur en MEDIO/BAJO.
6. **Auto-calidad:** `fxQuality.ts` mide EMA de FPS (ventana 2 s): si `<45` durante 3 s → baja un nivel; si `>57` durante 10 s → sube. Persistir en `localStorage`. Toggle manual en opciones + flag server `fxQuality`.
7. **Medición:** reutilizar `diagnostics/` existente (`components/game/diagnostics/`): añadir overlay `FX: {alive, drawCalls, emitters, fps}` y test de estrés (`?fxStress=500` spawnea N partículas para validar en CI manual). Presupuesto verificado con `pixi.js` devtools / Spector.js en revisión de PR.

Riesgos y mitigación: `ParticleContainer` no soporta filtros por hijo → filtros solo a nivel de contenedor y solo en ALTO; iOS Safari con `blendMode ADD` + DPR 3 puede caer → cap DPR 1.5 en iOS; memoria de texturas — 5 texturas de 128 px ≈ 320 KB VRAM, despreciable.

---

## 3. Especificación técnica — combate, atributos y progresión

Principios de diseño (acordados para esta propuesta):

- **P1 Servidor autoritativo, cliente tonto:** toda fórmula vive en `server/`; el cliente solo muestra. Nada de lo aquí propuesto mueve cálculo al frontend.
- **P2 Compatibilidad de protocolo y DB:** migración aditiva (nuevas columnas/tablas, nunca renombrar `attr_*` existentes); paquetes nuevos con fallback; `getSimulatedSkill` se mantiene como default hasta que el jugador entrene skills reales.
- **P3 Táctica > números:** cada atributo tiene rol defensivo y ofensivo; posicionamiento (flanqueo/espalda), stamina y posturas pesan tanto como el arma.
- **P4 Curvas con rendimientos decrecientes:** nada escala lineal al infinito; niveles 1–50 se sienten, 40–50 son prestigio horizontal.

### 3.1 Modelo de datos

#### 3.1.1 Atributos base (mantener + redefinir semántica)

| Attr (columna existente) | Rol ofensivo | Rol defensivo / utilidad | Notas de cambio |
|---|---|---|---|
| `attr_fuerza` (FUE) | Daño melee ×, carga/derribo, daño arrojadizas leve | Bloqueo escudo +, resistencia a derribo | Hoy solo suma si FUE>15; pasa a factor continuo con DR (3.2) |
| `attr_agilidad` (AGI) | Ataque (precisión), velocidad ataque leve, crítico, apuñalar | Evasión, velocidad movimiento en combate, iniciativa | Mantiene doble rol pero con DR separadas ataque/defensa |
| `attr_inteligencia` (INT) | Poder mágico, maná, penetración base | Resistencia mágica base, foco (sostener hechizos) | Nuevo: INT daña y defiende en magia |
| `attr_constitucion` (CON) | — | Vida, stamina, regen, resistencia a sangrado/veneno | Nuevo peso táctico vía stamina |
| `attr_carisma` (CAR, hoy solo creación) | Liderazgo party (bonus exp/daño party), mascotas | Precios mercado, facción | **Persistir** (nueva columna, ver migración) |

Nuevas columnas en `characters` (migración aditiva `api/migrations/XXX_combat_v2.sql`):

```sql
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS attr_carisma SMALLINT NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS stamina INT NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS stamina_max INT NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS crit_bonus_bp SMALLINT NOT NULL DEFAULT 0,   -- basis points, de equipo
  ADD COLUMN IF NOT EXISTS stance TEXT NOT NULL DEFAULT 'equilibrada',  -- ofensiva|equilibrada|defensiva|precisa
  ADD COLUMN IF NOT EXISTS exp_curve_version SMALLINT NOT NULL DEFAULT 1; -- 1=legacy, 2=nueva
-- Skills reales (nueva tabla; convive con simulated hasta migración completa)
CREATE TABLE IF NOT EXISTS character_skills (
  character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,            -- tacticas|defensa|armas|proyectiles|wrestling|ocultarse|apunalar|magia|meditar|resistencia
  value SMALLINT NOT NULL DEFAULT 0 CHECK (value BETWEEN 0 AND 100),
  PRIMARY KEY (character_id, skill)
);
```

Runtime `GameCharacter` (`server/src/game.ts:236-328`) añade: `stamina,staminaMax,stance,critBonusBp,skills:Record<Skill,number>|null` (null = usar simulated legacy), `comboCount,lastHitAt,focusStacks`.

`game_balance(id=1,data jsonb)` — nuevas claves versionadas (conservar las viejas):

```json
{
  "combatVersion": 2,
  "dr": { "kAtk": 0.045, "kEva": 0.05, "kCrit": 0.06, "capCritPct": 35 },
  "baseHitChance": 62, "hitSlope": 0.32, "hitClamp": [5, 95],
  "critBasePct": 5, "critDmgMult": 1.5, "backstabMult": 1.5, "flankMult": 1.15,
  "blockBase": 12, "armorCapPct": 70,
  "stamina": { "maxBase": 100, "perCon": 4, "meleeCost": 8, "spellCostFocus": 0, "regenPerTick": 6, "exhaustedAt": 15 },
  "stances": {
    "ofensiva":  { "dmgMult": 1.12, "evaMult": 0.92, "accMult": 1.05 },
    "equilibrada": { "dmgMult": 1.0, "evaMult": 1.0, "accMult": 1.0 },
    "defensiva": { "dmgMult": 0.88, "evaMult": 1.15, "blockMult": 1.25 },
    "precisa":   { "dmgMult": 0.95, "evaMult": 1.0, "accMult": 1.15, "critMult": 1.2 }
  },
  "exp": { "curveVersion": 2, "base": 320, "growth": 1.22, "softCapLevel": 40 }
}
```

### 3.2 Algoritmos de atributos y fórmulas de daño/defensa

Todas las fórmulas usan **rendimiento decreciente** `f(x) = x / (1 + k·x)` para que 10→20 se note y 80→100 apenas.

Notación: `S_*` = skill real (0–100) o `min(100,level*3)` si el PJ no tiene fila en `character_skills`; `mod*` = modificadores de clase existentes en `balanceData.ts` (se conservan); `stanceMult` de la tabla anterior.

#### 3.2.1 Poder de ataque y evasión (reemplaza `poderAtaqueArma` / `poderEvasion`)

```ts
// server/src/combat/attributes.ts (NUEVO)
export function atkPower(u: Char): number {
  const s = skillOf(u, weaponSkillFor(u));           // armas|proyectiles|wrestling|apu
  const agi = effAttr(u, 'agilidad');                // con buffs, cap bk*2 (lógica actual 808-834)
  const base = (s + 2.2 * dr(agi, K_ATK)) * modAtaque[u.clase];
  return base * stanceAcc(u) + 2.0 * Math.max(0, u.level - 12);
}
export function evaPower(u: Char): number {
  const t = skillOf(u, 'tacticas');
  const agi = effAttr(u, 'agilidad');
  const base = (t + (t / 30) * dr(agi, K_EVA)) * modEvasion[u.clase];
  return base * stanceEva(u) + 2.0 * Math.max(0, u.level - 12);
}
function dr(x: number, k: number) { return x / (1 + k * x); } // DR genérica
```

Probabilidad de impacto (conserva forma actual, re-parametriza):

```ts
// antes: 50 + (atk-eva)*0.4  →  ahora:
hitChance = clamp(BASE_HIT(62) + (atkPower(att) - evaPower(def) - shieldEva(def)) * HIT_SLOPE(0.32), 5, 95);
roll = rand(1,100); hit = roll <= hitChance;
// Posicionamiento táctico (NUEVO, barato: el server ya conoce heading/pos):
if (isBehind(att, def)) hitChance += 12;            // espalda: +12 pp
else if (isFlanking(att, def)) hitChance += 6;      // flanco: +6 pp
// Precisión por diferencia de nivel pequeña (anti-twinking suave):
hitChance += clamp((att.level - def.level) * 0.5, -5, 5);
```

#### 3.2.2 Daño físico (reemplaza `calcularDmg` + absorción)

```ts
// 1) base arma (igual que hoy: random(minHit,maxHit) arma + flecha si proyectil; sin arma 4-9)
raw = rand(arma.minHit, arma.maxHit) + (proyectil ? rand(flecha.minHit, flecha.maxHit) : 0);

// 2) fuerza con DR (antes: solo si FUE>15, lineal; ahora: siempre, con DR)
strBonus = 1 + dr(max(0, FUE - 8), 0.055) * 0.9;     // FUE 19 → ×1.34; FUE 30 → ×1.49; FUE 40 → ×1.57
// 3) skill arma con DR leve + nivel
skillMult = 1 + dr(S_arma, 0.02) * 0.5;              // S=50 → ×1.25; S=100 → ×1.33
lvlMult = 1 + min(u.level, 40) * 0.008;              // +0.8 %/nivel hasta 40 (+32 %), luego plano

dmg = raw * 3 * strBonus * skillMult * lvlMult * modDmgClase * stanceDmg(u);

// 4) crítico (NUEVO): base 5 % + agilidad DR + bonus equipo + postura precisa
critCh = clamp(5 + dr(AGI, 0.06) * 22 + critBonusBp/100 + (stance==='precisa' ? 3 : 0), 5, CAP_CRIT(35));
isCrit = rand(1,100) <= critCh;
if (isCrit) dmg *= CRIT_MULT(1.5) * (isBehind ? 1.2 : 1.0); // espalda potencia el crítico

// 5) apuñalar (conserva tablas por clase, integra con crítico: no acumulan — se queda el mayor)
stab = maybeStab(att, def, dmg); // misma STABBING_CHANCE/DAMAGE_MOD actuales; si isCrit && stab → dmg = max(crit, stab)

// 6) armadura con cap porcentual (antes: resta plana; ahora: resta + cap para que CON/armadura no inmortalicen)
abs = rand(armadura.minDef, armadura.maxDef);        // por parte del cuerpo (lógica getRandomBodyPart se conserva)
armorPct = min(abs / (abs + 40 + def.level * 3), ARMOR_CAP(0.70));
dmg = max(1, round(dmg * (1 - armorPct) - abs * 0.25));
// 7) postura defensiva del defensor + bloqueo escudo (conserva probRechazo actual × stanceBlock)
```

Ejemplo numérico (guerrero N20, FUE 22, S_armas 60, arma 8–14, vs cota 4–8): `raw≈11` → `×3=33` → `strBonus≈1.38` → `skillMult≈1.27` → `lvlMult=1.16` → `≈67` → armadura `abs≈6 → pct≈6/(6+40+60)=5.7 %` → `≈62` (crítico ≈93). Orden de magnitud compatible con el balance actual (no rompe TTK de un parche a otro; afinar con `scripts/applyBalanceToCharacters`).

#### 3.2.3 Magia (extiende `applyMagicBonuses`, conserva spells.json)

```ts
potencia = dr(INT, 0.05) * 2.4 + dr(S_magia, 0.02) * 1.6 + min(level,40) * 0.06;
dmg = rand(spell.minHp, spell.maxHp) * (1 + potencia * 0.28)
      * (1 + magicDamageBonusPct) * modDmgMagia[clase] * staffMult;
// mitigación (conserva diffSkill*2 y penetration actuales, añade INT del defensor con DR):
resist = defMagicResist + dr(def.INT, 0.05) * 30 + max(0, S_def - S_atk) * 1.6 - penetration;
dmg *= (1 - clamp(resist, 0, 75) / 100);
dmg = max(1, round(dmg) - defM);
// curas escalan con INT del lanzador: heal *= (1 + dr(INT,0.05)*0.9) (cap +80 %)
```

Sin cambios de schema en `spells.json` (solo se añaden opcionales `potenciaRatio`, `critMagic?: boolean`); varitas (`staffAffected`) multiplican como hoy.

#### 3.2.4 Stamina y posturas — la capa táctica

- Cada ataque melee cuesta `8` stamina; hechizos no cuestan stamina pero generan `foco` (ver 3.2.5). Regen `6/tick` (+`CON*0.15`), `staminaMax = 100 + CON*4`.
- Si `stamina < 15` (agotado): `dmg ×0.85`, `eva ×0.9`, sin críticos. Evita spam de click y premia pausas/kiteo.
- Posturas (comando `/postura` + hotkey, cambio con GCD 1 s, persiste en DB): ofensiva / equilibrada / defensiva / precisa (multiplicadores en 3.1). La UI muestra la postura en el HUD (nuevo icono junto a `BuffStatusSidebar`).
- Flanqueo/espalda calculado con `heading` existente del protocolo (sin paquetes nuevos): +6/+12 pp hit, ×1.15/×1.5 daño. Hace que el movimiento importe en PvP y PvE.

#### 3.2.5 Combos y foco (profundidad sin APM excesivo)

- Combo melee: 3er golpe consecutivo al mismo objetivo en <4 s → `+10 % daño, +5 % hit` (resetea al fallar o cambiar target). Contador en memoria, no persiste.
- Foco (casters): cada hechizo no-daño/cura acertado da 1 stack (máx 3, 8 s); cada stack `+4 % daño mágico, −3 % coste maná`. Incentiva rotación soporte→nuke.

### 3.3 Flujo de experiencia y subida de nivel

**Diagnóstico:** curva legacy `300 ×1.4/1.35/1.3/1.225/1.25` con floor por paso es opaca, diverge entre `balance.ts` y `characterCreation.ts`, y `getSimulatedSkill=level*3` hace que el nivel sea la única progresión.

**Propuesta: curva v2 paramétrica + niveles 1–50 + prestigio horizontal 40–50.**

```ts
// server/src/combat/experience.ts (NUEVO; reemplaza getLegacyExpNextLevelForLevel cuando exp_curve_version=2)
export function expNextLevel(level: number): number {
  // base 320, crecimiento 1.22 compuesto, suavizado 40+: crecimiento 1.10
  const g = level < 40 ? 1.22 : 1.10;
  return Math.floor(320 * Math.pow(g, level - 1) * (level < 40 ? 1 : Math.pow(1.22, 39) / Math.pow(1.22, 39)));
}
// Tabla indicativa v2 (redondeada): 1:320, 5:660, 10:1640, 15:4040, 20:9980, 25:24600, 30:60700,
// 35:149700, 40:369000, 45:594000, 49:871000. Total 1→50 ≈ 4.1 M (vs legacy ≈ 3.6 M: +14 %, más suave al inicio, más exigente 40+).
```

Reglas de flujo (conservan `NPC_HIT_EXP_RATIO=0.3`, party split, `multiplicadorExp/dobleExp`):

1. `distribuirExp` sin cambios de firma; añade `exp_curve_version` por PJ (legacy sigue funcionando para PJs existentes; los nuevos usan v2; migración opt-in con comando admin + script `api/src/scripts/migrateExpCurve.ts`).
2. Tope: `level<50` como hoy; al llegar a 50 el exceso va a **puntos de maestría** (ver 3.4) en vez de perderse.
3. `checkUserLevel` conserva full-heal al subir + `unequipRestrictedNewbieItems`, y añade: evento `levelUp` → paquete `fxSpawn(levelup)` (anillo dorado + sonido) + toast UI.
4. Anti-farming: `diminishing` por NPC gris (`npc.level <= level-9` → `exp ×0.25`) y bonus por reto (`npc.level >= level+3` → `exp ×1.2`, `+foco` si es con hechizo). Evita powerleveling en spawns bajos sin prohibirlo.
5. Descanso: `bonus rested` +50 % hasta 1 nivel de exp si el PJ pasa >10 min en zona segura (flag en memoria, no persiste; incentivo social en ciudades).

### 3.4 Progresión horizontal (retención 40+)

- **Skills reales:** entrenar por uso (cada golpe/hechizo con éxito `+1 punto de uso`; cada `N usos` → `+1 skill` hasta 100, con `N` creciente). Velocidad ×2 hasta `level*3` (catch-up al simulated), ×1 después. Tabla `character_skills` (3.1.1); `getSkill*` prefieren fila real y caen a simulated si no existe. Migración: seed inicial `= min(100,level*3)` para no nerfear a nadie.
- **Maestrías post-50:** cada "nivel de maestría" (coste = exp 49→50) da 1 punto para `+2 % daño arma favorita | +2 % resistencia mágica | +15 vida | +10 maná | +1 % crítico (máx 5 pts)`. Cap 20 puntos. Persisten en `character_skills(skill='maestria_*')` o JSON `settings` existente.
- **Carisma/liderazgo:** party con líder CAR alta: `+CAR*0.2 % exp party` (máx +6 %) y `+1 % daño party cada 10 CAR del líder`. Da rol social al CAR sin hacerlo obligatorio.

### 3.5 Modelos de datos — resumen de migraciones

| # | Migración | Tablas | Riesgo |
|---|---|---|---|
| M1 | `attr_carisma, stamina(_max), crit_bonus_bp, stance, exp_curve_version` | `characters` (aditiva, defaults) | Bajo (defaults cubren PJs viejos) |
| M2 | `character_skills` + seed `min(100,level*3)` | nueva + backfill | Medio (backfill en ventana de mantenimiento) |
| M3 | `game_balance.combatVersion=2` + claves `dr/hit/crit/stamina/stances/exp` | `game_balance` (JSON merge) | Bajo (merge, no overwrite; reconciliar divergencias código-vs-seed primero) |
| M4 | Telemetría combate (`damage_dealt_log` opcional, muestreo 1 %) | nueva, TTL 30 días | Bajo (solo para tuning; behind flag) |

---

## 4. Pasos de implementación recomendados (fases y prioridades)

### Fase 0 — Cimientos y reconciliación (0.5–1 semana) — PRIORIDAD MÁXIMA, sin cambios visibles

- [ ] F0.1 Reconciliar `balanceData.ts` vs `balance.json` vs `game_balance` DB (hay divergencias en `modEscudo/modEvasion/modDmgArmas`: decidir fuente y fijar test que compare los 3).
- [ ] F0.2 Añadir overlay diagnóstico FX (`alive/drawCalls/emitters/fps`) en `diagnostics/` + comando `?fxStress=N`.
- [ ] F0.3 Test de carga de combate: script que simula 50 PJs pegando a 1 NPC y mide p50/p99 del tick del server (baseline antes de tocar fórmulas).
- [ ] F0.4 Feature flags: `FX_V2`, `COMBAT_V2`, `FX_DUAL_SEND`, `EXP_V2_OPTIN` en `runtime_settings` (el server ya lee runtime-config; el cliente vía `/runtime-config`).

Criterio de salida: flags leídos en los 3 servicios + baseline FPS/TTK registrada en este doc (anexo).

### Fase 1 — Partículas base + fuego vivo (1–2 semanas) — VALOR VISIBLE INMEDIATO

- [ ] F1.1 `rendering/fx/{textures,types,ParticlePool,Emitters,FXManager,presets}.ts` + `config/fxQuality.ts` (auto-calidad + `localStorage`).
- [ ] F1.2 `Engine.loop` → `fxManager.update()`; `fxParticleOverlayContainer` por grupos de 4 filas; culling + LOD por distancia.
- [ ] F1.3 Presets `ANTORCHA/FOGATA/HECHIZO_FUEGO/IMPACTO` + luz pulsante + `fxSpawn/fxKill` con dual-send legacy.
- [ ] F1.4 Migrar `createSpellProjectileVisual` a `TrailEmitter`; antorchas del mapa piloto (1 mapa ciudad) con fuego compuesto llama+humo+brasas.
- [ ] F1.5 QA perf: `fxStress=1500` a 60 FPS en portátil medio; iOS DPR cap; toggle calidad en opciones.

Criterio de salida: fuego de antorcha/hechizo visiblemente "vivo" + techo 1500/900/400 cumplido + sin regresión de FPS vs baseline.

### Fase 2 — Combate táctico v2 en server (2–3 semanas) — CAMBIO DE GAMEPLAY, detrás de flag

- [ ] F2.1 Nuevo `server/src/combat/{attributes,formulas,experience,stances,positioning}.ts` con las fórmulas de §3.2 (puros + tests unitarios; no tocar `game.ts` aún).
- [ ] F2.2 Migraciones M1–M3 + `character_skills` + seed; endpoint admin para `exp_curve_version` y `stance`.
- [ ] F2.3 Integrar en `game.ts/npcs.ts`: `atkPower/evaPower/hitChance` con flanqueo, `dmg` con DR+crítico, armadura con cap, stamina/posturas, `expNextLevel` v2 opt-in. Mantener rama legacy cuando `COMBAT_V2=off` o `exp_curve_version=1`.
- [ ] F2.4 Paquetes: `stance` (cliente→server), `combo/foco/levelUp fx` (server→cliente vía `fxSpawn`), `PlayerHudState.stamina` (extender `aowProtocol.ts` sin romper clientes viejos: campo opcional al final).
- [ ] F2.5 Cliente: icono postura + barra stamina en HUD, `CharacterStatsModal` muestra crítico/bloqueo/penetración, `useCombatController` hotkey postura. Sin cálculo en cliente.
- [ ] F2.6 Tuning con telemetría (M4, muestreo 1 %): TTK guerrero-vs-esqueleto N20 debe quedar ±10 % del legacy antes de activar global.

Criterio de salida: `COMBAT_V2=on` en entorno test con paridad TTK ±10 % + tests verdes + skills entrenando por uso.

### Fase 3 — Pulido visual + progresión horizontal (2 semanas)

- [ ] F3.1 Easing/curvas en proyectiles (arco parabólico), `DisplacementFilter` heat-haze solo en ALTO, impactos con flash+onda+shake leve de cámara (con toggle accesibilidad).
- [ ] F3.2 Auras/buffs apilables (`entityEffects` → `Set`), anillo level-up, heal/veneno, AoE con permanencia (emisores loopeados + `fxKill` al expirar en server).
- [ ] F3.3 Maestrías post-50 + bonus CAR/liderazgo + rested bonus; UI ranking/wiki documenta nuevas fórmulas (reutilizar `wiki/` existente).
- [ ] F3.4 Apagar dual-send legacy (`FX_DUAL_SEND=off`) y `animFX` solo como fallback; borrar `Graphics`-por-partícula de `effectsRenderer`.

### Fase 4 — Rollout y operación

- [ ] F4.1 Blue/green: API → server (`COMBAT_V2=off` primero, activar en green) → frontend. Ventana de rollback <5 min por servicio.
- [ ] F4.2 Evento "Semana del Fuego": activar `dobleExp` + spawns con nuevos FX para medir FPS reales con carga (target: p95 tick server <50 ms, cliente p50 ≥55 FPS en ciudad).
- [ ] F4.3 Post-mortem numérico: anexar TTK/FPS antes/después y fijar `combatVersion=2` como default para cuentas nuevas.

### Matriz de riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Pixi 8 `ParticleContainer` no admite filtros por hijo | Alta | Medio | Filtros solo a nivel contenedor y solo en ALTO; resto con sprites ADD |
| iOS cae con ADD + DPR alto | Media | Alto | Cap DPR 1.5 iOS + auto-calidad agresiva + QA en dispositivo real en F1.5 |
| Cambio de fórmulas rompe TTK/economía | Media | Alto | Flag + rama legacy + paridad ±10 % + rollback blue/green |
| Divergencia balance código/seed/DB | Alta | Medio | F0.1 primero; test que falla si divergen |
| Scope creep (shaders/Three.js) | Media | Medio | Decisión A cerrada; heat-haze es el único shader permitido y es opcional |

---

## Anexo A — Archivos a tocar (índice)

- FX: `frontend/components/game/rendering/fx/*` (nuevo), `engine/Engine.ts:608-614,2042-2058,2147-2191,2971-2984`, `rendering/effectsRenderer.ts:191-404`, `rendering/entityOverlays.ts:240-598`, `rendering/rowLayerContainers.ts:54-138`, `core/useRendererBootstrap.ts:338-351,684-701`, `session/incomingUiPackets.ts:76-184`, `types/game.ts:149-181`, `lib/aowProtocol.ts`.
- Combate: `server/src/game.ts:356-410,714-797,2311-2357,6837-6905,7569-8591`, `server/src/npcs.ts:2010,2483-2671`, `server/src/balance.ts:5-89`, `server/src/balanceData.ts:32-62`, `server/src/combat/*` (nuevo), `api/src/jsons/balance.json:39-217`, `api/src/repositories/gameBalance.ts:95-147`, `api/schema.sql:13-81`, `api/migrations/*` (nuevo), `frontend/components/game/core/useCombatController.ts:364-440`, `frontend/components/CharacterStatsModal.tsx`, `frontend/lib/aowProtocol.ts:130-206`.

## Anexo B — Glosario de constantes propuestas (tuning inicial, no final)

`BASE_HIT=62, HIT_SLOPE=0.32, CRIT_BASE=5 %, CRIT_MULT=1.5, ARMOR_CAP=70 %, K_ATK=0.045, K_EVA=0.05, K_CRIT=0.06, STAMINA_MAX=100+CON*4, MELEE_COST=8, REGEN=6/tick, EXP_BASE=320, EXP_GROWTH=1.22 (<40)/1.10 (40+)`. Todo vive en `game_balance` para tuning sin deploy.
