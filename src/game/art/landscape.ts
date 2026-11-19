import { blobPoints, fbm, linear, mix, radial, rgba, rng, shade, smoothPath, type Ctx } from './paint';

/*
 * Painterly landscape layers for the title key art. Distant layers are lighter
 * and bluer (atmospheric perspective); near layers carry the most contrast and
 * detail.
 */

export function sky(ctx: Ctx, w: number, h: number, stops: Array<[number, number]>): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  stops.forEach(([o, c]) => g.addColorStop(o, rgba(c)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Soft cumulus built from overlapping lit puffs. */
export function clouds(ctx: Ctx, w: number, y0: number, y1: number, light: number, dark: number, count: number, seed: number, alpha = 1): void {
  const rand = rng(seed);
  for (let i = 0; i < count; i++) {
    const cx = rand() * w, cy = y0 + rand() * (y1 - y0);
    const size = (y1 - y0) * (0.25 + rand() * 0.5);
    for (let k = 0; k < 9; k++) {
      const px = cx + (rand() - 0.5) * size * 2.2, py = cy + (rand() - 0.5) * size * 0.5;
      const r = size * (0.35 + rand() * 0.45);
      ctx.fillStyle = radial(ctx, px, py, 0, r, [[0, mix(light, dark, 0.15 + (py - y0) / (y1 - y0) * 0.5), alpha * 0.55], [0.6, mix(light, dark, 0.45), alpha * 0.28], [1, dark, 0]], px - r * 0.3, py - r * 0.45);
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    }
  }
}

/** A ridge line (mountains, hills) from fractal noise, filled down to the bottom. */
export function ridge(
  ctx: Ctx, w: number, h: number, base: number, amplitude: number, top: number, bottom: number,
  seed: number, period = 3, haze?: { color: number; alpha: number },
): void {
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) {
    const n = fbm(x / w, seed * 0.137, period, 5, seed);
    const sharp = Math.pow(n, 1.6);
    ctx.lineTo(x, base - sharp * amplitude);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 0, base - amplitude, 0, base + (h - base) * 0.4, [[0, top], [1, bottom]]);
  ctx.fill();
  if (haze) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = linear(ctx, 0, base - amplitude * 0.3, 0, base + 40, [[0, haze.color, 0], [1, haze.color, haze.alpha]]);
    ctx.fillRect(0, base - amplitude, w, h);
    ctx.restore();
  }
}

/** Forest silhouette: rounded crowns (broadleaf) or spires (conifer). */
export function treeLine(
  ctx: Ctx, w: number, base: number, height: number, color: number, lit: number, seed: number,
  kind: 'broadleaf' | 'conifer' | 'mixed' = 'mixed', density = 1,
): void {
  const rand = rng(seed);
  const crowns: Array<{ x: number; y: number; r: number; conifer: boolean }> = [];
  for (let x = -40; x < w + 40; x += (height * 0.32) / density) {
    const conifer = kind === 'conifer' || (kind === 'mixed' && rand() < 0.4);
    const th = height * (0.6 + rand() * 0.5);
    crowns.push({ x: x + (rand() - 0.5) * height * 0.2, y: base - th, r: th * (conifer ? 0.22 : 0.34), conifer });
  }
  ctx.fillStyle = rgba(color);
  ctx.fillRect(0, base - height * 0.15, w, height * 0.4);
  crowns.forEach(({ x, y, r, conifer }) => {
    if (conifer) {
      ctx.fillStyle = linear(ctx, x - r, 0, x + r, 0, [[0, mix(color, lit, 0.5)], [0.5, color], [1, shade(color, -0.25)]]);
      ctx.beginPath();
      ctx.moveTo(x, y - r * 1.2);
      for (let k = 0; k < 6; k++) {
        const t = k / 5;
        ctx.lineTo(x + r * (0.3 + t * 0.7), y + t * (base - y));
        ctx.lineTo(x + r * (0.15 + t * 0.55), y + t * (base - y) - 2);
      }
      ctx.lineTo(x + r, base);
      ctx.lineTo(x - r, base);
      for (let k = 5; k >= 0; k--) {
        const t = k / 5;
        ctx.lineTo(x - r * (0.15 + t * 0.55), y + t * (base - y) - 2);
        ctx.lineTo(x - r * (0.3 + t * 0.7), y + t * (base - y));
      }
      ctx.closePath();
      ctx.fill();
    } else {
      const pts = blobPoints(x, y + r * 0.6, r * 1.15, r, 11, 0.16, rand);
      ctx.fillStyle = radial(ctx, x, y + r * 0.6, r * 0.1, r * 1.3, [[0, mix(color, lit, 0.55)], [0.55, color], [1, shade(color, -0.2)]], x - r * 0.45, y + r * 0.1);
      smoothPath(ctx, pts);
      ctx.fill();
      ctx.fillRect(x - r * 0.9, y + r * 0.6, r * 1.8, base - y);
    }
  });
}

/** Horizontal mist band. */
export function mist(ctx: Ctx, w: number, y: number, height: number, color: number, alpha: number): void {
  ctx.fillStyle = linear(ctx, 0, y - height / 2, 0, y + height / 2, [[0, color, 0], [0.5, color, alpha], [1, color, 0]]);
  ctx.fillRect(0, y - height / 2, w, height);
}
