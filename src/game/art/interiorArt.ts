import Phaser from 'phaser';
import { hash2, linear, rgba, roundRect, shade, softEllipse, type Ctx } from './paint';
import { worldTexture } from './worldTexture';
import { FX } from './fx';
import { addSoundLabAtmosphere, createSoundLabTextures } from './soundLabArt';
import type { Ambient, Hook, InteriorRoom, RoomRect } from '../maps/interiors/room';

/** Light enough that the props along the side walls stay readable in the darkest rooms. */
const DEFAULT_VIGNETTE = 0.3;
const DEFAULT_STAND_IN = { floor: 0x5a4636, wall: 0x6d5a4a, furniture: 0x4a3c30 };
const WALL_TOP = 0x15100d;

/** A plain block of furniture: soft contact shadow, lit top, darker base. */
function block(ctx: Ctx, { x, y, w, h }: RoomRect, color: number): void {
  softEllipse(ctx, x + w / 2, y + h - 1, w * 0.55, 4, 0x000000, 0.3);
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 2);
  ctx.fillStyle = linear(ctx, 0, y, 0, y + h, [[0, shade(color, 0.18)], [0.3, color], [1, shade(color, -0.35)]]);
  ctx.fill();
  ctx.strokeStyle = rgba(shade(color, -0.55), 0.9);
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

/**
 * The room painted in code: what the hero sees when the painting has not
 * arrived. It lines up with the colliders, so nothing looks walkable that is
 * not.
 */
function paintStandIn(ctx: Ctx, w: number, h: number, room: InteriorRoom): void {
  const { floor, wall, furniture } = room.standIn ?? DEFAULT_STAND_IN;
  const { back, left, right, nearLeft, nearRight } = room.walls;

  ctx.fillStyle = rgba(floor);
  ctx.fillRect(0, 0, w, h);
  for (let row = 0, y = back.h; y < h; row++, y += 6.4) {
    ctx.fillStyle = rgba(shade(floor, (hash2(row, 3) - 0.5) * 0.16));
    ctx.fillRect(0, y, w, 6.4);
    ctx.fillStyle = rgba(shade(floor, -0.45), 0.5);
    ctx.fillRect(0, y, w, 0.4);
  }

  ctx.fillStyle = rgba(wall);
  ctx.fillRect(0, 0, w, back.h);
  ctx.fillStyle = linear(ctx, 0, back.h - 10, 0, back.h, [[0, 0x000000, 0], [1, 0x000000, 0.35]]);
  ctx.fillRect(0, back.h - 10, w, 10);

  ctx.fillStyle = rgba(WALL_TOP);
  ctx.fillRect(0, 0, w, 4.4);
  for (const top of [left, right, nearLeft, nearRight]) ctx.fillRect(top.x, top.y, top.w, top.h);

  room.furniture.forEach((rect, index) => block(ctx, rect, shade(furniture, (hash2(index, 5) - 0.5) * 0.3)));

  // The doormat, and daylight through the open doorway.
  const { spawn } = room;
  ctx.fillStyle = rgba(0x6e6640);
  ctx.fillRect(spawn.x - 14, spawn.y + 5, 28, 13);
  softEllipse(ctx, spawn.x, h - 2, 16, 7, 0xffe6b0, 0.35);
}

/**
 * The room's textures. The painting is adopted first when it has arrived;
 * worldTexture() keeps an existing key, so the stand-in is painted only when
 * the key is missing.
 */
export function createRoomTextures(scene: Phaser.Scene, room: InteriorRoom): void {
  // The Sound Lab has its own stand-in and window light.
  if (room.id === 'sound-lab') {
    createSoundLabTextures(scene);
    return;
  }
  worldTexture(scene, room.art.key, room.width, room.height, (ctx, w, h) => paintStandIn(ctx, w, h, room));
}

/** The room's grade: the Sound Lab keeps its dusty look; every other room only a soft vignette. */
export function addRoomGrade(scene: Phaser.Scene, room: InteriorRoom, reducedMotion: boolean): void {
  if (room.id === 'sound-lab') {
    addSoundLabAtmosphere(scene, reducedMotion);
    return;
  }
  scene.cameras.main.postFX?.addVignette(0.5, 0.5, 0.86, room.vignette ?? DEFAULT_VIGNETTE);
}

const addGlow = (scene: Phaser.Scene, x: number, y: number, size: number, tint: number, alpha: number) =>
  scene.add.image(x, y, FX.glow).setDisplaySize(size, size).setTint(tint).setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(alpha).setDepth(1);

/** One lasting light or drift of motes. Under reduced motion it stands still. */
export function addAmbient(scene: Phaser.Scene, ambient: Ambient, reducedMotion: boolean): void {
  if (ambient.type === 'glow') {
    const glow = addGlow(scene, ambient.at.x, ambient.at.y, ambient.size, ambient.tint, ambient.alpha);
    if (ambient.pulseMs && !reducedMotion) {
      scene.tweens.add({
        targets: glow, alpha: { from: ambient.alpha * 0.55, to: ambient.alpha },
        duration: ambient.pulseMs, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
    return;
  }
  if (ambient.type === 'flicker') {
    const glow = addGlow(scene, ambient.at.x, ambient.at.y, ambient.size, ambient.tint, ambient.alpha * 0.85);
    if (reducedMotion) return;
    const level = () => ambient.alpha * (0.62 + Math.random() * 0.38);
    const { periodMs } = ambient;
    if (periodMs) {
      const glide = () => {
        scene.tweens.add({ targets: glow, alpha: level(), duration: periodMs, ease: 'Sine.easeInOut', onComplete: glide });
      };
      glide();
    } else {
      // Firelight and tired neon: an uneven waver.
      scene.time.addEvent({ delay: 120, loop: true, callback: () => glow.setAlpha(level()) });
    }
    // Visibility, not alpha, so the waver cannot fill the gaps. Two cuts in a quarter second stay far below a strobe.
    if (ambient.blink) {
      const blinkLater = () => scene.time.delayedCall(Phaser.Math.Between(3500, 8000), () => {
        glow.setVisible(false);
        scene.time.delayedCall(70, () => glow.setVisible(true));
        scene.time.delayedCall(170, () => glow.setVisible(false));
        scene.time.delayedCall(240, () => {
          glow.setVisible(true);
          blinkLater();
        });
      });
      blinkLater();
    }
    return;
  }
  const { area, tint, count, drift } = ambient;
  const shown = reducedMotion ? Math.ceil(count / 3) : count;
  for (let index = 0; index < shown; index++) {
    const x = area.x + Math.random() * area.w;
    const y = area.y + Math.random() * area.h;
    const size = 0.6 + Math.random() * 1.1;
    const peak = 0.3 + Math.random() * 0.35;
    const mote = scene.add.image(x, y, FX.mote).setDisplaySize(size, size).setTint(tint)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(7);
    if (reducedMotion) {
      mote.setAlpha(peak * 0.8);
      continue;
    }
    const travel = drift === 'rise' ? -(8 + Math.random() * 14) : drift === 'fall' ? 8 + Math.random() * 14 : Phaser.Math.Between(-4, 10);
    mote.setAlpha(0);
    scene.tweens.add({
      targets: mote,
      x: x + Phaser.Math.Between(-6, 6),
      y: y + travel,
      alpha: { from: 0.04, to: peak },
      duration: 3600 + Math.random() * 4200,
      delay: Math.random() * 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}

/** A one-off light or burst of motes from a hook. Under reduced motion it shows still for a moment. */
export function playHookEffect(scene: Phaser.Scene, hook: Extract<Hook, { type: 'glow' | 'motes' }>, reducedMotion: boolean): void {
  if (hook.type === 'glow') {
    const ring = hook.mode === 'ring';
    const light = scene.add.image(hook.at.x, hook.at.y, ring ? FX.ring : FX.glow).setTint(hook.tint)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(6);
    if (reducedMotion) {
      light.setDisplaySize(hook.size, hook.size).setAlpha(0.45);
      scene.time.delayedCall(hook.ms ?? 900, () => light.destroy());
      return;
    }
    light.setDisplaySize(hook.size * (ring ? 0.25 : 0.8), hook.size * (ring ? 0.25 : 0.8)).setAlpha(ring ? 0.85 : 0);
    scene.tweens.add({
      targets: light,
      displayWidth: hook.size * (ring ? 1.4 : 1),
      displayHeight: hook.size * (ring ? 1.4 : 1),
      alpha: ring ? 0 : { from: 0, to: 0.7 },
      yoyo: !ring,
      // A pulse swells and fades: half its time each way.
      duration: ring ? hook.ms ?? 1100 : (hook.ms ?? 1040) / 2,
      ease: ring ? 'Cubic.easeOut' : 'Sine.easeInOut',
      onComplete: () => light.destroy(),
    });
    return;
  }
  for (let index = 0; index < hook.count; index++) {
    const mote = scene.add.image(hook.at.x + Phaser.Math.Between(-8, 8), hook.at.y + Phaser.Math.Between(-3, 3), FX.mote)
      .setDisplaySize(1.2 + Math.random(), 1.2 + Math.random()).setTint(hook.tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(7);
    if (reducedMotion) {
      mote.setAlpha(0.6);
      scene.time.delayedCall(1200, () => mote.destroy());
      continue;
    }
    mote.setAlpha(0);
    scene.tweens.add({
      targets: mote,
      x: mote.x + Phaser.Math.Between(-6, 6),
      y: mote.y + (hook.dir === 'rise' ? -1 : 1) * (14 + Math.random() * 16),
      alpha: { from: 0.9, to: 0 },
      delay: index * 90,
      duration: 1300 + Math.random() * 700,
      ease: 'Sine.easeOut',
      onComplete: () => mote.destroy(),
    });
  }
}
