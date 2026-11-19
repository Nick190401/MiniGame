import Phaser from 'phaser';
import { TEXEL } from '../../render/RenderScale';
import { characterFrameKey, WALK_FRAMES, type PlayerDirection } from '../../assets/PlayerTextures';
import { makeCanvas, radial, type Ctx } from '../paint';
import { drawFigure } from './figure';
import { makePose, type Facing } from './rig';
import { OUTFITS, type CharacterId } from './outfits';

export type { CharacterId } from './outfits';

/**
 * Overworld frame layout in design units. A figure is ~100 units tall and is
 * shown 27 world units tall (one design unit = 0.27 world units). At that
 * height a 16-unit tile is about a metre, so doors (~31 units), windows,
 * trees and props keep real-world proportions next to a person.
 */
export const CHARACTER_FRAME = { w: 76, h: 120, footX: 38, footY: 113, unitsToWorld: 0.27 } as const;

/** World height of a character from the feet to the top of the head. */
export const CHARACTER_HEIGHT = 100 * CHARACTER_FRAME.unitsToWorld;

/** Texture texels per design unit for overworld frames (1:1 at the world zoom). */
export const CHARACTER_TEXELS = CHARACTER_FRAME.unitsToWorld * TEXEL;

const DIRECTIONS: PlayerDirection[] = ['down', 'up', 'left', 'right'];

function paintFrame(ctx: Ctx, id: CharacterId, facing: Facing, phase: number, yaw = 0, stance = 0): void {
  ctx.save();
  if (facing === 'left') ctx.scale(-1, 1);
  drawFigure(ctx, OUTFITS[id], makePose(facing === 'left' ? 'right' : facing, phase, yaw, stance));
  ctx.restore();
}

/** Every overworld frame of every character (standing + walk cycle, four directions). */
export function createCharacterTextures(scene: Phaser.Scene): void {
  const px = CHARACTER_TEXELS;
  (Object.keys(OUTFITS) as CharacterId[]).forEach((id) => {
    DIRECTIONS.forEach((direction) => {
      for (let frame = 0; frame <= WALK_FRAMES; frame++) {
        const key = characterFrameKey(id, direction, frame);
        if (scene.textures.exists(key)) continue;
        const { canvas, ctx } = makeCanvas(CHARACTER_FRAME.w * px, CHARACTER_FRAME.h * px);
        ctx.scale(px, px);
        ctx.translate(CHARACTER_FRAME.footX, CHARACTER_FRAME.footY);
        const phase = frame === 0 ? -1 : (frame - 1) / WALK_FRAMES;
        paintFrame(ctx, id, direction, phase);
        scene.textures.addCanvas(key, canvas);
      }
    });
  });
}

export interface PortraitOptions {
  /** Output canvas size in pixels. */
  width: number;
  height: number;
  /** 'full' shows the whole figure, 'bust' head and shoulders. */
  crop: 'full' | 'bust';
  /** Three-quarter turn of the face/torso (-1..1). */
  yaw?: number;
  /** Soft rim glow behind the figure, for dialogue cards. */
  halo?: number;
  /** Battle stance (0..1). */
  stance?: number;
}

/** High-resolution standing render of a character for battle sprites and dialogue portraits. */
export function renderCharacterPortrait(id: CharacterId, options: PortraitOptions): HTMLCanvasElement {
  const { width, height, crop, yaw = 0 } = options;
  const { canvas, ctx } = makeCanvas(width, height);
  // Design-space window to fit: full body or head-and-shoulders.
  const win = crop === 'full'
    ? { x0: -30, x1: 30, y0: -108, y1: 3 }
    : { x0: -19, x1: 19, y0: -104, y1: -55 };
  const scale = Math.min(width / (win.x1 - win.x0), height / (win.y1 - win.y0));
  if (options.halo !== undefined) {
    ctx.fillStyle = radial(ctx, width / 2, height * 0.42, 0, width * 0.6, [[0, options.halo, 0.35], [1, options.halo, 0]]);
    ctx.fillRect(0, 0, width, height);
  }
  const ox = (width - (win.x1 - win.x0) * scale) / 2 - win.x0 * scale;
  const oy = (height - (win.y1 - win.y0) * scale) / 2 - win.y0 * scale;
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  paintFrame(ctx, id, 'down', -1, yaw, options.stance ?? 0);
  return canvas;
}

/** Battle sprite for the player (three-quarter view toward the enemy) and NPC busts. */
export function createBattleCharacterTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('player-battle')) scene.textures.remove('player-battle');
  scene.textures.addCanvas('player-battle', renderCharacterPortrait('player', { width: 520, height: 960, crop: 'full', yaw: 0.45, stance: 0.8 }));
  (['professor', 'guard', 'musician'] as const).forEach((id) => {
    const key = `portrait-${id}`;
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, renderCharacterPortrait(id, { width: 256, height: 308, crop: 'bust', yaw: 0.2 }));
  });
}
