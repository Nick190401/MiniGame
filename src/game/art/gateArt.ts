import Phaser from 'phaser';
import { linear, mix, rgba, rng, roundRect, shade, type Ctx } from './paint';
import { worldTexture } from './worldTexture';

/** Code-painted parts of the Frequency Gate; the stone itself is painted art (hd-gate-arch). */
export const GATE_TEX = {
  threshold: 'hd-gate-threshold',
  sheet: 'fx-gate-sheet',
  lines: 'fx-gate-lines',
} as const;

export const GATE_TEX_SIZE = {
  threshold: { w: 68, h: 44 },
  sheet: { w: 64, h: 80 },
  lines: { w: 4, h: 6 },
} as const;

/** Worn limestone flags seen from above, with the bronze inlay the barrier stands on. */
function paintThreshold(ctx: Ctx, w: number, h: number): void {
  const rand = rng(931);
  const inlayTop = 35;
  const rows: Array<[number, number]> = [[0, 11], [11, 23], [23, inlayTop], [inlayTop + 2, h]];
  for (const [y0, y1] of rows) {
    let x = -((y0 * 7) % 9);
    while (x < w) {
      const bw = 12 + Math.floor(rand() * 7);
      const tone = mix(0xb3a68f, 0xcbbfa6, rand());
      ctx.fillStyle = linear(ctx, x, y0, x + bw, y1, [[0, shade(tone, 0.08)], [1, shade(tone, -0.1)]]);
      roundRect(ctx, x + 0.35, y0 + 0.35, bw - 0.7, y1 - y0 - 0.7, 1.2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,250,235,0.14)';
      ctx.fillRect(x + 1, y0 + 0.7, bw - 2, 0.5);
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = rgba(shade(tone, -0.25), 0.22);
        ctx.beginPath();
        ctx.ellipse(x + rand() * bw, y0 + rand() * (y1 - y0), 0.6 + rand() * 1.4, 0.4 + rand() * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Moss in the joints.
      if (rand() < 0.55) {
        ctx.fillStyle = rgba(rand() < 0.5 ? 0x56703a : 0x6b8442, 0.55);
        ctx.beginPath();
        ctx.ellipse(x + bw, y0 + rand() * (y1 - y0), 0.8 + rand(), 1.4 + rand() * 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      x += bw;
    }
  }
  // A path worn smooth down the middle.
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(1, 1.6);
  const worn = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
  worn.addColorStop(0, 'rgba(240,232,214,0.32)');
  worn.addColorStop(1, 'rgba(240,232,214,0)');
  ctx.fillStyle = worn;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
  // The bronze inlay across the doorway, with its dark groove.
  ctx.fillStyle = linear(ctx, 0, inlayTop, 0, inlayTop + 2, [[0, 0xc08a45], [0.5, 0x9a6a33], [1, 0x6e4a24]]);
  ctx.fillRect(0, inlayTop, w, 2);
  ctx.fillStyle = 'rgba(30,18,10,0.75)';
  ctx.fillRect(0, inlayTop + 0.85, w, 0.35);
  ctx.fillStyle = 'rgba(255,236,190,0.35)';
  ctx.fillRect(0, inlayTop, w, 0.3);
  // Feather the north and south edges into the road.
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, 0xffffff, 0], [0.14, 0xffffff, 1], [0.86, 0xffffff, 1], [1, 0xffffff, 0]]);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = linear(ctx, 0, 0, w, 0, [[0, 0xffffff, 0], [0.05, 0xffffff, 1], [0.95, 0xffffff, 1], [1, 0xffffff, 0]]);
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

/** The barrier's light sheet (white, tinted in code): a bright hem, soft body and lit jambs. */
function paintSheet(ctx: Ctx, w: number, h: number): void {
  const rand = rng(57);
  ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, 0xffffff, 0.18], [1, 0xffffff, 0.42]]);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = linear(ctx, 0, h - 6, 0, h, [[0, 0xffffff, 0], [0.45, 0xffffff, 0.55], [1, 0xffffff, 0.85]]);
  ctx.fillRect(0, h - 6, w, 6);
  ctx.fillStyle = linear(ctx, 0, 0, 4, 0, [[0, 0xffffff, 0.25], [1, 0xffffff, 0]]);
  ctx.fillRect(0, 0, 4, h);
  ctx.fillStyle = linear(ctx, w - 4, 0, w, 0, [[0, 0xffffff, 0], [1, 0xffffff, 0.25]]);
  ctx.fillRect(w - 4, 0, 4, h);
  for (let i = 0; i < 9; i++) {
    const x = 4 + rand() * (w - 8);
    ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, 0xffffff, 0], [0.5, 0xffffff, 0.08], [1, 0xffffff, 0.02]]);
    ctx.fillRect(x, 0, 0.6 + rand() * 0.8, h);
  }
}

/** A seamless tile of two thin interference lines, scrolled upward through the barrier. */
function paintLines(ctx: Ctx, w: number, h: number): void {
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(0, 1.2, w, 0.35);
  ctx.fillRect(0, 4.2, w, 0.35);
}

export function createGateTextures(scene: Phaser.Scene): void {
  worldTexture(scene, GATE_TEX.threshold, GATE_TEX_SIZE.threshold.w, GATE_TEX_SIZE.threshold.h, paintThreshold);
  worldTexture(scene, GATE_TEX.sheet, GATE_TEX_SIZE.sheet.w, GATE_TEX_SIZE.sheet.h, paintSheet);
  worldTexture(scene, GATE_TEX.lines, GATE_TEX_SIZE.lines.w, GATE_TEX_SIZE.lines.h, paintLines);
}
