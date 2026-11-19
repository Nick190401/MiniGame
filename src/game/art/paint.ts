/**
 * Small, dependency-free painting toolkit shared by every generated texture.
 * Everything is deterministic (seeded) so the world looks identical on every
 * load and on every device.
 */

export type Ctx = CanvasRenderingContext2D;

/** Mulberry32: tiny, fast and good enough for art placement. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable hash of two integers to [0, 1). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Value noise on an integer lattice that wraps every `period` cells. */
export function valueNoise(x: number, y: number, period: number, seed = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const wrap = (v: number) => ((v % period) + period) % period;
  const x0 = wrap(xi), x1 = wrap(xi + 1), y0 = wrap(yi), y1 = wrap(yi + 1);
  const a = hash2(x0, y0, seed), b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed), d = hash2(x1, y1, seed);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Tileable fractal noise in [0, 1]; `x`, `y` are in [0, 1). */
export function fbm(x: number, y: number, basePeriod: number, octaves: number, seed = 0, gain = 0.5): number {
  let sum = 0, amp = 0.5, norm = 0, period = basePeriod;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * period, y * period, period, seed + o * 101) * amp;
    norm += amp;
    amp *= gain;
    period *= 2;
  }
  return sum / norm;
}

export function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  const ctx = canvas.getContext('2d', { willReadFrequently: false })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

export interface RGB { r: number; g: number; b: number }

export function hex(color: number): RGB {
  return { r: (color >> 16) & 255, g: (color >> 8) & 255, b: color & 255 };
}

export function rgba(color: number | RGB, alpha = 1): string {
  const c = typeof color === 'number' ? hex(color) : color;
  return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${alpha})`;
}

export function mix(a: number, b: number, t: number): number {
  const x = hex(a), y = hex(b);
  const r = Math.round(x.r + (y.r - x.r) * t);
  const g = Math.round(x.g + (y.g - x.g) * t);
  const bl = Math.round(x.b + (y.b - x.b) * t);
  return (r << 16) | (g << 8) | bl;
}

/** Multiplies toward black (amount < 0) or blends toward white (amount > 0). */
export function shade(color: number, amount: number): number {
  return amount >= 0 ? mix(color, 0xffffff, amount) : mix(color, 0x000000, -amount);
}

/** Linear gradient shorthand: stops are [offset, color, alpha?]. */
export function linear(
  ctx: Ctx, x0: number, y0: number, x1: number, y1: number,
  stops: Array<[number, number, number?]>,
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c, a]) => g.addColorStop(o, rgba(c, a ?? 1)));
  return g;
}

export function radial(
  ctx: Ctx, x: number, y: number, r0: number, r1: number,
  stops: Array<[number, number, number?]>, fx = x, fy = y,
): CanvasGradient {
  const g = ctx.createRadialGradient(fx, fy, r0, x, y, r1);
  stops.forEach(([o, c, a]) => g.addColorStop(o, rgba(c, a ?? 1)));
  return g;
}

/** Soft elliptical blob, used for shadows, glows and ambient occlusion. */
export function softEllipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: number, alpha: number, hardness = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = radial(ctx, 0, 0, rx * hardness, rx, [[0, color, alpha], [1, color, 0]]);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Draws `draw` at every wrapped offset that can touch a tile of size w x h. */
export function wrapDraw(w: number, h: number, x: number, y: number, margin: number, draw: (x: number, y: number) => void): void {
  for (const dx of [-w, 0, w]) {
    if (x + dx < -margin || x + dx > w + margin) continue;
    for (const dy of [-h, 0, h]) {
      if (y + dy < -margin || y + dy > h + margin) continue;
      draw(x + dx, y + dy);
    }
  }
}

/** Rounded rectangle path (no stroke/fill). */
export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[]): void {
  const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

/** Closed smooth path through points (Catmull-Rom converted to cubic Béziers). */
export function smoothPath(ctx: Ctx, pts: Array<[number, number]>, closed = true, tension = 0.5): void {
  const n = pts.length;
  if (n < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  const count = closed ? n : n - 1;
  for (let i = 0; i < count; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const q0 = closed || i > 0 ? p0 : p1;
    const q3 = closed || i + 2 < n ? p3 : p2;
    const t = tension / 3;
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - q0[0]) * t, p1[1] + (p2[1] - q0[1]) * t,
      p2[0] - (q3[0] - p1[0]) * t, p2[1] - (q3[1] - p1[1]) * t,
      p2[0], p2[1],
    );
  }
  if (closed) ctx.closePath();
}

/** Irregular organic blob outline around a centre (leaf clusters, rocks, bushes). */
export function blobPoints(cx: number, cy: number, rx: number, ry: number, count: number, jitter: number, rand: () => number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const phase = rand() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2;
    const k = 1 + (rand() - 0.5) * 2 * jitter;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}

/**
 * Adds fine grain to whatever is already drawn on the canvas, preserving alpha.
 * `amount` is the max per-channel offset (0-255 scale).
 */
export function grain(ctx: Ctx, width: number, height: number, amount: number, seed: number): void {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const rand = rng(seed);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const n = (rand() - 0.5) * 2 * amount;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  ctx.putImageData(image, 0, 0);
}
