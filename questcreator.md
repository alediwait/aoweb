# Cómo agregar una quest

Las quests se definen en `server/src/quests/questRegistry.ts`. Agrega un bloque `registerQuest({ ... })` junto a las demás quests. El `id` debe ser único y conviene escribirlo en minúsculas, con guiones bajos y sin espacios; se usa en el código y en los comandos internos.

## Textos y requisitos

- `name`: título que aparece en el diario.
- `description`: relato breve de lo que pide la quest.
- `levelRequirement`: nivel mínimo del personaje.
- `id`: identificador único, por ejemplo `deliver_herbs`.

Los textos se escriben directamente como cadenas entre comillas. La descripción del objetivo también aparece en el diario, así que debe explicar qué hacer y cuánto.

## NPC que entrega y recibe la quest

- `startNpcId`: NPC que ofrece la quest.
- `endNpcId`: NPC al que hay que volver para entregarla y cobrar la recompensa.

Usa el **índice de plantilla del NPC** (`templateNpcIndex`), no el ID de una instancia que aparece en el mapa. El personaje debe estar en el mismo mapa y a seis casilleros o menos del NPC para aceptar o entregar la quest. Si se omite uno de estos campos, no se exige hablar con ese NPC para esa acción.

## Objetivos

Cada entrada de `objectives` define un objetivo:

- `id`: identificador único dentro de esta quest.
- `type`: evento del juego que contará el progreso.
- `targetId`: ID del objeto, NPC, jugador o mapa, según el tipo de objetivo.
- `targetName`: nombre de NPC/objeto para identificarlo en objetivos de eliminación o recolección. Para NPC, el nombre debe coincidir con el nombre que usa el juego.
- `targetPosition`: destino para `reach_location`, con `map`, `x`, `y` y un `radius` opcional (por defecto, 2 casilleros).
- `requiredAmount`: progreso necesario para completar el objetivo.
- `currentAmount`: siempre comienza en `0`.
- `description`: texto visible para el jugador.
- `optional`: si es `true`, no impide completar la quest cuando queda pendiente.

Tipos con progreso conectado actualmente:

| `type` | Progreso por | Campos usuales |
| --- | --- | --- |
| `kill_npc` | Eliminar un NPC | `targetName` y/o `targetId`; puede limitarse con `zoneRestriction` |
| `collect_item` | Recoger un objeto | `targetId` del objeto |
| `talk_to_npc` | Interactuar con un NPC | `targetName` o `targetId` |
| `reach_location` | Llegar a un mapa o posición | `targetPosition` o `targetId` de mapa |
| `kill_player` | Eliminar un jugador | opcionalmente `targetId` |
| `craft_item` | Fabricar un objeto | `targetId` del objeto fabricado |
| `use_item` | Usar un objeto | `targetId` del objeto |
| `spell_cast` | Lanzar un hechizo | `targetId` del hechizo |
| `deal_damage` | Infligir daño | opcionalmente `targetId` del objetivo |
| `take_damage` | Recibir daño | opcionalmente `targetId` del atacante |
| `reach_level` | Alcanzar un nivel | `targetId` con el nivel requerido |

`escort_npc` figura en el tipo de datos, pero todavía no tiene una mecánica de progreso conectada; no lo uses esperando que se complete.

Si la quest debe contar eliminaciones solo en ciertos mapas, agrega `zoneRestriction: [1, 10]` al nivel de la quest, usando los IDs de mapa correspondientes.

## Recompensas

Cada entrada de `rewards` tiene un `type` y un `amount`:

- `{ type: "exp", amount: 100 }`: experiencia.
- `{ type: "gold", amount: 50 }`: oro.
- `{ type: "item", amount: 1, itemId: 36 }`: entrega objetos; `amount` es la cantidad y `itemId` el ID del objeto.
- `{ type: "faction_score", amount: 25, faction: "armada" }`: reputación para `armada` o `caos`.
- `{ type: "spell", amount: 1, spellId: 12 }`: enseña el hechizo indicado si el personaje aún no lo conoce. `amount` se mantiene en `1`.

Las recompensas se otorgan cuando el jugador entrega la quest en el NPC definido por `endNpcId`.

## Ejemplo completo

```ts
registerQuest({
    id: "deliver_herbs",
    name: "Un remedio para el camino",
    description: "El curandero teme que las reservas se agoten. Reúne hierbas y regresa con él.",
    levelRequirement: 2,
    startNpcId: 1, // índice de plantilla del NPC que la ofrece
    endNpcId: 1,   // índice de plantilla del NPC que la recibe
    objectives: [
        {
            id: "collect_herbs",
            type: "collect_item",
            targetId: 100,
            targetName: "Hierba Medicinal",
            requiredAmount: 5,
            currentAmount: 0,
            description: "Recolecta 5 hierbas medicinales",
        },
    ],
    rewards: [
        { type: "exp", amount: 120 },
        { type: "gold", amount: 40 },
        { type: "item", amount: 1, itemId: 36 },
    ],
});
```

Otros campos opcionales que ya admite la definición:

- `prerequisiteQuestIds`: IDs de quests que deben haberse entregado antes.
- `repeatable: true`: permite volver a aceptar la quest después de entregarla.
- `timeLimitMinutes`: tiempo límite desde que se acepta.

Al terminar la edición, reinicia el servidor para que registre la nueva definición. El diario la mostrará y permitirá aceptarla cuando el personaje cumpla el nivel, los requisitos y la proximidad al NPC.
