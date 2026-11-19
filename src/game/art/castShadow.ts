import Phaser from 'phaser';
import { TEXEL } from '../render/RenderScale';
import { linear } from './paint';
import { worldTexture } from './worldTexture';

/**
 * Sun shadows on the ground. The silhouette of a standing sprite is projected
 * away from the sun (to the lower right, matching the upper-left light of all
 * artwork), fades with distance from its foot and is stored as a small, soft
 * texture of its own.
 */

/** Ground offset per unit of height above the foot. */
const LEAN_X = 0.5;
const LEAN_Y = 0.2;
const PAD = 3;
/** Shadows are stored at a third of the art's resolution; filtering softens them. */
const SOFTNESS = 3;
/** Above ground decals and grass clumps, below anything standing. */
export const CAST_SHADOW_DEPTH = 1.2;

export interface CastShadowInfo {
  key: string;
  /** World size of the shadow texture. */
  width: number;
  height: number;
  /** Where the sprite's foot point lies in the shadow texture (0..1). */
  originX: number;
  originY: number;
}

/**
 * Projected shadow for the world texture `sourceKey` (w x h world units, foot
 * point at footX/footY inside it). Mirrored sprites need their own shadow, as
 * the sun does not mirror with them.
 */
export function castShadow(
  scene: Phaser.Scene, sourceKey: string, w: number, h: number, footX: number, footY: number, flipX = false,
): CastShadowInfo {
  const left = LEAN_X * (footY - h) - PAD;
  const right = w + LEAN_X * footY + PAD;
  const top = footY - LEAN_Y * (h - footY) - PAD;
  const bottom = footY + LEAN_Y * footY + PAD;
  const width = right - left, height = bottom - top;
  const footPx = flipX ? w - footX : footX;
  const key = `${sourceKey}-cast${flipX ? '-flip' : ''}`;
  worldTexture(scene, key, width, height, (ctx) => {
    const source = scene.textures.get(sourceKey).getSourceImage() as HTMLCanvasElement;
    ctx.save();
    ctx.translate(-left, -top);
    // (x, y) -> (x + LEAN_X * height, footY + LEAN_Y * height), height = footY - y.
    ctx.transform(1, 0, -LEAN_X, -LEAN_Y, LEAN_X * footY, footY * (1 + LEAN_Y));
    if (flipX) { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(source, 0, 0, w, h);
    ctx.restore();
    // Darkest where the object meets the ground, lighter towards the tip.
    ctx.globalCompositeOperation = 'source-in';
    const fx = footPx - left, fy = footY - top;
    ctx.fillStyle = linear(ctx, fx, fy, fx + LEAN_X * footY, fy + LEAN_Y * footY, [[0, 0x000000, 1], [1, 0x000000, 0.5]]);
    ctx.fillRect(0, 0, width, height);
  }, { density: TEXEL / SOFTNESS });
  return { key, width, height, originX: (footPx - left) / width, originY: (footY - top) / height };
}

export function addCastShadow(
  scene: Phaser.Scene, info: CastShadowInfo, x: number, footY: number, scale = 1, alpha = 0.3,
): Phaser.GameObjects.Image {
  return scene.add.image(x, footY, info.key)
    .setOrigin(info.originX, info.originY)
    .setDisplaySize(info.width * scale, info.height * scale)
    .setAlpha(alpha)
    .setDepth(CAST_SHADOW_DEPTH);
}

/** Angle and length that reproduce the projected shadows above for a flat silhouette. */
const LIVE_ANGLE = -Math.atan2(LEAN_X, LEAN_Y) * (180 / Math.PI);
const LIVE_LENGTH = Math.hypot(LEAN_X, LEAN_Y);

/**
 * Live shadow for an animated sprite: its current frame, flipped down from
 * the feet, flattened and turned so it falls like the static shadows.
 * Call sync() after the sprite moves or changes frame.
 */
export class SpriteShadow {
  readonly image: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, private readonly target: Phaser.GameObjects.Sprite, alpha = 0.26) {
    this.image = scene.add.image(target.x, target.y, target.texture.key)
      .setOrigin(target.originX, target.originY)
      .setTintFill(0x000000)
      .setAlpha(alpha)
      .setAngle(LIVE_ANGLE)
      .setDepth(CAST_SHADOW_DEPTH);
    this.sync();
  }

  sync(visible = true): void {
    const t = this.target;
    if (this.image.texture.key !== t.texture.key) this.image.setTexture(t.texture.key);
    this.image
      .setPosition(t.x, t.y)
      .setFlipX(t.flipX)
      .setScale(t.scaleX, -t.scaleY * LIVE_LENGTH)
      .setVisible(visible && t.visible);
  }

  destroy(): void {
    this.image.destroy();
  }
}
