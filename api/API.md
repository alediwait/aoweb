# Manual de la API REST de AOWeb (El Corazón de los Datos)

Este documento está diseñado para ser un manual técnico-conceptual de la API, ideal para alguien que tiene conocimientos básicos sobre cómo funcionan las APIs REST, pero que no está familiarizado con la arquitectura de AOWeb.

---

## 🚀 1. ¿Qué es la API de AOWeb?

La API (`api/`) es el **servidor backend principal** de todo el sistema. Su trabajo esencial es actuar como un intermediario (o *backend for the frontend*) entre el usuario (el *Frontend*, Next.js) y la base de datos (PostgreSQL).

**En términos sencillos:**
1.  El usuario pide algo (ej: "quiero crear un personaje").
2.  El Frontend envía una solicitud HTTP a la API.
3.  La API:
    a. **Verifica la identidad** del usuario (¿Quién eres? Tienes sesión activa).
    b. **Valida la solicitud** (¿Estás intentando hacer algo ilegal? ¿Los datos son correctos?).
    c. **Ejecuta la lógica de negocio** (¿Tiene la clase suficiente oro para ese objeto? ¿Permitimos esto en la cola de mensajes?).
    d. **Guarda o recupera la información** de la Base de Datos.
    e. **Devuelve una respuesta** limpia y estructurada al Frontend.

**Tecnologías Clave:**
*   **Framework:** Express 5.1 (Para gestionar las rutas y peticiones HTTP).
*   **Lenguaje:** TypeScript (Aporta muchísima seguridad y estructura al código).
*   **Base de Datos:** PostgreSQL 18 (Donde se almacena *toda* la información persistente del juego: cuentas, inventarios, récords, etc.).
*   **Validación:** Zod (Se usa para asegurar que cualquier dato que entre a la API, o salga de ella, tenga el formato correcto).

## 🔐 2. Seguridad y Flujo de Acceso (¡Cómo Funciona la Autenticación!)

La API no confía en nadie por defecto; debe verificar continuamente la identidad y los permisos.

1.  **Autenticación de Sesión (Usuario):** Cuando un usuario se registra o inicia sesión, la API establece una **sesión** y el Frontend guarda un token de sesión en una *cookie httpOnly*. Esto garantiza que el usuario sea quien dice ser en cada petición (Ej: `/character_save/`).
2.  **Autenticación de Componente (Machine-to-Machine):** El *Server de Juego* (`server/`) no puede simplemente asumir que es válido. Para comunicarse con la API (por ejemplo, para guardar el estado de un jugador en medio del combate), debe incluir un token secreto llamado `TOKEN_AUTH`. Esto asegura que solo el *Server de Juego* (y nadie más) pueda enviar datos cruciales de juego desde el mundo real.

## <0xF0><0x9F><0x97><0x84>️ 3. Capacidad de la Base de Datos (El "Cerebro")

La DB es vital y sigue una estructura relacional definida en `aoweb.sql`. La API tiene repositorios específicos para interactuar con estas 30 tablas. No se pueden manipular estas tablas directamente desde el frontend, toda interacción va *a través* de la API.

**Áreas de Datos Centralizadas:**
*   **Cuentas y Usuarios (`accounts`, `auth_sessions`):** Manejan el registro, inicio de sesión y tokens.
*   **Personajes (`characters`, `character_items/*`):** Almacenan todo lo que pertenece a un personaje (equipamiento, habilidades, etc.). Cada cambio importante pasa por un proceso llamado `character_save`.
*   **Economía y Comercio (`market_listings`, `vaults`, `clans`):** Gestionan el sistema de intercambio de bienes de juego.
*   **Configuración Global (`runtime_settings`, `game_tickets`):** Almacenan parámetros que afectan a todo el servidor (como los ajustes de *rate limiting* o los tickets de inicio de sesión).

## ⚙️ 4. Módulos y Responsabilidades Clave (Feature Breakdown)

La API está dividida lógicamente en grupos de rutas, cada uno con una responsabilidad clara:

| Módulo / Ruta | Propósito Principal | Usuarios Típicos |
| :--- | :--- | :--- |
| **`/auth/*`** | **Gestión de Acceso.** Permite registrarse, iniciar sesión, restablecer contraseñas y, crucialmente, solicitar un *game-ticket* para saltar al mundo de juego. | Usuario, Sistema de Login. |
| **`/character_save/*`** | **Persistencia del Personaje.** Es el sistema de guardado de personaje. Cuando el usuario hace pausa, esta ruta guarda todas las novedades del personaje. | Usuario (Frontend). |
| **`/arenas/*`** | **Eventos de Combate.** Gestiona la creación, membresía y funcionalidad de las salas de combate PvP. | Usuario, Sistema de Evento. |
| **`/market/*`** | **Economía.** Administra la compra, venta, listado y canje de ítems. | Usuario. |
| **`/clans/*`** | **Organización Social.** Controla la creación y gestión de los clanes y sus bóvedas. | Usuario, Líder de Clan. |
| **`/internal/*`** | **Sincronización de Juego.** **(Solo para el Server de Juego).** Es la vía autorizada para que el *Server de Juego* guarde el estado del mundo en tiempo real (jugadores que se mueven, un objeto que interactúa). | Server de Juego. |
| **`/admin/game-data/*`** | **Mantenimiento y QA.** Rutas restringidas para editores y desarrolladores para simular cambios de juego (ej: cambiar el valor de un objeto o un *buff*) sin tener que acceder a la base de datos directamente. | Desarrollador/Admin. |

***

## 💡 5. Guía Conceptual para el Desarrollo

Si necesitas añadir una funcionalidad (ej: añadir un sistema de mascotas), debes seguir este patrón:

1.  **Diseño de Datos:** Identificar qué nueva información necesita guardarse (ej: `mascot_id`, `owner_char_id`).
2.  **DB Migration:** Crear las tablas necesarias en `api/src/migrate.ts` y en el `schema.sql`.
3.  **Lógica (Repo y Servicio):** Crear un nuevo repositorio en `api/src/repositories/` para interactuar con la nueva tabla.
4.  **Rutas (Express):** Crear las rutas HTTP en algún punto adecuado (`api/src/server.ts`) y encapsular la lógica de negocio en un nuevo *handler* (ej: `mascotService.ts`).
5.  **Seguridad:** Asegurarse de que todas las nuevas rutas estén protegidas por `requireAuth(TOKEN_AUTH)` o `requireAuth(SessionToken)` para evitar accesos no autorizados.