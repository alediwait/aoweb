# Manual del Servidor de Juegos (WebSocket)

Este documento describe el componente `server/`, que es el **servidor de juego en tiempo real** del proyecto AOWeb. Este servidor es crucial porque es la única autoridad en el mundo virtual, determinando lo que los clientes (el Frontend) realmente experimentan.

---

## 🌐 1. ¿Qué es el Servidor de Juegos?

A diferencia de la API REST, que maneja datos *persistentes* (ej: guardado de personajes, inventario), el servidor de juegos maneja el **estado transitorio y autoritativo** del mundo en tiempo real. Su función principal es ejecutar el bucle del juego (el *game loop*), calcular colisiones, gestionar el combate en vivo, y enviar actualizaciones instantáneas a todos los clientes conectados.

**Analogía:** Si la API es el encargado de la *oficina de contabilidad* (donde se guardan los registros permanentes), el servidor es el *maestro de ceremonias* y el encargado del *escenario en vivo*.

**Tecnologías Clave:**
*   **Protocolo:** WebSocket (ws): Permite una comunicación bidireccional, persistente y de baja latencia, perfecta para datos en tiempo real (ej: la posición de un jugador).
*   **Lenguaje y Framework:** TypeScript con Node.js, usando la librería `ws` (WebSocket).
*   **Autoridad:** Es el único que puede decidir si un ataque fue exitoso, si un jugador está en línea, o si un objeto se ha respawnado.

## 🏃 2. Responsabilidades en Tiempo Real

El servidor gestiona tres flujos de trabajo principales que ocurren continuamente:

### A. Gestión del Mundo (El Estado General)
*   **Mapas y Áreas:** Carga, mapea y gestiona las instancias de los diferentes mapas. El *Game Instance Manager* se encarga de saber qué jugadores están en qué área.
*   **Movimiento y Visibilidad:** Implementa la detección de colisiones y el sistema de visibilidad (solo ves lo que está cerca y en tu área).
*   **Actualizaciones:** Llama a la función de *broadcast* (difusión) cuando algo cambia en una zona (un jugador entra, un objetivo se activa, un NPC se mueve).

### B. Lógica de Juego (El Gameplay Core)
*   **Combate:** Calcula el daño infligido, la CD (Cooldown) de hechizos y las interacciones en tiempo real entre entidades.
*   **Interacciones:** Maneja eventos como pesca, minería, *smelting* (fundición) y actividades de *crafting* iniciadas por el jugador.
*   **NPCs:** Gestiona el comportamiento automático de los NPCs (rutas, respawn, patrones de guardia).

### C. Integración de Datos (Conexión con la API)
*   **Estado de Permanencia:** El servidor **NO** guarda la información de la sesión. Al inicio, usa el `game-ticket` y las llamadas internas a la API (`/internal/*`) para *cargar* el estado inicial del personaje guardado.
*   **Sincronización:** Cuando el jugador realiza una acción permanente (ej: cambia de ciudad, sale del juego), el servidor debe **persistir** ese cambio enviándolo a los endpoints internos de la API REST.

## 🔄 3. Flujo de Datos Esencial: El Bucle de Juego

1.  **Inicio:** El Frontend solicita un `game-ticket` a la API -> el usuario se conecta a `ws://:7666` con ese ticket.
2.  **Conexión/Login:** El servidor consume el ticket vía la API REST. La API devuelve los datos del personaje serializado.
3.  **Juego Continuo (WebSocket):**
    *   **Cliente $\rightarrow$ Servidor:** El cliente envía paquetes binarios con su intención (Ej: `movimiento_a_X_Y`, `usar_habilidad_A`).
    *   **Servidor $\rightarrow$ Cliente:** El servidor recibe el paquete, valida si es posible (¿Tiene suficiente mana? ¿Está bloqueada esa celda?), calcula el resultado, y envía un paquete de **estado actualizado** a todos los clientes afectados por ese evento.

## 🚧 4. Puntos de Integración y Expansión de Contenido

Cualquier nueva característica o área grande debe pasar por esta revisión:

1.  **Definición del Estado:** ¿Qué nuevos datos necesitamos guardar? $\rightarrow$ **Actualizar la Base de Datos (vía `api/`)**.
2.  **Lógica Central:** ¿Cómo se controla la interacción? $\rightarrow$ **Actualizar el Servidor (`server/`)** para que gestione el estado transitorio y lo simule en tiempo real.
3.  **El "Artefacto de Datos":** ¿Hay JSONs o assets que deben reflejar este nuevo contenido? $\rightarrow$ **Actualizar los scripts de exportación** que llevan los assets del *Source Folder* al *Game Loop*.

**Conclusión:** El servidor es el motor del juego. Es el que da vida y autoriza la interacción en el momento. Es el más complejo de mantener porque su lógica debe ser infalible y atómica.