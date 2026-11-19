import { blobPoints, linear, makeCanvas, radial, rgba, rng, smoothPath, type Ctx } from './paint';
import { clouds, mist, ridge, sky, treeLine } from './landscape';
import { CHARACTER_FRAME } from '../assets/PlayerTextures';

/*
 * Title key art: the four heroes on a ridge above Echo Village, watching the
 * corrupted signal tear the sky in two — fire on the left, cold static on the
 * right. Painted once per screen orientation; no Phaser dependency so the
 * title screen stays light.
 */

const glow = (ctx: Ctx, x: number, y: number, r: number, color: number, alpha: number) => {
  ctx.fillStyle = radial(ctx, x, y, 0, r, [[0, color, alpha], [0.4, color, alpha * 0.45], [1, color, 0]]);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
};

function stormSky(ctx: Ctx, w: number, h: number, horizon: number): void {
  sky(ctx, w, horizon + h * 0.05, [[0, 0x07060f], [0.42, 0x1c1236], [0.78, 0x5a2a42], [1, 0xd8774a]]);
  // Fire on the left, cold signal on the right.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, w * 0.12, horizon * 0.55, w * 0.42, 0xff4a1a, 0.34);
  glow(ctx, w * 0.9, horizon * 0.45, w * 0.42, 0x1a9ad8, 0.3);
  glow(ctx, w * 0.5, horizon * 0.98, w * 0.32, 0xffb06a, 0.42);
  ctx.restore();
  // Storm banks.
  clouds(ctx, w * 0.55, horizon * 0.05, horizon * 0.62, 0xff9a5a, 0x2a0e12, 9, 3, 0.85);
  ctx.save();
  ctx.translate(w * 0.45, 0);
  clouds(ctx, w * 0.55, horizon * 0.05, horizon * 0.6, 0x7fd8ff, 0x0c1426, 9, 5, 0.8);
  ctx.restore();
  clouds(ctx, w, horizon * 0.6, horizon * 0.92, 0xffc08a, 0x3a1a26, 6, 9, 0.5);
}

/** Colossal shapes looming inside the storm: the Gatekeeper and the static. */
function looming(ctx: Ctx, w: number, h: number, horizon: number): void {
  const s = h / 1080;
  // Left: horned silhouette with ember eyes and a burning core.
  ctx.save();
  ctx.globalAlpha = 0.78;
  const gx = w * 0.19, gy = horizon * 0.52;
  ctx.fillStyle = linear(ctx, gx - 260 * s, gy - 300 * s, gx + 260 * s, gy + 300 * s, [[0, 0x2a0c0e], [1, 0x0e0406]]);
  ctx.beginPath();
  ctx.moveTo(gx - 330 * s, gy + 360 * s);
  ctx.quadraticCurveTo(gx - 300 * s, gy - 40 * s, gx - 150 * s, gy - 120 * s);
  ctx.quadraticCurveTo(gx - 260 * s, gy - 260 * s, gx - 220 * s, gy - 380 * s);
  ctx.quadraticCurveTo(gx - 150 * s, gy - 260 * s, gx - 70 * s, gy - 200 * s);
  ctx.lineTo(gx, gy - 250 * s);
  ctx.lineTo(gx + 70 * s, gy - 200 * s);
  ctx.quadraticCurveTo(gx + 150 * s, gy - 260 * s, gx + 220 * s, gy - 380 * s);
  ctx.quadraticCurveTo(gx + 260 * s, gy - 260 * s, gx + 150 * s, gy - 120 * s);
  ctx.quadraticCurveTo(gx + 300 * s, gy - 40 * s, gx + 330 * s, gy + 360 * s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const side of [-1, 1]) glow(ctx, gx + side * 46 * s, gy - 150 * s, 40 * s, 0xff6a2a, 0.9);
  glow(ctx, gx, gy - 20 * s, 110 * s, 0xff3a1a, 0.55);
  ctx.restore();
  // Right: a storm of static with a cold eye and waveform scars.
  const sx = w * 0.82, sy = horizon * 0.45;
  ctx.save();
  ctx.globalAlpha = 0.72;
  const rand = rng(17);
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * 300 * s;
    const r = (40 + rand() * 80) * s;
    ctx.fillStyle = radial(ctx, sx + Math.cos(a) * d, sy + Math.sin(a) * d * 0.8, 0, r, [[0, 0x0a1428, 0.8], [1, 0x0a1428, 0]]);
    ctx.beginPath(); ctx.arc(sx + Math.cos(a) * d, sy + Math.sin(a) * d * 0.8, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const side of [-1, 1]) glow(ctx, sx + side * 60 * s, sy - 40 * s, 44 * s, 0x6ff0ff, 0.95);
  ctx.lineCap = 'round';
  [[0x9dff4a, -120], [0x3fe0ff, 0], [0xff4fd0, 110]].forEach(([color, dy], k) => {
    const r2 = rng(40 + k);
    for (const [width, alpha] of [[16, 0.08], [7, 0.2], [2.4, 0.9]]) {
      ctx.strokeStyle = rgba(color, alpha);
      ctx.lineWidth = width * s;
      ctx.beginPath();
      for (let x = -360; x <= 360; x += 12) {
        const env = Math.cos((x / 360) * Math.PI / 2);
        const y = sy + dy * s + (Math.sin(x * 0.05) * 50 + (r2() - 0.5) * 40) * env * s;
        if (x === -360) ctx.moveTo(sx + x * s, y); else ctx.lineTo(sx + x * s, y);
      }
      ctx.stroke();
    }
  });
  ctx.restore();
}

function valley(ctx: Ctx, w: number, h: number, horizon: number): void {
  ridge(ctx, w, h, horizon - h * 0.02, h * 0.16, 0x3a2a4a, 0x2a2238, 11, 2.6, { color: 0xd88a6a, alpha: 0.45 });
  ridge(ctx, w, h, horizon + h * 0.03, h * 0.1, 0x2a2a3e, 0x20202e, 13, 3.6, { color: 0xc8805e, alpha: 0.35 });
  mist(ctx, w, horizon + h * 0.05, h * 0.08, 0xf0a07a, 0.35);
  // Valley floor with a winding river catching the sunset.
  const floorTop = horizon + h * 0.06;
  ctx.fillStyle = linear(ctx, 0, floorTop, 0, h, [[0, 0x2a3a34], [1, 0x14201a]]);
  ctx.fillRect(0, floorTop, w, h - floorTop);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = linear(ctx, 0, floorTop, 0, h * 0.85, [[0, 0xffc08a, 0.85], [1, 0x6ab8d8, 0.35]]);
  ctx.lineCap = 'round';
  for (const [width, alpha] of [[26, 0.25], [12, 0.6], [4, 1]] as Array<[number, number]>) {
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width * (h / 1080);
    ctx.beginPath();
    ctx.moveTo(w * 0.5, floorTop + 4);
    ctx.bezierCurveTo(w * 0.42, floorTop + h * 0.08, w * 0.62, floorTop + h * 0.12, w * 0.5, floorTop + h * 0.2);
    ctx.bezierCurveTo(w * 0.38, floorTop + h * 0.27, w * 0.46, h * 0.86, w * 0.4, h * 0.95);
    ctx.stroke();
  }
  ctx.restore();
  treeLine(ctx, w, floorTop + h * 0.03, h * 0.05, 0x1c2c26, 0x4a6a4a, 21, 'mixed', 1.4);
  // Echo Village lights.
  const rand = rng(29);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 40; i++) {
    const x = w * (0.32 + rand() * 0.36), y = floorTop + h * (0.04 + rand() * 0.08);
    glow(ctx, x, y, (3 + rand() * 6) * (h / 1080), 0xffc070, 0.9);
  }
  ctx.restore();
  treeLine(ctx, w, floorTop + h * 0.16, h * 0.09, 0x142019, 0x34503a, 33, 'conifer', 1.1);
}

/** The heroes (their painted back views), rim-lit by the burning sky. */
function heroes(ctx: Ctx, w: number, h: number, ground: number, figureHeight: number, figures: CanvasImageSource[], spacing: number): void {
  const s = figureHeight / CHARACTER_FRAME.figure;
  figures.forEach((image, i) => {
    const x = w / 2 + (i - (figures.length - 1) / 2) * spacing;
    const pad = 40;
    const cw = Math.ceil(CHARACTER_FRAME.w * s + pad * 2), ch = Math.ceil(CHARACTER_FRAME.h * s + pad * 2);
    const footX = pad + CHARACTER_FRAME.footX * s, footY = pad + CHARACTER_FRAME.footY * s;
    const { canvas: fig, ctx: f } = makeCanvas(cw, ch);
    f.drawImage(image, pad, pad, CHARACTER_FRAME.w * s, CHARACTER_FRAME.h * s);
    // Backlit: pull the figure into shadow, keep a hint of its colours.
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.globalCompositeOperation = 'source-atop';
    f.fillStyle = linear(f, 0, 0, 0, ch, [[0, 0x1a1020, 0.6], [1, 0x07060c, 0.82]]);
    f.fillRect(0, 0, cw, ch);
    // Rim silhouette for the warm (left) and cold (right) edges.
    const rim = (color: number) => {
      const { canvas: r, ctx: rc } = makeCanvas(cw, ch);
      rc.drawImage(fig, 0, 0);
      rc.globalCompositeOperation = 'source-in';
      rc.fillStyle = rgba(color);
      rc.fillRect(0, 0, cw, ch);
      return r;
    };
    const warm = rim(0xffa060), cool = rim(0x7fd8ff);
    ctx.save();
    ctx.translate(x - footX, ground - footY);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(warm, -2.4 * (h / 1080), -1.6 * (h / 1080));
    ctx.globalAlpha = 0.6;
    ctx.drawImage(cool, 2.2 * (h / 1080), -1.2 * (h / 1080));
    ctx.globalAlpha = 1;
    ctx.drawImage(fig, 0, 0);
    ctx.restore();
  });
}

function cliff(ctx: Ctx, w: number, h: number, top: number): void {
  const rand = rng(51);
  ctx.fillStyle = linear(ctx, 0, top, 0, h, [[0, 0x1c1a20], [1, 0x07070a]]);
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, top + h * 0.05);
  for (let x = 0; x <= w; x += w / 24) ctx.lineTo(x, top + Math.sin(x / w * Math.PI) * -h * 0.02 + (rand() - 0.5) * h * 0.015);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  // Rim light along the ledge and silhouetted grass.
  ctx.strokeStyle = 'rgba(255,170,110,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 6) {
    const y = top + Math.sin(x / w * Math.PI) * -h * 0.02;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const x = rand() * w;
    const y = top + Math.sin(x / w * Math.PI) * -h * 0.02 + 2;
    const len = (6 + rand() * 22) * (h / 1080);
    ctx.strokeStyle = rgba(rand() < 0.5 ? 0x14160f : 0x22261a, 0.95);
    ctx.lineWidth = 1.2 + rand() * 1.4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (rand() - 0.5) * len * 0.6, y - len * 0.5, x + (rand() - 0.5) * len, y - len); ctx.stroke();
  }
  // A few boulders at the edges.
  for (const [bx, r] of [[w * 0.06, h * 0.07], [w * 0.95, h * 0.09], [w * 0.88, h * 0.05]]) {
    ctx.fillStyle = linear(ctx, bx - r, top - r, bx + r, top + r, [[0, 0x3a3440], [1, 0x0c0b0e]]);
    smoothPath(ctx, blobPoints(bx, top + r * 0.2, r, r * 0.7, 10, 0.18, rand)); ctx.fill();
  }
}

export interface KeyArtOptions {
  width: number;
  height: number;
  /** Back views of the heroes, left to right; omitted until they have loaded. */
  figures?: CanvasImageSource[];
}

/** Paints the key art for the given pixel size (landscape or portrait). */
export function paintKeyArt({ width, height, figures = [] }: KeyArtOptions): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(width, height);
  const portrait = height > width * 1.05;
  const horizon = height * (portrait ? 0.5 : 0.55);
  stormSky(ctx, width, height, horizon);
  looming(ctx, width, height, horizon);
  valley(ctx, width, height, horizon);
  const ground = height * (portrait ? 0.86 : 0.9);
  cliff(ctx, width, height, ground);
  heroes(ctx, width, height, ground + height * 0.006, height * (portrait ? 0.24 : 0.31), figures, width * (portrait ? 0.2 : 0.085));
  // Embers drifting up from the valley.
  const rand = rng(61);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++) glow(ctx, rand() * width, horizon + rand() * height * 0.4, (1.5 + rand() * 3.5) * (height / 1080), rand() < 0.75 ? 0xff9a4a : 0x7fe8ff, 0.8);
  ctx.restore();
  // Cinematic grade: darker top for the logo, soft vignette.
  ctx.fillStyle = linear(ctx, 0, 0, 0, height * 0.35, [[0, 0x050308, 0.55], [1, 0x050308, 0]]);
  ctx.fillRect(0, 0, width, height * 0.35);
  ctx.fillStyle = radial(ctx, width / 2, height * 0.55, height * 0.35, Math.max(width, height) * 0.75, [[0, 0x000000, 0], [1, 0x000000, 0.6]]);
  ctx.fillRect(0, 0, width, height);
  return canvas;
}
