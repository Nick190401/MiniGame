import Phaser from 'phaser';
import { TEXEL } from '../render/RenderScale';
import { fbm, makeCanvas, radial, rgba, rng, roundRect, type Ctx } from './paint';
import { addStaticCanvas, worldTexture } from './worldTexture';

/**
 * Textures of the NPC heal (src/game/world/NpcHeal.ts), painted once while the
 * game loads. Each is authored in world units at world density (TEXEL texels
 * per unit), so it is crisp at its authored size; white unless noted, tinted
 * at use.
 */
export const HFX = {
  ring: 'hfx-ring',
  crescent: 'hfx-crescent',
  crescentWorn: 'hfx-crescent-worn',
  line: 'hfx-line',
  lens1: 'hfx-lens-1',
  lens2: 'hfx-lens-2',
  glint: 'hfx-glint',
  vinyl: 'hfx-vinyl',
  vinylSheen: 'hfx-vinyl-sheen',
  note1: 'hfx-note-1',
  note2: 'hfx-note-2',
} as const;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Hermite step from e0 to e1; e0 may be larger than e1 for a falling edge. */
const step = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const gauss = (x: number, s: number) => Math.exp(-(x * x) / (2 * s * s));
const angDiff = (a: number, b: number) => {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
};

/** Mirrors battleFx's alphaTexture, but at world density; u, v run 0..1 over the texture. */
function alphaWorld(scene: Phaser.Scene, key: string, w: number, h: number, alphaAt: (u: number, v: number) => number): void {
  if (scene.textures.exists(key)) return;
  const { canvas, ctx } = makeCanvas(w * TEXEL, h * TEXEL);
  const W = canvas.width;
  const H = canvas.height;
  const image = ctx.createImageData(W, H);
  const data = image.data;
  const dither = rng(key.length * 7919);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const a = clamp01(alphaAt((x + 0.5) / W, (y + 0.5) / H));
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.max(0, Math.min(255, Math.round(a * 255 + dither() - 0.5)));
    }
  }
  ctx.putImageData(image, 0, 0);
  addStaticCanvas(scene, key, canvas);
}

/** A soft crescent in an 8 x 16 unit box, convex side toward +x, crest at x = 6. */
function crescentAlpha(u: number, v: number): number {
  const px = u * 8;
  const py = v * 16;
  const rho = Math.hypot(px + 10, py - 8) - 16;
  const t = Math.atan2(py - 8, px + 10) / (Math.PI / 6);
  if (Math.abs(t) >= 1) return 0;
  const taper = Math.pow(1 - t * t, 1.6);
  const haze = rho < 0 ? 0.3 * gauss((rho + 1.8) / 2, 1) : 0;
  return taper * (gauss(rho, 0.6) + haze) * step(0, 0.15, u) * step(0, 0.03, v) * step(1, 0.97, v);
}

function lensAlpha(u: number, v: number, harmonic: number): number {
  const y = Math.abs(v * 2 - 1);
  const env = 0.8 * Math.max(0.05, Math.abs(Math.sin(harmonic * Math.PI * u)));
  const k = y / env;
  const inner = k <= 1 ? (0.12 + 0.88 * k ** 4) * step(1, 0.92, k) : 0;
  const rim = gauss((y - env) / 0.07, 1);
  return Math.max(inner, rim) * step(0, 0.03, u) * step(1, 0.97, u);
}

/** Draws a note glyph three times: soft under-shadow, white glow, white body. */
function noteTexture(scene: Phaser.Scene, key: string, shape: (ctx: Ctx) => void): void {
  worldTexture(scene, key, 10, 12, ctx => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.save();
    ctx.translate(0, 0.4);
    ctx.shadowColor = 'rgba(26,15,10,0.35)';
    // shadowBlur is in canvas pixels and ignores ctx.scale.
    ctx.shadowBlur = 0.6 * TEXEL;
    ctx.fillStyle = ctx.strokeStyle = 'rgba(26,15,10,0.35)';
    shape(ctx);
    ctx.restore();
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.85)';
    ctx.shadowBlur = 1.4 * TEXEL;
    ctx.fillStyle = ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    shape(ctx);
    ctx.restore();
    ctx.fillStyle = ctx.strokeStyle = '#ffffff';
    shape(ctx);
  });
}

export function createHealFxTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(HFX.note2)) return;

  alphaWorld(scene, HFX.ring, 32, 32, (u, v) => {
    const r = Math.hypot(u * 2 - 1, v * 2 - 1);
    const inside = r < 0.88;
    const a = 0.9 * gauss(r - 0.88, 0.045) + 0.22 * gauss(r - 0.8, 0.1) * (inside ? 1 : 0.4) + 0.06 * step(0.3, 0.85, r) * (inside ? 1 : 0);
    return a * step(1, 0.96, r);
  });

  alphaWorld(scene, HFX.crescent, 8, 16, crescentAlpha);

  alphaWorld(scene, HFX.crescentWorn, 8, 16, (u, v) => {
    const t = Math.atan2(v * 16 - 8, u * 8 + 10) / (Math.PI / 6);
    const gaps = 0.25 + 0.75 * step(0.42, 0.58, fbm(clamp01(t * 0.5 + 0.5), 0.5, 6, 2, 733));
    return crescentAlpha(u, v) * gaps * (0.8 + 0.2 * fbm(u, v, 24, 2, 911));
  });

  alphaWorld(scene, HFX.line, 16, 2, (u, v) => {
    const y = v * 2 - 1;
    return (0.9 * gauss(y, 0.16) + 0.22 * gauss(y, 0.42)) * step(0, 0.05, u) * step(1, 0.95, u);
  });

  alphaWorld(scene, HFX.lens1, 32, 6, (u, v) => lensAlpha(u, v, 1));
  alphaWorld(scene, HFX.lens2, 32, 6, (u, v) => lensAlpha(u, v, 2));

  alphaWorld(scene, HFX.glint, 8, 8, (u, v) => {
    const x = u * 2 - 1;
    const y = v * 2 - 1;
    const arms = Math.max(gauss(y, 0.06) * gauss(x, 0.45), gauss(x, 0.06) * gauss(y, 0.45));
    return Math.min(1, 0.9 * arms + gauss(Math.hypot(x, y), 0.16)) * step(1, 0.9, Math.hypot(x, y));
  });

  // Painted record, label toward the top so its spin reads.
  worldTexture(scene, HFX.vinyl, 14, 14, ctx => {
    const disc = (r: number) => {
      ctx.beginPath();
      ctx.arc(7, 7, r, 0, Math.PI * 2);
    };
    ctx.fillStyle = radial(ctx, 7, 7, 0, 6.6, [[0, 0x1d1714], [0.85, 0x120d0b], [1, 0x0a0706]]);
    disc(6.6);
    ctx.fill();
    ctx.strokeStyle = rgba(0x4a3b33, 0.9);
    ctx.lineWidth = 0.3;
    disc(6.45);
    ctx.stroke();
    // Broad, faint groove bands: hairlines would moiré under the record's squash.
    for (const rc of [3.4, 4.6, 5.7]) {
      ctx.fillStyle = radial(ctx, 7, 7, rc - 0.7, rc + 0.7, [[0, 0x9a8a80, 0], [0.5, 0x9a8a80, 0.07], [1, 0x9a8a80, 0]]);
      disc(rc + 0.7);
      ctx.fill();
    }
    ctx.fillStyle = radial(ctx, 7, 7, 0, 2.2, [[0, 0xff7a2b], [1, 0xcf5a1d]]);
    disc(2.2);
    ctx.fill();
    ctx.strokeStyle = rgba(0x2a1a12, 0.6);
    ctx.lineWidth = 0.15;
    ctx.stroke();
    ctx.fillStyle = rgba(0xffe7c2);
    roundRect(ctx, 7 - 0.75, 5.75 - 0.19, 1.5, 0.38, 0.19);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8.1, 7.7, 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba(0x0a0706);
    disc(0.24);
    ctx.fill();
  });

  alphaWorld(scene, HFX.vinylSheen, 14, 14, (u, v) => {
    const dx = u * 14 - 7;
    const dy = v * 14 - 7;
    const rn = Math.hypot(dx, dy) / 6.6;
    const theta = Math.atan2(dy, dx);
    const wedges = gauss(angDiff(theta, (-40 * Math.PI) / 180) / 0.32, 1) + gauss(angDiff(theta, (140 * Math.PI) / 180) / 0.32, 1);
    return 0.55 * wedges * step(0.3, 0.42, rn) * step(1, 0.95, rn) * (0.6 + 0.4 * rn);
  });

  noteTexture(scene, HFX.note1, ctx => {
    ctx.beginPath();
    ctx.ellipse(3.7, 9.3, 2.25, 1.6, -0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(5.9, 9.0);
    ctx.lineTo(5.9, 1.8);
    ctx.stroke();
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(5.9, 1.8);
    ctx.bezierCurveTo(8.9, 2.6, 9.2, 5.2, 7.4, 7.0);
    ctx.stroke();
  });

  noteTexture(scene, HFX.note2, ctx => {
    ctx.beginPath();
    ctx.ellipse(2.6, 9.6, 1.9, 1.35, -0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(7.4, 8.4, 1.9, 1.35, -0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.moveTo(4.3, 9.3);
    ctx.lineTo(4.3, 2.6);
    ctx.moveTo(9.0, 8.1);
    ctx.lineTo(9.0, 1.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4.0, 2.4);
    ctx.lineTo(9.3, 1.2);
    ctx.lineTo(9.3, 2.6);
    ctx.lineTo(4.0, 3.8);
    ctx.closePath();
    ctx.fill();
  });
}
