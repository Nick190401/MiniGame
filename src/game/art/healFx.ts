import Phaser from 'phaser';
import { TEXEL } from '../render/RenderScale';
import { hash2, makeCanvas, rgba, rng, valueNoise, type Ctx } from './paint';
import { addStaticCanvas, worldTexture } from './worldTexture';
import { createKrysHealTextures } from './healFxKrys';
import { createQuincyHealTextures } from './healFxQuincy';
import { createKianHealTextures } from './healFxKian';

/**
 * Textures of the NPC heal (src/game/world/heal), painted once while the game
 * loads. White unless noted, tinted at use. The three healers add their own in
 * healFxKrys / healFxQuincy / healFxKian.
 */
export const HFX = {
  ring: 'hfx-ring',
  glint: 'hfx-glint',
  // Light
  column: 'hfx-column',
  raysOpen: 'hfx-rays-open',
  rayFan: 'hfx-ray-fan',
  bloom: 'hfx-bloom',
  flare: 'hfx-flare',
  // Ground, authored top-down as circles
  sigilStaff: 'hfx-sigil-staff',
  sigilWave: 'hfx-sigil-wave',
  sigilFifths: 'hfx-sigil-fifths',
  wave: 'hfx-wave',
  halo: 'hfx-halo',
  swirl: 'hfx-swirl',
  pool: 'hfx-pool',
  stage: 'hfx-stage',
  // Particles and pieces
  spark: 'hfx-spark',
  mote: 'hfx-mote',
  streak: 'hfx-streak',
  noteEighth: 'hfx-note-eighth',
  notePair: 'hfx-note-pair',
  noteQuarter: 'hfx-note-quarter',
  noteSixteenth: 'hfx-note-sixteenth',
  noteHalf: 'hfx-note-half',
} as const;

const TAU = Math.PI * 2;

/**
 * Texels per unit of the sigil layers. They lie on the ground squashed to 0.36
 * and the textures have no mipmaps: at this density one screen pixel spans two
 * texels down the squash, which bilinear filtering still covers. Denser art
 * would crawl as it turns. Strokes stay at 0.8 units or wider for the same reason.
 */
const GROUND_DENSITY = 0.72 * Math.min(TEXEL, 4);

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
/** Hermite step from e0 to e1; e0 may be larger than e1 for a falling edge. */
export function step(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
export function gauss(x: number, s: number): number {
  return Math.exp(-(x * x) / (2 * s * s));
}
export function angDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export type AlphaAt = (u: number, v: number) => number;

/**
 * A white texture of width x height texels whose alpha comes from alphaAt
 * (u, v run 0..1), dithered so soft falloffs do not band when stretched.
 */
export function alphaTexture(scene: Phaser.Scene, key: string, width: number, height: number, alphaAt: AlphaAt): void {
  if (scene.textures.exists(key)) return;
  const { canvas, ctx } = makeCanvas(width, height);
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

/** alphaTexture authored in world units at world density (mirrors battleFx's alphaTexture). */
function alphaWorld(scene: Phaser.Scene, key: string, w: number, h: number, alphaAt: AlphaAt): void {
  alphaTexture(scene, key, w * TEXEL, h * TEXEL, alphaAt);
}

/**
 * alphaTexture whose two outer texels are empty and whose next two ease in, so
 * a stretched texture can never show its box.
 */
export function softTexture(scene: Phaser.Scene, key: string, width: number, height: number, alphaAt: AlphaAt): void {
  alphaTexture(scene, key, width, height, (u, v) => {
    const edge = Math.min(Math.min(u, 1 - u) * width, Math.min(v, 1 - v) * height);
    return edge < 2 ? 0 : alphaAt(u, v) * Math.min(1, (edge - 2) / 2);
  });
}

/** alphaAt of a round texture from its radial profile; r is 0 at the centre and 1 at the edge. */
export function discAlpha(profile: (r: number) => number): AlphaAt {
  const N = 512;
  const lut = new Float32Array(N + 2);
  for (let i = 0; i <= N; i++) lut[i] = profile(i / N);
  return (u, v) => {
    const x = u * 2 - 1;
    const y = v * 2 - 1;
    const f = Math.sqrt(x * x + y * y) * N;
    if (f >= N) return 0;
    const i = f | 0;
    return lut[i] + (lut[i + 1] - lut[i]) * (f - i);
  };
}

/** Multiplies what is drawn by a frame that is empty at the border and full `margin` units in. */
function fadeEdges(ctx: Ctx, w: number, h: number, margin: number): void {
  const texel = 1 / ctx.getTransform().a;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  for (const [length, x1, y1] of [[w, w, 0], [h, 0, h]] as const) {
    const g = ctx.createLinearGradient(0, 0, x1, y1);
    const zero = (1.5 * texel) / length;
    const full = margin / length;
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(zero, 'rgba(255,255,255,0)');
    g.addColorStop(full, '#ffffff');
    g.addColorStop(1 - full, '#ffffff');
    g.addColorStop(1 - zero, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

/**
 * Crisp white line art over its own narrow glow. `draw` paints in world units
 * on a w x h canvas; `glow` is the blur in units.
 */
export function lineArt(scene: Phaser.Scene, key: string, w: number, h: number, density: number, glow: number, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) return;
  const line = makeCanvas(w * density, h * density);
  line.ctx.scale(line.canvas.width / w, line.canvas.height / h);
  line.ctx.fillStyle = line.ctx.strokeStyle = '#ffffff';
  line.ctx.lineCap = 'round';
  line.ctx.lineJoin = 'round';
  draw(line.ctx);
  const { canvas, ctx } = makeCanvas(line.canvas.width, line.canvas.height);
  ctx.shadowColor = 'rgba(255,255,255,0.55)';
  // shadowBlur is in canvas pixels and ignores ctx.scale.
  ctx.shadowBlur = glow * density;
  ctx.drawImage(line.canvas, 0, 0);
  addStaticCanvas(scene, key, canvas);
}

/**
 * Draws a glyph three times: soft under-shadow, white glow, white body.
 * `fade` (units) clears the glow off the border; leave room for it.
 */
export function glyphTexture(scene: Phaser.Scene, key: string, w: number, h: number, shape: (ctx: Ctx) => void, fade = 0): void {
  worldTexture(scene, key, w, h, ctx => {
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
    if (fade > 0) fadeEdges(ctx, w, h, fade);
  });
}

// ── Note glyphs, drawn in a 10 x 12 unit box ───────────────────────────────

function noteHead(ctx: Ctx, x: number, y: number, rx = 2.25, ry = 1.6): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, -0.38, 0, TAU);
  ctx.fill();
}

function eighthNote(ctx: Ctx): void {
  noteHead(ctx, 3.7, 9.3);
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
}

function notePair(ctx: Ctx): void {
  noteHead(ctx, 2.6, 9.6, 1.9, 1.35);
  noteHead(ctx, 7.4, 8.4, 1.9, 1.35);
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
}

function quarterNote(ctx: Ctx): void {
  noteHead(ctx, 4.4, 9.3);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(6.6, 9.0);
  ctx.lineTo(6.6, 1.8);
  ctx.stroke();
}

function sixteenthNote(ctx: Ctx): void {
  noteHead(ctx, 3.7, 9.3);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(5.9, 9.0);
  ctx.lineTo(5.9, 1.8);
  ctx.stroke();
  ctx.lineWidth = 0.85;
  ctx.beginPath();
  for (const y of [1.8, 4.0]) {
    ctx.moveTo(5.9, y);
    ctx.bezierCurveTo(8.5, y + 0.7, 9.1, y + 2.3, 7.9, y + 3.7);
  }
  ctx.stroke();
}

function halfNote(ctx: Ctx): void {
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(4.4, 9.3, 1.95, 1.3, -0.38, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(6.6, 9.0);
  ctx.lineTo(6.6, 1.8);
  ctx.stroke();
}

/** The glyph in a 12 x 14 box with a clear border, at the same scale as the 10 x 12 notes. */
function cleanNote(scene: Phaser.Scene, key: string, shape: (ctx: Ctx) => void): void {
  glyphTexture(scene, key, 12, 14, ctx => {
    ctx.save();
    ctx.translate(1, 1);
    shape(ctx);
    ctx.restore();
  }, 1.2);
}

// ── Light ──────────────────────────────────────────────────────────────────

/** Height of the ground line in the column texture; its origin y. */
const COLUMN_FOOT = 0.955;

/**
 * The pillar: hot core, soft body, streaks that come and go along the height,
 * a top that frays out and a base that flares onto a ground ellipse.
 */
function columnAlpha(): AlphaAt {
  const rand = rng(4127);
  const N = 256;
  const sets = Array.from({ length: 4 }, () => {
    const lut = new Float32Array(N + 2);
    for (let k = 0; k < 5; k++) {
      const at = (rand() * 2 - 1) * 0.78;
      const width = 0.02 + 0.05 * rand() * rand();
      const level = 0.3 + 0.6 * rand();
      for (let i = 0; i <= N; i++) lut[i] += level * gauss((i / N) * 2 - 1 - at, width);
    }
    return lut;
  });
  const weight = [0, 0, 0, 0];
  let row = -1;
  let half = 1;
  let body = 0;
  let fill = 0;
  let core = 0;
  return (u, v) => {
    if (v !== row) {
      row = v;
      const straight = 0.36 + 0.05 * v;
      half = straight + 0.5 * clamp01((v - 0.8) / (COLUMN_FOOT - 0.8)) ** 2.4;
      const lift = 0.72 + 0.28 * v * v;
      // The light thins out where the base spreads it; the even fill faster than the streaks.
      const thin = straight / half;
      body = step(0.02, 0.34, v) * lift * thin;
      fill = 0.32 * thin * thin;
      core = step(0.01, 0.3, v) * lift;
      for (let k = 0; k < 4; k++) {
        weight[k] = step(0.3, 0.7, valueNoise(v * 7 + k * 13.7, k * 3.1, 64, 517)) * step(0.02 + 0.05 * k, 0.2 + 0.07 * k, v);
      }
    }
    const x = u * 2 - 1;
    const q = x / half;
    const aq = Math.abs(q);
    if (aq >= 1) return 0;
    const f = (q * 0.5 + 0.5) * N;
    const i = f | 0;
    const k = f - i;
    let streaks = 0;
    for (let s = 0; s < 4; s++) streaks += weight[s] * (sets[s][i] + (sets[s][i + 1] - sets[s][i]) * k);
    let a = body * (fill * step(1, 0.25, aq) + 0.4 * Math.min(1, streaks) * step(1, 0.6, aq)) + 0.7 * core * gauss(x, 0.068);
    const dv = v - COLUMN_FOOT;
    if (dv > -0.07) {
      // Where the pillar meets the ground: a pool of light, and an edge that follows a ground ellipse.
      const px = x / 0.4;
      const py = dv / 0.013;
      a += 0.55 * Math.exp(-(px * px + py * py) / 2);
      if (dv > 0) a *= step(1, 0.35, dv / (0.03 * Math.sqrt(1 - (x * x) / 0.865)));
    }
    return a;
  };
}

interface RayTable { level: Float32Array; reach: Float32Array; n: number }

/** Uneven rays around a full turn: brightness and length per angle. */
function rayTable(seed: number, count: number): RayTable {
  const n = 1024;
  const rand = rng(seed);
  const level = new Float32Array(n + 2);
  const sum = new Float32Array(n + 2);
  for (let k = 0; k < count; k++) {
    const at = ((k + rand()) / count) * TAU;
    const width = 0.012 + 0.06 * rand() ** 2;
    const strength = 0.22 + 0.78 * rand() ** 1.6;
    const length = 0.5 + 0.47 * rand();
    for (let i = 0; i <= n; i++) {
      const d = angDiff((i / n) * TAU, at);
      if (Math.abs(d) > 4 * width) continue;
      const g = strength * gauss(d, width);
      level[i] += g;
      sum[i] += g * length;
    }
  }
  // A faint, shorter haze between the rays, so the gaps are not holes.
  const haze = 0.03;
  const reach = new Float32Array(n + 2);
  for (let i = 0; i <= n; i++) {
    reach[i] = (sum[i] + haze * 0.6) / (level[i] + haze);
    level[i] = Math.min(1, level[i] + haze);
  }
  return { level, reach, n };
}

/** Brightness of a ray table at turn fraction f (0..1) and distance r from the source. */
function rayAt(table: RayTable, f: number, r: number): number {
  const p = f * table.n;
  const i = p | 0;
  const k = p - i;
  const t = r / (table.reach[i] + (table.reach[i + 1] - table.reach[i]) * k);
  if (t >= 1) return 0;
  const level = table.level[i] + (table.level[i + 1] - table.level[i]) * k;
  const fall = 1 - t * t;
  // Toward the source the rays pinch below a texel: blend them into an even glow there.
  return (0.8 + (level - 0.8) * step(0, 0.3, r)) * fall * Math.sqrt(fall);
}

function paintLight(scene: Phaser.Scene): void {
  // Stretch freely in height (the structure runs along it); 20 to 60 units wide.
  softTexture(scene, HFX.column, 120, 480, columnAlpha());

  // The burst with its middle left open, for a source that stands in front of it; seen 200 to 360 units.
  const open = rayTable(4421, 34);
  softTexture(scene, HFX.raysOpen, 220, 220, (u, v) => {
    const x = u * 2 - 1;
    const y = v * 2 - 1;
    const d = x * x + y * y;
    if (d >= 0.94) return 0;
    const r = Math.sqrt(d) / 0.97;
    return rayAt(open, Math.atan2(y, x) / TAU + 0.5, r) * step(0.07, 0.3, r);
  });

  // Rays rising from a point on the ground, none below the horizon.
  const fan = rayTable(2647, 30);
  softTexture(scene, HFX.rayFan, 300, 160, (u, v) => {
    const x = (u - 0.5) * 2;
    const y = ((COLUMN_FOOT - v) * 160) / 150;
    const d = x * x + y * y;
    if (y <= 0 || d >= 0.94) return 0;
    const r = Math.sqrt(d);
    return rayAt(fan, Math.atan2(x, y) / Math.PI + 0.5, r / 0.97) * Math.sqrt(y / r);
  });

  softTexture(scene, HFX.bloom, 120, 120, discAlpha(r => (1 - r * r) ** 2 / (1 + (r / 0.2) ** 2)));

  softTexture(scene, HFX.flare, 250, 30, (u, v) => {
    const x = Math.abs(u * 2 - 1);
    const y = Math.abs(v * 2 - 1);
    const reach = Math.max(0, 1 - x / 0.97);
    const line = reach ** 2.4 * gauss(y, 0.07 + 0.16 * reach ** 3);
    return Math.min(1, 0.95 * line + 0.6 * gauss(x, 0.05) * gauss(y, 0.42)) * step(1, 0.75, y);
  });
}

// ── Ground ─────────────────────────────────────────────────────────────────

/** Point at radius r and angle a, moved t along the tangent. */
function polar(r: number, a: number, t = 0): [number, number] {
  return [r * Math.cos(a) - t * Math.sin(a), r * Math.sin(a) + t * Math.cos(a)];
}

function circle(ctx: Ctx, r: number, width: number, alpha: number): void {
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
}

function segment(ctx: Ctx, from: [number, number], to: [number, number]): void {
  ctx.moveTo(from[0], from[1]);
  ctx.lineTo(to[0], to[1]);
}

/** Radius of the innermost staff line and the spacing between lines. */
const STAFF_LINE = 44.6;
const STAFF_GAP = 2.8;
const DEG = Math.PI / 180;

/**
 * Eight bars around the circle; a note is [slot 1-4, staff position 0-8,
 * kind]: 0 quarter, 1 half, 2 and 3 the two notes of a beamed pair.
 */
const STAFF_MELODY: Array<Array<[number, number, 0 | 1 | 2 | 3]>> = [
  [[1, 2, 0], [2, 4, 0], [3, 6, 0], [4, 4, 0]],
  [[1, 5, 1], [3, 7, 1]],
  [[1, 8, 2], [2, 6, 3], [3, 4, 2], [4, 2, 3]],
  [[1, 1, 0], [2, 3, 0], [3, 5, 1]],
  [[1, 4, 2], [2, 6, 3], [3, 8, 0], [4, 6, 0]],
  [[1, 7, 1], [3, 5, 1]],
  [[1, 3, 2], [2, 4, 3], [3, 5, 2], [4, 7, 3]],
  [[1, 6, 0], [2, 4, 0], [3, 2, 1]],
];

/** Outer sigil layer, 128 units: a five-line staff bent into a ring, its melody, a tuner scale and the rim. */
function paintSigilStaff(ctx: Ctx): void {
  ctx.translate(64, 64);
  const pitch = (p: number) => STAFF_LINE + (STAFF_GAP / 2) * p;
  circle(ctx, 61.6, 1, 1);
  circle(ctx, 41.4, 0.8, 0.55);
  for (let i = 0; i < 5; i++) circle(ctx, STAFF_LINE + i * STAFF_GAP, 0.8, 0.8);

  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 0; i < 72; i++) segment(ctx, polar(i % 3 ? 58.9 : 57.9, i * 5 * DEG), polar(60.2, i * 5 * DEG));
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  for (let bar = 1; bar < 8; bar++) segment(ctx, polar(STAFF_LINE, bar * 45 * DEG), polar(pitch(8), bar * 45 * DEG));
  segment(ctx, polar(STAFF_LINE, 1.3 * DEG), polar(pitch(8), 1.3 * DEG));
  ctx.stroke();
  // Repeat sign: where the melody starts over, and what makes the turn readable.
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  segment(ctx, polar(STAFF_LINE - 0.4, -1 * DEG), polar(pitch(8) + 0.4, -1 * DEG));
  ctx.stroke();
  for (const p of [3, 5]) {
    ctx.beginPath();
    ctx.arc(...polar(pitch(p), 3.5 * DEG), 0.8, 0, TAU);
    ctx.fill();
  }

  STAFF_MELODY.forEach((notes, bar) => {
    notes.forEach(([slot, p, kind], index) => {
      const a = (bar * 45 + slot * 9) * DEG;
      const r = pitch(p);
      const partner = kind === 2 ? notes[index + 1] : kind === 3 ? notes[index - 1] : undefined;
      // Stems point away from the middle line, as written music does; a pair shares one direction.
      const out = (partner ? (p + partner[1]) / 2 : p) <= 4 ? 1 : -1;
      ctx.save();
      ctx.translate(...polar(r, a));
      ctx.rotate(a);
      ctx.beginPath();
      if (kind === 1) {
        ctx.lineWidth = 0.7;
        ctx.ellipse(0, 0, 1.05, 1.55, 0.3, 0, TAU);
        ctx.stroke();
      } else {
        ctx.ellipse(0, 0, 1.25, 1.75, 0.3, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      const side = out * 1.5;
      const tip = polar(r + 7.2 * out, a, side);
      ctx.lineCap = 'round';
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      segment(ctx, polar(r + 0.3 * out, a, side), tip);
      ctx.stroke();
      if (kind === 2 && partner) {
        ctx.lineCap = 'butt';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        segment(ctx, tip, polar(pitch(partner[1]) + 7.2 * out, (bar * 45 + partner[0] * 9) * DEG, side));
        ctx.stroke();
      }
    });
  });
}

/** Middle sigil layer, 84 units: a waveform wrapped into a ring, four swells to the turn. */
function paintSigilWave(ctx: Ctx): void {
  ctx.translate(42, 42);
  const mid = 33.2;
  circle(ctx, mid, 0.8, 0.5);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU;
    const swell = (0.5 + 0.5 * Math.sin(4 * a - 0.9)) ** 1.5 * (0.75 + 0.25 * Math.sin(a + 0.4));
    const half = 0.6 + 5.1 * clamp01(0.12 + 0.62 * swell + 0.42 * (hash2(i, 3, 61) - 0.5));
    segment(ctx, polar(mid - half, a), polar(mid + half, a));
  }
  ctx.stroke();
}

/**
 * Inner sigil layer, 56 units: the circle of fifths. Twelve tones on a ring,
 * seven naturals filled and five accidentals open, around the outline of the
 * star that joins every tone to its fifth.
 */
function paintSigilFifths(ctx: Ctx): void {
  ctx.translate(28, 28);
  const ringR = 24.4;
  const gap = 2.1 / ringR;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 0.8;
  ctx.lineCap = 'butt';
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, ringR, i * 30 * DEG + gap, (i + 1) * 30 * DEG - gap);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    if (i < 7) {
      ctx.arc(...polar(ringR, i * 30 * DEG), 1.45, 0, TAU);
      ctx.fill();
    } else {
      ctx.lineWidth = 0.75;
      ctx.arc(...polar(ringR, i * 30 * DEG), 1.2, 0, TAU);
      ctx.stroke();
    }
  }
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 5;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const [x, y] = polar(i % 2 ? 20.6 * 0.5176 : 20.6, i * 15 * DEG);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  circle(ctx, 8.2, 0.8, 0.6);
}

function paintGround(scene: Phaser.Scene): void {
  lineArt(scene, HFX.sigilStaff, 128, 128, GROUND_DENSITY, 1, paintSigilStaff);
  lineArt(scene, HFX.sigilWave, 84, 84, GROUND_DENSITY, 1, paintSigilWave);
  lineArt(scene, HFX.sigilFifths, 56, 56, GROUND_DENSITY, 1, paintSigilFifths);

  // A broad swell with a steeper leading edge; any size.
  softTexture(scene, HFX.wave, 120, 120, discAlpha(r => 0.9 * gauss(r - 0.7, r > 0.7 ? 0.07 : 0.18) * step(1, 0.88, r)));

  softTexture(scene, HFX.halo, 180, 180, discAlpha(r => (0.75 * gauss(r - 0.78, 0.02) + 0.25 * gauss(r - 0.78, 0.075)) * step(1, 0.93, r)));

  // A comet on a circle, head at 3 o'clock leading clockwise, its tail winding outward behind it.
  const sweep = 1.45 * Math.PI;
  softTexture(scene, HFX.swirl, 180, 180, (u, v) => {
    const x = u * 2 - 1;
    const y = v * 2 - 1;
    const d2 = x * x + y * y;
    if (d2 < 0.2 || d2 > 0.96) return 0;
    const r = Math.sqrt(d2);
    const back = (TAU - Math.atan2(y, x)) % TAU;
    const t = back / sweep;
    if (t < 1) {
      const life = 1 - t;
      const width = 0.012 + 0.03 * life;
      const d = r - (0.72 + 0.16 * t);
      return life * Math.sqrt(life) * (0.8 * gauss(d, width) + 0.2 * gauss(d, 2 * width));
    }
    const d = r - 0.72;
    return gauss((TAU - back) * 0.72, 0.035) * (0.8 * gauss(d, 0.042) + 0.2 * gauss(d, 0.084));
  });

  softTexture(scene, HFX.pool, 96, 96, discAlpha(r => step(1, 0.12, r) ** 1.4));

  // The dimmer for the world around the pair: tint it dark. Clear in the middle
  // and solid from 62 % of the half-size out to the border, so show it large
  // enough that its border stays off screen.
  alphaTexture(scene, HFX.stage, 120, 120, (u, v) => step(0.16, 0.62, Math.hypot(u * 2 - 1, v * 2 - 1)));
}

// ── Particles and pieces ───────────────────────────────────────────────────

function paintPieces(scene: Phaser.Scene): void {
  softTexture(scene, HFX.spark, 90, 90, (u, v) => {
    const x = Math.abs(u * 2 - 1) / 0.94;
    const y = Math.abs(v * 2 - 1) / 0.94;
    const s = x + y + 2 * Math.sqrt(x * y);
    const star = s < 1 ? Math.min(1, (1 - s) / 0.3) ** 1.3 : 0;
    return Math.min(1, star + 0.4 * Math.exp(-(x * x + y * y) / 0.08));
  });

  softTexture(scene, HFX.mote, 30, 30, discAlpha(r => (1 - r * r) ** 2 * (0.3 + 0.7 * gauss(r, 0.32))));

  // Travels toward its top: a round head and a tail thinning out below it.
  softTexture(scene, HFX.streak, 22, 120, (u, v) => {
    const x = Math.abs(u * 2 - 1);
    const head = 0.1;
    if (v >= 0.975) return 0;
    const along = v < head ? gauss(v - head, 0.03) : (1 - (v - head) / (0.975 - head)) ** 1.7;
    const width = 0.16 + 0.2 * along;
    return along * (0.85 * gauss(x, width) + 0.15 * gauss(x, 2.2 * width)) * step(0.95, 0.6, x);
  });

  cleanNote(scene, HFX.noteEighth, eighthNote);
  cleanNote(scene, HFX.notePair, notePair);
  cleanNote(scene, HFX.noteQuarter, quarterNote);
  cleanNote(scene, HFX.noteSixteenth, sixteenthNote);
  cleanNote(scene, HFX.noteHalf, halfNote);
}

export function createHealFxTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(HFX.noteHalf)) return;

  alphaWorld(scene, HFX.ring, 32, 32, (u, v) => {
    const r = Math.hypot(u * 2 - 1, v * 2 - 1);
    const inside = r < 0.88;
    const a = 0.9 * gauss(r - 0.88, 0.045) + 0.22 * gauss(r - 0.8, 0.1) * (inside ? 1 : 0.4) + 0.06 * step(0.3, 0.85, r) * (inside ? 1 : 0);
    return a * step(1, 0.96, r);
  });

  alphaWorld(scene, HFX.glint, 8, 8, (u, v) => {
    const x = u * 2 - 1;
    const y = v * 2 - 1;
    const arms = Math.max(gauss(y, 0.06) * gauss(x, 0.45), gauss(x, 0.06) * gauss(y, 0.45));
    return Math.min(1, 0.9 * arms + gauss(Math.hypot(x, y), 0.16)) * step(1, 0.9, Math.hypot(x, y));
  });

  paintLight(scene);
  paintGround(scene);
  paintPieces(scene);

  createKrysHealTextures(scene);
  createQuincyHealTextures(scene);
  createKianHealTextures(scene);
}
