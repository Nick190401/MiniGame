import Phaser from 'phaser';
import { TEXEL } from '../render/RenderScale';
import { PAINTED_TEXEL, PAINTED_WORLD_ART } from '../assets/WorldArt';

const sourceKey = (key: string) => `${key}-painted`;

export function loadPaintedWorldArt(scene: Phaser.Scene): void {
  PAINTED_WORLD_ART.forEach(({ key, url }) => scene.load.image(sourceKey(key), url));
}

/**
 * Registers the painted art under the keys the code painters use. Call it
 * before they run: worldTexture() keeps an existing key, so the painted
 * version wins without touching any placement code, and cast shadows are
 * later derived from its alpha.
 */
export function registerPaintedWorldArt(scene: Phaser.Scene): void {
  for (const { key } of PAINTED_WORLD_ART) {
    const source = sourceKey(key);
    // A file that failed to load leaves the key to its code painter.
    if (!scene.textures.exists(source) || scene.textures.exists(key)) continue;
    const image = scene.textures.get(source).getSourceImage() as HTMLImageElement;
    const scale = TEXEL / PAINTED_TEXEL;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    scene.textures.addCanvas(key, canvas);
    // The full-size source is only needed for this one resample.
    scene.textures.remove(source);
  }
}
