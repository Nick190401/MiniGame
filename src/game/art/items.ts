import Phaser from 'phaser';
import { makeCanvas, radial, rgba, type Ctx } from './paint';
import { addStaticCanvas } from './worldTexture';

/** Pixel sizes of the item textures (the WorldScene scales the sprites to world size). */
export const ITEM_TEXTURE_SIZE = { fragment: 192, lostTrack: 192 } as const;

/** Framed MR monogram, the same strokes as public/assets/mr-logo.svg. */
function mrMark(ctx: Ctx, x: number, y: number, width: number, color: string): void {
  const s = width / 150;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineJoin = 'miter';
  ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(10, 8); ctx.lineTo(146, 6); ctx.lineTo(144, 88); ctx.lineTo(4, 88); ctx.closePath(); ctx.stroke();
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(20, 77); ctx.lineTo(25, 19); ctx.lineTo(54, 76); ctx.lineTo(90, 19); ctx.lineTo(111, 19);
  ctx.bezierCurveTo(124, 19, 133, 23, 132, 33);
  ctx.bezierCurveTo(131, 45, 117, 51, 102, 53);
  ctx.lineTo(126, 76);
  ctx.stroke();
  ctx.restore();
}

/** A vinyl record seen from above: grooves, anisotropic sheen and a paper label. */
function paintVinyl(ctx: Ctx, size: number, master: boolean): void {
  const c = size / 2;
  const r = c * 0.94;
  // Soft contact shadow so it reads as an object, not a sticker.
  ctx.fillStyle = radial(ctx, c + size * 0.03, c + size * 0.04, r * 0.7, r * 1.05, [[0, 0x000000, 0.45], [1, 0x000000, 0]]);
  ctx.beginPath(); ctx.arc(c + size * 0.03, c + size * 0.04, r * 1.05, 0, Math.PI * 2); ctx.fill();
  // Disc body.
  ctx.fillStyle = radial(ctx, c, c, r * 0.3, r, [[0, master ? 0x2a2014 : 0x16181c], [1, master ? 0x120c06 : 0x07080a]]);
  ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.fill();
  // Grooves.
  for (let rr = r * 0.97; rr > r * 0.42; rr -= size * 0.012) {
    ctx.strokeStyle = rgba(master ? 0x5a4426 : 0x2a2e36, 0.55);
    ctx.lineWidth = size * 0.004;
    ctx.beginPath(); ctx.arc(c, c, rr, 0, Math.PI * 2); ctx.stroke();
  }
  // Two-lobed sheen, as light catches the grooves.
  const conic = (ctx as Ctx & { createConicGradient?: (a: number, x: number, y: number) => CanvasGradient }).createConicGradient;
  if (conic) {
    const g = conic.call(ctx, -0.6, c, c);
    const hi = master ? '255,226,150' : '210,225,240';
    g.addColorStop(0, `rgba(${hi},0)`);
    g.addColorStop(0.08, `rgba(${hi},0.38)`);
    g.addColorStop(0.16, `rgba(${hi},0)`);
    g.addColorStop(0.5, `rgba(${hi},0)`);
    g.addColorStop(0.58, `rgba(${hi},0.3)`);
    g.addColorStop(0.66, `rgba(${hi},0)`);
    g.addColorStop(1, `rgba(${hi},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c, c, r * 0.98, 0, Math.PI * 2); ctx.arc(c, c, r * 0.4, 0, Math.PI * 2, true); ctx.fill();
  }
  // Rim highlight.
  ctx.strokeStyle = master ? 'rgba(255,214,130,0.9)' : 'rgba(126,200,240,0.8)';
  ctx.lineWidth = size * 0.012;
  ctx.beginPath(); ctx.arc(c, c, r - size * 0.006, 0, Math.PI * 2); ctx.stroke();
  // Label with the MR mark.
  const lr = r * 0.38;
  ctx.fillStyle = radial(ctx, c - lr * 0.3, c - lr * 0.3, lr * 0.1, lr, master
    ? [[0, 0xfff0b8], [0.6, 0xe8c477], [1, 0xb08a3a]]
    : [[0, 0xffb07a], [0.6, 0xe88d54], [1, 0xb0582c]]);
  ctx.beginPath(); ctx.arc(c, c, lr, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(80,40,20,0.6)';
  ctx.lineWidth = size * 0.006;
  ctx.beginPath(); ctx.arc(c, c, lr * 0.9, 0, Math.PI * 2); ctx.stroke();
  mrMark(ctx, c - lr * 0.82, c - lr * 0.6, lr * 1.64, 'rgba(23,19,15,0.95)');
  ctx.fillStyle = '#17130f';
  ctx.beginPath(); ctx.arc(c, c + lr * 0.66, size * 0.014, 0, Math.PI * 2); ctx.fill();
  if (master) {
    // Gold master glints.
    for (const [x, y, k] of [[0.24, 0.26, 1], [0.78, 0.74, 0.7]]) {
      const gx = size * x, gy = size * y, l = size * 0.08 * k;
      ctx.fillStyle = radial(ctx, gx, gy, 0, l, [[0, 0xffffff, 0.95], [1, 0xffe9af, 0]]);
      ctx.beginPath(); ctx.arc(gx, gy, l, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,250,230,0.95)';
      ctx.lineWidth = size * 0.008;
      ctx.beginPath(); ctx.moveTo(gx - l, gy); ctx.lineTo(gx + l, gy); ctx.moveTo(gx, gy - l); ctx.lineTo(gx, gy + l); ctx.stroke();
    }
  }
}

export function createItemTextures(scene: Phaser.Scene): void {
  const add = (key: string, size: number, master: boolean) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const { canvas, ctx } = makeCanvas(size, size);
    paintVinyl(ctx, size, master);
    addStaticCanvas(scene, key, canvas);
  };
  add('item-fragment-mr', ITEM_TEXTURE_SIZE.fragment, false);
  add('item-lost-track', ITEM_TEXTURE_SIZE.lostTrack, true);
}
