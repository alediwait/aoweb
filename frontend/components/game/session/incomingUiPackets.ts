import type { IncomingPacketHandlerArgs } from "./incomingPacketTypes";
import { TILE_SIZE } from "../../../lib/viewport";

export async function handleIncomingUiPacket({
    packet,
    engine,
    ctx,
}: IncomingPacketHandlerArgs): Promise<boolean> {
    switch (packet.type) {
        case "console":
            if (
                /Comienzas a pescar\.|Has dejado de pescar\.|La pesca se canceló\.|Debes equiparte la caña de pescar/i.test(
                    packet.payload.msg,
                )
            ) {
                ctx.clearTargetingMode();
            }

            ctx.onConsoleMessage?.({
                text: packet.payload.msg,
                color: packet.payload.color,
                source: "console",
                channel: packet.payload.channel ?? "console",
                senderName: packet.payload.senderName,
            });
            ctx.emitStatus({
                connected: true,
                connecting: false,
                worldName: engine?.worldName,
                consoleLine: packet.payload.msg,
            });
            return true;

        case "dialog": {
            if (packet.payload.id > 0) {
                ctx.showDialogBubble(
                    packet.payload.id,
                    packet.payload.msg,
                    packet.payload.color,
                );
            }

            const dialogSpeakerName =
                packet.payload.name?.trim() ||
                (packet.payload.id > 0
                    ? engine?.personajes[
                          packet.payload.id
                      ]?.nameCharacter?.trim()
                    : undefined);
            const dialogSpeakerType =
                packet.payload.id > 0 &&
                engine?.personajes[packet.payload.id]?.isNpc
                    ? "npc"
                    : "user";

            if (packet.payload.writeToConsole) {
                ctx.onConsoleMessage?.({
                    text: dialogSpeakerName
                        ? `[${dialogSpeakerName}]: ${packet.payload.msg}`
                        : packet.payload.msg,
                    color: packet.payload.color,
                    source: "dialog",
                    speakerType: dialogSpeakerType,
                    channel: "console",
                });
            }
            return true;
        }

        case "globalNotice":
            ctx.onGlobalNotice?.({
                text: packet.payload.msg,
                durationMs: packet.payload.durationMs,
            });
            return true;

        case "animFX":
            if (!engine) {
                return true;
            }
            await ctx.renderEntityFX(
                engine,
                packet.payload.id,
                packet.payload.fxGrh,
            );
            return true;

        case "spellProjectile": {
            if (!engine) {
                return true;
            }
            const spellProjectileData =
                engine.spellsDB?.[String(packet.payload.spellId)];
            if (!spellProjectileData) {
                return true;
            }
            await ctx.renderSpellProjectileVisual(
                engine,
                { x: packet.payload.startX, y: packet.payload.startY },
                { x: packet.payload.endX, y: packet.payload.endY },
                spellProjectileData,
            );
            return true;
        }

        case "spellVisual": {
            if (packet.payload.msg && packet.payload.casterId) {
                ctx.showDialogBubble(
                    packet.payload.casterId,
                    packet.payload.msg,
                    "#E69500",
                );
            }

            if (!engine) {
                return true;
            }

            if (
                typeof packet.payload.spellId === "number" &&
                typeof packet.payload.startX === "number" &&
                typeof packet.payload.startY === "number" &&
                typeof packet.payload.endX === "number" &&
                typeof packet.payload.endY === "number"
            ) {
                const spellProjectileData =
                    engine.spellsDB?.[String(packet.payload.spellId)];
                if (spellProjectileData) {
                    await ctx.renderSpellProjectileVisual(
                        engine,
                        {
                            x: packet.payload.startX,
                            y: packet.payload.startY,
                        },
                        {
                            x: packet.payload.endX,
                            y: packet.payload.endY,
                        },
                        spellProjectileData,
                    );
                }
            }

            if (
                typeof packet.payload.targetId === "number" &&
                typeof packet.payload.fxGrh === "number"
            ) {
                await ctx.renderEntityFX(
                    engine,
                    packet.payload.targetId,
                    packet.payload.fxGrh,
                );
            }

            if (
                typeof packet.payload.targetId === "number" &&
                typeof packet.payload.soundId === "number"
            ) {
                ctx.soundManagerRef.current?.play({
                    soundId: packet.payload.soundId,
                    listener: ctx.resolveEntitySoundPosition(
                        engine,
                        engine.user?.id,
                    ),
                    source: ctx.resolveEntitySoundPosition(
                        engine,
                        packet.payload.targetId,
                    ),
                });
            }

            return true;
        }

        case "createProjectile":
            if (!engine) {
                return true;
            }
            await ctx.renderProjectileVisual(
                engine,
                { x: packet.payload.startX, y: packet.payload.startY },
                { x: packet.payload.endX, y: packet.payload.endY },
                packet.payload.grhIndex,
            );
            return true;

        case "critHit": {
            if (!engine || engine.isDestroyed) {
                return true;
            }
            const targetId = Number(packet.payload.targetId);
            const attackerId = Number(packet.payload.attackerId);
            const dmg = Math.max(1, Number(packet.payload.dmg) || 1);
            const kind = Number(packet.payload.kind) === 1 ? 1 : 0;
            const userId = engine.user?.id;

            // Posición mundo del objetivo (tile → px).
            const target = engine.personajes?.[targetId];
            const hasPos =
                target &&
                Number.isFinite(Number(target.pos?.x)) &&
                Number.isFinite(Number(target.pos?.y));
            const worldX = hasPos
                ? (Number(target.pos.x) - 1) * TILE_SIZE + TILE_SIZE / 2
                : null;
            const worldY = hasPos
                ? (Number(target.pos.y) - 1) * TILE_SIZE + TILE_SIZE / 2
                : null;

            if (worldX !== null && worldY !== null) {
                ctx.showCritText(engine, targetId, `¡${dmg}!`);
                ctx.renderImpactBurstAtWorld(
                    engine,
                    Math.round(worldX),
                    Math.round(worldY),
                    kind === 1 ? "impact-fire" : "impact-physical",
                );
            }

            // Shake: fuerte si me pega o pego yo, suave si es visible.
            const involvesMe = attackerId === userId || targetId === userId;
            if (involvesMe) {
                engine.addScreenShake?.(0.55);
            } else if (
                worldX !== null &&
                worldY !== null &&
                engine.mapContainer &&
                engine.app
            ) {
                const viewX = -engine.mapContainer.x;
                const viewY = -engine.mapContainer.y;
                const viewW = engine.app.screen.width;
                const viewH = engine.app.screen.height;
                const onScreen =
                    worldX >= viewX - 64 &&
                    worldX <= viewX + viewW + 64 &&
                    worldY >= viewY - 64 &&
                    worldY <= viewY + viewH + 64;
                if (onScreen) {
                    engine.addScreenShake?.(0.25);
                }
            }
            return true;
        }

        case "playSound":
            if (!engine) {
                return true;
            }
            ctx.soundManagerRef.current?.play({
                soundId: packet.payload.soundId,
                listener: ctx.resolveEntitySoundPosition(
                    engine,
                    engine.user?.id,
                ),
                source: ctx.resolveEntitySoundPosition(
                    engine,
                    packet.payload.id,
                ),
            });
            return true;

        case "error":
            ctx.setIsSceneReady(false);
            ctx.emitStatus({
                connected: false,
                connecting: false,
                error: packet.payload.msg,
            });
            return true;

        case "closeForce":
            ctx.setIsSceneReady(false);
            ctx.emitStatus({
                connected: false,
                connecting: false,
                error: "El servidor cerro la sesion.",
            });
            ctx.disconnectSocket();
            return true;

        default:
            return false;
    }
}
