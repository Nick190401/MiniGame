import Phaser from 'phaser';
import { TEXEL } from '../../render/RenderScale';
import { CHARACTER_DIRECTIONS, CHARACTER_FRAME, characterFrameKey, characterSourceKey, WALK_FRAMES } from '../../assets/PlayerTextures';
import { NPC_IDS } from '../../assets/NpcTextures';
import { makeCanvas } from '../paint';
import { addStaticCanvas } from '../worldTexture';

export { CHARACTER_FRAME };

/**
 * World height of a character from the feet to the top of the head. At this
 * height a 16-unit tile is about a metre, so doors, windows, trees and props
 * keep real-world proportions next to a person.
 */
export const CHARACTER_HEIGHT = 27;

/** Out in the world the hero and the NPCs are drawn at this multiple of CHARACTER_HEIGHT (indoors: INTERIOR_HERO_SCALE). */
export const OVERWORLD_CHARACTER_SCALE = 1.2;

/** In battle the hero is drawn at this multiple of the size his platform calls for. */
export const BATTLE_HERO_SCALE = 0.8;

/** Texture texels per frame pixel for overworld frames (1:1 at the world zoom). */
export const CHARACTER_TEXELS = (CHARACTER_HEIGHT / CHARACTER_FRAME.figure) * TEXEL;

/**
 * Gives a character its collision footprint: `width` x `height` world units
 * with the bottom edge at the feet. Arcade scales a body with its sprite, so
 * a figure drawn at `modelScale` times its base size gets a body that much
 * smaller in texture space and keeps the same footprint in the world.
 */
export function setCharacterFootprint(sprite: Phaser.Physics.Arcade.Sprite, width: number, height: number, modelScale = 1): void {
  const body = sprite.body as Phaser.Physics.Arcade.Body;
  const w = width * TEXEL;
  const h = height * TEXEL;
  // Arcade places a body at scale * (offset - display origin), so the offset shrinks about the origin.
  const dx = CHARACTER_FRAME.footX * CHARACTER_TEXELS - w / 2 - sprite.displayOriginX;
  const dy = CHARACTER_FRAME.footY * CHARACTER_TEXELS - h - sprite.displayOriginY;
  body.setSize(w / modelScale, h / modelScale);
  body.setOffset(sprite.displayOriginX + dx / modelScale, sprite.displayOriginY + dy / modelScale);
}

/**
 * Overworld frames at the world's texel density. The large source images are
 * reduced once here, in halving steps, so they stay crisp instead of
 * shimmering when the GPU minifies them every frame.
 */
export function createCharacterTextures(scene: Phaser.Scene): void {
  const width = Math.round(CHARACTER_FRAME.w * CHARACTER_TEXELS);
  const height = Math.round(CHARACTER_FRAME.h * CHARACTER_TEXELS);
  for (const id of ['player', ...NPC_IDS]) {
    for (const direction of CHARACTER_DIRECTIONS) {
      for (let frame = 0; frame <= WALK_FRAMES; frame++) {
        const key = characterFrameKey(id, direction, frame);
        const sourceKey = characterSourceKey(key);
        if (scene.textures.exists(key) || !scene.textures.exists(sourceKey)) continue;
        const source = scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
        addStaticCanvas(scene, key, downsample(source, width, height));
        // Only this one reduction needs the full-size frame; free its memory.
        scene.textures.remove(sourceKey);
      }
    }
  }
}

function downsample(source: HTMLImageElement | HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  let input: HTMLImageElement | HTMLCanvasElement = source;
  let w = source.width, h = source.height;
  while (w / 2 >= width && h / 2 >= height) {
    w = Math.ceil(w / 2); h = Math.ceil(h / 2);
    const { canvas, ctx } = makeCanvas(w, h);
    ctx.drawImage(input, 0, 0, w, h);
    input = canvas;
  }
  const { canvas, ctx } = makeCanvas(width, height);
  ctx.drawImage(input, 0, 0, width, height);
  return canvas;
}
