import Phaser from 'phaser';
import { TEXEL } from '../render/RenderScale';
import { makeCanvas, type Ctx } from './paint';

/**
 * World artwork is painted in world units onto a canvas that is TEXEL times
 * denser, so it samples ~1:1 at the overworld zoom. Images using these
 * textures are scaled by 1 / TEXEL (see addWorldImage).
 */
export const WORLD_TEXTURE_SCALE = 1 / TEXEL;

export type WorldDraw = (ctx: Ctx, width: number, height: number) => void;

/**
 * Registers a finished canvas as a plain texture. textures.addCanvas builds a
 * CanvasTexture, which reads every pixel back into a second copy it keeps:
 * slow at load and memory that phones (iOS especially) count against the page.
 * Use addCanvas only for canvases that are drawn on again later.
 */
export function addStaticCanvas(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): Phaser.Textures.Texture | null {
  // Phaser's typings only name images, but a texture source may be a canvas.
  return scene.textures.addImage(key, canvas as unknown as HTMLImageElement);
}

export function worldTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: WorldDraw,
  { replace = false, density = TEXEL }: { replace?: boolean; density?: number } = {},
): string {
  if (scene.textures.exists(key)) {
    if (!replace) return key;
    scene.textures.remove(key);
  }
  const { canvas, ctx } = makeCanvas(width * density, height * density);
  ctx.scale(density, density);
  draw(ctx, width, height);
  addStaticCanvas(scene, key, canvas);
  return key;
}

/** An image whose HD texture is displayed at its authored world size. */
export function addWorldImage(scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image {
  return scene.add.image(x, y, key).setScale(WORLD_TEXTURE_SCALE);
}

/** Depth used by everything that stands on the ground (y-sorted by its foot line). */
export const standingDepth = (footY: number) => 5 + footY / 10000;
