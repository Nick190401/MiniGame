import Phaser from 'phaser';
import { blobPoints, linear, mix, radial, rgba, rng, roundRect, shade, smoothPath, softEllipse, type Ctx } from './paint';
import { addWorldImage, standingDepth, worldTexture } from './worldTexture';
import { FX } from './fx';
import { woodBoard } from './structures';
import { TEXEL } from '../render/RenderScale';
import { heightAdd, heightGradient, heightOnly, heightRadial, heightRamp, mat, paintRelief, withHeight } from './relief';

/*
 * Buildings are painted in a three-quarter view: the roof seen from above,
 * the south façade facing the camera, sun from the upper left. Each landmark
 * is composed from the material toolkit below.
 */

type Rand = () => number;

/**
 * Material heights (share of the relief scale, see relief.ts): the façade
 * plane, recessed glass and doors, frames and beams standing proud of it,
 * protruding sills, and roofs rising to the eaves that overhang the walls.
 */
const H = {
  wall: 0.3, recess: 0.22, frame: 0.36, beam: 0.355, sill: 0.45,
  roofRidge: 0.6, roofEave: 0.86, flatRoof: 0.72, parapet: 0.8, prop: 0.46,
} as const;

// ── Materials ─────────────────────────────────────────────────────────────

function plaster(ctx: Ctx, x: number, y: number, w: number, h: number, color: number, rand: Rand): void {
  withHeight(mat(H.wall), () => {
    ctx.fillStyle = linear(ctx, x, y, x, y + h, [[0, shade(color, -0.05)], [0.3, color], [1, shade(color, -0.08)]]);
    ctx.fillRect(x, y, w, h);
  });
  for (let i = 0; i < w * h * 0.08; i++) {
    const raised = rand() < 0.5;
    const rx = x + rand() * w, ry = y + rand() * h, rw = 0.5 + rand() * 1.2, rh = 0.4 + rand() * 0.8;
    ctx.fillStyle = rgba(raised ? shade(color, 0.06) : shade(color, -0.1), 0.25);
    ctx.fillRect(rx, ry, rw, rh);
    heightOnly(mat(H.wall + (raised ? 0.006 : -0.006)), () => ctx.fillRect(rx, ry, rw, rh));
  }
  // Rain streaks below the eaves.
  for (let i = 0; i < w / 6; i++) {
    const sx = x + rand() * w;
    ctx.fillStyle = linear(ctx, 0, y, 0, y + h * 0.6, [[0, 0x3a3328, 0.14], [1, 0x3a3328, 0]]);
    ctx.fillRect(sx, y, 0.6 + rand(), h * (0.2 + rand() * 0.4));
  }
}

function stoneWall(ctx: Ctx, x: number, y: number, w: number, h: number, base: number, rand: Rand, course = 4.2, lift = 0): void {
  withHeight(mat(H.wall - 0.05 + lift), () => {
    ctx.fillStyle = rgba(shade(base, -0.5), 1);
    ctx.fillRect(x, y, w, h);
  });
  for (let cy = y; cy < y + h; cy += course) {
    let cx = x - rand() * 4;
    while (cx < x + w) {
      const sw = 4 + rand() * 5;
      const tone = mix(shade(base, -0.2), shade(base, 0.14), rand());
      ctx.fillStyle = linear(ctx, cx, cy, cx, cy + course, [[0, shade(tone, 0.04)], [1, shade(tone, -0.06)]]);
      withHeight(mat(H.wall + lift), () => { roundRect(ctx, cx + 0.35, cy + 0.35, sw - 0.7, course - 0.7, 1); ctx.fill(); });
      heightOnly(mat(H.wall + 0.035 + lift), () => { roundRect(ctx, cx + 0.95, cy + 0.9, sw - 1.9, course - 1.8, 0.8); ctx.fill(); });
      // Weathered surface: lichen, pits and lighter grains.
      for (let k = 0; k < sw * 0.8; k++) {
        ctx.fillStyle = rgba(rand() < 0.3 ? 0x6f7a4a : rand() < 0.5 ? shade(tone, -0.25) : shade(tone, 0.18), 0.35);
        ctx.beginPath(); ctx.ellipse(cx + 0.6 + rand() * (sw - 1.2), cy + 0.6 + rand() * (course - 1.2), 0.25 + rand() * 0.4, 0.2 + rand() * 0.25, 0, 0, Math.PI * 2); ctx.fill();
      }
      cx += sw;
    }
  }
}

function brickWall(ctx: Ctx, x: number, y: number, w: number, h: number, base: number, rand: Rand): void {
  withHeight(mat(H.wall - 0.035), () => {
    ctx.fillStyle = rgba(0xa79a88, 1);
    ctx.fillRect(x, y, w, h);
  });
  const bh = 2.2, bw = 5;
  let row = 0;
  for (let cy = y; cy < y + h; cy += bh, row++) {
    for (let cx = x - (row % 2) * bw / 2; cx < x + w; cx += bw) {
      // Most bricks near the base colour, some over-fired or sooty.
      const pick = rand();
      const tone = pick < 0.12 ? shade(base, -0.32) : pick > 0.92 ? mix(base, 0xc98a5a, 0.4) : mix(shade(base, -0.12), shade(base, 0.12), rand());
      ctx.fillStyle = linear(ctx, cx, cy, cx + bw * 0.3, cy + bh, [[0, shade(tone, 0.05)], [1, shade(tone, -0.08)]]);
      withHeight(mat(H.wall), () => ctx.fillRect(cx + 0.25, cy + 0.25, bw - 0.5, bh - 0.5));
      heightOnly(mat(H.wall + 0.018), () => ctx.fillRect(cx + 0.6, cy + 0.55, bw - 1.2, bh - 1.1));
      if (rand() < 0.5) {
        ctx.fillStyle = rgba(rand() < 0.5 ? 0x2a1a12 : 0xe0b48c, 0.22);
        ctx.fillRect(cx + 0.5 + rand() * (bw - 1.5), cy + 0.5 + rand() * (bh - 1), 0.5 + rand() * 0.8, 0.3);
      }
    }
  }
}

function planks(ctx: Ctx, x: number, y: number, w: number, h: number, base: number, seed: number, vertical = true, lift: number = H.wall): void {
  const size = vertical ? 4 : 3.2;
  let i = 0;
  for (let p = 0; p < (vertical ? w : h); p += size, i++) {
    const tone = mix(shade(base, -0.08), shade(base, 0.08), ((i * 37) % 13) / 13);
    const bw = Math.min(size, (vertical ? w : h) - p);
    const board = vertical
      ? heightGradient(x + p, 0, x + p + bw, 0, [[0, lift - 0.008], [0.5, lift + 0.012], [1, lift - 0.008]])
      : heightGradient(0, y + p, 0, y + p + bw, [[0, lift - 0.008], [0.5, lift + 0.012], [1, lift - 0.008]]);
    withHeight(board, () => {
      if (vertical) woodBoard(ctx, x + p, y, bw, h, tone, seed + i, true);
      else woodBoard(ctx, x, y + p, w, bw, tone, seed + i);
    });
    ctx.fillStyle = 'rgba(25,15,8,0.55)';
    withHeight(mat(lift - 0.03), () => {
      if (vertical) ctx.fillRect(x + p, y, 0.35, h); else ctx.fillRect(x, y + p, w, 0.35);
    });
  }
}

function panels(ctx: Ctx, x: number, y: number, w: number, h: number, base: number, rand: Rand, size = 12): void {
  for (let px = x; px < x + w; px += size) {
    for (let py = y; py < y + h; py += size * 0.75) {
      const tone = mix(shade(base, -0.05), shade(base, 0.06), rand());
      ctx.fillStyle = linear(ctx, px, py, px + size, py + size, [[0, shade(tone, 0.03)], [1, shade(tone, -0.05)]]);
      withHeight(mat(H.wall, 0.25), () => ctx.fillRect(px, py, Math.min(size, x + w - px), Math.min(size * 0.75, y + h - py)));
      ctx.fillStyle = 'rgba(20,24,26,0.35)';
      withHeight(mat(H.wall - 0.025), () => {
        ctx.fillRect(px, py, 0.4, Math.min(size * 0.75, y + h - py));
        ctx.fillRect(px, py, Math.min(size, x + w - px), 0.4);
      });
    }
  }
}

function timberFrame(ctx: Ctx, x: number, y: number, w: number, h: number, beam: number, posts: number[]): void {
  const draw = (bx: number, by: number, bw: number, bh: number) =>
    withHeight(mat(H.beam), () => woodBoard(ctx, bx, by, bw, bh, beam, Math.round(bx * 7 + by), bw < bh));
  draw(x, y, w, 2.2);
  draw(x, y + h - 2.4, w, 2.4);
  posts.forEach(px => draw(x + px - 1.1, y, 2.2, h));
  ctx.strokeStyle = rgba(shade(beam, -0.1), 1);
  ctx.lineWidth = 1.6;
  withHeight(mat(H.beam), () => {
    for (let i = 0; i + 1 < posts.length; i++) {
      if (i % 2) continue;
      ctx.beginPath(); ctx.moveTo(x + posts[i] + 1, y + h - 2.4); ctx.lineTo(x + posts[i + 1] - 1, y + 2.2); ctx.stroke();
    }
  });
}

// ── Roofs ─────────────────────────────────────────────────────────────────

type RoofMaterial = 'tile' | 'slate' | 'shingle' | 'metal' | 'thatch';

function roofCourses(ctx: Ctx, x: number, y: number, w: number, h: number, color: number, material: RoofMaterial, rand: Rand): void {
  const level = (yy: number) => H.roofRidge + (H.roofEave - H.roofRidge) * Math.max(0, Math.min(1, (yy - y) / h));
  withHeight(heightGradient(0, y, 0, y + h, [[0, H.roofRidge], [1, H.roofEave]]), () => {
    ctx.fillStyle = linear(ctx, x, y, x, y + h, [[0, shade(color, 0.06)], [1, shade(color, -0.1)]]);
    ctx.fillRect(x, y, w, h);
  });
  // Moss, lichen and soot weather every roof a little differently.
  const weather = () => {
    for (let i = 0; i < w * h * 0.03; i++) {
      const tone = rand() < 0.55 ? (material === 'slate' ? 0xb8b9a0 : 0x5d6a2c) : 0x1c1814;
      ctx.fillStyle = rgba(tone, 0.12 + rand() * 0.14);
      ctx.beginPath(); ctx.ellipse(x + rand() * w, y + h * (0.25 + rand() * 0.75), 0.4 + rand() * 1.4, 0.3 + rand() * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    }
  };
  if (material === 'metal') {
    for (let sx = x; sx < x + w; sx += 3.2) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(sx, y, 0.5, h);
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(sx + 0.5, y, 0.5, h);
      heightAdd(mat(0.02), () => ctx.fillRect(sx, y, 0.6, h));
    }
    return;
  }
  if (material === 'thatch') {
    for (let i = 0; i < w * h * 0.5; i++) {
      const sx = x + rand() * w, sy = y + rand() * h;
      ctx.strokeStyle = rgba(rand() < 0.5 ? shade(color, 0.2) : shade(color, -0.25), 0.55);
      ctx.lineWidth = 0.3;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + (rand() - 0.5) * 0.8, sy + 2 + rand() * 2); ctx.stroke();
      if (i % 3 === 0) heightAdd(mat(0.012), () => ctx.stroke());
    }
    weather();
    return;
  }
  const courseH = material === 'tile' ? 3 : 2.6;
  let row = 0;
  for (let cy = y; cy < y + h; cy += courseH, row++) {
    const unit = material === 'tile' ? 3.2 : material === 'slate' ? 4.2 : 3.6;
    // Each course starts tucked under the one above and ends in a lit lip.
    heightOnly(heightGradient(0, cy, 0, cy + courseH, [[0, level(cy) - 0.02], [1, level(cy + courseH) + 0.025]]), () => ctx.fillRect(x, cy, w, courseH));
    for (let cx = x - (row % 2) * unit / 2; cx < x + w; cx += unit) {
      const tone = mix(shade(color, -0.12), shade(color, 0.1), rand());
      ctx.fillStyle = linear(ctx, 0, cy, 0, cy + courseH, [[0, shade(tone, 0.05)], [0.75, tone], [1, shade(tone, -0.25)]]);
      if (material === 'tile') {
        ctx.beginPath();
        ctx.moveTo(cx, cy); ctx.lineTo(cx + unit, cy); ctx.lineTo(cx + unit, cy + courseH - 0.6);
        ctx.quadraticCurveTo(cx + unit / 2, cy + courseH + 0.5, cx, cy + courseH - 0.6);
        ctx.closePath(); ctx.fill();
        // Barrel-shaped clay tiles.
        heightAdd(heightRamp(cx, 0, cx + unit, 0, [[0, 0], [0.5, 0.022], [1, 0]]), () => ctx.fill());
      } else {
        ctx.fillRect(cx + 0.2, cy, unit - 0.4, courseH - 0.25);
        // Slates and shingles never lie perfectly flat.
        heightAdd(mat(rand() * 0.012), () => ctx.fillRect(cx + 0.2, cy, unit - 0.4, courseH - 0.25));
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.fillRect(x, cy + courseH - 0.35, w, 0.35);
  }
  weather();
}

interface RoofSpec {
  x: number; y: number; w: number; h: number;
  color: number;
  material: RoofMaterial;
  /** How far the ridge is inset from each side (hip roofs); 0 = gable seen from the front slope. */
  hip: number;
  ridge?: number;
}

/** Hip roof: front slope plus lit west and shaded east hips, with eaves overhang. */
function hipRoof(ctx: Ctx, spec: RoofSpec, rand: Rand): void {
  const { x, y, w, h, color, material, hip } = spec;
  const ridgeH = spec.ridge ?? Math.max(2, h * 0.12);
  // Eave shadow cast onto the wall below.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + hip, y); ctx.lineTo(x + w - hip, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath();
  ctx.clip();
  roofCourses(ctx, x, y, w, h, color, material, rand);
  ctx.restore();
  if (hip > 0) {
    // West hip faces the sun, east hip turns away from it.
    const westHip = () => { ctx.beginPath(); ctx.moveTo(x + hip, y); ctx.lineTo(x, y + h); ctx.lineTo(x + hip * 0.2, y + h); ctx.lineTo(x + hip * 1.25, y + ridgeH); ctx.closePath(); };
    const eastHip = () => { ctx.beginPath(); ctx.moveTo(x + w - hip, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - hip * 0.2, y + h); ctx.lineTo(x + w - hip * 1.25, y + ridgeH); ctx.closePath(); };
    heightOnly(heightGradient(x, 0, x + hip * 1.25, 0, [[0, H.roofRidge + 0.02], [1, H.roofEave - 0.02]]), () => { westHip(); ctx.fill(); });
    heightOnly(heightGradient(x + w - hip * 1.25, 0, x + w, 0, [[0, H.roofEave - 0.02], [1, H.roofRidge + 0.02]]), () => { eastHip(); ctx.fill(); });
    ctx.save(); westHip(); ctx.fillStyle = rgba(0xfff4dc, 0.05); ctx.fill(); ctx.restore();
    ctx.save(); eastHip(); ctx.fillStyle = rgba(0x0a0806, 0.1); ctx.fill(); ctx.restore();
  }
  // Ridge cap.
  ctx.fillStyle = linear(ctx, 0, y - 0.6, 0, y + ridgeH, [[0, shade(color, 0.18)], [1, shade(color, -0.2)]]);
  withHeight(heightGradient(0, y - 0.6, 0, y + ridgeH, [[0, H.roofRidge + 0.05], [0.5, H.roofRidge + 0.08], [1, H.roofRidge + 0.03]]), () => {
    roundRect(ctx, x + hip - 1, y - 0.6, w - hip * 2 + 2, ridgeH, 0.8);
    ctx.fill();
  });
  // Fascia board along the eave.
  ctx.fillStyle = linear(ctx, 0, y + h - 1.6, 0, y + h + 0.6, [[0, shade(color, -0.45)], [1, 0x1b120c]]);
  withHeight(mat(H.roofEave + 0.02), () => ctx.fillRect(x - 0.5, y + h - 1.4, w + 1, 1.9));
}

function eaveShadow(ctx: Ctx, x: number, y: number, w: number, depth = 5): void {
  ctx.fillStyle = linear(ctx, 0, y, 0, y + depth, [[0, 0x140e0a, 0.25], [1, 0x140e0a, 0]]);
  ctx.fillRect(x, y, w, depth);
}

function flatRoof(ctx: Ctx, x: number, y: number, w: number, h: number, color: number, rand: Rand): void {
  ctx.fillStyle = linear(ctx, x, y, x + w, y + h, [[0, shade(color, 0.05)], [1, shade(color, -0.07)]]);
  withHeight(mat(H.flatRoof), () => ctx.fillRect(x, y, w, h));
  for (let i = 0; i < w * h * 0.25; i++) {
    ctx.fillStyle = rgba(rand() < 0.5 ? shade(color, -0.2) : shade(color, 0.16), 0.35);
    ctx.fillRect(x + rand() * w, y + rand() * h, 0.6, 0.6);
  }
  // Parapet.
  ctx.strokeStyle = rgba(shade(color, 0.22), 1);
  ctx.lineWidth = 1.6;
  withHeight(mat(H.parapet), () => ctx.strokeRect(x + 0.8, y + 0.8, w - 1.6, h - 1.6));
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
}

// ── Openings and details ──────────────────────────────────────────────────

interface WindowStyle {
  frame: number;
  glow?: number;
  shutters?: number;
  flowers?: boolean;
  arch?: boolean;
  mullion?: boolean;
}

function windowAt(ctx: Ctx, x: number, y: number, w: number, h: number, style: WindowStyle, rand: Rand): void {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + 0.6, y + 0.8, w, h);
  ctx.fillStyle = rgba(style.frame, 1);
  withHeight(mat(H.frame, 0.2), () => {
    if (style.arch) { roundRect(ctx, x - 0.8, y - 0.8, w + 1.6, h + 1.6, [w / 2, w / 2, 0.6, 0.6]); ctx.fill(); }
    else ctx.fillRect(x - 0.8, y - 0.8, w + 1.6, h + 1.6);
  });
  // Glass: sky reflection on top, warm interior below.
  const glass = linear(ctx, x, y, x + w * 0.4, y + h, [[0, 0xbfd8e0], [0.45, 0x5d7c88], [1, style.glow ?? 0x2f3e45]]);
  ctx.fillStyle = glass;
  withHeight(mat(H.recess, 0.9, style.glow ? 0.3 : 0), () => {
    if (style.arch) { roundRect(ctx, x, y, w, h, [w / 2 - 0.6, w / 2 - 0.6, 0, 0]); ctx.fill(); }
    else ctx.fillRect(x, y, w, h);
  });
  if (style.glow) {
    ctx.fillStyle = radial(ctx, x + w / 2, y + h * 0.7, 0, w, [[0, style.glow, 0.55], [1, style.glow, 0]]);
    ctx.fillRect(x, y, w, h);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.moveTo(x + 0.6, y + h * 0.55); ctx.lineTo(x + w * 0.45, y + 0.4); ctx.lineTo(x + w * 0.6, y + 0.4); ctx.lineTo(x + 0.6, y + h * 0.75); ctx.closePath(); ctx.fill();
  if (style.mullion !== false) {
    ctx.fillStyle = rgba(style.frame, 1);
    withHeight(mat(H.recess + 0.05, 0.2), () => {
      ctx.fillRect(x + w / 2 - 0.35, y, 0.7, h);
      ctx.fillRect(x, y + h * 0.48, w, 0.6);
    });
  }
  // Sill.
  ctx.fillStyle = linear(ctx, 0, y + h + 0.4, 0, y + h + 1.8, [[0, 0xe8e2d4], [1, 0x8d877a]]);
  withHeight(mat(H.sill), () => ctx.fillRect(x - 1.2, y + h + 0.5, w + 2.4, 1.3));
  if (style.shutters !== undefined) {
    for (const sx of [x - 3.2, x + w + 0.8]) {
      ctx.fillStyle = linear(ctx, sx, 0, sx + 2.4, 0, [[0, shade(style.shutters, 0.08)], [1, shade(style.shutters, -0.12)]]);
      withHeight(mat(H.frame - 0.01), () => ctx.fillRect(sx, y - 0.5, 2.4, h + 1));
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let ly = y + 1; ly < y + h; ly += 1.6) ctx.fillRect(sx + 0.3, ly, 1.8, 0.35);
    }
  }
  if (style.flowers) {
    ctx.fillStyle = linear(ctx, 0, y + h + 1.6, 0, y + h + 4, [[0, 0x8a5a36], [1, 0x4d3220]]);
    withHeight(mat(H.sill + 0.03), () => ctx.fillRect(x - 0.8, y + h + 1.6, w + 1.6, 2.4));
    for (let i = 0; i < w * 1.4; i++) {
      ctx.fillStyle = rgba([0xe4553b, 0xf1c440, 0xf5f1e3, 0xd77fb3][Math.floor(rand() * 4)], 0.95);
      ctx.beginPath(); ctx.arc(x + rand() * w, y + h + 1.2 + rand() * 1.2, 0.55 + rand() * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(0x4f7d35, 0.9);
      ctx.beginPath(); ctx.arc(x + rand() * w, y + h + 1.8 + rand(), 0.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function doorAt(ctx: Ctx, x: number, y: number, w: number, h: number, color: number, { arch = false, glass = false, frame = 0x3b2a1e, step = true } = {}): void {
  if (step) {
    ctx.fillStyle = linear(ctx, 0, y + h, 0, y + h + 2.6, [[0, 0xb8b2a2], [1, 0x6f6a60]]);
    withHeight(mat(0.08), () => ctx.fillRect(x - 2, y + h - 0.2, w + 4, 2.6));
  }
  ctx.fillStyle = rgba(frame, 1);
  withHeight(mat(H.frame), () => {
    if (arch) { roundRect(ctx, x - 1, y - 1, w + 2, h + 1, [w / 2 + 1, w / 2 + 1, 0, 0]); ctx.fill(); }
    else ctx.fillRect(x - 1, y - 1, w + 2, h + 1);
  });
  ctx.save();
  if (arch) { roundRect(ctx, x, y, w, h, [w / 2, w / 2, 0, 0]); ctx.clip(); }
  if (glass) {
    ctx.fillStyle = linear(ctx, x, y, x + w, y + h, [[0, 0xa9cbd4], [0.5, 0x3d5a64], [1, 0x1d2a2f]]);
    withHeight(mat(H.recess - 0.02, 0.9, 0.12), () => ctx.fillRect(x, y, w, h));
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x + w * 0.15, y, w * 0.18, h);
  } else {
    planks(ctx, x, y, w, h, color, Math.round(x * 3), true, H.recess);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + 1, y + 1.5, w - 2, 0.6);
    ctx.fillRect(x + 1, y + h - 3, w - 2, 0.6);
  }
  ctx.restore();
  ctx.fillStyle = rgba(0xd8b860, 1);
  withHeight(mat(H.frame, 0.8), () => { ctx.beginPath(); ctx.arc(x + w - 1.6, y + h * 0.55, 0.55, 0, Math.PI * 2); ctx.fill(); });
}

function chimney(ctx: Ctx, x: number, y: number, w: number, h: number, rand: Rand): void {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + w, y + 2, 2.4, h - 2);
  stoneWall(ctx, x, y, w, h, 0x8a6f5c, rand, 2.4, 0.62);
  ctx.fillStyle = linear(ctx, 0, y - 1.4, 0, y + 1, [[0, 0x9c9a90], [1, 0x55534c]]);
  withHeight(mat(1), () => ctx.fillRect(x - 0.8, y - 1.2, w + 1.6, 2));
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(x + 0.8, y - 1, w - 1.6, 0.9);
}

function signboard(ctx: Ctx, x: number, y: number, w: number, h: number, text: string, bg: number, fg: number, glow = false): void {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, x + 0.5, y + 0.7, w, h, 1); ctx.fill();
  ctx.fillStyle = linear(ctx, 0, y, 0, y + h, [[0, shade(bg, 0.08)], [1, shade(bg, -0.12)]]);
  withHeight(mat(H.frame + 0.05, 0.15), () => { roundRect(ctx, x, y, w, h, 1); ctx.fill(); });
  ctx.strokeStyle = rgba(shade(bg, -0.45), 1);
  ctx.lineWidth = 0.35;
  roundRect(ctx, x, y, w, h, 1); ctx.stroke();
  ctx.font = `700 ${h * 0.62}px Syne, "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (glow) {
    ctx.shadowColor = rgba(fg, 0.9);
    ctx.shadowBlur = 3;
  }
  ctx.fillStyle = rgba(fg, 1);
  withHeight(glow ? mat(H.frame + 0.05, 0, 0.9) : null, () => ctx.fillText(text, x + w / 2, y + h / 2 + 0.2, w - 2));
  ctx.shadowBlur = 0;
}

function lamp(ctx: Ctx, x: number, y: number, color = 0xffd890): void {
  ctx.fillStyle = rgba(0x2a2622, 1);
  ctx.fillRect(x - 0.3, y - 2.4, 0.6, 2.4);
  ctx.fillStyle = radial(ctx, x, y + 0.9, 0, 4, [[0, color, 0.55], [1, color, 0]]);
  ctx.fillRect(x - 4, y - 3, 8, 8);
  ctx.fillStyle = rgba(0x2a2622, 1);
  withHeight(mat(H.frame + 0.08, 0.4), () => { roundRect(ctx, x - 1.1, y - 0.4, 2.2, 2.6, 0.5); ctx.fill(); });
  ctx.fillStyle = rgba(color, 1);
  withHeight(mat(H.frame + 0.08, 0, 1), () => ctx.fillRect(x - 0.6, y + 0.1, 1.2, 1.6));
}

function plantPot(ctx: Ctx, x: number, y: number, rand: Rand): void {
  softEllipse(ctx, x + 0.5, y + 0.5, 2.8, 1, 0x000000, 0.4);
  ctx.fillStyle = linear(ctx, x - 2, 0, x + 2, 0, [[0, 0xc26b45], [1, 0x7a3a22]]);
  withHeight(mat(H.prop), () => { ctx.beginPath(); ctx.moveTo(x - 2, y - 3); ctx.lineTo(x + 2, y - 3); ctx.lineTo(x + 1.5, y); ctx.lineTo(x - 1.5, y); ctx.closePath(); ctx.fill(); });
  ctx.fillStyle = rgba(0x3f6e2c, 1);
  withHeight(mat(H.prop + 0.05), () => { smoothPath(ctx, blobPoints(x, y - 5, 2.8, 2.4, 8, 0.25, rand)); ctx.fill(); });
  ctx.fillStyle = rgba(0x6f9e45, 0.8);
  ctx.beginPath(); ctx.arc(x - 0.8, y - 5.8, 1, 0, Math.PI * 2); ctx.fill();
}

function crates(ctx: Ctx, x: number, y: number, rand: Rand): void {
  softEllipse(ctx, x + 4, y, 7, 1.6, 0x000000, 0.4);
  for (const [cx, cy, s] of [[x, y - 6, 6], [x + 6.2, y - 5, 5], [x + 2.4, y - 11, 5]] as Array<[number, number, number]>) {
    withHeight(mat(H.prop + 0.02), () => woodBoard(ctx, cx, cy, s, s, 0x9a7448, Math.round(cx + cy + rand() * 10)));
    ctx.strokeStyle = 'rgba(40,24,12,0.8)';
    ctx.lineWidth = 0.45;
    ctx.strokeRect(cx, cy, s, s);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + s, cy + s); ctx.stroke();
  }
}

function barrel(ctx: Ctx, x: number, y: number): void {
  softEllipse(ctx, x + 1, y, 3.4, 1.2, 0x000000, 0.45);
  ctx.fillStyle = linear(ctx, x - 3, 0, x + 3, 0, [[0, 0x9a6a40], [0.5, 0x7a4f2e], [1, 0x4a2f1a]]);
  withHeight(heightGradient(x - 3, 0, x + 3, 0, [[0, H.prop - 0.03], [0.45, H.prop + 0.03], [1, H.prop - 0.04]]), () => { roundRect(ctx, x - 3, y - 7, 6, 7, 1.6); ctx.fill(); });
  ctx.fillStyle = rgba(0x3c3c38, 1);
  ctx.fillRect(x - 3, y - 5.8, 6, 0.6); ctx.fillRect(x - 3, y - 2, 6, 0.6);
  ctx.fillStyle = radial(ctx, x, y - 7, 0.3, 3, [[0, 0xb08050], [1, 0x6a4526]]);
  ctx.beginPath(); ctx.ellipse(x, y - 7, 3, 1.1, 0, 0, Math.PI * 2); ctx.fill();
}

function groundShade(ctx: Ctx, x: number, y: number, w: number): void {
  ctx.fillStyle = linear(ctx, 0, y - 3, 0, y + 1, [[0, 0x000000, 0], [1, 0x000000, 0.32]]);
  ctx.fillRect(x, y - 3, w, 4);
}

// ── Buildings ─────────────────────────────────────────────────────────────

interface Placement { left: number; top: number; width: number; height: number }

export interface LandmarkArtEntry {
  w: number;
  h: number;
  paint: (ctx: Ctx, w: number, h: number) => void;
  /** Flat landmarks never occlude characters. */
  ground?: boolean;
  shadow?: boolean;
  /** Units above the image bottom used as the y-sort foot line. */
  sortInset?: number;
  decorate?: (scene: Phaser.Scene, at: Placement, add: (object: Phaser.GameObjects.GameObject & { x: number; y: number }) => void) => void;
}

const smoke = (x: number, y: number) => (scene: Phaser.Scene, at: Placement, add: (o: Phaser.GameObjects.Image) => void) => {
  for (let i = 0; i < 4; i++) {
    const puff = addWorldImage(scene, at.left + x, at.top + y, FX.glow).setTint(0xe8e4dc).setAlpha(0)
      .setDisplaySize(6, 6).setDepth(standingDepth(at.top + at.height) + 0.01);
    add(puff);
    scene.tweens.add({
      targets: puff, y: puff.y - 26, x: puff.x + 9, displayWidth: 18, displayHeight: 14,
      alpha: { from: 0.28, to: 0 }, duration: 3600, delay: i * 900, repeat: -1, ease: 'Sine.easeOut',
    });
  }
};

const blinker = (x: number, y: number, color: number, period = 1400) => (scene: Phaser.Scene, at: Placement, add: (o: Phaser.GameObjects.Image) => void) => {
  const glow = addWorldImage(scene, at.left + x, at.top + y, FX.glow).setTint(color).setDisplaySize(10, 10)
    .setBlendMode(Phaser.BlendModes.ADD).setDepth(standingDepth(at.top + at.height) + 0.01);
  add(glow);
  scene.tweens.add({ targets: glow, alpha: { from: 1, to: 0.15 }, duration: period / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
};

const combine = (...fns: Array<NonNullable<LandmarkArtEntry['decorate']>>): NonNullable<LandmarkArtEntry['decorate']> =>
  (scene, at, add) => fns.forEach(fn => fn(scene, at, add));

function cottage(ctx: Ctx, w: number, h: number): void {
  const rand = rng(1);
  const wallTop = 50, base = h - 4;
  chimney(ctx, w * 0.7, 8, 6, 18, rand);
  plaster(ctx, 8, wallTop, w - 16, base - wallTop, 0xe9dcc2, rand);
  timberFrame(ctx, 8, wallTop, w - 16, base - wallTop, 0x5a3c26, [0, 22, 48, 74, w - 16]);
  eaveShadow(ctx, 8, wallTop, w - 16);
  stoneWall(ctx, 6, base - 5, w - 12, 5, 0x8c8676, rand, 2.5);
  hipRoof(ctx, { x: 2, y: 6, w: w - 4, h: wallTop - 4, color: 0xa4513a, material: 'tile', hip: 18 }, rand);
  windowAt(ctx, 18, wallTop + 10, 11, 12, { frame: 0xf2ead8, glow: 0xffc56b, shutters: 0x3f6b52, flowers: true }, rand);
  windowAt(ctx, w - 30, wallTop + 10, 11, 12, { frame: 0xf2ead8, glow: 0xffc56b, shutters: 0x3f6b52, flowers: true }, rand);
  doorAt(ctx, w / 2 - 6, wallTop + 11, 12, base - wallTop - 11, 0x4f6f48, { arch: true });
  lamp(ctx, w / 2 + 9, wallTop + 9);
  plantPot(ctx, w / 2 - 12, base + 1, rand);
  groundShade(ctx, 6, base + 1, w - 12);
}

function professorLab(ctx: Ctx, w: number, h: number): void {
  const rand = rng(2);
  const wallTop = 56, base = h - 4;
  brickWall(ctx, 6, wallTop, w - 12, base - wallTop, 0x9b5a45, rand);
  eaveShadow(ctx, 6, wallTop, w - 12, 6);
  stoneWall(ctx, 4, base - 6, w - 8, 6, 0x8f8a7c, rand, 3);
  hipRoof(ctx, { x: 0, y: 14, w: w, h: wallTop - 12, color: 0x40576a, material: 'slate', hip: 22 }, rand);
  // Observatory dome on the roof.
  const dx = w * 0.3, dy = 20;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(dx + 3, dy + 12, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = radial(ctx, dx, dy + 4, 1, 16, [[0, 0xe2e6e4], [0.6, 0xa8b0b2], [1, 0x5d6669]], dx - 6, dy - 2);
  withHeight(heightRadial(dx, dy + 10, 14, [[0, 1], [0.7, 0.92], [1, 0.8]], 0.5), () => { ctx.beginPath(); ctx.arc(dx, dy + 10, 14, Math.PI, 0); ctx.closePath(); ctx.fill(); });
  ctx.fillStyle = rgba(0x1a2226, 1);
  ctx.fillRect(dx - 2, dy - 3.5, 4, 13.5);
  ctx.strokeStyle = 'rgba(40,50,55,0.6)';
  ctx.lineWidth = 0.4;
  for (const a of [-0.6, 0.6]) { ctx.beginPath(); ctx.moveTo(dx + a * 14 * 0.7, dy + 10); ctx.quadraticCurveTo(dx + a * 9, dy, dx + a * 2, dy - 3.6); ctx.stroke(); }
  // Antenna array.
  const ax = w * 0.76;
  ctx.strokeStyle = rgba(0x30383c, 1);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ax, 30); ctx.lineTo(ax, 2); ctx.stroke();
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(ax - 5 + i, 6 + i * 4); ctx.lineTo(ax + 5 - i, 6 + i * 4); ctx.stroke(); }
  // Big glazed façade and an entrance canopy.
  for (let i = 0; i < 4; i++) windowAt(ctx, 16 + i * 17 + (i > 1 ? 34 : 0), wallTop + 9, 12, 16, { frame: 0x26303a, glow: 0x9ee6ff }, rand);
  doorAt(ctx, w / 2 - 8, wallTop + 12, 16, base - wallTop - 12, 0x2f3d44, { glass: true, frame: 0x1e262c });
  ctx.fillStyle = linear(ctx, 0, wallTop + 5, 0, wallTop + 9, [[0, 0x6e7a80], [1, 0x343c40]]);
  withHeight(mat(H.frame + 0.12, 0.4), () => ctx.fillRect(w / 2 - 14, wallTop + 6, 28, 3));
  signboard(ctx, w / 2 - 15, wallTop - 1, 30, 6, 'SOUND LAB', 0x1d262c, 0x9ff0ff, true);
  groundShade(ctx, 4, base + 1, w - 8);
}

function clinic(ctx: Ctx, w: number, h: number, modern = false): void {
  const rand = rng(modern ? 33 : 3);
  const wallTop = modern ? 26 : 48, base = h - 3;
  if (modern) {
    panels(ctx, 4, wallTop, w - 8, base - wallTop, 0xd6dcda, rand, 10);
    flatRoof(ctx, 2, 4, w - 4, wallTop - 4, 0x6b7476, rand);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(4, wallTop, w - 8, 2);
  } else {
    plaster(ctx, 6, wallTop, w - 12, base - wallTop, 0xf4f1ea, rand);
    eaveShadow(ctx, 6, wallTop, w - 12);
    hipRoof(ctx, { x: 0, y: 6, w, h: wallTop - 4, color: 0x4f7f7a, material: 'tile', hip: 16 }, rand);
    stoneWall(ctx, 5, base - 4, w - 10, 4, 0x9a968a, rand, 2);
  }
  // Healing wave emblem: a soft green cross with a waveform through it.
  const ex = w / 2, ey = wallTop + (modern ? 6 : 6);
  ctx.fillStyle = rgba(0xffffff, 1);
  withHeight(heightRadial(ex, ey, 4.6, [[0, H.frame + 0.06], [1, H.frame + 0.02]], 0.3), () => { ctx.beginPath(); ctx.arc(ex, ey, 4.6, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = rgba(0x3fbf8a, 1);
  ctx.fillRect(ex - 1.2, ey - 3.4, 2.4, 6.8); ctx.fillRect(ex - 3.4, ey - 1.2, 6.8, 2.4);
  const wy = wallTop + (modern ? 16 : 18);
  windowAt(ctx, 12, wy, 14, 12, { frame: modern ? 0x39464a : 0xe8efe9, glow: 0xdff7ff }, rand);
  windowAt(ctx, w - 26, wy, 14, 12, { frame: modern ? 0x39464a : 0xe8efe9, glow: 0xdff7ff }, rand);
  doorAt(ctx, w / 2 - 6, wy - 2, 12, base - wy + 2, 0x5e8f8a, { glass: true, frame: modern ? 0x2e383b : 0xd5ddd8 });
  if (!modern) { lamp(ctx, w / 2 - 9, wy - 3, 0xd8fff0); lamp(ctx, w / 2 + 9, wy - 3, 0xd8fff0); }
  groundShade(ctx, 4, base + 1, w - 8);
}

function inn(ctx: Ctx, w: number, h: number, modern = false): void {
  const rand = rng(modern ? 44 : 4);
  const wallTop = modern ? 26 : 40, base = h - 3;
  if (modern) {
    stoneWall(ctx, 4, wallTop, w - 8, base - wallTop, 0x8e8c84, rand, 3.6);
    hipRoof(ctx, { x: 0, y: 3, w, h: wallTop - 2, color: 0x4a5258, material: 'metal', hip: 10 }, rand);
  } else {
    // Loft band under the eaves, then a full-height stone ground floor.
    const loft = (base - wallTop) * 0.3;
    plaster(ctx, 6, wallTop, w - 12, base - wallTop, 0xeadbbd, rand);
    timberFrame(ctx, 6, wallTop, w - 12, loft, 0x5b3a24, [0, 18, 36, 56, 78, w - 12]);
    stoneWall(ctx, 6, wallTop + loft, w - 12, base - wallTop - loft, 0x9a8f7c, rand, 3.4);
    eaveShadow(ctx, 6, wallTop, w - 12);
    hipRoof(ctx, { x: 0, y: 4, w, h: wallTop - 2, color: 0x8f4433, material: 'tile', hip: 18 }, rand);
    chimney(ctx, 24, 0, 6, 14, rand);
    for (const x of [16, 44, w - 58, w - 28]) windowAt(ctx, x, wallTop + 3, 9, 8, { frame: 0xf0e6d0, glow: 0xffc061, flowers: true }, rand);
  }
  // Door and windows sized to the people walking in (door ~1.15x their height).
  const doorTop = base - 32, lower = base - 27;
  windowAt(ctx, 12, lower, 12, 13, { frame: modern ? 0x2a2f33 : 0x4b3322, glow: 0xffb24a }, rand);
  windowAt(ctx, w - 24, lower, 12, 13, { frame: modern ? 0x2a2f33 : 0x4b3322, glow: 0xffb24a }, rand);
  doorAt(ctx, w / 2 - 7, doorTop, 14, base - doorTop, 0x6b3f25, { arch: !modern });
  // Hanging tavern sign / neon on the Junction branch.
  if (modern) signboard(ctx, w / 2 - 14, wallTop + 3, 28, 6, 'INN 24/7', 0x15191c, 0xffa24a, true);
  else {
    ctx.strokeStyle = rgba(0x2a2420, 1); ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(w / 2 + 10, doorTop - 1); ctx.lineTo(w / 2 + 20, doorTop - 1); ctx.stroke();
    signboard(ctx, w / 2 + 12, doorTop, 10, 7, 'INN', 0x7a4a2a, 0xf6e2b8);
  }
  barrel(ctx, 8, base + 1);
  groundShade(ctx, 4, base + 1, w - 8);
}

function workshop(ctx: Ctx, w: number, h: number, modern = false): void {
  const rand = rng(modern ? 55 : 5);
  const wallTop = modern ? 24 : 34, base = h - 3;
  if (modern) {
    ctx.fillStyle = rgba(0x59636a, 1);
    ctx.fillRect(4, wallTop, w - 8, base - wallTop);
    for (let x = 4; x < w - 4; x += 2.4) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, wallTop, 0.6, base - wallTop); ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x + 0.6, wallTop, 0.6, base - wallTop); }
    hipRoof(ctx, { x: 0, y: 4, w, h: wallTop - 3, color: 0x6c7276, material: 'metal', hip: 6 }, rand);
  } else {
    planks(ctx, 5, wallTop, w - 10, base - wallTop, 0x8a6240, 500, true);
    eaveShadow(ctx, 5, wallTop, w - 10);
    hipRoof(ctx, { x: 0, y: 4, w, h: wallTop - 3, color: 0x6e5a48, material: 'shingle', hip: 14 }, rand);
  }
  // Wide roller/barn door with a speaker cabinet stacked outside.
  const dw = w * 0.36, dx = w * 0.42;
  ctx.fillStyle = rgba(0x1b1714, 1);
  ctx.fillRect(dx - 1, wallTop + 6, dw + 2, base - wallTop - 6);
  if (modern) {
    for (let y = wallTop + 7; y < base; y += 1.8) { ctx.fillStyle = y % 3.6 < 1.8 ? '#7b858b' : '#5d666b'; ctx.fillRect(dx, y, dw, 1.8); }
  } else {
    planks(ctx, dx, wallTop + 7, dw, base - wallTop - 7, 0x6a4a30, 520, true);
    ctx.strokeStyle = rgba(0x3a2a1c, 1); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(dx, wallTop + 7); ctx.lineTo(dx + dw, base); ctx.moveTo(dx + dw, wallTop + 7); ctx.lineTo(dx, base); ctx.stroke();
  }
  windowAt(ctx, 10, wallTop + 10, 10, 9, { frame: 0x3a2a1c, glow: 0xffd28a }, rand);
  // Speaker stack.
  const sx = w - 18, sy = base - 16;
  for (const [ox, oy, size] of [[0, 8, 9], [1, 0, 7.5]] as Array<[number, number, number]>) {
    ctx.fillStyle = linear(ctx, sx + ox, 0, sx + ox + size, 0, [[0, 0x2e2c2a], [1, 0x141312]]);
    withHeight(mat(H.prop, 0.3), () => { roundRect(ctx, sx + ox, sy + oy, size, size, 0.8); ctx.fill(); });
    ctx.fillStyle = radial(ctx, sx + ox + size / 2, sy + oy + size / 2, 0.3, size * 0.4, [[0, 0x6a6a66], [0.5, 0x2a2a28], [1, 0x101010]]);
    ctx.beginPath(); ctx.arc(sx + ox + size / 2, sy + oy + size / 2, size * 0.36, 0, Math.PI * 2); ctx.fill();
  }
  if (!modern) crates(ctx, 6, base + 1, rand);
  signboard(ctx, dx + dw / 2 - 11, wallTop + 1, 22, 4.5, modern ? 'REPAIR' : 'WORKSHOP', modern ? 0x14191c : 0x5a3a22, modern ? 0x7ff0ff : 0xf2d7a6, modern);
  groundShade(ctx, 4, base + 1, w - 8);
}

function riversideHut(ctx: Ctx, w: number, h: number): void {
  const rand = rng(6);
  const wallTop = 34, base = h - 6;
  // Stilts and a little jetty.
  for (const x of [10, w - 12]) { ctx.fillStyle = rgba(0x3c2a1c, 1); ctx.fillRect(x, base - 2, 2.4, 8); }
  planks(ctx, 6, wallTop, w - 12, base - wallTop, 0x7a5a3a, 600, false);
  eaveShadow(ctx, 6, wallTop, w - 12);
  hipRoof(ctx, { x: 0, y: 2, w, h: wallTop, color: 0xb49a64, material: 'thatch', hip: 16 }, rand);
  windowAt(ctx, 14, wallTop + 9, 10, 9, { frame: 0x4b3322, glow: 0xffc46a, shutters: 0x55745a }, rand);
  doorAt(ctx, w / 2 + 4, wallTop + 8, 11, base - wallTop - 8, 0x5c3e26, { step: false });
  // Fishing net and a rod leaning on the wall.
  ctx.strokeStyle = 'rgba(210,200,170,0.6)'; ctx.lineWidth = 0.25;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(w - 24 + i * 2, wallTop + 6); ctx.lineTo(w - 26 + i * 2.4, base - 4); ctx.stroke(); }
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(w - 26, wallTop + 8 + i * 4); ctx.lineTo(w - 12, wallTop + 7 + i * 4); ctx.stroke(); }
  barrel(ctx, 10, base + 2);
  groundShade(ctx, 4, base + 2, w - 8);
}

function signalStation(ctx: Ctx, w: number, h: number): void {
  const rand = rng(7);
  const wallTop = 34, base = h - 3;
  panels(ctx, 4, wallTop, w - 8, base - wallTop, 0xbfc6c4, rand, 14);
  flatRoof(ctx, 0, 6, w, wallTop - 6, 0x5f686b, rand);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(4, wallTop, w - 8, 2.4);
  // Solar panels and a dish on the roof.
  for (let i = 0; i < 4; i++) {
    const px = 14 + i * 16, py = 12;
    ctx.fillStyle = linear(ctx, px, py, px + 13, py + 10, [[0, 0x3c5a78], [1, 0x14243a]]);
    withHeight(mat(H.flatRoof + 0.04, 0.8), () => ctx.fillRect(px, py, 13, 10));
    ctx.strokeStyle = 'rgba(160,200,230,0.35)'; ctx.lineWidth = 0.25;
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(px + k * 3.25, py); ctx.lineTo(px + k * 3.25, py + 10); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(px, py + 5); ctx.lineTo(px + 13, py + 5); ctx.stroke();
  }
  const dx = w - 34, dy = 18;
  ctx.fillStyle = radial(ctx, dx, dy, 1, 10, [[0, 0xf2f4f2], [0.7, 0xb8c0c0], [1, 0x6a7272]], dx - 3, dy - 3);
  withHeight(heightRadial(dx, dy, 10, [[0, H.flatRoof + 0.02], [1, H.flatRoof + 0.12]], 0.6), () => { ctx.beginPath(); ctx.ellipse(dx, dy, 10, 7, -0.4, 0, Math.PI * 2); ctx.fill(); });
  ctx.strokeStyle = rgba(0x3a4244, 1); ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx + 6, dy - 7); ctx.stroke();
  // Mast.
  const mx = w - 14;
  ctx.strokeStyle = rgba(0x2b3336, 1); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(mx, wallTop - 2); ctx.lineTo(mx, 0.5); ctx.stroke();
  ctx.lineWidth = 0.4;
  for (let y = 4; y < wallTop - 4; y += 4) { ctx.beginPath(); ctx.moveTo(mx - 2, y); ctx.lineTo(mx + 2, y + 4); ctx.moveTo(mx + 2, y); ctx.lineTo(mx - 2, y + 4); ctx.stroke(); }
  // Glass curtain wall with a lit lobby.
  ctx.fillStyle = linear(ctx, 0, wallTop + 8, 0, base, [[0, 0x9fc4cf], [0.4, 0x3e6370], [1, 0x162a31]]);
  withHeight(mat(H.recess, 0.9, 0.25), () => ctx.fillRect(w * 0.3, wallTop + 8, w * 0.4, base - wallTop - 8));
  ctx.fillStyle = radial(ctx, w / 2, base - 8, 0, 30, [[0, 0xffe2a8, 0.5], [1, 0xffe2a8, 0]]);
  ctx.fillRect(w * 0.3, wallTop + 8, w * 0.4, base - wallTop - 8);
  for (let x = w * 0.3; x <= w * 0.7; x += w * 0.08) { ctx.fillStyle = rgba(0x1d2529, 1); ctx.fillRect(x - 0.4, wallTop + 8, 0.8, base - wallTop - 8); }
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath(); ctx.moveTo(w * 0.32, base); ctx.lineTo(w * 0.42, wallTop + 8); ctx.lineTo(w * 0.47, wallTop + 8); ctx.lineTo(w * 0.37, base); ctx.closePath(); ctx.fill();
  for (const x of [10, 28, w - 46, w - 28]) windowAt(ctx, x, wallTop + 12, 12, 12, { frame: 0x2a3236, glow: 0xbde9ff }, rand);
  signboard(ctx, w / 2 - 30, wallTop + 1.5, 60, 6, 'SIGNAL STATION', 0x11171a, 0x7ff6ff, true);
  groundShade(ctx, 4, base + 1, w - 8);
}

function guardPost(ctx: Ctx, w: number, h: number): void {
  const rand = rng(8);
  const wallTop = 24, base = h - 3;
  panels(ctx, 6, wallTop, w - 12, base - wallTop, 0x4c5a62, rand, 8);
  flatRoof(ctx, 3, 4, w - 6, wallTop - 4, 0x384247, rand);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(6, wallTop, w - 12, 2);
  // Hazard band and the booth window.
  for (let x = 6; x < w - 6; x += 4) { ctx.fillStyle = (x / 4) % 2 < 1 ? '#f0c23e' : '#1b1b1b'; ctx.fillRect(x, base - 4, 4, 2.4); }
  windowAt(ctx, 12, wallTop + 7, w - 36, 11, { frame: 0x1b2226, glow: 0xa6f0ff, mullion: false }, rand);
  doorAt(ctx, w - 22, wallTop + 2, 11, base - wallTop - 2, 0x2f3a40, { glass: true, frame: 0x161b1e, step: false });
  signboard(ctx, 14, wallTop + 1, 26, 4.5, 'CHECKPOINT', 0x141819, 0xffa142, true);
  groundShade(ctx, 4, base + 1, w - 8);
}

function archiveShrine(ctx: Ctx, w: number, h: number): void {
  const rand = rng(9);
  const wallTop = 46, base = h - 6;
  // Stepped plinth.
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = linear(ctx, 0, base - 2 + i * 2, 0, base + i * 2, [[0, 0xa8a594], [1, 0x6e6c60]]);
    withHeight(mat(0.2 - i * 0.05), () => ctx.fillRect(4 - i * 2, base - 2 + i * 2, w - 8 + i * 4, 2.2));
  }
  stoneWall(ctx, 12, wallTop, w - 24, base - wallTop - 2, 0x8c8a7a, rand, 5);
  eaveShadow(ctx, 12, wallTop, w - 24, 6);
  // Columns.
  for (const x of [8, 24, w - 32, w - 16]) {
    ctx.fillStyle = linear(ctx, x, 0, x + 8, 0, [[0, 0xd8d4c2], [0.45, 0xa9a594], [1, 0x6c6a5e]]);
    withHeight(heightGradient(x, 0, x + 8, 0, [[0, 0.4], [0.45, 0.5], [1, 0.4]]), () => ctx.fillRect(x, wallTop + 2, 8, base - wallTop - 4));
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let k = 1; k < 4; k++) ctx.fillRect(x + k * 2, wallTop + 2, 0.4, base - wallTop - 4);
    ctx.fillStyle = rgba(0xc8c4b2, 1);
    withHeight(mat(0.54), () => ctx.fillRect(x - 1, wallTop, 10, 2.6));
  }
  // Pediment roof with moss.
  ctx.fillStyle = linear(ctx, 0, 10, 0, wallTop, [[0, 0x5e6e60], [1, 0x3c463c]]);
  ctx.beginPath(); ctx.moveTo(2, wallTop); ctx.lineTo(w / 2, 8); ctx.lineTo(w - 2, wallTop); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.clip();
  roofCourses(ctx, 0, 8, w, wallTop - 8, 0x5b6a5c, 'slate', rand);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = rgba(rand() < 0.5 ? 0x4f6d33 : 0x6a8a3e, 0.6);
    ctx.beginPath(); ctx.ellipse(rand() * w, 12 + rand() * (wallTop - 14), 1 + rand() * 3, 0.6 + rand() * 1.2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = rgba(0xd8d4c2, 1);
  ctx.fillRect(2, wallTop - 1.6, w - 4, 2.2);
  // The archive's resonant bell window.
  ctx.fillStyle = rgba(0x1a1e1a, 1);
  ctx.beginPath(); ctx.arc(w / 2, wallTop - 14, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = radial(ctx, w / 2, wallTop - 14, 0, 7, [[0, 0xffd889, 0.9], [1, 0xd08a3a, 0.1]]);
  withHeight(mat(H.recess + 0.3, 0.4, 0.7), () => { ctx.beginPath(); ctx.arc(w / 2, wallTop - 14, 5.5, 0, Math.PI * 2); ctx.fill(); });
  doorAt(ctx, w / 2 - 7, wallTop + 10, 14, base - wallTop - 12, 0x4a3a2a, { arch: true, frame: 0x6c6a5e, step: false });
  groundShade(ctx, 2, base + 4, w - 4);
}

function rangerHut(ctx: Ctx, w: number, h: number): void {
  const rand = rng(10);
  const wallTop = 36, base = h - 3;
  // Log walls.
  for (let y = wallTop; y < base; y += 4) {
    ctx.fillStyle = linear(ctx, 0, y, 0, y + 4, [[0, 0x8a6442], [0.5, 0x6a4a2e], [1, 0x3c2818]]);
    withHeight(heightGradient(0, y, 0, y + 3.8, [[0, 0.27], [0.45, 0.35], [1, 0.27]]), () => { roundRect(ctx, 5, y, w - 10, 3.8, 1.8); ctx.fill(); });
    for (const x of [5, w - 9]) { ctx.fillStyle = radial(ctx, x + 2, y + 1.9, 0.2, 2, [[0, 0xc89a68], [1, 0x6a4a2e]]); ctx.beginPath(); ctx.arc(x + 2, y + 1.9, 1.9, 0, Math.PI * 2); ctx.fill(); }
  }
  eaveShadow(ctx, 5, wallTop, w - 10);
  hipRoof(ctx, { x: 0, y: 4, w, h: wallTop - 2, color: 0x4a5a3a, material: 'shingle', hip: 14 }, rand);
  chimney(ctx, w - 30, 0, 6, 14, rand);
  windowAt(ctx, 12, wallTop + 9, 11, 10, { frame: 0x3a2818, glow: 0xffb75a, shutters: 0x5a3a24 }, rand);
  doorAt(ctx, w / 2 + 2, wallTop + 7, 12, base - wallTop - 7, 0x5a3a24);
  // Woodpile.
  for (let i = 0; i < 9; i++) {
    const lx = w - 22 + (i % 3) * 4.2, ly = base - 2 - Math.floor(i / 3) * 3.6;
    ctx.fillStyle = radial(ctx, lx, ly, 0.2, 2, [[0, 0xd8b080], [1, 0x6a4a2e]]);
    ctx.beginPath(); ctx.arc(lx, ly, 1.8, 0, Math.PI * 2); ctx.fill();
  }
  groundShade(ctx, 4, base + 1, w - 8);
}

function caveMouth(ctx: Ctx, w: number, h: number): void {
  const rand = rng(12);
  const openL = 64, openR = 160;
  // Rock massif framing the opening, painted as layered boulders.
  const rock = (x: number, y: number, rx: number, ry: number, tone: number) => {
    const pts = blobPoints(x, y, rx, ry, 12, 0.18, rand);
    ctx.fillStyle = radial(ctx, x, y, 1, Math.max(rx, ry) * 1.1, [[0, shade(tone, 0.25)], [0.6, tone], [1, shade(tone, -0.45)]], x - rx * 0.4, y - ry * 0.45);
    withHeight(heightRadial(x, y, Math.max(rx, ry), [[0, 0.75], [0.7, 0.55], [1, 0.3]]), () => { smoothPath(ctx, pts); ctx.fill(); });
    ctx.save(); ctx.clip();
    ctx.fillStyle = rgba(0x4f6a34, 0.45);
    ctx.beginPath(); ctx.ellipse(x - rx * 0.2, y - ry * 0.55, rx * 0.6, ry * 0.25, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  for (const [x, y, rx, ry, tone] of [
    [26, 62, 30, 34, 0x6b6a60], [42, 30, 26, 24, 0x77766a], [12, 80, 16, 16, 0x5e5d55],
    [198, 62, 30, 34, 0x66655c], [182, 30, 26, 24, 0x737266], [212, 80, 16, 16, 0x5b5a52],
    [74, 18, 26, 16, 0x7a796c], [150, 18, 26, 16, 0x75746a], [112, 12, 30, 14, 0x807f72],
  ] as Array<[number, number, number, number, number]>) rock(x, y, rx, ry, tone);
  // Lintel stones over the passage.
  ctx.fillStyle = linear(ctx, 0, 22, 0, 40, [[0, 0x7c7b70], [1, 0x3b3a34]]);
  ctx.beginPath();
  ctx.moveTo(openL - 6, 40); ctx.quadraticCurveTo(w / 2, 14, openR + 6, 40); ctx.lineTo(openR + 2, 46); ctx.quadraticCurveTo(w / 2, 24, openL - 2, 46); ctx.closePath();
  ctx.fill();
  // Darkness inside the arch fades so the shader floor stays visible near the feet.
  ctx.save();
  ctx.beginPath(); ctx.moveTo(openL, h); ctx.lineTo(openL, 46); ctx.quadraticCurveTo(w / 2, 26, openR, 46); ctx.lineTo(openR, h); ctx.closePath();
  ctx.clip();
  ctx.fillStyle = linear(ctx, 0, 26, 0, h, [[0, 0x040606, 0.98], [0.5, 0x040606, 0.72], [1, 0x040606, 0]]);
  ctx.fillRect(openL, 26, openR - openL, h - 26);
  ctx.restore();
  // Faint cold light escaping the depths.
  ctx.fillStyle = radial(ctx, w / 2, 52, 0, 40, [[0, 0x3fd8c0, 0.18], [1, 0x3fd8c0, 0]]);
  ctx.fillRect(openL, 30, openR - openL, 50);
}

export const LANDMARK_ART: Record<string, LandmarkArtEntry> = {
  'landmark-cottage': { w: 112, h: 96, paint: cottage, decorate: smoke(112 * 0.7 + 3, 8) },
  'landmark-professor-lab': { w: 160, h: 112, paint: professorLab, decorate: blinker(160 * 0.76, 2, 0xff4b3a) },
  'landmark-clinic': { w: 128, h: 96, paint: (c, w, h) => clinic(c, w, h) },
  'landmark-inn': { w: 128, h: 96, paint: (c, w, h) => inn(c, w, h), decorate: smoke(27, 0) },
  'landmark-workshop': { w: 112, h: 80, paint: (c, w, h) => workshop(c, w, h) },
  'landmark-riverside-hut': { w: 112, h: 80, paint: riversideHut },
  'landmark-signal-station': { w: 192, h: 84, paint: signalStation, decorate: combine(blinker(192 - 14, 1, 0xff4b3a, 1200), blinker(96, 37.5, 0x7ff6ff, 2600)) },
  'landmark-junction-inn': { w: 96, h: 72, paint: (c, w, h) => inn(c, w, h, true), decorate: blinker(48, 29, 0xffa24a, 3000) },
  'landmark-junction-clinic': { w: 96, h: 72, paint: (c, w, h) => clinic(c, w, h, true) },
  'landmark-junction-workshop': { w: 84, h: 60, paint: (c, w, h) => workshop(c, w, h, true) },
  'landmark-guard-post': { w: 84, h: 60, paint: guardPost, decorate: blinker(27, 26, 0xffa142, 900) },
  'landmark-archive-shrine': { w: 112, h: 112, paint: archiveShrine },
  'landmark-ranger-hut': { w: 112, h: 80, paint: rangerHut, decorate: smoke(112 - 27, 0) },
  'landmark-cave-mouth': { w: 224, h: 96, paint: caveMouth, shadow: false, sortInset: 30 },
};

export function createLandmarkTextures(scene: Phaser.Scene): void {
  Object.entries(LANDMARK_ART).forEach(([key, art]) => worldTexture(scene, key, art.w, art.h, (ctx) => {
    ctx.drawImage(paintRelief(art.w, art.h, TEXEL, art.paint), 0, 0, art.w, art.h);
  }));
}
