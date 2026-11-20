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

/** Texture texels per frame pixel for overworld frames (1:1 at the world zoom). */
export const CHARACTER_TEXELS = (CHARACTER_HEIGHT / CHARACTER_FRAME.figure) * TEXEL;

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
