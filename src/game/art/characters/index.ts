import Phaser from 'phaser';
import { TEXEL } from '../../render/RenderScale';
import { characterFrameKey, WALK_FRAMES, type PlayerDirection } from '../../assets/PlayerTextures';
import { radial, type Ctx } from '../paint';
import { paintRelief } from '../relief';
import type { LightingOptions } from '../litSprite';
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

/**
 * Figures are lit like the rest of the world (see relief.ts): every body part
 * is a soft volume, arms shade the torso, and the light falls from the same
 * upper left as on buildings and trees. Units are design units.
 */
const FIGURE_LIGHT: LightingOptions = {
  wrap: 0.45, aoRadius: 2.4, formRadius: 4, formWeight: 0.3, selfShadow: 0.5, shadowReach: 7,
  shadowHardness: 0.3, maxSlope: 1.8, smooth: 0.25, backgroundDrop: -0.6,
  sun: [1.1, 1.0, 0.86], sky: [0.38, 0.42, 0.5], ground: [0.24, 0.21, 0.16],
};

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
        const phase = frame === 0 ? -1 : (frame - 1) / WALK_FRAMES;
        const canvas = paintRelief(CHARACTER_FRAME.w, CHARACTER_FRAME.h, px, (ctx) => {
          ctx.translate(CHARACTER_FRAME.footX, CHARACTER_FRAME.footY);
          paintFrame(ctx, id, direction, phase);
        }, FIGURE_LIGHT);
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
  // Design-space window to fit: full body or head-and-shoulders.
  const win = crop === 'full'
    ? { x0: -30, x1: 30, y0: -108, y1: 3 }
    : { x0: -19, x1: 19, y0: -104, y1: -55 };
  const scale = Math.min(width / (win.x1 - win.x0), height / (win.y1 - win.y0));
  // Painted in design units at `scale` pixels per unit, then lit.
  const w = width / scale, h = height / scale;
  return paintRelief(w, h, scale, (ctx) => {
    if (options.halo !== undefined) {
      ctx.fillStyle = radial(ctx, w / 2, h * 0.42, 0, w * 0.6, [[0, options.halo, 0.35], [1, options.halo, 0]]);
      ctx.fillRect(0, 0, w, h);
    }
    ctx.translate((w - (win.x1 - win.x0)) / 2 - win.x0, (h - (win.y1 - win.y0)) / 2 - win.y0);
    paintFrame(ctx, id, 'down', -1, yaw, options.stance ?? 0);
  }, FIGURE_LIGHT);
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
