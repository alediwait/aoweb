# Estado de la IA de NPC

Este documento describe el comportamiento implementado en el servidor para detectar entidades, elegir objetivos, combatir y moverse. Resume el código de `server/src/npcAI/` y su integración con `server/src/npcs.ts`, `server/src/loadNpcs.ts` y `server/src/game.ts`.

## Tipos de comportamiento

Al cargar los NPC, `loadNpcs.ts` asigna el comportamiento según `npcType`:

| Tipo | Comportamiento | Respuesta a jugadores | Respuesta a NPC hostiles |
| --- | --- | --- | --- |
| `0` (común/monstruo) y `6` (dragón) | `aggressive` | Busca y ataca jugadores visibles; también toma como objetivo a quien lo ataque. | Puede atacar objetivos NPC válidos según su estado de combate. |
| `2` (guardia) y `8` (guardia Caos) | `guard` | No inicia ataques por proximidad. Persigue y ataca al jugador que lo haya atacado primero. | Detecta hostiles cercanos y los combate. |
| Otros tipos | `passive` | No toma represalias automáticamente cuando un jugador lo ataca. | La rutina de defensa contra hostiles cercanos también se aplica a NPC pasivos. |
| `defensive` | Solo si se configura explícitamente | Puede responder a una agresión si tiene `aggroOnAttack`. No es el valor asignado por defecto a los NPC neutrales. | Puede atacar hostiles. |

Los tipos hostiles que reconoce la detección de ciudades son `0` y `6`. Se usa el tipo de objetivo (`player` o `npc`) además del ID, porque los identificadores de jugadores y NPC pertenecen a registros distintos.

## Detección y selección de objetivos

### Jugadores

- Los NPC agresivos obtienen candidatos del área de jugadores visibles (`vars.areaNpc`) y descartan personajes desconectados, muertos, en otro mapa o invisibles para el NPC.
- Si existe un agresor reciente y sigue visible, se prioriza ese objetivo. Si no, la selección normal considera los jugadores visibles y su puntuación de objetivo.
- Los guardias y los NPC defensivos solo pueden seleccionar a un jugador cuando ya tienen un objetivo de tipo `player`, por ejemplo, después de recibir un ataque. La mera proximidad o visibilidad no los vuelve hostiles hacia el jugador.
- La IA valida periódicamente que el jugador objetivo siga vivo, conectado, en el mismo mapa y dentro del rectángulo de visión (`areaVisionRangeX/Y`, con valor alternativo de 15 por eje). Al dejar de ser válido, limpia la agresión y restaura el movimiento anterior.

### NPC hostiles

Cada tick de IA (500 ms), se agrupan por mapa los NPC vivos de tipo `0` o `6`. Cada NPC `passive`, `defensive` o `guard` sin un objetivo activo busca uno a distancia Manhattan de hasta 8 tiles. Si encuentra uno, registra el objetivo como `npc` y activa el movimiento de combate.

Si el objetivo NPC muere o deja de ser válido, se limpia y el NPC puede buscar otro hostil en un tick posterior. Esta búsqueda es independiente de la persecución de jugadores: haber atacado a un jugador no deshabilita la búsqueda de hostiles.

### Agresión y aliados

Cuando un jugador daña a un NPC, `game.markNpcAggressor` comunica la agresión al módulo de IA. Los guardias guardan a ese jugador como objetivo y pueden alertar a guardias cercanos del mismo mapa (radio Manhattan predeterminado de 10). La IA general también admite asistencia de aliados para estados guardia/defensivo (radio predeterminado de 8).

La memoria de agresión predeterminada es de 15 segundos; para guardias es de 30 segundos. El objetivo puede limpiarse antes si deja de ser válido o sale del rango de visión. Los NPC hostiles cargados tienen memoria configurada de 30 segundos.

## Combate

- La resolución del combate y el daño se mantienen en el sistema existente de `npcs.ts` y `game.ts`; la IA decide el objetivo y activa persecución, pero no sustituye las reglas de combate del servidor.
- Cuando el objetivo no está junto al NPC, este intenta acercarse. Cuando está en una casilla adyacente, puede atacar sujeto al enfriamiento global `vars.timing.statusDurations.npcAttackMs`.
- Antes de atacar, el NPC puede intentar lanzar un hechizo disponible si su estrategia y configuración lo permiten. Los guardias tienen configuración para hechizos; su uso real depende de los hechizos registrados y sus enfriamientos.
- Los NPC `passive` no toman represalias contra el jugador. Los hostiles (`aggressive`) sí buscan jugadores visibles; los guardias solo atacan al jugador que los provocó (o a un criminal/atacante de un objetivo protegido cuando se invocan esos manejadores).
- El combate entre NPC se limita a objetivos NPC vivos y del mismo mapa; la rutina descrita para ciudades selecciona como enemigo a los tipos hostiles `0` y `6`.
- Las invocaciones tienen tratamiento propio dentro de `npcs.ts`; pueden priorizar objetivos relacionados con su dueño y siguen una ruta de movimiento separada.

## Movimiento y persecución

- El movimiento normal de combate procesa NPC con `movement === 3`, sujeto al tiempo de pensamiento (`vars.timing.npcThinkMs`).
- Al entrar en combate, la IA guarda el valor previo de `movement` una sola vez y lo cambia a `3`. Al limpiar el objetivo, restaura ese valor guardado.
- `npcAttackUser` valida el objetivo y el mapa, comprueba si está adyacente y, si no lo está, solicita el siguiente paso de ruta (`getNextChasePosition`) y mueve al NPC con `moveNpcByPos`.
- Si no hay ruta disponible, el NPC no avanza en ese intento; el procesamiento posterior puede volver a intentarlo.
- Los NPC paralizados o inmovilizados no avanzan ni ejecutan el ataque en ese ciclo.
- El procesamiento de movimientos permite atender objetivos de IA de tipo `player` o `npc` aunque no haya jugadores registrados en el área visible del NPC. Esto es necesario para la persecución entre NPC.

## Ciclo resumido

1. El servidor carga el NPC y asigna su comportamiento por tipo.
2. La IA detecta jugadores visibles (para hostiles) y NPC hostiles cercanos (para NPC neutrales y guardias).
3. Una agresión del jugador registra al atacante; el guardia solo adquiere ese objetivo después de ser atacado.
4. El NPC valida el objetivo, busca una ruta y se acerca.
5. Al quedar adyacente, intenta atacar, respetando el enfriamiento y las reglas de combate.
6. Si el objetivo deja de ser válido o expira la memoria de agresión, se limpia el estado y se restaura el movimiento anterior.

## Archivos principales

- `server/src/npcAI/npcAI.ts`: estado, aggro, ciclo de IA, detección de hostiles cercanos y movimiento de combate.
- `server/src/npcAI/guardAI.ts`: inicialización y respuesta de guardias a ataques/crímenes, memoria y asistencia.
- `server/src/npcAI/strategies.ts`: diferencias de estrategia entre NPC pasivos, defensivos, agresivos y guardias.
- `server/src/loadNpcs.ts`: asignación inicial del comportamiento según `npcType`.
- `server/src/npcs.ts`: selección de objetivos, movimiento de persecución y resolución de ataques NPC.
- `server/src/game.ts`: registro de agresiones de jugadores contra NPC e integración con la IA.

## Valores configurables relevantes

| Parámetro | Valor usado por defecto |
| --- | ---: |
| Frecuencia del tick de IA | 500 ms |
| Detección de hostiles por NPC de ciudad | 8 tiles Manhattan |
| Memoria de aggro general | 15 s |
| Memoria de aggro de guardias | 30 s |
| Radio de asistencia de guardias | 10 tiles Manhattan |
| Visión de jugador si no hay configuración | 15 tiles por eje |

