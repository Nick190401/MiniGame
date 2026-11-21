import Phaser from 'phaser';
import { TEXEL } from '../render/RenderScale';
import { alphaTexture, angDiff, gauss, softTexture, step } from './healFx';

/**
 * Textures only Professor Krys's heal uses (the tuning fork: rings and standing waves). Keys start with 'hfx-krys-'.
 * The painters are exported by ./healFx (alphaTexture, softTexture, discAlpha,
 * lineArt, glyphTexture, gauss, step). healFx imports this file too: the cycle
 * is harmless as long as nothing of healFx is used at module level here.
 */
export const HFX_KRYS = {
  /** Chladni figures of a resonating plate, simple to rich; top-down, lay them on the ground at 0.36. */
  plateA: 'hfx-krys-plate-a',
  plateB: 'hfx-krys-plate-b',
  plateC: 'hfx-krys-plate-c',
  /** A ring vibrating in its fifth mode, crest at 0.8 of the half-size, bright still nodes; turned 36 degrees it is the opposite phase. */
  mode: 'hfx-krys-mode',
  /** A ring around a column seen from the side: front arc bright, back arc faint. 224 x 80 texels. */
  band: 'hfx-krys-band',
  /**
   * A crisp ground wave crest at 0.86 of the half-size with a short trail inside, for 20 to 320 units at
   * aspect 0.36: thickened toward its top and bottom so the squashed line keeps one width all round.
   */
  wave: 'hfx-krys-wave',
  /**
   * A fine ring for the ground, crest at 0.9 of the half-size, for 150 to 450 units at aspect 0.36: thickened
   * toward its top and bottom like the wave, and with no trail, so several stand side by side as clean lines.
   */
  stand: 'hfx-krys-stand',
} as const;

/** Crest radius of the wave as a share of its half-size. */
export const KRYS_WAVE_CREST = 0.86;
/** Crest radius of the standing ring as a share of its half-size. */
export const KRYS_STAND_CREST = 0.9;

export const KRYS_PLATES = [HFX_KRYS.plateA, HFX_KRYS.plateB, HFX_KRYS.plateC] as const;
/** Height over width of the band texture. */
export const KRYS_BAND_ASPECT = 80 / 224;
/** Crest radius of the mode ring as a share of its half-size. */
export const KRYS_MODE_CREST = 0.8;

const TAU = Math.PI * 2;
const PLATE_PX = 256;

// J0 and J6 on [0, 16] from Bessel's integral; the midpoint rule converges fast on it.
const BESSEL_MAX = 16;
const BESSEL_N = 1024;
let bessel: [Float32Array, Float32Array] | undefined;
function besselAt(lut: Float32Array, x: number): number {
  const f = Math.min(BESSEL_N, (x / BESSEL_MAX) * BESSEL_N);
  const i = Math.min(BESSEL_N - 1, f | 0);
  return lut[i] + (lut[i + 1] - lut[i]) * (f - i);
}
function besselTables(): [Float32Array, Float32Array] {
  if (bessel) return bessel;
  const table = (m: number) => {
    const lut = new Float32Array(BESSEL_N + 1);
    for (let i = 0; i <= BESSEL_N; i++) {
      const x = (i / BESSEL_N) * BESSEL_MAX;
      let s = 0;
      for (let k = 0; k < 32; k++) {
        const tau = ((k + 0.5) / 32) * Math.PI;
        s += Math.cos(m * tau - x * Math.sin(tau));
      }
      lut[i] = s / 32;
    }
    return lut;
  };
  bessel = [table(0), table(6)];
  return bessel;
}

/** The plate's displacement for figure i at x, y (-1..1); its zero set is the figure. */
function field(i: number, x: number, y: number): number {
  const P = Math.PI;
  if (i === 0) return Math.cos(2 * P * x) * Math.cos(3 * P * y) + Math.cos(3 * P * x) * Math.cos(2 * P * y);
  if (i === 1) return Math.cos(3 * P * x) * Math.cos(4 * P * y) + Math.cos(4 * P * x) * Math.cos(3 * P * y);
  const [j0, j6] = besselTables();
  const r = Math.hypot(x, y);
  return besselAt(j6, 14 * r) * Math.cos(6 * Math.atan2(y, x)) + 0.2 * besselAt(j0, 10 * r);
}

/** Distance in grid cells from each cell of an n x n grid to the figure's nearest line (first order). */
function lineDistance(i: number, n: number): Float32Array {
  const f = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) f[y * n + x] = field(i, ((x + 0.5) / n) * 2 - 1, ((y + 0.5) / n) * 2 - 1);
  }
  const d = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const gx = (f[y * n + Math.min(n - 1, x + 1)] - f[y * n + Math.max(0, x - 1)]) / 2;
      const gy = (f[Math.min(n - 1, y + 1) * n + x] - f[Math.max(0, y - 1) * n + x]) / 2;
      d[y * n + x] = Math.abs(f[y * n + x]) / (Math.hypot(gx, gy) + 1e-4);
    }
  }
  return d;
}

const nodes: Float32Array[] = [];
/**
 * Points on figure i's lines, plate units (-1..1), 0.25 to 0.88 from the centre and spread
 * evenly along the lines, in a fixed shuffled order: [x0, y0, x1, y1, ...].
 */
export function krysPlateNodes(i: number): Float32Array {
  if (nodes[i]) return nodes[i];
  const n = 160;
  const d = lineDistance(i, n);
  let seed = 0x2f6b1d + i * 7919;
  const rand = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  const cells: number[] = [];
  for (let k = 0; k < n * n; k++) {
    const x = ((k % n) + 0.5) / n * 2 - 1;
    const y = (Math.floor(k / n) + 0.5) / n * 2 - 1;
    const r = Math.hypot(x, y);
    if (d[k] < 0.5 && r > 0.25 && r < 0.88) cells.push(k);
  }
  for (let k = cells.length - 1; k > 0; k--) {
    const j = Math.floor(rand() * (k + 1));
    [cells[k], cells[j]] = [cells[j], cells[k]];
  }
  const out: number[] = [];
  for (const k of cells) {
    const x = ((k % n) + 0.5) / n * 2 - 1;
    const y = (Math.floor(k / n) + 0.5) / n * 2 - 1;
    let near = false;
    for (let j = 0; j < out.length && !near; j += 2) near = Math.hypot(out[j] - x, out[j + 1] - y) < 0.075;
    if (!near) out.push(x, y);
    if (out.length >= 320) break;
  }
  nodes[i] = Float32Array.from(out);
  return nodes[i];
}

function paintPlate(scene: Phaser.Scene, key: string, i: number): void {
  if (scene.textures.exists(key)) return;
  const n = PLATE_PX;
  const d = lineDistance(i, n);
  const half = n / 2;
  const alpha = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(x + 0.5 - half, y + 0.5 - half) / half;
      if (r >= 0.99) continue;
      const k = y * n + x;
      const line = (0.85 * gauss(d[k], 2.1) + 0.22 * gauss(d[k], 6)) * step(0.93, 0.89, r);
      const rimD = (r - 0.95) * half;
      const rim = 0.8 * gauss(rimD, 1.5) + 0.2 * gauss(rimD, 4.5);
      alpha[k] = Math.min(1, Math.max(line, rim)) * step(0.99, 0.975, r);
    }
  }
  alphaTexture(scene, key, n, n, (u, v) => alpha[Math.min(n - 1, (v * n) | 0) * n + Math.min(n - 1, (u * n) | 0)]);
}

export function createKrysHealTextures(scene: Phaser.Scene): void {
  KRYS_PLATES.forEach((key, i) => paintPlate(scene, key, i));
  for (let i = 0; i < KRYS_PLATES.length; i++) krysPlateNodes(i);

  // The vibrating ring: drawn at density TEXEL for a 64-unit display, shown 20 to 300 wide.
  const modePx = Math.round(Math.min(TEXEL, 4) * 64);
  softTexture(scene, HFX_KRYS.mode, modePx, modePx, (u, v) => {
    const x = u * 2 - 1;
    const y = v * 2 - 1;
    const rho = Math.hypot(x, y);
    if (rho < 0.55 || rho > 0.97) return 0;
    const a = Math.atan2(y, x);
    const swing = Math.cos(5 * a);
    const dPx = (rho - KRYS_MODE_CREST * (1 + 0.045 * swing)) * (modePx / 2);
    const still = 1 - Math.abs(swing);
    const node = angDiff(a, Math.round((a / TAU) * 10 - 0.5) * (TAU / 10) + TAU / 20);
    const bead = gauss(node * KRYS_MODE_CREST * (modePx / 2), 3.2) * gauss(dPx, 3);
    return Math.min(1, (0.65 + 0.35 * still) * (0.85 * gauss(dPx, 1.7) + 0.25 * gauss(dPx, 6)) + 0.7 * bead);
  });

  softTexture(scene, HFX_KRYS.band, 224, 80, (u, v) => {
    const dx = u * 224 - 112;
    const dy = v * 80 - 40;
    const A = 100;
    const B = 26;
    const q = Math.hypot(dx / A, dy / B);
    const grad = Math.hypot(dx / (A * A), dy / (B * B)) / Math.max(q, 1e-3);
    const dPx = (q - 1) / Math.max(grad, 1e-4);
    const front = 0.32 + 0.68 * step(-0.4, 0.4, dy / B);
    return front * (0.9 * gauss(dPx, 1.6) + 0.3 * gauss(dPx, 5));
  });

  softTexture(scene, HFX_KRYS.wave, 320, 320, (u, v) => {
    const x = u * 2 - 1;
    const y = v * 2 - 1;
    const rho = Math.hypot(x, y);
    if (rho < 0.5 || rho > 0.98) return 0;
    // Distance across the line as it will look on the ground (y squashed to 0.36).
    const c = x / Math.max(rho, 1e-4);
    const s = y / Math.max(rho, 1e-4);
    const d = (rho - KRYS_WAVE_CREST) / Math.sqrt(c * c + (s * s) / 0.1296);
    const trail = d < 0 ? 0.22 * Math.exp(d / 0.035) * step(-0.12, -0.06, d) : 0;
    return Math.min(1, 0.9 * gauss(d, 0.0105) + 0.2 * gauss(d, 0.028) + trail);
  });

  softTexture(scene, HFX_KRYS.stand, 512, 512, (u, v) => {
    const x = u * 2 - 1;
    const y = v * 2 - 1;
    const rho = Math.hypot(x, y);
    if (rho < 0.72 || rho > 0.995) return 0;
    const c = x / rho;
    const s = y / rho;
    const d = (rho - KRYS_STAND_CREST) / Math.sqrt(c * c + (s * s) / 0.1296);
    return Math.min(1, 0.92 * gauss(d, 0.0033) + 0.16 * gauss(d, 0.009));
  });
}
