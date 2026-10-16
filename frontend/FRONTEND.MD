# Manual del Cliente Web (Frontend)

Este documento describe `frontend/`, el cliente web desarrollado con Next.js 16. Este componente es el encargado de la **Experiencia de Usuario (UX)** y la **Presentación Visual** de todo el juego.

---

## 🖼️ 1. ¿Qué es el Frontend?

El Frontend es lo que el usuario ve y con lo que interactúa directamente en el navegador. Su rol no es *autorizar* las acciones, sino *solicitar* las acciones y *mostrar* los resultados que le han sido aprobados por la capa de API o el Server de Juego.

**Flujo de Datos:**
El Frontend es un consumidor de servicios. Se comunica con dos "servicios" *backend*:
1.  **API REST (`http://localhost:3001`):** Para la gestión de datos (usuarios, inventario, mercado).
2.  **WebSocket (`ws://localhost:7666`):** Para la acción en tiempo real (movimiento, combate).

**Tecnologías Clave:**
*   **Next.js 16 (App Router):** El framework que estructura las rutas, maneja la carga de componentes y optimiza la aplicación web.
*   **PixiJS 8:** El motor gráfico de bajo nivel (WebGL) que se utiliza para renderizar el juego 2D, separando la lógica del juego de la capa de renderizado de React.
*   **React 19:** El sistema de componentes utilizado para toda la interfaz de usuario (HUD, Inventario, Menús).
*   **Tailwind CSS 4:** El sistema de estilos, encargado de la apariencia y el diseño responsive de la interfaz.

## 🧩 2. Arquitectura de Componentes (Separación de Responsabilidades)

El sistema está intencionalmente fragmentado para manejar la complejidad de un MMO:

### A. La Capa de Presentación (React Components)
Esta capa se encarga de los elementos de la interfaz de usuario (UI) y el "Head-Up Display" (HUD).
*   **Ejemplos:** Componentes de Inventario, el Mapa de Habilidades, la Barra de Estado del personaje (`BuffStatusSidebar`), la barra de chat, el panel de mercado.
*   **Función:** Son elementos reactivos que se actualizan según los datos que recibe de la API o del WebSocket. No contienen lógica de juego; solo muestran lo que se les pide.

### B. El Motor de Juego (PixiJS Engine)
Esta es la capa gráfica. `components/game/engine.ts` es el corazón visual.
*   **Función:** Utiliza la librería PixiJS para gestionar el *frame rate*, dibujar sprites, manejar transiciones visuales, y asegurarse de que la animación se ejecute de manera eficiente, independientemente de lo que haga React.
*   **Renderizado:** Divide la vista en *capas* (Map Layers, NPC Layers, Effect Layers) para un control de dibujo preciso.

### C. La Lógica Cliente ($\text{Hooks}$ y $\text{Hooks}$)
El código que actúa como puente entre la API/WebSocket y los componentes visuales.
*   **`useGameSession`:** Hook que centraliza la recepción de paquetes del WebSocket. Cuando llega un paquete de "Nueva Posición", este hook actualiza el estado que luego consume el motor PixiJS.
*   **`useAuthRedirect`:** Maneja la compleja lógica de redireccionamiento basada en las rutas de negocio (Ej: si no tienes personaje, te mandan a crear uno).

## 📞 3. Flujo de Datos Cliente $\leftrightarrow$ Servidor (BFF Pattern)

El patrón más importante aquí es el **BFF (Backend-for-Frontend)**, implementado en `app/api/*`.

*   **¿Por qué se usa BFF?** Porque el Frontend no debe hablar directamente con la DB ni con todos los microservicios. El BFF centraliza las peticiones y simplifica lo que el cliente necesita.
*   **Ejemplo Práctico:** Si el Frontend necesita saber "los 5 ítems más vendidos", no le pregunta a `market_listings` directamente. Llama a la ruta interna `/api/market/top-sellers` en el BFF, y este ya sabe cómo hacer la consulta compleja a la DB y devolver los 5 ítems listos para mostrar.

## ✨ 4. Resumen Operacional (Startup Checklist)

1.  **Init:** El cliente carga JSONs estáticos (`public/init/`) con datos de *lore*, gráficos, y configuraciones de base de las clases.
2.  **Autenticación:** Al iniciar, el cliente intenta autenticarse con la API (manejo de cookies).
3.  **Juego:** Si la autenticación y la creación de personaje tienen éxito, abre la conexión WebSocket con el servidor.
4.  **Loop:** El `Engine.js` comienza a dibujar, y los `use*` hooks escuchan constantemente el WebSocket para actualizar las posiciones, la vida o cualquier otro dato en tiempo real.

**Conclusión:** El Frontend es el escaparate. Su magia reside en su capacidad de escuchar y renderizar de manera eficiente los datos que le llegan, utilizando PixiJS para el arte de la acción y Next.js para la estructura persistente de la aplicación web.