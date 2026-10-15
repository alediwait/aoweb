# Mapa de Infraestructura y Arquitectura del Proyecto

> Documento generado a partir del análisis de la estructura del repositorio AOWeb.
> Última revisión: octubre 2026.

---

## 1. Resumen General

**AOWeb** es un MMORPG browser-based (inspirado en *Argentum Online*) compuesto por **tres aplicaciones independientes** en un monorepo, más una base de datos PostgreSQL:

| Módulo | Carpeta | Rol | Puerto |
|---|---|---|---|
| **API** | `api/` | API REST (Express 5 + PostgreSQL) con cuentas, personajes, clanes, mercado, arenas y datos de juego | `3001` (dev) / `3100` (Docker/prod) |
| **Server del juego** | `server/` | Servidor de juego en tiempo real por **WebSocket** (`ws`), autoritativo: mapa, NPCs, combate, crafting, pesca, minado, smelting, retos, cárceles, etc. | `7666` |
| **Frontend** | `frontend/` | Web client **Next.js 16 (App Router)** + React 19 + **PixiJS 8** (render del juego) + Tailwind CSS 4 + Howler (audio) | `3000` |
| **Base de datos** | `database/` | Dump inicial de **PostgreSQL 18** (`aoweb.sql`, ~2.2 MB, 30 tablas) | `5432` |

**Flujo de comunicación general:**

```
Browser (Next.js :3000)
   │
   ├── HTTP  → rutas /api/* (BFF del frontend, con cookie de sesión)
   │              └── fetch → API REST (:3001) → PostgreSQL (:5432)
   │
   └── WebSocket (ws://:7666) → Server del juego (:7666)
                                    └── HTTP interno → API REST (:3001)
                                         (game-ticket/consume, character_save, game-data sync,
                                          con header Authorization: TOKEN_AUTH)
```

- El **frontend** nunca toca la base de datos: actúa como BFF (Backend-for-Frontend) proxyando a la API y guardando el token de sesión en una **cookie httpOnly**.
- El **server del juego** tampoco accede directamente a la DB: persiste personajes y sincroniza datos de juego (objetos, NPCs, balance, recetas) **a través de endpoints `/internal/*` de la API** autenticados con `TOKEN_AUTH`.
- El paso del lobby al juego se hace con un **game-ticket** de un solo uso: el frontend lo pide a la API (`/auth/game-ticket`) y el server del juego lo consume vía `/game-ticket/consume`.

---

## 2. Mapa de Directorios

```
aoweb/
│
├── README.md                     # Instrucciones de levantamiento (DB → API → Server → Frontend)
├── Infraestructura.md            # Este documento
├── .gitignore                    # Excluye node_modules, dist, .next, .env*, claves
│
├── database/
│   └── aoweb.sql                 # Dump inicial de PostgreSQL 18 (esquema + datos semilla)
│
├── api/                          # ── API REST (Express 5 + pg + zod) ──
│   ├── src/
│   │   ├── server.ts             # ENTRYPOINT: app Express, ~1600 líneas de rutas
│   │   ├── config.ts             # Lee .env; PORT, DATABASE_URL, TOKEN_AUTH, SES, admin
│   │   ├── db.ts                 # Pool de conexiones pg (tunneable por env)
│   │   ├── migrate.ts            # Migraciones (corrido en `pnpm start` de prod)
│   │   ├── middleware/auth.ts    # requireAuth (TOKEN_AUTH)
│   │   ├── lib/                  # passwords (bcryptjs), email (AWS SES), characterCreation, etc.
│   │   ├── repositories/         # 16 repositorios: auth, characters, clans, arenas, market,
│   │   │                         #   vaults, gameObjects, gameNpcs, gameBalance, recipes,
│   │   │                         #   runtimeSettings, wiki, userOnlineStats, challenges...
│   │   ├── scripts/              # Scripts de mantenimiento/balance (tsx)
│   │   ├── tests/                # 10 suites de tests de integración (Vitest)
│   │   ├── jsons/                # Datos de juego versionados (balance, spells, recetas)
│   │   └── mapas_source/         # ~280 mapas fuente (mapa_N/)
│   ├── schema.sql                # Esquema SQL autocontenido (se inyecta en docker-entrypoint-initdb)
│   ├── Dockerfile                # Multi-stage (node:24-bookworm-slim + pnpm), EXPOSE 3100
│   ├── docker-compose.yml        # postgres:18-alpine + api (stack de desarrollo/prod local)
│   ├── docker-compose.blue.yml   # Despliegue blue/green (nombre: aoweb-api-blue)
│   ├── docker-compose.green.yml  # Despliegue blue/green (contraparte green)
│   ├── docker-compose.postgres.yml
│   ├── .env.example / .env.docker.example
│   ├── vitest.config.ts          # Tests de integración (timeout 60s, env node)
│   └── tsconfig.json
│
├── server/                       # ── Server de juego en tiempo real (WebSocket) ──
│   ├── src/
│   │   ├── server.ts             # ENTRYPOINT: http + WebSocketServer(:7666), bucle de conexión,
│   │   │                         #   arranque asíncrono (LoadMaps/Objs/Balance/Spells/Recipes)
│   │   ├── config.ts             # PORT(7666), API_BASE_URL, TOKEN_AUTH, AOWEB_TEST_MODE...
│   │   ├── socket.ts             # Cola de salida por cliente, batching, broadcast por área
│   │   ├── protocol.ts /         # Protocolo binario de paquetes cliente<->servidor
│   │   │   package.ts / handleProtocol.ts
│   │   ├── game.ts               # Lógica central del mundo (loopAreaPos, movimiento, etc.)
│   │   ├── login.ts              # Login vía game-ticket contra la API
│   │   ├── npcs.ts / npcData.ts / loadNpcs.ts / respawn.ts / npcRespawnCooldowns.ts
│   │   ├── crafting.ts / smelting.ts / fishing.ts / harvesting.ts / balance.ts
│   │   ├── factions.ts / challengeManager.ts / arenaManager.ts / safeZone.ts
│   │   ├── mapInstanceManager.ts / mapNpcStorage.ts / gameDataSync.ts
│   │   ├── commands.ts           # Comandos/consola de administración
│   │   ├── chatAuditLogger.ts    # Auditoría de chat
│   │   ├── runtimeRegistry.ts / runtimeTiming.ts / workingLock.ts / vars.ts
│   │   ├── types/runtime.ts
│   │   └── scripts/              # Exportadores de assets/mapas hacia el frontend
│   ├── jsons/                    # craftingRecipes / smeltingRecipes / spells (datos de arranque)
│   ├── mapas_source/             # ~280 mapas fuente (idénticos a los de api/)
│   ├── scripts/                  # copy-assets.cjs (build), build-world-map.cjs
│   ├── Dockerfile                # EXPOSE 7666; copia dist + jsons + mapas_source
│   ├── docker-compose.yml        # Servidor aislado; red externa `api_shared` (api_default)
│   ├── docker-compose.test.yml
│   ├── .env.example / .env.docker.example
│   └── tsconfig.json / eslint.config.mjs
│
├── frontend/                     # ── Web client (Next.js 16 App Router) ──
│   ├── app/                      # Rutas App Router
│   │   ├── layout.tsx / page.tsx # Layout raíz y landing
│   │   ├── play/                 # ★ JUEGO: carga MapRenderer (PixiJS) + todos los paneles/HUD
│   │   ├── login/ register/ forgot-password/ reset-password/[token]/
│   │   ├── characters/ character/ createcharacter/
│   │   ├── arenas/ arenas/join/[joinToken]/
│   │   ├── ranking/ wiki/ wiki/[section]/ updates/ users-online-stats/
│   │   └── api/                  # ★ BFF: routes que proxyan a la API y gestionan cookie de sesión
│   │       ├── auth/             # login, register, session, me, signout, create/delete-character,
│   │       │                     #   game-ticket, character-settings, password-reset/*
│   │       ├── arenas/           # rooms CRUD, join, leave, select-template, join/[joinToken]
│   │       ├── clans/ ranking/ runtime-config/ users-online-stats/
│   ├── components/
│   │   ├── game/                 # Motor del cliente MMO:
│   │   │   ├── core/             #   hooks: useCombatController, useMovementSync, useHudStateController...
│   │   │   ├── engine/Engine.ts  #   bucle del motor PixiJS
│   │   │   ├── rendering/        #   capas de mapa, personajes, efectos, texturas, visibilidad
│   │   │   ├── session/          #   useGameSession + manejo de paquetes entrantes
│   │   │   ├── network/          #   packetQueue, ping
│   │   │   ├── input/ state/ overlays/ assets/ config/ admin/ diagnostics/
│   │   │   └── MapRenderer.tsx / MapRendererCore.tsx
│   │   ├── wiki/                 # WikiExplorer
│   │   └── *.tsx                 # Paneles de UI: Inventory, Market, Trade, Crafting, Retos,
│   │                             #   CharacterStats, MacroBar, BuffStatusSidebar, AuthCards...
│   ├── lib/                      # auth, authPayloadEncryption, aowProtocol, arenas, hotkeys,
│   │                             #   sound, runtime-config, wiki-data, seo, viewport...
│   ├── hooks/ utils/ types/ data/  # useAuthRedirect, gameLoader (carga JSONs de juego), changelog.json...
│   ├── public/
│   │   ├── init/                 # JSONs de datos de juego servidos al cliente (graficos, heads,
│   │   │                         #   bodies, armas, cascos, escudos, npcs_optimized, world-map...)
│   │   ├── maps/ imgs_maps/      # Mapas e imágenes de mapas (mapa_N.json)
│   │   ├── graphics/ imgs/ sounds/ static/   # Sprites, íconos, audio, assets locales
│   ├── scripts/generate-headswithfile.mjs
│   ├── Dockerfile                # Build args (API/WS/CDN/Spaces), EXPOSE 3000
│   ├── docker-compose.yml / blue.yml / green.yml / test.yml
│   ├── next.config.ts            # buildId derivado de git short hash
│   ├── postcss.config.mjs        # Tailwind CSS 4 (@tailwindcss/postcss)
│   └── .env.example / .env.docker.example
│
└── screenshots/                  # Capturas 1-4.jpg para el README
```

---

## 3. Módulos y Servicios

### 🔵 Backend — `api/` (API REST)

| Aspecto | Detalle |
|---|---|
| **Lenguaje** | TypeScript (compilado con `tsc`; dev con `tsx watch`) |
| **Framework** | Express **5.1** |
| **Persistencia** | PostgreSQL 18 vía `pg` (pool configurable: `DATABASE_POOL_MAX`, timeouts de conexión/idle/statement/tx) |
| **Validación** | Zod 4 |
| **Auth** | bcryptjs + token bearer (`TOKEN_AUTH` para rutas internas; sesiones propias con token por cuenta) |
| **Email** | AWS SES v2 (`@aws-sdk/client-sesv2`) — reset de password, notificaciones |
| **Puerto** | `3001` (dev) / `3100` (Docker prod, `EXPOSE 3100`) |
| **Tests** | Vitest — 10 suites de integración (`auth`, `security`, `vaults`, `market`, `clans`, `arenas`, `character-save`, `game-tickets`, `password-reset`, `platform`) |
| **Responsabilidad** | Cuentas/registro/login/sesiones, personajes (creación, save en 5 variantes: base + items/bank/storage/spells), clanes + bóvedas de clan, mercado (listings/claims), salas de arena, ranking, wiki, game-data admin (`/admin/game-data/*` protegido por email admin + proxy token), sincronización interna de datos de juego (`/internal/game-data/*` con `sinceVersion` para incremental sync), runtime-config de timings |

**Grupos de rutas principales:** `/auth/*`, `/character_save/*`, `/arenas/rooms*`, `/clans/*`, `/market/*`, `/ranking`, `/wiki`, `/runtime-config`, `/users-online-stats`, `/admin/game-data/*` (admin UI), `/internal/*` (server del juego), `/health`.

### 🟢 Backend — `server/` (Server de juego WebSocket)

| Aspecto | Detalle |
|---|---|
| **Lenguaje** | TypeScript (mix ESM/`require`), Node 24 |
| **Framework** | `ws` (WebSocketServer montado sobre `http.createServer`) |
| **Persistencia** | **Ninguna directa** — delega a la API REST (`API_BASE_URL`) |
| **Puerto** | `7666` (`ws://localhost:7666`) |
| **Arranque** | Carga en paralelo: mapas, objetos, balance, hechizos, recetas de crafteo y fundición; luego marca `serverReady` y notifica por Telegram |
| **Responsabilidad** | Mundo autoritativo: movimiento/áreas de visibilidad, combate, NPCs (respawn, rutas), zonas seguras, cárceles (mapa 66), pesca, minería/herbicida, crafting, smelting, comercio entre jugadores, retos (`challengeManager`), arenas (`arenaManager`), instancias de mapa (`mapInstanceManager`), audit de chat, comandos admin, detección de flood (PPS) y control de IPs duplicadas |

**Mecanismos notables:** batching de paquetes salientes (32 paquetes / 48 KB por flush), sincronización incremental de game-data contra la API, snapshots de personaje/NPC broadcast por área.

### 🟡 Frontend — `frontend/` (Web Client Next.js)

| Aspecto | Detalle |
|---|---|
| **Framework** | Next.js **16** (App Router, Turbopack en dev) + React **19** |
| **Render del juego** | **PixiJS 8** (motor 2D en `/play`, `components/game/engine` + `rendering`) |
| **Estilos** | **Tailwind CSS 4** (PostCSS, `@import "tailwindcss"` + `@theme inline`) |
| **Audio** | Howler |
| **Iconos** | lucide-react |
| **Puerto** | `3000` |
| **Arquitectura de páginas** | Landing `/`; login/registro/recuperación; selección y creación de personajes; **`/play`** (juego completo: HUD, inventario, macros, mercado, trade, crafting, retos, stats, admin); `/arenas` (+ join por link); `/ranking`; `/wiki/[section]`; `/updates` (changelog/roadmap desde `data/`); `/users-online-stats` |
| **BFF** | `app/api/*` proxya a la API REST y maneja la cookie de sesión (`AUTH_COOKIE_NAME`, 7 días), con timeout de 8 s y normalización de errores |
| **Datos de juego** | `utils/gameLoader.ts` carga JSONs optimizados desde `public/init/` y `public/maps/` (con flags `NEXT_PUBLIC_LOAD_*_LOCAL` para assets locales) |

### 🟠 Otros Componentes

- **`database/`** — dump `aoweb.sql` con el esquema completo (**30 tablas**: `accounts`, `auth_sessions`, `characters`, `character_items/bank_items/spells/settings`, `clans`, `clan_members/requests/vaults/vault_items`, `account_vaults/vault_items`, `arena_rooms/members`, `market_listings/claims`, `challenge_history`, `game_objects/npcs/balance/crafting_recipes/smelting_recipes/data_revisions`, `game_tickets`, `password_reset_requests/tokens`, `runtime_settings`, `user_online_stats`). El API también lleva su propio `schema.sql` autocontenido para init de Docker.
- **Scripts de exportación** (`server/src/scripts`, `api/src/scripts`) — pipeline que transforma los assets originales del cliente AO en JSONs optimizados para el frontend (`exportFrontendOptimizedMaps`, `exportFrontendOptimizedGraphics`, `exportClientObjs`, `compactObjsJson`...), además de scripts de mantenimiento de balance/población (`applyBalanceToCharacters`, `importGameData`, `fixCharactersMissingHeads`...).
- **Despliegue blue/green** — cada servicio tiene `docker-compose.blue.yml` y `docker-compose.green.yml` (nombres `aoweb-api-blue`, `aoweb-frontend-blue`, etc.) para despliegues sin downtime; redes externas compartidas (`api_default`, `postgres_shared`).
- **`screenshots/`** — capturas de referencia del juego para el README.
- **Assets del cliente** — `mapas_source/` (~280 mapas) duplicados en `api/` y `server/`; los exports finales viven en `frontend/public/`.

---

## 4. Archivos Clave de Configuración

| Archivo | Propósito |
|---|---|
| `api/package.json` | Dependencias (express 5, pg, zod, bcryptjs, SES) y scripts: `dev` (tsx watch), `build`, `start` (migrate + node), `test` (vitest), múltiples scripts de mantenimiento |
| `api/src/config.ts` | Config efectiva de la API: `PORT`, `DATABASE_URL` (obligatoria), pool/timeouts, `TOKEN_AUTH` (obligatorio), `CORS_ORIGIN`, `SITE_URL`, credenciales SES, `GAME_DATA_ADMIN_*`; **lee `api/.env` manualmente** |
| `api/Dockerfile` + `api/docker-compose.yml` | Imagen multi-stage (pnpm, build, runtime slim) exponiendo 3100; compose con `postgres:18-alpine` (init con `schema.sql`) + api |
| `api/vitest.config.ts` | Suite de integración en `src/tests/**`, timeouts de 60 s |
| `api/.env.example` | `PORT`, `DATABASE_URL`, `TOKEN_AUTH`, `CORS_ORIGIN`, `NODE_ENV` |
| `server/package.json` | Dependencias (`ws`, `axios`, `bytebuffer`, `lodash`) y scripts: `dev`, `build` (+`copy-assets.cjs`), `start`, `world-map`, exportadores |
| `server/src/config.ts` | `PORT` (7666), `API_BASE_URL`, `TOKEN_AUTH`, `AOWEB_TEST_MODE`, `INITIAL_ONLINE_RECORD`, `RESET_CONNECTED_CHARACTERS_ON_STARTUP`; lee `server/.env` |
| `server/Dockerfile` + `server/docker-compose.yml` | Runtime con `dist` + `jsons` + `mapas_source`, EXPOSE 7666, red externa `api_shared` |
| `server/.env.example` | `NODE_ENV`, `AOWEB_TEST_MODE`, `INITIAL_ONLINE_RECORD`, `PORT`, `API_BASE_URL`, `RESET_CONNECTED_CHARACTERS_ON_STARTUP`, `TOKEN_AUTH` |
| `frontend/package.json` | Next 16, React 19, pixi.js 8, howler, Tailwind 4; scripts `dev` (turbopack, 0.0.0.0), `build`, `start`, `generate:headswithfile` |
| `frontend/next.config.ts` | `generateBuildId` a partir del short hash de git (o `NEXT_BUILD_ID`), expone `NEXT_PUBLIC_NEXT_BUILD_ID` |
| `frontend/postcss.config.mjs` | Plugin `@tailwindcss/postcss` (Tailwind v4) |
| `frontend/Dockerfile` + `docker-compose*.yml` | Build args sensibles (API/WS/CDN/DO Spaces/`GAME_DATA_ADMIN_PROXY_TOKEN`), runtime en 3000; blue/green/test |
| `frontend/.env.example` | `NEXT_PUBLIC_API_BASE_URL`, `API_BASE_URL`, `TOKEN_AUTH`, `NEXT_PUBLIC_WS_URL` |
| `frontend/lib/api-base-url.ts` + `frontend/lib/auth-session.ts` | Resolución de la URL de la API (server vs cliente) y nombre/TTLL de la cookie de sesión |
| `database/aoweb.sql` | Dump inicial (esquema + seed) restaurado vía `docker exec ... psql < database/aoweb.sql` |
| `api/schema.sql` | Esquema autocontenido usado como init de Docker (`docker-entrypoint-initdb.d`) |
| `.gitignore` | Excluye `node_modules`, `dist`, `.next`, `.env*` (salvo ejemplos) y claves/certs |

### Variables de entorno por servicio (resumen)

| API (`api/.env`) | Server (`server/.env`) | Frontend (`frontend/.env.local`) |
|---|---|---|
| `PORT=3001` | `PORT=7666` | `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001` |
| `DATABASE_URL=postgresql://...` | `API_BASE_URL=http://127.0.0.1:3001` | `API_BASE_URL=http://localhost:3001` |
| `TOKEN_AUTH=...` | `TOKEN_AUTH=...` (igual al de la API) | `TOKEN_AUTH=...` |
| `CORS_ORIGIN=http://localhost:3000` | `AOWEB_TEST_MODE`, `INITIAL_ONLINE_RECORD` | `NEXT_PUBLIC_WS_URL=ws://localhost:7666` |
| *(opcional)* `SES_*`, `SITE_URL`, `GAME_DATA_ADMIN_*` | `RESET_CONNECTED_CHARACTERS_ON_STARTUP` | *(build)* `NEXT_BUILD_ID`, `NEXT_ASSET_CDN_*`, `DO_SPACES_*` |

> **Nota de seguridad:** `TOKEN_AUTH` es un secreto compartido entre los tres servicios (firma la comunicación server→API). El correo de recuperación usa AWS SES; el panel admin de game-data requiere además `GAME_DATA_ADMIN_EMAIL`/`GAME_DATA_ADMIN_ACCOUNT_ID` y un `GAME_DATA_ADMIN_PROXY_TOKEN` inyectado en build.

---

## 5. Diagrama de Comunicación entre Servicios

```
┌──────────────────────────────────────────────────────────────────────┐
│  FRONTEND  (Next.js 16 · :3000)                                      │
│  PixiJS 8 en /play · Tailwind 4 · BFF en app/api/*                   │
└───────────┬──────────────────────────────┬───────────────────────────┘
            │ HTTP (cookie httpOnly)       │ WebSocket (game-ticket)
            ▼                              ▼
┌───────────────────────────┐   ┌──────────────────────────────────────┐
│  API  (Express 5 · :3001) │◄──┤  SERVER DE JUEGO  (ws · :7666)       │
│  /auth /character_save    │   │  Mundo autoritativo, NPCs, combate,  │
│  /arenas /clans /market   │◄──┤  crafting, pesca, arenas, retos      │
│  /internal/game-data/*    │   │  (HTTP con Authorization: TOKEN_AUTH)│
└────────────┬──────────────┘   └──────────────────────────────────────┘
             │ pg (pool)
             ▼
┌───────────────────────────┐
│  PostgreSQL 18  (:5432)   │   Dump: database/aoweb.sql · Init: api/schema.sql
│  30 tablas                │
└───────────────────────────┘
```

**Secuencia típica de una sesión de juego:**
1. `register`/`login` → la API crea sesión y el frontend guarda el token en cookie.
2. Crear/seleccionar personaje (`/auth/create-character`, `/auth/select-character`).
3. `/play` solicita `/auth/game-ticket`; el frontend abre `ws://:7666` enviando el ticket.
4. El server del juego consume el ticket vía `POST {API}/game-ticket/consume` y carga el personaje.
5. Durante el juego, el server persiste el estado (`PUT /character_save/*`) y sincroniza game-data (`/internal/game-data/*/changes?sinceVersion=N`).
6. Al salir, logout limpia la sesión y los estados `connected` en la base.

---

## 6. Puesta en Marcha Rápida

```bash
# 1) Base de datos (PostgreSQL 18 en Docker)
docker run --name aoweb-postgres -e POSTGRES_DB=aoweb -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres -p 127.0.0.1:5432:5432 -d postgres:18-alpine
docker exec -i aoweb-postgres psql -U postgres -d aoweb < database/aoweb.sql

# 2) API (:3001)          — crear api/.env desde api/.env.example
cd api && pnpm install && pnpm dev

# 3) Server del juego (:7666) — crear server/.env desde server/.env.example
cd server && pnpm install && pnpm dev

# 4) Frontend (:3000)     — crear frontend/.env.local desde frontend/.env.example
cd frontend && pnpm install && pnpm dev
# → http://localhost:3000
```

**Requisitos:** Node.js ≥ 22, pnpm, Docker (para PostgreSQL), `psql` (opcional).

**Despliegue con Docker (producción local):** cada servicio incluye su `Dockerfile` y `docker-compose.yml`; los archivos `docker-compose.blue.yml` / `docker-compose.green.yml` habilitan esquemas de despliegue blue/green sin downtime.
