import Phaser from 'phaser';
import { TEXEL } from '../render/RenderScale';
import { PAINTED_TEXEL, PAINTED_WORLD_ART } from '../assets/WorldArt';
import { bootAssetUrl } from '../assets/BootPrefetch';
import { addStaticCanvas } from './worldTexture';

const sourceKey = (key: string) => `${key}-painted`;

export function loadPaintedWorldArt(scene: Phaser.Scene): void {
  PAINTED_WORLD_ART.forEach(({ key, url }) => scene.load.image(sourceKey(key), bootAssetUrl(url)));
}

/**
 * Registers the painted art under the keys the code painters use. Call it
 * before they run: worldTexture() keeps an existing key, so the painted
 * version wins without touching any placement code, and cast shadows are
 * later derived from its alpha.
 */
export function registerPaintedWorldArt(scene: Phaser.Scene): void {
  for (const { key } of PAINTED_WORLD_ART) registerPaintedTexture(scene, sourceKey(key), key);
}

/**
 * Registers one loaded painted file under `key`, resampled to the world's
 * TEXEL. A file that failed to load leaves the key to its code painter. An
 * existing key is kept, unless `replace` lets the painted file take over
 * from a stand-in painted before it arrived (art that streams in late).
 */
export function registerPaintedTexture(
  scene: Phaser.Scene,
  source: string,
  key: string,
  { replace = false }: { replace?: boolean } = {},
): boolean {
  if (!scene.textures.exists(source)) return false;
  if (scene.textures.exists(key)) {
    if (!replace) return false;
    scene.textures.remove(key);
  }
  const image = scene.textures.get(source).getSourceImage() as HTMLImageElement;
  const scale = TEXEL / PAINTED_TEXEL;
  // Already at the world's density: use the loaded image as it is.
  if (scale === 1) {
    scene.textures.renameTexture(source, key);
    return true;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  addStaticCanvas(scene, key, canvas);
  // The full-size source is only needed for this one resample.
  scene.textures.remove(source);
  return true;
}
