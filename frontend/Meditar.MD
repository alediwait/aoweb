# Manual de Sistema de Partículas y Animaciones de Hechizos

Este documento detalla el sistema de partículas (`ParticlePool.ts`) del lado del cliente (Frontend) y explica una corrección crítica en la lógica de coloreado para asegurar que todos los efectos visuales utilicen gradientes de color definidos en los presets.

---

## 🎨 1. Detalle de la Corrección: Sistema ParticlePool

**Archivo Afectado:** `frontend/components/game/rendering/fx/ParticlePool.ts`

**Problema Identificado:**
Originalmente, al momento de crear (spawnear) una partícula, el código asignaba el color inicial (`particle.tint = s.colorStart;`) *manualmente* en la función `spawn()`. Esto hacía que la primera visualización fuera correcta, pero al depender de esta asignación manual, la lógica de gradiente de color definidos en los presets (que incluyen un color de inicio y uno de fin) no se aplicaba consistentemente desde el primer *frame* sin riesgo de ser sobrescrito o gestionado de forma redundante.

**La Solución Implementada:**
Se ha **removido la asignación manual de `particle.tint`** del método `spawn()`.

**Impacto de la Corrección:**
Al retirar esta asignación manual, se fuerza al sistema a depender exclusivamente de la lógica de interpolación de color dentro del método `update()` (líneas 283-284).

El código ahora realiza:
```typescript
p.tint = lerpColorNumber(this.colorStart[i], this.colorEnd[i], t);
```
*   **Resultado:** Los colores de las partículas ahora siguen perfectamente el gradiente tiempo/vida definido por el *preset* (ej: de blanco brillante a azul/violeta `0x9a6bff` en el caso de meditaciones). Esto garantiza que el color de la partícula evolucione suave y consistentemente durante toda su duración.

## ✨ 2. Aplicabilidad General (Análisis de Hechizos)

**¿Pasa lo mismo con las animaciones de hechizos? Sí, lo es.**

Dado que la lógica de los hechizos en el Frontend (Componente de efectos) debería interactuar con el mismo sistema o con un patrón idéntico al de `ParticlePool.ts`, es altamente probable que otros componentes como `SpellEffectRenderer.ts` (o sus equivalentes) que manejen partículas también utilicen una lógica de color de manera manual o incompleta.

**Recomendación de Tarea:**
Cualquier componente nuevo o existente que emita partículas y utilice `s.colorStart` y `s.colorEnd` debe ser revisado para asegurarse de que:
1.  Solo configure los datos de color (`colorStart[i]`, `colorEnd[i]`, etc.) en la data `ResolvedSpawn`.
2.  Deje que su motor de actualización (`update()`) aplique *siempre* `lerpColorNumber` para el color en cada *frame*.

Este patrón garantiza la coherencia visual en todo el juego.
