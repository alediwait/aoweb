# Plan de Mejoras: IA de NPCs y Sistema de Habilidades

> Documento de relevamiento y propuesta (solo lectura — no se modificó código).
> Ámbito analizado: `server/src` (+ impacto en `frontend/` y `api/` cuando corresponde).
> Fecha: octubre 2026.

---

## 0. Resumen Ejecutivo

| # | Mejora | Estado actual | Complejidad | ¿Toca frontend? |
|---|--------|---------------|-------------|------------------|
| A1 | Sonido/FX de aggro al detectar jugador | Campo `soundClose` existe pero **nunca se usa** | **Baja** | No (packet `playSound` ya existe) |
| A2 | Mantener distancia (arquero/mago que kitea) | No existe — todos persiguen hasta casilla adyacente | **Media** | No |
| A3 | Fase de huida / "enrage" con poca vida | No existe — solo curación propia al 75% | **Media** | Sí (indicators opcionales) |
| A4 | Selección inteligente de hechizo por contexto | Aleatoria entre ofensivos válidos | **Baja–Media** | No |
| A5 | Reacción a la distancia del objetivo (rango de hechizo configurable por hechizo) | Rango global fijo (11×9) + `spellRange` del NPC | **Baja** | No |
| B1 | Skills reales (dejar el "skill simulado" = nivel×3) | **No existen**: `getSimulatedSkill() = min(100, level*3)` | **Alta** | Sí (stats + barras de progreso) |
| B2 | Subdivisión de Magia en ramas elementales | Un solo skill implícito; hechizos sin elemento | **Alta** (requiere B1) | Sí (UI de ramas) |
| B3 | Progresión por uso (train) y puntos al subir nivel | No existe — al subir nivel solo suben HP/mana/hits | **Media–Alta** | Sí |

> **Hallazgo crítico (B1):** el juego aparenta tener 7 skills (Tácticas, Defensa, Armas, Proyectiles, Wrestling, Ocultarse, Apuñalar) pero **todas devuelven el mismo número derivado del nivel**. El frontend ya muestra la sección "Skills" en `CharacterStatsModal` con esos valores ficticios. Cualquier progresión real parte de reemplazar `getSimulatedSkill`.

---

## Parte A — IA de NPCs / Criaturas Hostiles

### A.0. Mapa actual de la IA (dónde está cada cosa)

La IA vive casi toda en **`server/src/npcs.ts`** (2.579 líneas) con soporte en otros archivos:

| Archivo | Rol en la IA |
|---------|--------------|
| `server/src/npcs.ts` | **Núcleo**: `npcAttackUser` (think por NPC), `selectNpcTarget` (scoring), `tryNpcCastSpell` + `chooseNpcSpell` (hechizos), `getNextChasePosition` + `buildFlowField` (pathfinding BFS con caché), `reserveAttackTile` (evita que 2 NPCs pisen la misma casilla de ataque), `attackNpcTarget` (melee NPC vs summon), `muereNpc` (muerte/respawn), `spawnSummon` |
| `server/src/server.ts` (L893–914) | **El loop**: `createDynamicScheduler` ejecuta `npcs.processPendingMovements()` cada `gameplayTickMs` (50 ms). Cada NPC "piensa" cada `npcThinkMs` (650 ms) gracias a `npc.nextThinkAt` |
| `server/src/vars.ts` (L41–108) | **Tuning**: `timing.npcThinkMs`, `timing.statusDurations.npcAttackMs` (2 s cooldown melee), y el bloque `npcAi` (TTL del flow-field, memoria de agresor 15 s, lock de target 3 s, pesos del scoring `targetScoreWeights`) |
| `server/src/game.ts` (L5750–5873, L1112) | **Detección**: `setNewAreas` — al entrar/moverse un jugador, los NPCs con `movement == 3` (hostil) que lo "detectan" (`canNpcDetectCharacter`: no admin invisible, no invisible por hechizo) lo agregan a `vars.areaNpc[npcId]`. Es el "ojo" del NPC |
| `server/src/game.ts` (L6100, L9692) | Click/ataque del jugador sobre NPC hostil → también entra al área |
| `server/src/loadNpcs.ts` | Hidrata cada NPC instanciado desde el template (`vars.datNpc`): stats, `snd1/snd2/soundClose`, `spells[]`, `spellCastIntervalMs`, `spellRange` |
| `server/src/npcData.ts` | Tipo `DataNpc` + normalización/defaults de los templates (sincronizados desde la API: tabla `game_npcs`) |
| `server/src/gameDataSync.ts` (L247–295) | `patchLiveNpc`: aplica cambios de template a NPCs vivos en el mundo (con guarda `isNpcSafeToPatch`) |
| `server/src/handleProtocol.ts` | Primitivas de feedback que la IA ya usa: `playSound` (pkt 49), `animFX` (pkt 10), `dialog` (burbujas, pkt 7), `console` (pkt 8), `spellProjectile` (pkt 66), `entityVitalsDelta` (pkt 81) |
| `server/src/package.ts` | IDs de paquetes; `clientPacketID` llega hasta **81** (libre para agregar 82+) |

**Flujo de combate NPC→jugador actual (simplificado):**

```
server.ts tick (50ms)
  └─ npcs.processPendingMovements()                  [npcs.ts L2174]
       ├─ calcula targetPressure (cuántos NPCs apuntan a cada jugador)
       └─ por cada NPC movement==3 con nextThinkAt vencido:
            npcAttackUser(idNpc)                      [npcs.ts L2353]
              ├─ selectNpcTarget()   → scoring (distancia, presión, tiles de
              │                         escape/ataque, agresor reciente, lock 3s)
              ├─ tryNpcCastSpell()   → chooseNpcSpell():
              │                         · si HP≤75% y tiene curación → curarse
              │                         · si en rango (11×9 o spellRange) →
              │                           hechizo ofensivo ALEATORIO
              │                         · feedback: FX + wav + palabras mágicas
              ├─ si no está adyacente → getNextChasePosition() (flow-field BFS,
              │                         detour de multitudes, reserva de tile)
              └─ si está adyacente → golpe melee (poderAtaque vs evasion,
                                      partes del cuerpo, escudo, snd1/snd2)
```

**Estado de sonidos de NPC:** el template ya define `snd1` (sonido al atacar), `snd2` (sonido al recibir daño) y **`soundClose` (cargado en `loadNpcs.ts` L102, `gameDataSync.ts` L267, `arenaManager.ts`, `commands.ts`… pero jamás reproducido en la IA)**. Es decir: el dato ya existe en la DB (`game_npcs.data`) y solo falta usarlo → la mejora A1 es casi gratis.

**Lo que la IA NO hace hoy** (brechas a cubrir con las mejoras):

- ❌ Sonar/FX al detectar un jugador (aggro feedback).
- ❌ Mantener distancia o kiting (todo NPC persigue hasta pegarse).
- ❌ Huir, pedir ayuda o entrar en pánico con poca vida.
- ❌ Elegir hechizo según contexto (daño bajo, objetivo paralizado, curación ajena, etc.) — es aleatorio.
- ❌ Distintas "personalidades" (guardia persigue pero no sale de su zona, mago se queda lejos, bestia rush).
- ❌ Coordinación entre NPCs del mismo tipo (emboscada, foco al más débil).
- ❌ Día/noche, olores, emboscada desde invisibilidad propia, etc.

---

### A1. Sonido + FX de aggro al detectar jugador — **Complejidad: Baja**

**Idea:** cuando un NPC hostil agrega un jugador a su `areaNpc` por primera vez (transición "pasivo → aggro"), reproducir `soundClose` (o un nuevo `aggroSoundId`) y enviar un FX.

**Puntos de modificación:**

1. `server/src/npcs.ts`:
   - En `npcToArea()` (L2862, función interna `addNpcToUser`) y en `game.ts setNewAreas` (L5804–5810) — o centralizar detectando la transición en `npcAttackUser` la primera vez que `previousTargetId === 0` (L2362–2377) → **recomendado: hacerlo en `npcAttackUser`**, un solo lugar.
   - Al detectar `previousTargetId === 0 && target` → `handleProtocol.playSound(npc.id, npc.soundClose, client)` + `handleProtocol.animFX(npc.id, fx, client)` vía `loopArea` (mismo patrón de `sendNpcSpellFeedback`, L439).
2. `server/src/vars.ts`: agregar `npcAi.aggroFxId` (o reusar un FX existente).
3. Nada más. El cliente ya reproduce `playSound` (pkt 49) con Howler (`frontend/lib/sound.ts`).

**Riesgo:** bajo. Solo ruido/feedback. Considerar anti-spam: un cooldown `lastAggroSoundAt` por NPC (~3–5 s).

**Frontend:** no requiere cambios (los sonidos y FX ya se manejan).

---

### A2. Mantener distancia / kiting (criatura a distancia) — **Complejidad: Media**

**Idea:** NPCs "a distancia" (mago/arquero) no corren hacia el jugador: se quedan dentro de su rango de hechizo pero fuera del rango de golpe del jugador, y retroceden si el jugador se acerca.

**Dónde está hoy el comportamiento opuesto:** `npcAttackUser` (L2408–2436) — si no está adyacente, **siempre** persigue con `getNextChasePosition` (que baja por el flow-field hacia las 4 casillas adyacentes al objetivo).

**Puntos de modificación (todos en `server/src/npcs.ts`):**

1. **Template** (`server/src/npcData.ts` + `server/src/loadNpcs.ts` + `gameDataSync.patchLiveNpc`): nuevo campo `combatStyle: "melee" | "ranged" | "skirmisher"` (default `"melee"` → cero regresión). Como `DataNpc` es un JSON flexible con `catchall` en el Zod de la API (`api/src/repositories/gameNpcs.ts` usa `.catchall(z.unknown())`), **no requiere migración de DB**.
2. **Nuevo flujo en `npcAttackUser`** para `ranged/skirmisher`:
   - Calcular distancia actual (ya existe `getManhattanDistance`).
   - Si `distancia > spellRange` → perseguir (código actual, reutiliza flow-field).
   - Si `distancia <= minDistance` (p.ej. 3–4, configurable por template: `preferredMinDistance`) → **retroceder**: invertir la lógica del flow-field (construir el campo hacia "lejos del objetivo" o simplemente elegir el paso legal que maximice distancia sin pisar obstáculos — función nueva `getNextRetreatPosition`, ~40–60 líneas).
   - Si está en banda cómoda → lanzar hechizo (lógica actual de `tryNpcCastSpell`).
3. **`vars.ts` → `npcAi`**: nuevos parámetros `rangedKeepDistance`, `rangedRetreatPriority` (peso de retreat vs atacar).
4. **Flow-field inverso (opcional, mejor pathfinding al retroceder):** `buildFlowField` (L1452) está construido con goal = adyacentes del objetivo; una variante con goal = posición del NPC y walk-away funciona igual de bien con BFS estándar.

**Riesgo medio:** los NPCs al retroceder pueden "atrapar" al jugador contra muros o llevarlo fuera de la zona (el juego no tiene leash de spawn hoy — agregar `maxChaseDistanceFromSpawn`, p.ej. 25 tiles, usando `npc.spawnOrigin` que ya existe). **Recomendado incluir el leash en esta misma feature** para evitar exploits (arrastrar NPCs lejos de su zona de respawn).

**Frontend:** no requiere cambios (el movimiento usa el mismo paquete `actPosition`/`moveEntity`).

---

### A3. Fase de huida / enrage con poca vida — **Complejidad: Media**

**Idea:** umbrales de HP por template (`fleeHpPct`, `enrageHpPct`) que cambien el comportamiento:

- `hp% ≤ fleeHpPct` (p.ej. 15%) → **huye** hacia su `spawnOrigin` (o zona segura), no ataca, emite sonido de pánico (reusar `snd2` o nuevo `fleeSoundId`). Al llegar al spawn, "cura parcial" o simplemente resetea su estado a patrulla.
- `hp% ≤ enrageHpPct` (p.ej. 25%) → **enrage**: +daño/+velocidad de ataque, sin curarse, sin huir, FX rojo, nombre con sufijo "(Furioso)" o color.

**Dónde modificar:**

1. `server/src/npcs.ts`:
   - `npcAttackUser` (L2353): antes de todo, evaluar fase → ruta de huida con `getNextChasePosition` apuntando a `spawnOrigin` (el flow-field hay que construirlo hacia la meta de spawn — reutilizando `buildFlowField` con una meta custom o función simple de un paso, ya que huir solo requiere alejarse).
   - Al morir o al terminar la pelea, limpiar estado (`clearNpcTarget` ya existe, L1128).
   - Enrage: multiplicador aplicado en `npcAttackUser` (daño, L2489) y en `tryNpcCastSpell` (daño de hechizo, L617).
   - `muereNpc` (L2238): no persistir estado de fase (resetea en respawn — ya lo hace).
2. **Estado runtime** en el tipo `NpcCharacter` (L46–106): `aiPhase?: "idle" | "aggro" | "flee" | "enrage"`, `aiPhaseChangedAt`.
3. `server/src/npcData.ts` + `loadNpcs.ts` + `gameDataSync.patchLiveNpc`: campos `fleeHpPct`, `enrageHpPct`, `enrageDamageBonus`, `fleeSpeedupMs` (cooldown de ataque más corto).
4. **Sincronización al cliente (opcional):** si querés que se vea el "Furioso":
   - `server/src/handleProtocol.ts` → `writeNpcPayload` (L648): agregar 1 byte de "AI phase/flags" **al final** del payload.
   - `frontend/components/game/session/incomingCharacterPackets.ts` (`getNpc`/`areaNpcsSnapshot`, L211–240) y `engine/Engine.ts` (`syncRemoteEntity`): parsear el byte extra.
   - ⚠️ **Compatibilidad:** el parser binario del cliente debe actualizarse en el mismo deploy que el servidor (payload NPC es fijo, sin flags actualmente). Es el punto más delicado. Alternativa sin romper nada: usar solo `animFX` (pkt 10) + `dialog` + nombre coloreado ya existentes para el feedback visual, y no tocar el payload.
5. `frontend`: solo si se elige la opción visual (indicador/enrage overlay en `rendering/characterRenderer.ts`, que ya dibuja barras de vida — `healthBarBg/Fill`).

**Frontend:** requerido solo para indicador visual de fase (opcional). El resto funciona con paquetes existentes.

---

### A4. Selección inteligente de hechizo — **Complejidad: Baja–Media**

**Idea:** reemplazar el azar de `chooseNpcSpell` (L403–437) por scoring por hechizo.

**Hoy:** filtra hechizos disponibles (cooldown vencido) → si HP≤75% elige curación aleatoria → si en rango, elige **aleatorio** entre ofensivos (paraliza/inmoviliza/daño), evitando CC si el objetivo ya está CC.

**Propuesta (scoring por slot, ~30–50 líneas en `npcs.ts`):**

```
score(spell) =
  + peso si datSpell.subeHp==2 y target.hp bajo (rematar)
  + peso si datSpell.paraliza y target escapando (pocas tiles de escape →
    countUserEscapeTiles ya existe, L1294)
  + penalización si paraliza/inmoviliza y target ya CC (ya se filtra)
  + bonus si spell.matiza/elemento coincide con resistencia débil del target (requiere B2)
  + bonus si npc.hp bajo y spell es curación (ya implícito, afinar umbral)
  - penalización por repetir el último hechizo (anti-bucle)
```

**Dónde modificar:** solo `server/src/npcs.ts` (`chooseNpcSpell`) + parámetros en `vars.ts → npcAi.spellWeights`. El tipo `DataSpell` (`types/runtime.ts` L206) ya tiene todos los campos necesarios (`subeHp`, `minHp/maxHp`, `paraliza`, `inmoviliza`); si se quiere "elemento" por hechizo, agregar `element?: "fuego" | "hielo" | ...` (los templates de hechizo son JSON — sin migración; la API permite JSON flexible).

**Frontend:** no requiere cambios.

---

### A5. Rango de hechizo por hechizo y reacción a distancia — **Complejidad: Baja**

**Idea:** hoy el rango es global (`DEFAULT_NPC_SPELL_RANGE_X = 11`, `Y = 9`, L38–39) + `spellRange` manhattan del NPC. Agregar `spellRange` opcional por slot de hechizo (un hechizo de área corta vs uno lejano) usando `isWithinNpcSpellRange` (L370).

**Dónde modificar:** `server/src/types/runtime.ts` (`NpcSpellSlot`, L226: `range?: number`), `loadNpcs.ts` (copiar el rango al hidratar), `chooseNpcSpell`/`isWithinNpcSpellRange` en `npcs.ts`.

**Frontend:** no requiere cambios.

---

### Roadmap sugerido Parte A

1. **A1** (sonido aggro) — 1–2 días, cero riesgo, usa `soundClose` muerto.
2. **A5 + A4** (rango por hechizo + scoring) — 2–4 días, solo `npcs.ts`/`vars.ts`.
3. **A2 + leash de spawn** — 4–7 días, toca pathfinding.
4. **A3** (fases) — 4–7 días; decidir feedback visual (sin tocar payload vs. tocar `writeNpcPayload` + cliente).

---

## Parte B — Sistema de Habilidades (Skills) y Progresión

### B.0. Estado actual (hallazgo principal)

**No existe un sistema de skills real.** Todo el combate, hechizos, crafting y recolección usan una única función simulada:

```ts
// server/src/game.ts L421-423
function getSimulatedSkill(user: GameCharacter): number {
    return Math.min(100, user.level * 3);
}
```

Las 7 funciones públicas `getSkillTacticasCombate`, `getSkillDefensa`, `getSkillArmas`, `getSkillProyectiles`, `getSkillWrestling`, `getSkillOcultarse`, `getSkillApu` (todas en `game.ts` L8358–8462) devuelven **exactamente lo mismo**: `level × 3` (tope 100). Es decir:

- La "skill" no progresar por uso; es una foto del nivel.
- `minSkill` de los hechizos (p.ej. 60) en la práctica significa "nivel 20" (`protocol.ts` L162–163 y L3817: `getSimulatedSkill(user) < minSkill`).
- El crafting (`crafting.ts` L300/345/380) y la recolección (`harvesting.ts` L195) usan el mismo valor simulado.
- La tabla `characters` (DB) **no tiene columnas de skills** (`database/aoweb.sql` L215–288) — no hay dónde persistirlas.
- El frontend (`CharacterStatsModal.tsx` L523–597) ya renderiza la sección "Skills" con 7 filas, alimentada por el paquete `characterStatsSnapshot` (pkt 57) que arma `commands.ts → buildCharacterStatsSnapshot` (L252–262) con esas funciones simuladas.

**Dónde vive la progresión de nivel hoy:** `game.ts → checkUserLevel` (L6837–6905): al superar `expNextLevel` sube nivel y recalcula `maxHp/maxMana/minHit/maxHit` desde `balanceData.classProgress`. **No reparte puntos de atributo ni de skill.** La exp por daño sale de `calcularExp` (L9478).

**Magic damage hoy:** `applyMagicBonuses`/`applyMagicResistanceToNpc/User` (`game.ts` L757–797) usan `getSimulatedSkill` como "skill de magia" del caster y del target, más modificadores por clase (`vars.modDmgMagia`, `vars.modResistenciaMagica` desde `balanceData.ts`) y bonus de ítems (`magicDamageBonus`, `magicPenetration` en `DataObject`).

**Hechizos:** `server/jsons/spells.json` (y tabla `game_data` sincronizada) con campos: `name`, `desc`, `type`, `target`, `minSkill`, `manaRequired`, `subeHp` (1=cura, 2=daño), `minHp/maxHp`, `paraliza`, `inmoviliza`, `invisibilidad`, `revivir`, `fxGrh`, `wav`, `palabrasMagicas`, `staffAffected`, `projectileVisual` (colores del proyectil que ya usa el cliente). **No hay concepto de elemento/rama.**

---

### B1. Skills reales con progresión por uso — **Complejidad: Alta** (es la base de todo lo demás)

**Modelo propuesto** (clásico Argentum / AO):

- Cada personaje tiene skills 0–100 con sub-puntos (p.ej. `skill = 1000` decimos → se guarda entero 0–1000 y se muestra /100).
- Entrenan por uso: golpear con arma sube "Armas", bloquear sube "Defensa", lanzar hechizo sube su rama (ver B2), ocultarse sube "Ocultarse", etc.
- Regla base: probabilidad de mejora baja (p.ej. `chance = max(1, (100 - skill) / 4)`), con tope por nivel (`skillMaxForLevel = min(100, level * 3)` — **la fórmula actual se convierte en tope**, lo que hace la transición balanceada y no rompe contenido existente).

**Archivos a modificar:**

| Archivo | Cambio | Detalle |
|---------|--------|---------|
| `database/aoweb.sql` + `api/schema.sql` | **Migración SQL** | Nueva tabla `character_skills (character_id uuid, skill_key text, value int, updated_at)` o columna JSONB `skills jsonb` en `characters`. Recomendado: tabla aparte (1 FK + índice) |
| `api/src/repositories/characters.ts` | Carga/guardado | Leer skills en el login/selector y en `character_save`; los campos de personaje ya se serializan con un mapa `FIELD_MAP` (L201+) — skills como JSONB simplifica |
| `server/src/types/runtime.ts` | `RuntimeCharacter` (L232) | `skills?: Record<SkillKey, number>` (los tipos ya permiten `[key: string]: unknown`) |
| `server/src/login.ts` | Hidratar | Al cargar el personaje desde la API, poblar `user.skills` |
| `server/src/vars.ts` | Catálogo | `skillKeys` (tacticasCombate, defensa, armas, proyectiles, wrestling, ocultarse, apuñalar, +Hechicería/ramas de B2) y `skillTrainRates` |
| `server/src/game.ts` | **Reemplazar `getSimulatedSkill`** | `getSkill(user, key)` real + `trainSkill(user, key, amount)` (con chance y tope por nivel). Los 8 call-sites de `getSimulatedSkill` (L764, 785–786, 8364…8457) pasan a pedir la skill correspondiente. `crafting.ts` L300/345/380 y `harvesting.ts` L195 también |
| `server/src/protocol.ts` / `game.ts` | Entrenar por uso | Donde se resuelve el golpe: melee del jugador (`poderAtaqueArma`, ~L8589), escudo (`getSkillDefensa` en bloqueo, ~L8130), proyectiles, apuñalar (`puedeApu`, L8469), ocultarse (`toggleHiddenSkill` pkt 244), y al lanzar hechizo (`protocol.ts` L3790+) |
| `server/src/commands.ts` | Snapshot real | `buildCharacterStatsSnapshot` (L231): skills reales en vez de las simuladas |
| Persistencia periódica | `game.worldSave` (scheduler en `server.ts` L916) + `character_save` de la API | El guardado del personaje ya existe; agregar skills al payload |

**Migración de contenido:** los hechizos con `minSkill` (spells.json) y recetas con `skill` (crafting/smelting) quedan interpretados contra la skill real; como el tope por nivel replica `level×3`, **el requisito efectivo no cambia para personajes existentes** (solo que ahora pueden entrenarlo antes o quedar por debajo si no lo usan). Balance controlado y reversible.

**Frontend (impacto):**

| Archivo | Cambio |
|---------|--------|
| `frontend/components/CharacterStatsModal.tsx` | La sección "Skills" (L523) ya consume `snapshot.skills` — se actualiza el payload del paquete 57 en el servidor y el modal muestra valores reales + barra de progreso (hoy solo número). Agregar sub-puntos visuales y tooltip de "próxima mejora" |
| `frontend/lib/*` | Tipado del snapshot (`characterStatsSnapshot` se parsea en `components/game/session/incomingUiPackets.ts` o `incomingCharacterPackets.ts` — verificar al implementar; el paquete usa chunking `characterStatsSnapshotChunk` pkt 58, así que el payload puede crecer sin romper) |
| Opcional | Notificación "¡Skill subió!" — reusar `console` (pkt 8) con color, o paquete nuevo |

**Riesgos:** alto volumen de toques (10+ archivos server, 2 api, 2–4 frontend, migración SQL). Requiere tests de regresión de combate (hay suite de integración en `api/src/tests` pero **no hay tests de combate del server** — considerar agregar tests unitarios de `game.ts` con el sistema de skills).

---

### B2. Subdivisión de Magia en ramas elementales — **Complejidad: Alta** (requiere B1)

**Idea:** en vez de una skill "Magia" genérica (hoy simulada), ramas: **Fuego, Hielo, Rayo, Tierra/Naturaleza, Sanación, Invocación** (ejemplo; el catálogo es configurable en `vars.ts`).

**Diseño propuesto:**

1. **Catálogo** en `vars.ts`: `magicSchools = { fuego: "Fuego", hielo: "Hielo", ... }`.
2. **Hechizos con elemento:** `DataSpell` (`types/runtime.ts` L206) ya tiene `[key: string]: unknown` — agregar `school?: MagicSchoolKey` y `schoolWeight?: number` (para hechizos híbridos). Los hechizos son JSON flexibles en `game_data` (API usa `.catchall`) → **sin migración de DB**, solo cargar `spells.json` con el nuevo campo y ajustar `loadSpells.ts`.
3. **Progresión:** al lanzar un hechizo, `trainSkill(user, datSpell.school, ...)` (en el flujo de `attackSpell` de `protocol.ts` L3790+ y `game.userSpellNpc`/`userSpellUser`). La efectividad (daño/curación) escala con esa rama en lugar de `getSimulatedSkill`:
   - `applyMagicBonuses` (game.ts L752: `getMagicDamageModifier(caster.idClase)`) → multiplicar también por `schoolSkill/100` con curva suave.
   - `applyMagicResistanceToNpc/User` (L764, 785): la "skill mágica" del caster pasa a ser **la rama del hechizo lanzado** (parámetro nuevo), y la resistencia del target puede ser por rama (`npc.magicResistanceBySchool?: Record<...>`, hoy es un número global).
4. **Requisitos por rama:** `minSkill` de hechizo ahora se valida contra `skills[school]` (o mantener `minSkill` global + nuevo `minSchoolSkill` para contenido avanzado).
5. **Balance de clases:** `balanceData.ts` tiene `modDmgMagia`/`modResistenciaMagica` por clase — extender con `schoolAptitude: Record<classId, Record<school, number>>` para que el Mago sea bueno en Fuego/Hielo, el Druida en Naturaleza/Invocación, etc. (`game_balance` en la API ya sincroniza `balanceData` completo vía `gameDataSync.applyBalanceChanges` — sin migración).
6. **Invocación:** los hechizos con `type==4 && numNpc>0` (ya detectados en `protocol.ts` L3813) → rama "Invocación" (proyecta a futuro permitir invocaciones más fuertes a mayor skill).

**Frontend (impacto — necesario para inmersión):**

| Archivo | Cambio |
|---------|--------|
| `frontend/components/CharacterStatsModal.tsx` | Sección "Habilidades Mágicas": barras por rama con % de progreso |
| NUEVO: `frontend/components/MagicSchoolsPanel.tsx` (o pestaña en el modal de personaje) | Árbol visual de ramas: al subir de rama, mostrar hechizos disponibles de esa rama y ventajas (p. ej. "Aprendiste Bola de Fuego II") |
| `frontend/lib/*` + payload pkt 57 | Extender `characterStatsSnapshot.skills` → `skills: {...} & magicSchools: Record<school, {value, level, toNext}>`. El chunking pkt 58 ya soporta payloads grandes |
| `frontend/app/play/page.tsx` + `components/game/` | Opcional: efecto/tinte elemental en hechizos — `projectileVisual` (spells.json) ya permite colores por hechizo; agregar `school` al tooltip de hechizos (panel de hechizos en `play/page.tsx`) |
| Wiki (`frontend/components/wiki/`) | Sección "Escuelas de magia" (usa `lib/wiki-data.ts`) |

**Nota de balance:** las mejoras de daño por rama deben ser modestas (p. ej. ±15%) para no invalidar el balance actual de `modDmgMagia` por clase.

---

### B3. Progresión inmersiva al subir de nivel — **Complejidad: Media–Alta**

**Idea:** que subir de nivel se sienta significativo. Hoy `checkUserLevel` (game.ts L6837) solo imprime 4 mensajes de consola y actualiza HP/mana/hits.

**Propuestas (combinables):**

1. **Puntos de distribución** (opcional estilo AO clásico): al subir, +10 puntos para repartir en Fuerza/Agilidad/Inteligencia/Constitución (atributos ya existen: `attrFuerza` etc. en `RuntimeCharacter` L311). Requiere: paquete para abrir un modal de reparto (paquete nuevo o reusar `panelSnapshot` 53), UI en frontend, persistencia (los attrs ya se guardan).
2. **Puntos de skill / desbloqueos por rama** (si B2 existe): al subir N niveles, desbloquear hechizo de la rama entrenada (la learnSpell ya existe: `aprenderSpell` pkt 42 + pergaminos con `spellIndex`).
3. **Sonido/FX de nivel:** ya existe `SND_NIVEL = 6` en `vars.arSounds` (L593) — verificar que se use en `checkUserLevel` (hoy no se ve su uso ahí); agregar `animFX` de nivel + mensaje destacado + posible recompensa cosmética.
4. **Hitos de rama:** notificación "Tu dominio de Fuego alcanzó el rango Aprendiz" al cruzar umbrales de skill.

**Frontend:** modal de reparto de puntos (nuevo componente), notificaciones, y el modal de stats con atributos distribuibles (hoy solo muestra valores).

---

## C. Tabla Final de Complejidad y Orden Recomendado

| Orden | ID | Mejora | Archivos server principales | Frontend | API/DB | Estimación |
|-------|----|--------|----------------------------|----------|--------|------------|
| 1 | A1 | Sonido/FX aggro | `npcs.ts`, `vars.ts` | — | — | 1–2 días |
| 2 | A5 | Rango por hechizo | `npcs.ts`, `types/runtime.ts`, `loadNpcs.ts` | — | — | 1–2 días |
| 3 | A4 | Scoring de hechizos | `npcs.ts`, `vars.ts` | — | — | 2–3 días |
| 4 | A2 | Kiting + leash | `npcs.ts`, `vars.ts`, `npcData.ts`, `gameDataSync.ts` | — | — | 4–7 días |
| 5 | A3 | Huida/enrage | `npcs.ts`, `npcData.ts`, `loadNpcs.ts`, `gameDataSync.ts` (+`handleProtocol.ts` si hay indicador) | Opcional (1 comp. + parser) | — | 4–7 días |
| 6 | B1 | Skills reales | `game.ts`, `protocol.ts`, `commands.ts`, `login.ts`, `vars.ts`, `types/runtime.ts`, `crafting.ts`, `harvesting.ts` | `CharacterStatsModal.tsx`, parser pkt 57 | Migración SQL + `characters.ts` | 2–3 semanas |
| 7 | B2 | Ramas elementales | `game.ts`, `protocol.ts`, `vars.ts`, `loadSpells.ts`, `balanceData.ts` | Modal + panel de ramas + tooltips | Sync `game_data` (sin migración) | 1–2 semanas (tras B1) |
| 8 | B3 | Progresión de nivel | `game.ts` (`checkUserLevel`) | Modal de puntos / notificaciones | Persistencia attrs | 1 semana |

### Notas transversales de implementación

- **Extensibilidad del protocolo:** `clientPacketID` termina en 81 (`package.ts` L117) — hay lugar para paquetes nuevos (`npcAiPhaseDelta: 82`, `skillGained: 83`, etc.). `characterStatsSnapshot` ya usa chunking (pkts 57/58), así que crecer el payload de skills es seguro.
- **Templates de NPC y hechizos son JSON** (`game_npcs.data`, `game_data`): casi todas las mejoras de IA/campos nuevos no requieren migración SQL (el Zod de la API usa `.catchall`); **la única migración real es la de skills (B1)**.
- **Sincronización en caliente:** `gameDataSync.patchLiveNpc` (L247) debe copiar cada campo nuevo de template a los NPCs vivos (hoy copia sonidos/hechizos… agregar `combatStyle`, umbrales de fase, etc.), con la guarda `isNpcSafeToPatch`.
- **Performance:** el think de NPC corre a 650 ms/NPC dentro de un tick de 50 ms; las mejoras de scoring/flow-field deben mantenerse O(vecindario) (ya lo son: flow-field con caché y BFS acotado a radio 15). El scoring por hechizo (A4) evalúa ~pocos slots por NPC, despreciable.
- **Testing:** el server no tiene tests automatizados de combate — para B1 se recomienda crear tests unitarios de `game.ts` (skills/daño) antes de tocar fórmulas; para A2–A3, tests de pathfinding con mapas sintéticos.
- **Rollback:** todas las mejoras de IA deben ser **opt-in por template** (defaults = comportamiento actual) para poder activarse NPC por NPC desde el editor de game-data sin redeploy.
