import { rng, valueNoise } from './paint';
import { LitSprite, rgb, type RGB, type SurfaceOptions } from './litSprite';

/**
 * Trees, bushes and rocks modelled as lit volumes (see LitSprite). Crowns are
 * built like real foliage: a shaded inner mass, big clumps on the front of
 * the crown, and many small leaf clusters on every clump, so the canopy has
 * a sunlit side, a shaded side, deep gaps and a broken, leafy outline.
 * Sizes are world units; `density` is texture pixels per unit.
 */

const NOISE_PERIOD = 4096;
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

interface LeafPalette { deep: RGB; base: RGB; sun: RGB; young: RGB }

/** Oak, beech, linden and field maple: muted, naturally varied greens. */
const BROADLEAF_PALETTES: LeafPalette[] = [
  { deep: rgb(0x15230e), base: rgb(0x3a5824), sun: rgb(0x7d9b46), young: rgb(0x9fb058) },
  { deep: rgb(0x18270f), base: rgb(0x42612a), sun: rgb(0x89a44f), young: rgb(0xa9b860) },
  { deep: rgb(0x112216), base: rgb(0x325337), sun: rgb(0x6c935c), young: rgb(0x8ea964) },
  { deep: rgb(0x1d2810), base: rgb(0x4a6126), sun: rgb(0x919f4a), young: rgb(0xb2ae58) },
];

/** Relief and colour of individual leaves on a cluster of the given size. */
function leaves(seed: number, size: number): Pick<SurfaceOptions, 'bump' | 'tint'> {
  const f = 1.6 / size, g = 4.2 / size;
  return {
    bump: (x, y) =>
      (valueNoise(x * f, y * f, NOISE_PERIOD, seed) - 0.5) * size * 0.32
      + (valueNoise(x * g, y * g, NOISE_PERIOD, seed + 7) - 0.5) * size * 0.14,
    tint: (x, y) => 0.78 + 0.42 * valueNoise(x * g * 0.9, y * g * 0.9, NOISE_PERIOD, seed + 19),
  };
}

function bark(seed: number): Pick<SurfaceOptions, 'bump' | 'tint'> {
  return {
    bump: (x, y) => (valueNoise(x * 2.6, y * 0.42, NOISE_PERIOD, seed) - 0.5) * 0.65,
    tint: (x, y) => {
      const n = valueNoise(x * 3.2, y * 0.55, NOISE_PERIOD, seed + 3);
      // Dark vertical fissures between bark plates.
      return Math.abs(n - 0.5) < 0.06 ? 0.45 : 0.72 + n * 0.5;
    },
  };
}

interface CrownSpec {
  cx: number; cy: number; rx: number; ry: number;
  /** Bulge of the crown towards the viewer, in units. */
  depth: number;
  z0: number;
  clumps: number;
  leafSize: number;
  translucency: number;
}

function leafyCrown(s: LitSprite, spec: CrownSpec, palette: LeafPalette, seed: number): void {
  const { cx, cy, rx, ry, depth, z0, leafSize, translucency } = spec;
  const rand = rng(seed);
  // Inner mass in deep shade, kept well inside the clumps.
  s.ellipsoid(cx, cy + ry * 0.05, rx * 0.66, ry * 0.64, z0, depth * 0.45, palette.deep, { ...leaves(seed, leafSize * 2), translucency: 0.05 });

  // Big clumps covering the front of the crown: they carry the overall form.
  const clumps: Array<{ x: number; y: number; r: number; z: number; sunny: number }> = [];
  for (let k = 0; k < spec.clumps; k++) {
    const a = (k / spec.clumps) * Math.PI * 2 * 2.618 + rand() * 0.6;
    const rr = Math.sqrt((k + 0.5) / spec.clumps) * 0.86;
    const x = cx + Math.cos(a) * rr * rx * 0.82;
    const y = cy + Math.sin(a) * rr * ry * 0.82;
    const env = Math.sqrt(Math.max(0, 1 - rr * rr));
    const r = rx * (0.27 + rand() * 0.1) * (1 - rr * 0.25);
    // Towards the upper left the leaves face the sun and bleach slightly.
    const sunny = Math.max(0, 0.45 - (Math.cos(a) * 0.55 + Math.sin(a) * 0.75) * rr * 0.55);
    clumps.push({ x, y, r, z: z0 + depth * env * 0.85 - r * 0.2, sunny });
  }

  // Each clump is a dome of individual leaves.
  const leafRelief = leaves(seed + 3, leafSize * 0.8);
  clumps.forEach((c, k) => {
    const body = mixRGB(palette.deep, palette.base, 0.3 + rand() * 0.2);
    s.ellipsoid(c.x, c.y, c.r, c.r * 0.88, c.z - c.r * 0.35, c.r * 0.6, body, { ...leaves(seed + k, leafSize * 1.4), translucency: translucency * 0.4 });
    const count = Math.round((c.r * c.r) / (leafSize * leafSize) * 2.2);
    for (let j = 0; j < count; j++) {
      const b = rand() * Math.PI * 2;
      const q = Math.sqrt(rand()) * 1.02;
      const lx = c.x + Math.cos(b) * q * c.r;
      const ly = c.y + Math.sin(b) * q * c.r * 0.88;
      const e = Math.sqrt(Math.max(0, 1 - Math.min(1, q) ** 2));
      const len = leafSize * (0.8 + rand() * 0.5);
      const facing = Math.max(0, 0.55 - (Math.cos(b) * 0.55 + Math.sin(b) * 0.75) * q * 0.7);
      let col = mixRGB(palette.deep, palette.base, 0.5 + rand() * 0.5);
      col = mixRGB(col, rand() < 0.15 ? palette.young : palette.sun, Math.min(0.5, (c.sunny * 0.7 + facing * 0.5) * (0.35 + rand() * 0.65)));
      s.ellipsoid(lx, ly, len, len * (0.42 + rand() * 0.18), c.z - c.r * 0.35 + c.r * 0.6 * e + len * 0.2, len * 0.45, col,
        { ...leafRelief, translucency, specular: 0.1 }, rand() * Math.PI);
    }
  });

  // Leaves along the rim break up the outline without floating free.
  const rim = Math.round(rx * 2.2);
  for (let m = 0; m < rim; m++) {
    const a = rand() * Math.PI * 2;
    const rr = 0.8 + rand() * 0.1;
    const x = cx + Math.cos(a) * rr * rx * 0.98, y = cy + Math.sin(a) * rr * ry * 0.96;
    const len = leafSize * (0.7 + rand() * 0.5);
    const col = mixRGB(mixRGB(palette.deep, palette.base, 0.6 + rand() * 0.4), palette.sun, Math.max(0, -Math.cos(a) * 0.35 - Math.sin(a) * 0.45) * 0.6);
    s.ellipsoid(x, y, len, len * 0.5, z0 + depth * 0.3, len * 0.45, col, { ...leafRelief, translucency: translucency * 1.15, specular: 0.08 }, a + (rand() - 0.5));
  }
}

export function renderBroadleaf(w: number, h: number, variant: number, density: number): HTMLCanvasElement {
  const s = new LitSprite(w, h, density);
  const rand = rng(300 + variant * 37);
  const palette = BROADLEAF_PALETTES[variant % BROADLEAF_PALETTES.length];
  const cx = w / 2, baseY = h - 2.6;
  const lean = (rand() - 0.5) * w * 0.07;
  const barkCol = rgb(0x4d3a2a), rootCol = rgb(0x3a2c20);
  const barkOpts = bark(variant * 11 + 5);
  for (const [dx, rx] of [[-w * 0.042, 1.9], [w * 0.046, 1.7], [w * 0.006, 1.5]] as Array<[number, number]>) {
    s.ellipsoid(cx + dx, baseY - 1, rx, 1.6, 0, 2.2, rootCol, barkOpts);
  }
  // Slightly bent, tapering trunk splitting into limbs under the crown.
  const midX = cx + lean * 0.4 + (rand() - 0.5) * 1.2, midY = h * 0.72;
  const topX = cx + lean, topY = h * 0.56;
  s.limb(cx, baseY, midX, midY, w * 0.047, w * 0.04, 0.5, barkCol, barkOpts);
  s.limb(midX, midY, topX, topY, w * 0.04, w * 0.032, 0.5, barkCol, barkOpts);
  for (let i = 0; i < 4; i++) {
    const side = i % 2 ? 1 : -1;
    const tx = topX + side * w * (0.1 + rand() * 0.18), ty = h * (0.3 + rand() * 0.14);
    s.limb(topX, topY + 1.5, tx, ty, w * 0.022, w * 0.01, 2 + i * 0.5, barkCol, barkOpts);
  }
  const rx = w * (0.46 - rand() * 0.03), ry = h * (0.33 - rand() * 0.02);
  leafyCrown(s, { cx: cx + lean * 0.7, cy: h * 0.38, rx, ry, depth: rx * 0.72, z0: 6, clumps: 16, leafSize: 1.7, translucency: 0.6 },
    palette, 900 + variant * 53);
  return s.render({ wrap: 0.22, occlusion: 1.35, selfShadow: 0.92, formRadius: 7, formWeight: 0.72, shadowReach: 24, sky: [0.26, 0.33, 0.42] });
}

export function renderConifer(w: number, h: number, variant: number, density: number): HTMLCanvasElement {
  const s = new LitSprite(w, h, density);
  const rand = rng(500 + variant * 41);
  const cx = w / 2, baseY = h - 2.6;
  const deep = rgb(variant % 2 ? 0x0b1b11 : 0x0a1810);
  const base = rgb(variant % 2 ? 0x223f2b : 0x1f3b29);
  const sun = rgb(variant % 2 ? 0x5e8a54 : 0x547f50);
  const tips = rgb(0x7f9e5c);
  s.ellipsoid(cx, baseY - 0.6, 2.8, 1.3, 0, 1.2, rgb(0x2f241a), bark(variant));
  s.limb(cx, baseY, cx, h * 0.6, w * 0.05, w * 0.032, 0.4, rgb(0x4a3626), bark(variant + 9));
  const needles = (seed: number): Pick<SurfaceOptions, 'bump' | 'tint'> => ({
    bump: (x, y) => (valueNoise(x * 3.4, y * 1.1, NOISE_PERIOD, seed) - 0.5) * 0.75,
    tint: (x, y) => 0.76 + 0.46 * valueNoise(x * 5, y * 1.6, NOISE_PERIOD, seed + 5),
  });
  // Dark core along the axis so gaps between branches read as depth.
  for (let k = 0; k <= 10; k++) {
    const t = k / 10;
    s.ellipsoid(cx, h * (0.08 + t * 0.66), 1.5 + t * w * 0.2, 2.5 + t * 2, 1, 3 + t * 3, deep, needles(40 + k));
  }
  // Drooping branches, tier by tier; each is a run of needle sprays from the axis to its tip.
  const tiers = 9;
  for (let t = 0; t < tiers; t++) {
    const k = t / (tiers - 1);
    const tierY = h * (0.06 + k * 0.68);
    const half = 1.8 + k * w * 0.45;
    const branches = 4 + Math.round(k * 7);
    for (let b = 0; b < branches; b++) {
      const u = ((b + 0.5) / branches) * 2 - 1 + (rand() - 0.5) * 0.12;
      const tipX = cx + u * half, tipY = tierY + 2 + Math.abs(u) * (2.5 + k * 3.5);
      const sprays = 2 + Math.round(Math.abs(u) * 3 + k * 2);
      for (let q = 0; q < sprays; q++) {
        const f = 0.35 + (q / Math.max(1, sprays - 1)) * 0.65;
        const x = cx + (tipX - cx) * f + (rand() - 0.5) * 0.8;
        const y = tierY + (tipY - tierY) * f * f + (rand() - 0.5) * 0.8;
        const r = (1.5 + k * 1.3) * (1.1 - f * 0.35);
        const lit = Math.max(0, 0.55 - u * 0.45 - (1 - k) * 0.05);
        let c = mixRGB(mixRGB(deep, base, 0.55 + rand() * 0.45), sun, lit * 0.5 * (0.5 + rand() * 0.5));
        if (f > 0.85 && rand() < 0.5) c = mixRGB(c, tips, 0.35);
        const z = 3 + (1 - Math.abs(u)) * (3 + k * 7) * (1 - f * 0.3) + (1 - k) * 1.5;
        s.ellipsoid(x, y, r * 1.35, r * 0.75, z, r * 0.8, c, { ...needles(700 + t * 31 + b * 7 + q), translucency: 0.28, specular: 0.05 }, Math.atan2(tipY - tierY, tipX - cx) * 0.8);
      }
    }
  }
  s.ellipsoid(cx, h * 0.035, 1.2, 2.6, 6, 1.4, base, needles(9));
  return s.render({ wrap: 0.3, occlusion: 1.3, selfShadow: 0.85, formRadius: 5, formWeight: 0.5, shadowReach: 16 });
}

export function renderBush(w: number, h: number, variant: number, density: number): HTMLCanvasElement {
  const s = new LitSprite(w, h, density);
  const rand = rng(1300 + variant * 29);
  const palette = BROADLEAF_PALETTES[(variant + 1) % BROADLEAF_PALETTES.length];
  leafyCrown(s, { cx: w / 2, cy: h * 0.56, rx: w * 0.45, ry: h * 0.39, depth: w * 0.3, z0: 0.5, clumps: 7, leafSize: 1.25, translucency: 0.5 },
    palette, 1400 + variant * 17);
  if (variant % 3 === 0) {
    // Berries with a wet sheen.
    for (let i = 0; i < 11; i++) {
      const x = w * (0.16 + rand() * 0.68), y = h * (0.22 + rand() * 0.52);
      s.ellipsoid(x, y, 0.62, 0.62, 7 + rand() * 2, 0.6, rgb(i % 3 ? 0xa8242c : 0xd9b23e), { specular: 0.55 });
    }
  }
  return s.render({ wrap: 0.32, occlusion: 1.25, selfShadow: 0.85, formRadius: 3, formWeight: 0.6, shadowReach: 9 });
}

export function renderRock(w: number, h: number, variant: number, density: number): HTMLCanvasElement {
  const s = new LitSprite(w, h, density);
  const rand = rng(1700 + variant * 23);
  const stone = rgb([0x6f6b62, 0x66635b, 0x77726a][variant % 3]);
  const moss = rgb(0x4a6129);
  const seed = 1800 + variant * 7;
  const surface: SurfaceOptions = {
    // Broken faces, ridges and fine grain.
    bump: (x, y) =>
      (valueNoise(x * 0.38, y * 0.38, NOISE_PERIOD, seed) - 0.5) * 1.3
      + (valueNoise(x * 1.1, y * 1.1, NOISE_PERIOD, seed + 4) - 0.5) * 0.35
      + (valueNoise(x * 3.6, y * 3.6, NOISE_PERIOD, seed + 1) - 0.5) * 0.16,
    tint: (x, y) => {
      const n = valueNoise(x * 1.4, y * 1.4, NOISE_PERIOD, seed + 2);
      return Math.abs(n - 0.5) < 0.025 ? 0.5 : 0.8 + 0.34 * n;
    },
    paint: (x, y, c) => {
      const top = Math.max(0, 1 - (y / h) * 1.7);
      const m = top * Math.max(0, valueNoise(x * 0.9, y * 0.9, NOISE_PERIOD, seed + 3) * 1.7 - 0.6);
      return mixRGB(c, moss, Math.min(0.8, m));
    },
    specular: 0.04,
  };
  const cy = h * 0.64;
  s.ellipsoid(w * (0.46 + rand() * 0.08), cy, w * 0.4, h * 0.35, 0, h * 0.55, stone, surface, (rand() - 0.5) * 0.5);
  s.ellipsoid(w * (0.26 + rand() * 0.1), cy + h * 0.12, w * 0.19, h * 0.19, 0, h * 0.3, mixRGB(stone, rgb(0x55534d), 0.4), surface, rand());
  if (variant !== 1) s.ellipsoid(w * (0.72 + rand() * 0.06), cy + h * 0.13, w * 0.15, h * 0.15, 0, h * 0.24, mixRGB(stone, rgb(0x8a857a), 0.3), surface);
  return s.render({ wrap: 0.08, occlusion: 1.4, selfShadow: 0.7, formRadius: 2, formWeight: 0.35, shadowReach: 6, sky: [0.34, 0.4, 0.5] });
}

/**
 * A weathered ledge stone: a broad, flat-topped boulder with bedding planes,
 * moss on its upper side and a darker, damp foot. Rows of them form the rock
 * ledges that terrace the meadows.
 */
export function renderLedgeStone(w: number, h: number, variant: number, density: number): HTMLCanvasElement {
  const s = new LitSprite(w, h, density);
  const rand = rng(2100 + variant * 31);
  const stone = rgb([0x77736a, 0x6c6961, 0x807a6e, 0x726f66][variant % 4]);
  const moss = rgb(0x4d6a2b);
  const seed = 2200 + variant * 13;
  const surface: SurfaceOptions = {
    bump: (x, y) => {
      // Bedding planes: soft horizontal steps, broken by cracks.
      const strata = Math.sin((y + valueNoise(x * 0.3, y * 0.3, NOISE_PERIOD, seed) * 3) * 1.6) * 0.25;
      return strata
        + (valueNoise(x * 0.42, y * 0.42, NOISE_PERIOD, seed + 1) - 0.5) * 1.4
        + (valueNoise(x * 3.2, y * 3.2, NOISE_PERIOD, seed + 2) - 0.5) * 0.2;
    },
    tint: (x, y) => {
      const n = valueNoise(x * 1.2, y * 1.2, NOISE_PERIOD, seed + 3);
      return Math.abs(n - 0.5) < 0.022 ? 0.48 : 0.8 + 0.32 * n;
    },
    paint: (x, y, c) => {
      const top = Math.max(0, 1 - (y / h) * 1.5);
      const m = top * Math.max(0, valueNoise(x * 0.7, y * 0.7, NOISE_PERIOD, seed + 4) * 1.8 - 0.55);
      const damp = Math.max(0, (y / h - 0.75) * 2.2) * 0.35;
      return mixRGB(mixRGB(c, rgb(0x3c3a34), damp), moss, Math.min(0.85, m));
    },
    specular: 0.04,
  };
  const cy = h * 0.6;
  s.ellipsoid(w * (0.48 + rand() * 0.06), cy, w * 0.46, h * 0.4, 0, h * 0.5, stone, surface, (rand() - 0.5) * 0.2);
  s.ellipsoid(w * (0.24 + rand() * 0.08), cy + h * 0.1, w * 0.22, h * 0.24, 0, h * 0.34, mixRGB(stone, rgb(0x5a5750), 0.35), surface, rand() - 0.5);
  s.ellipsoid(w * (0.74 + rand() * 0.08), cy + h * 0.12, w * 0.2, h * 0.22, 0, h * 0.3, mixRGB(stone, rgb(0x8e897d), 0.25), surface, rand() - 0.5);
  if (variant % 2) s.ellipsoid(w * 0.5, cy + h * 0.22, w * 0.16, h * 0.13, 0, h * 0.18, mixRGB(stone, rgb(0x56534c), 0.4), surface);
  return s.render({ wrap: 0.08, occlusion: 1.45, selfShadow: 0.8, formRadius: 3, formWeight: 0.45, shadowReach: 8, sky: [0.32, 0.38, 0.48] });
}

/**
 * A clump of meadow grass: curved, tapering blades that let light through,
 * darker at the base where they crowd together, some carrying seed heads.
 * `front` clumps are shorter (they cover a walker's legs).
 */
/**
 * Encounter grass in the painted style: a few broad, smoothly shaded blades
 * in a saturated green, tapering to points, with a clear clump silhouette.
 * `front` is the short tuft drawn in front of the walker's legs.
 */
export function renderGrassTuft(w: number, h: number, variant: number, density: number, front: boolean): HTMLCanvasElement {
  const s = new LitSprite(w, h, density);
  const rand = rng((front ? 2600 : 2400) + variant * 19);
  const base = rgb(0x2a5220), mid = rgb(0x44802e), tip = rgb(0x7fb44e);
  const groundY = h - 0.8;
  const blades = front ? 7 : 11;
  for (let i = 0; i < blades; i++) {
    const x0 = w * 0.5 + (rand() - 0.5) * w * 0.72;
    const centre = 1 - Math.abs(x0 - w / 2) / (w / 2);
    const len = (front ? 5 + rand() * 2.4 + centre * 2 : 8 + rand() * 3.4 + centre * 4.4) * (0.92 + rand() * 0.16);
    const lean = (x0 - w / 2) * (0.3 + rand() * 0.25) + (rand() - 0.5) * 2;
    const z = (front ? 2 : 0) + rand() * 1.5;
    const width = 0.95 + rand() * 0.35;
    const rootY = groundY - rand() * 1.2;
    // Three segments curve the blade over and taper it to a point.
    let px = x0, py = rootY, pr = width;
    for (let k = 1; k <= 3; k++) {
      const t = k / 3;
      const nx = x0 + lean * t * t, ny = rootY - len * t * (1 - 0.08 * t * Math.abs(lean) / 4);
      const nr = Math.max(0.08, width * (1 - t * 0.92));
      const col = k === 1 ? mixRGB(base, mid, 0.55 + rand() * 0.2) : k === 2 ? mixRGB(mid, tip, 0.2 + rand() * 0.25) : mixRGB(mid, tip, 0.6 + rand() * 0.3);
      s.limb(px, py, nx, ny, pr, nr, z + t * 1.2, col, { translucency: 0.5, specular: 0.05 });
      px = nx; py = ny; pr = nr;
    }
  }
  // Roots fade into the ground instead of ending on a hard line.
  return fadeBottom(s.render({ wrap: 0.45, occlusion: 0.9, selfShadow: 0.5, formRadius: 2.4, formWeight: 0.4, shadowReach: 4 }), 2.4 * density);
}

/** Fades the lowest `px` rows of a sprite to transparent (the rest is untouched). */
function fadeBottom(canvas: HTMLCanvasElement, px: number): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')!;
  ctx.globalCompositeOperation = 'destination-in';
  // destination-in clears everything the fill does not cover, so cover all of it.
  const fade = ctx.createLinearGradient(0, canvas.height - px, 0, canvas.height);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}

export interface FlowerStyle { petal: number; centre: number; size: number; petals: number }

/** A clump of wildflowers: thin stems, a few leaves and lit, translucent petals. */
export function renderFlowers(w: number, h: number, style: FlowerStyle, seed: number, density: number): HTMLCanvasElement {
  const s = new LitSprite(w, h, density);
  const rand = rng(seed);
  const stem = rgb(0x3d6a2a), leaf = rgb(0x4f8a34), petal = rgb(style.petal), centre = rgb(style.centre);
  const groundY = h - 0.8;
  for (let i = 0; i < 6; i++) {
    const x = 2.5 + rand() * (w - 5);
    const top = 2.4 + rand() * Math.max(0.5, h - 7);
    const y0 = groundY - rand() * 1.2;
    s.limb(x, y0, x + (rand() - 0.5) * 2, top + 0.8, 0.26, 0.16, 0.4, stem, { translucency: 0.5 });
    s.ellipsoid(x + 1, (y0 + top) / 2 + 1, 1.3, 0.55, 0.8, 0.35, leaf, { translucency: 0.6 }, -0.6);
    const hx = x + (rand() - 0.5) * 1.2, hy = top;
    const r = style.size * (0.8 + rand() * 0.35);
    for (let k = 0; k < style.petals; k++) {
      const a = (k / style.petals) * Math.PI * 2 + rand() * 0.3;
      s.ellipsoid(hx + Math.cos(a) * r * 0.62, hy + Math.sin(a) * r * 0.46, r * 0.58, r * 0.34, 2.6, r * 0.28,
        mixRGB(petal, rgb(0xffffff), rand() * 0.15), { translucency: 0.55, specular: 0.08 }, a);
    }
    s.ellipsoid(hx, hy, r * 0.34, r * 0.3, 3, r * 0.3, centre, { specular: 0.2 });
  }
  return fadeBottom(s.render({ wrap: 0.35, occlusion: 1, selfShadow: 0.5, formRadius: 1, formWeight: 0.2, shadowReach: 3 }), 1.6 * density);
}
