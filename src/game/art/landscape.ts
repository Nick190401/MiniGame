import { blobPoints, fbm, linear, mix, radial, rgba, rng, shade, smoothPath, type Ctx } from './paint';

/*
 * Painterly landscape layers for battle arenas and the title key art. Distant
 * layers are lighter and bluer (atmospheric perspective); near layers carry
 * the most contrast and detail.
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

/** Soft crepuscular rays from a light source. */
export function lightRays(ctx: Ctx, x: number, y: number, length: number, color: number, count: number, seed: number, alpha = 0.12): void {
  const rand = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const a = Math.PI * (0.25 + rand() * 0.5);
    const spread = 0.03 + rand() * 0.05;
    ctx.fillStyle = linear(ctx, x, y, x + Math.cos(a) * length, y + Math.sin(a) * length, [[0, color, alpha * (0.6 + rand() * 0.6)], [1, color, 0]]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a - spread) * length, y + Math.sin(a - spread) * length);
    ctx.lineTo(x + Math.cos(a + spread) * length, y + Math.sin(a + spread) * length);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Ground plane with grass strokes that grow toward the viewer. */
export function meadowGround(ctx: Ctx, w: number, horizon: number, h: number, far: number, near: number, seed: number, strokes = 5200): void {
  ctx.fillStyle = linear(ctx, 0, horizon, 0, h, [[0, far], [1, near]]);
  ctx.fillRect(0, horizon, w, h - horizon);
  const rand = rng(seed);
  // Patches of light and shade across the field.
  for (let i = 0; i < 60; i++) {
    const t = Math.pow(rand(), 0.7);
    const py = horizon + t * (h - horizon);
    const px = rand() * w;
    const r = (20 + t * 160) * (0.6 + rand());
    ctx.fillStyle = radial(ctx, px, py, 0, r, [[0, rand() < 0.5 ? shade(mix(far, near, t), 0.12) : shade(mix(far, near, t), -0.14), 0.4], [1, near, 0]]);
    ctx.save(); ctx.translate(px, py); ctx.scale(1, 0.32); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.restore(); ctx.fill();
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < strokes; i++) {
    const t = Math.pow(rand(), 0.85);
    const y = horizon + t * (h - horizon);
    const x = rand() * w;
    const len = 2 + t * 22 * (0.5 + rand());
    const base = mix(far, near, t);
    ctx.strokeStyle = rgba(rand() < 0.5 ? shade(base, 0.2 + rand() * 0.15) : shade(base, -0.25), 0.35 + t * 0.4);
    ctx.lineWidth = 0.6 + t * 2.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (rand() - 0.5) * len * 0.5, y - len * 0.6, x + (rand() - 0.5) * len * 0.6, y - len);
    ctx.stroke();
  }
}

/** A worn earthen battle circle in perspective. */
export function arenaPlatform(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, earth: number, rings: number, seed: number): void {
  const rand = rng(seed);
  // Trampled grass halo.
  ctx.fillStyle = radial(ctx, 0, 0, 0, 1, [[0, 0x000000, 0]]);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = radial(ctx, 0, 0, rx * 0.8, rx * 1.25, [[0, shade(earth, -0.35), 0.5], [1, shade(earth, -0.35), 0]]);
  ctx.beginPath(); ctx.arc(0, 0, rx * 1.25, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = radial(ctx, -rx * 0.2, -rx * 0.25, rx * 0.1, rx, [[0, shade(earth, 0.14)], [0.75, earth], [1, shade(earth, -0.2)]]);
  ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
  // Footprint scuffs and pebbles.
  for (let i = 0; i < 140; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * rx * 0.92;
    ctx.fillStyle = rgba(rand() < 0.5 ? shade(earth, -0.2) : shade(earth, 0.18), 0.35);
    ctx.beginPath(); ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, 1 + rand() * 4, 0.6 + rand() * 2, rand() * Math.PI, 0, Math.PI * 2); ctx.fill();
  }
  // Carved resonance rings.
  for (let i = 1; i <= rings; i++) {
    ctx.strokeStyle = rgba(shade(earth, -0.28), 0.5);
    ctx.lineWidth = rx * 0.012;
    ctx.beginPath(); ctx.arc(0, 0, rx * (i / (rings + 1)), 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = rgba(shade(earth, 0.25), 0.25);
    ctx.lineWidth = rx * 0.006;
    ctx.beginPath(); ctx.arc(0, rx * 0.008, rx * (i / (rings + 1)), 0, Math.PI * 2); ctx.stroke();
  }
  // Grass creeping over the rim.
  ctx.lineCap = 'round';
  for (let i = 0; i < 220; i++) {
    const a = rand() * Math.PI * 2;
    const d = rx * (0.96 + rand() * 0.1);
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    ctx.strokeStyle = rgba(rand() < 0.5 ? 0x4f7a32 : 0x6e9a44, 0.85);
    ctx.lineWidth = rx * 0.012;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rand() - 0.5) * rx * 0.04, y - rx * (0.04 + rand() * 0.06)); ctx.stroke();
  }
  ctx.restore();
}

/** Leafy foreground framing (ferns and broad leaves) along the bottom corners. */
export function foregroundFoliage(ctx: Ctx, w: number, h: number, color: number, seed: number): void {
  const rand = rng(seed);
  const frond = (x: number, y: number, len: number, angle: number, tone: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = rgba(shade(tone, -0.2));
    ctx.lineWidth = len * 0.02;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.1, -len * 0.5, len * 0.05, -len); ctx.stroke();
    for (let k = 1; k < 14; k++) {
      const t = k / 14;
      const px = len * 0.1 * Math.sin(t * Math.PI) * 0.8, py = -len * t;
      const leaf = len * 0.24 * (1 - t * 0.7);
      for (const side of [-1, 1]) {
        ctx.fillStyle = linear(ctx, px, py, px + side * leaf, py - leaf * 0.4, [[0, shade(tone, -0.15)], [1, shade(tone, 0.25)]]);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + side * leaf * 0.6, py - leaf * 0.5, px + side * leaf, py - leaf * 0.25);
        ctx.quadraticCurveTo(px + side * leaf * 0.5, py + leaf * 0.05, px, py + leaf * 0.12);
        ctx.fill();
      }
    }
    ctx.restore();
  };
  for (let i = 0; i < 9; i++) {
    frond(rand() * w * 0.18, h + 10, h * (0.22 + rand() * 0.16), -0.7 + rand() * 0.9, shade(color, (rand() - 0.5) * 0.3));
    frond(w - rand() * w * 0.18, h + 10, h * (0.22 + rand() * 0.16), -0.2 + rand() * 0.9, shade(color, (rand() - 0.5) * 0.3));
  }
}

/** Mossy standing stone with a softly glowing glyph. */
export function standingStone(ctx: Ctx, x: number, base: number, width: number, height: number, glow: number, seed: number): void {
  ctx.fillStyle = radial(ctx, x, base, 0, width, [[0, 0x000000, 0.45], [1, 0x000000, 0]]);
  ctx.save(); ctx.translate(x, base); ctx.scale(1, 0.25); ctx.beginPath(); ctx.arc(0, 0, width, 0, Math.PI * 2); ctx.restore(); ctx.fill();
  const pts: Array<[number, number]> = [
    [x - width * 0.5, base], [x - width * 0.52, base - height * 0.6], [x - width * 0.32, base - height * 0.95],
    [x + width * 0.1, base - height], [x + width * 0.42, base - height * 0.82], [x + width * 0.5, base],
  ];
  ctx.fillStyle = linear(ctx, x - width / 2, 0, x + width / 2, 0, [[0, 0xa6a89a], [0.45, 0x7d8075], [1, 0x45473f]]);
  smoothPath(ctx, pts, true, 0.35);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = rgba(0x56713a, 0.55);
  ctx.beginPath(); ctx.ellipse(x - width * 0.1, base - height * 0.92, width * 0.4, height * 0.12, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = rgba(glow, 0.35);
  ctx.lineWidth = width * 0.12;
  const glyph = () => {
    ctx.beginPath();
    ctx.moveTo(x - width * 0.12, base - height * 0.66); ctx.lineTo(x + width * 0.08, base - height * 0.56);
    ctx.lineTo(x - width * 0.1, base - height * 0.44); ctx.lineTo(x + width * 0.1, base - height * 0.32);
  };
  glyph(); ctx.stroke();
  ctx.strokeStyle = rgba(shade(glow, 0.4), 0.95);
  ctx.lineWidth = width * 0.035;
  glyph(); ctx.stroke();
}
