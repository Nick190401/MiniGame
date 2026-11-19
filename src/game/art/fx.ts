import Phaser from 'phaser';
import { radial, rgba, type Ctx } from './paint';
import { worldTexture } from './worldTexture';

/** Generic soft shapes for shadows, glows and particles (white unless noted; tint at use). */
export const FX = {
  shadow: 'fx-shadow',
  glow: 'fx-glow',
  glowHard: 'fx-glow-hard',
  mote: 'fx-mote',
  spark: 'fx-spark',
  leaf: 'fx-leaf',
  ring: 'fx-ring',
  ember: 'fx-ember',
} as const;

/** Authored world sizes (units) of the fx textures above. */
export const FX_SIZE = {
  shadow: { w: 32, h: 16 },
  glow: { w: 32, h: 32 },
  mote: { w: 4, h: 4 },
  spark: { w: 12, h: 12 },
  leaf: { w: 4, h: 3 },
  ring: { w: 32, h: 32 },
  ember: { w: 3, h: 5 },
} as const;

function paintSpark(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h / 2;
  ctx.fillStyle = radial(ctx, cx, cy, 0, w / 2, [[0, 0xffffff, 1], [0.25, 0xffffff, 0.5], [1, 0xffffff, 0]]);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = rgba(0xffffff, 0.95);
  ctx.beginPath();
  ctx.moveTo(cx, 0); ctx.quadraticCurveTo(cx + 0.6, cy - 0.6, w, cy); ctx.quadraticCurveTo(cx + 0.6, cy + 0.6, cx, h);
  ctx.quadraticCurveTo(cx - 0.6, cy + 0.6, 0, cy); ctx.quadraticCurveTo(cx - 0.6, cy - 0.6, cx, 0);
  ctx.fill();
}

export function createFxTextures(scene: Phaser.Scene): void {
  worldTexture(scene, FX.shadow, FX_SIZE.shadow.w, FX_SIZE.shadow.h, (ctx, w, h) => {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1, h / w);
    ctx.fillStyle = radial(ctx, 0, 0, 0, w / 2, [[0, 0x000000, 0.9], [0.45, 0x000000, 0.55], [1, 0x000000, 0]]);
    ctx.beginPath(); ctx.arc(0, 0, w / 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
  worldTexture(scene, FX.glow, FX_SIZE.glow.w, FX_SIZE.glow.h, (ctx, w, h) => {
    ctx.fillStyle = radial(ctx, w / 2, h / 2, 0, w / 2, [[0, 0xffffff, 1], [0.2, 0xffffff, 0.55], [0.5, 0xffffff, 0.16], [1, 0xffffff, 0]]);
    ctx.fillRect(0, 0, w, h);
  });
  worldTexture(scene, FX.glowHard, FX_SIZE.glow.w, FX_SIZE.glow.h, (ctx, w, h) => {
    ctx.fillStyle = radial(ctx, w / 2, h / 2, 0, w / 2, [[0, 0xffffff, 1], [0.55, 0xffffff, 0.85], [0.8, 0xffffff, 0.3], [1, 0xffffff, 0]]);
    ctx.fillRect(0, 0, w, h);
  });
  worldTexture(scene, FX.mote, FX_SIZE.mote.w, FX_SIZE.mote.h, (ctx, w, h) => {
    ctx.fillStyle = radial(ctx, w / 2, h / 2, 0, w / 2, [[0, 0xffffff, 1], [0.4, 0xffffff, 0.7], [1, 0xffffff, 0]]);
    ctx.fillRect(0, 0, w, h);
  });
  worldTexture(scene, FX.spark, FX_SIZE.spark.w, FX_SIZE.spark.h, paintSpark);
  worldTexture(scene, FX.leaf, FX_SIZE.leaf.w, FX_SIZE.leaf.h, (ctx, w, h) => {
    ctx.fillStyle = rgba(0xffffff, 1);
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2, h / 2.6, 0.3, 0, Math.PI * 2); ctx.fill();
  });
  worldTexture(scene, FX.ring, FX_SIZE.ring.w, FX_SIZE.ring.h, (ctx, w, h) => {
    ctx.fillStyle = radial(ctx, w / 2, h / 2, 0, w / 2, [[0, 0xffffff, 0], [0.72, 0xffffff, 0], [0.86, 0xffffff, 1], [1, 0xffffff, 0]]);
    ctx.fillRect(0, 0, w, h);
  });
  worldTexture(scene, FX.ember, FX_SIZE.ember.w, FX_SIZE.ember.h, (ctx, w, h) => {
    ctx.fillStyle = radial(ctx, w / 2, h * 0.6, 0, h / 2, [[0, 0xffffff, 1], [0.5, 0xffffff, 0.6], [1, 0xffffff, 0]]);
    ctx.beginPath(); ctx.ellipse(w / 2, h * 0.6, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
  });
}
