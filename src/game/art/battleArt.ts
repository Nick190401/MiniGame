import Phaser from 'phaser';
import { blobPoints, linear, makeCanvas, mix, radial, rgba, rng, roundRect, shade, smoothPath, type Ctx } from './paint';
import {
  arenaPlatform, clouds, foregroundFoliage, lightRays, meadowGround, mist, ridge, sky, standingStone, treeLine,
} from './landscape';

/*
 * Battle arenas and combatants. The arena canvases keep the 1672 x 941 layout
 * the BattleScene was designed around (platform centres are fractions of it).
 */

const ARENA_W = 1672, ARENA_H = 941;

/** Glow helper: strokes a path several times, wide and faint to thin and bright. */
function glowStroke(ctx: Ctx, path: () => void, color: number, width: number, intensity = 1): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [k, a] of [[6, 0.06], [3.5, 0.12], [2, 0.25], [1, 0.9]] as Array<[number, number]>) {
    ctx.strokeStyle = rgba(k === 1 ? shade(color, 0.45) : color, a * intensity);
    ctx.lineWidth = width * k;
    path();
    ctx.stroke();
  }
  ctx.restore();
}

function glowDot(ctx: Ctx, x: number, y: number, r: number, color: number, alpha = 1): void {
  ctx.fillStyle = radial(ctx, x, y, 0, r, [[0, shade(color, 0.6), alpha], [0.3, color, alpha * 0.6], [1, color, 0]]);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

// ── Arenas ────────────────────────────────────────────────────────────────

function forestArena(ctx: Ctx, w: number, h: number): void {
  const horizon = h * 0.45;
  sky(ctx, w, horizon + 20, [[0, 0x8fb4a6], [0.55, 0xcfdcc2], [1, 0xeae8cf]]);
  // Faint resonance rings: the signal hangs in the air.
  ctx.strokeStyle = 'rgba(255,255,240,0.13)';
  ctx.lineWidth = 2;
  for (let r = 60; r < 420; r += 70) { ctx.beginPath(); ctx.arc(w * 0.5, h * 0.12, r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = radial(ctx, w * 0.56, h * 0.2, 0, w * 0.35, [[0, 0xfff6d2, 0.75], [1, 0xfff6d2, 0]]);
  ctx.fillRect(0, 0, w, horizon);
  clouds(ctx, w, h * 0.04, h * 0.22, 0xffffff, 0xb6c8b8, 7, 11, 0.7);
  ridge(ctx, w, h, horizon - 10, h * 0.16, 0x9fb9ab, 0xb2c6b0, 3, 2.2, { color: 0xe6e8d2, alpha: 0.6 });
  ridge(ctx, w, h, horizon, h * 0.09, 0x7d9d86, 0x8fae92, 7, 3.4, { color: 0xdfe4cc, alpha: 0.45 });
  treeLine(ctx, w, horizon + 4, h * 0.11, 0x6f9271, 0xa9c693, 17, 'mixed', 1.2);
  mist(ctx, w, horizon + 2, h * 0.08, 0xe8ead5, 0.55);
  // Lake glint between the far trees.
  ctx.fillStyle = linear(ctx, 0, horizon - 2, 0, horizon + 22, [[0, 0x9fc8c4], [1, 0x5f938f]]);
  ctx.beginPath(); ctx.ellipse(w * 0.4, horizon + 10, w * 0.22, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 12; i++) { const x = w * 0.25 + i * 26; ctx.beginPath(); ctx.moveTo(x, horizon + 8 + (i % 3) * 4); ctx.lineTo(x + 14, horizon + 8 + (i % 3) * 4); ctx.stroke(); }
  meadowGround(ctx, w, horizon + 14, h, 0x93ad6f, 0x426c2e, 23, 6500);
  lightRays(ctx, w * 0.56, -h * 0.1, h * 1.2, 0xfff3c4, 6, 3, 0.045);
  // Framing forest on both sides.
  const sideTree = (x: number, base: number, scale: number, flip: number) => {
    ctx.save();
    ctx.translate(x, base);
    ctx.scale(scale * flip, scale);
    ctx.fillStyle = linear(ctx, -26, 0, 26, 0, [[0, 0x6a4c34], [0.5, 0x4a3424], [1, 0x2c1e14]]);
    ctx.beginPath(); ctx.moveTo(-30, 0); ctx.quadraticCurveTo(-18, -60, -16, -420); ctx.lineTo(16, -420); ctx.quadraticCurveTo(18, -60, 34, 0); ctx.closePath(); ctx.fill();
    const rand = rng(Math.round(x));
    for (let i = 0; i < 26; i++) {
      const cx = (rand() - 0.5) * 300, cy = -420 - rand() * 260;
      const r = 50 + rand() * 70;
      const lit = (cx < 0 ? 0.6 : 0.3) + (cy < -560 ? 0.2 : 0);
      ctx.fillStyle = radial(ctx, cx, cy, r * 0.1, r, [[0, mix(0x355f2e, 0x8fb862, lit)], [0.7, 0x2e5228], [1, 0x1b3218]], cx - r * 0.3, cy - r * 0.35);
      smoothPath(ctx, blobPoints(cx, cy, r, r * 0.85, 10, 0.18, rand)); ctx.fill();
    }
    ctx.restore();
  };
  sideTree(w * 0.04, h * 0.55, 0.9, 1);
  sideTree(w * 0.97, h * 0.52, 0.95, -1);
  treeLine(ctx, w * 0.18, h * 0.5, h * 0.2, 0x3f6a3a, 0x86b066, 41, 'broadleaf', 1.3);
  ctx.save(); ctx.translate(w * 0.82, 0); treeLine(ctx, w * 0.18, h * 0.5, h * 0.2, 0x3d6638, 0x7fa860, 43, 'broadleaf', 1.3); ctx.restore();
  // Standing stones with the signal glyph.
  standingStone(ctx, w * 0.12, h * 0.5, 70, 130, 0x7ff0c8, 1);
  standingStone(ctx, w * 0.055, h * 0.62, 54, 96, 0x7ff0c8, 2);
  standingStone(ctx, w * 0.93, h * 0.42, 50, 110, 0x7ff0c8, 3);
  standingStone(ctx, w * 0.86, h * 0.86, 90, 120, 0x7ff0c8, 4);
  arenaPlatform(ctx, w * 0.70, h * 0.505, w * 0.17, h * 0.062, 0xb7996a, 4, 5);
  arenaPlatform(ctx, w * 0.33, h * 0.73, w * 0.25, h * 0.1, 0xb9996a, 5, 6);
  // Wildflowers sparkle across the field.
  const rand = rng(77);
  for (let i = 0; i < 90; i++) {
    const t = rand();
    const y = horizon + 30 + t * (h - horizon - 40), x = rand() * w;
    const r = 1.5 + t * 4;
    ctx.fillStyle = rgba([0xf6f1dc, 0xf1d65a, 0xd9a3e6][i % 3], 0.9);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  foregroundFoliage(ctx, w, h, 0x2f5a2a, 9);
  // Gentle vignette.
  ctx.fillStyle = radial(ctx, w / 2, h * 0.55, h * 0.4, w * 0.75, [[0, 0x000000, 0], [1, 0x0a120a, 0.45]]);
  ctx.fillRect(0, 0, w, h);
}

function coreArena(ctx: Ctx, w: number, h: number): void {
  sky(ctx, w, h, [[0, 0x07060a], [0.45, 0x120c14], [1, 0x0b0a0c]]);
  // Distant cavern walls.
  ridge(ctx, w, h, h * 0.36, h * 0.3, 0x1b1920, 0x0e0d12, 5, 4);
  ridge(ctx, w, h, h * 0.5, h * 0.22, 0x221c22, 0x100e12, 9, 5);
  // Glowing fissures in the rock.
  const rand = rng(31);
  for (let i = 0; i < 14; i++) {
    let x = rand() * w, y = h * (0.15 + rand() * 0.4);
    const pts: Array<[number, number]> = [[x, y]];
    for (let k = 0; k < 7; k++) { x += (rand() - 0.5) * 60; y += 12 + rand() * 30; pts.push([x, y]); }
    glowStroke(ctx, () => { ctx.beginPath(); pts.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); }, i % 3 ? 0xff4a24 : 0x3fe0c8, 1.6, 0.8);
  }
  // Great rune ring behind the dais.
  const rx = w * 0.645, ry = h * 0.25;
  glowStroke(ctx, () => { ctx.beginPath(); ctx.ellipse(rx, ry, w * 0.2, h * 0.24, 0, 0, Math.PI * 2); }, 0xff5a3a, 3, 0.9);
  glowStroke(ctx, () => { ctx.beginPath(); ctx.ellipse(rx, ry, w * 0.17, h * 0.2, 0, 0, Math.PI * 2); }, 0x3fe0c8, 1.6, 0.6);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    glowDot(ctx, rx + Math.cos(a) * w * 0.185, ry + Math.sin(a) * h * 0.22, 6, i % 2 ? 0xff8a5a : 0x7ff0e0, 0.8);
  }
  // Stalactites.
  for (let i = 0; i < 26; i++) {
    const x = rand() * w, len = 60 + rand() * 180, wd = 14 + rand() * 30;
    ctx.fillStyle = linear(ctx, x - wd, 0, x + wd, 0, [[0, 0x2c2830], [0.5, 0x1a171d], [1, 0x0a090c]]);
    ctx.beginPath(); ctx.moveTo(x - wd, -4); ctx.quadraticCurveTo(x - wd * 0.3, len * 0.6, x, len); ctx.quadraticCurveTo(x + wd * 0.3, len * 0.6, x + wd, -4); ctx.closePath(); ctx.fill();
  }
  // Obsidian floor.
  const floorY = h * 0.42;
  ctx.fillStyle = linear(ctx, 0, floorY, 0, h, [[0, 0x16121a], [1, 0x221a1e]]);
  ctx.beginPath(); ctx.moveTo(0, floorY + 40); ctx.quadraticCurveTo(w * 0.5, floorY - 30, w, floorY + 30); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 22; i++) {
    let x = rand() * w, y = floorY + 40 + rand() * (h - floorY);
    const pts: Array<[number, number]> = [[x, y]];
    for (let k = 0; k < 5; k++) { x += (rand() - 0.5) * 120; y += (rand() - 0.3) * 40; pts.push([x, y]); }
    glowStroke(ctx, () => { ctx.beginPath(); pts.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); }, 0xff5226, 1.4, 0.65);
  }
  // Raised dais for the Gatekeeper.
  const dx = w * 0.645, dy = h * 0.385;
  for (let step = 3; step >= 0; step--) {
    const sw = w * (0.16 + step * 0.03), sh = h * (0.05 + step * 0.012);
    ctx.fillStyle = linear(ctx, 0, dy - sh, 0, dy + sh + step * 14, [[0, 0x3a3240], [1, 0x14111a]]);
    ctx.beginPath(); ctx.ellipse(dx, dy + step * 14, sw, sh, 0, 0, Math.PI * 2); ctx.fill();
  }
  glowStroke(ctx, () => { ctx.beginPath(); ctx.ellipse(dx, dy, w * 0.13, h * 0.04, 0, 0, Math.PI * 2); }, 0xff6b3d, 2, 0.9);
  // Player's rocky outcrop.
  const px = w * 0.24, py = h * 0.68;
  ctx.fillStyle = linear(ctx, 0, py - 40, 0, py + 80, [[0, 0x3a333c], [1, 0x120f14]]);
  smoothPath(ctx, blobPoints(px, py + 18, w * 0.2, h * 0.09, 14, 0.12, rand)); ctx.fill();
  ctx.fillStyle = radial(ctx, px - w * 0.04, py, 0, w * 0.2, [[0, 0x524955, 0.9], [1, 0x2a242c, 0]]);
  ctx.beginPath(); ctx.ellipse(px, py, w * 0.18, h * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  glowStroke(ctx, () => { ctx.beginPath(); ctx.ellipse(px, py, w * 0.14, h * 0.05, 0, 0, Math.PI * 2); }, 0x3fe0c8, 1.2, 0.5);
  // Embers rising through the heat.
  for (let i = 0; i < 120; i++) glowDot(ctx, rand() * w, rand() * h, 2 + rand() * 5, rand() < 0.7 ? 0xff7a3a : 0x7ff0e0, 0.4 + rand() * 0.5);
  mist(ctx, w, h * 0.78, h * 0.3, 0x2a1418, 0.5);
  ctx.fillStyle = radial(ctx, w / 2, h * 0.5, h * 0.3, w * 0.7, [[0, 0x000000, 0], [1, 0x000000, 0.6]]);
  ctx.fillRect(0, 0, w, h);
}

// ── Static Noise ─────────────────────────────────────────────────────────

function staticNoise(ctx: Ctx, w: number, h: number): void {
  const rand = rng(101);
  const cx = w / 2, cy = h * 0.44;
  ctx.fillStyle = radial(ctx, cx, cy, 0, w * 0.55, [[0, 0x3fe0ff, 0.22], [0.5, 0xb04bd8, 0.1], [1, 0x000000, 0]]);
  ctx.fillRect(0, 0, w, h);
  // Smoky storm body: many dark puffs, denser in the core.
  for (let i = 0; i < 140; i++) {
    const a = rand() * Math.PI * 2, d = Math.pow(rand(), 0.7);
    const px = cx + Math.cos(a) * d * w * 0.34, py = cy + Math.sin(a) * d * h * 0.22 - d * 30;
    const r = 30 + rand() * 60;
    ctx.fillStyle = radial(ctx, px, py, 0, r, [[0, mix(0x1a1c34, 0x3a2f5c, rand()), 0.85], [1, 0x0b0b16, 0]]);
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  }
  // Spiky static fringe.
  ctx.strokeStyle = 'rgba(16,16,30,0.9)';
  ctx.lineCap = 'round';
  for (let i = 0; i < 80; i++) {
    const a = rand() * Math.PI * 2;
    const r0 = w * 0.26, r1 = r0 + 20 + rand() * 70;
    ctx.lineWidth = 3 + rand() * 6;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.7); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.7); ctx.stroke();
  }
  // Smoke tail spiralling down.
  ctx.lineWidth = 26;
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = rgba(0x141428, 0.7 - k * 0.2);
    ctx.lineWidth = 26 - k * 7;
    ctx.beginPath(); ctx.moveTo(cx, cy + h * 0.2); ctx.bezierCurveTo(cx + 60, cy + h * 0.32, cx - 70, cy + h * 0.38, cx + 10, cy + h * 0.5); ctx.stroke();
  }
  glowStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(cx - 10, cy + h * 0.44); ctx.quadraticCurveTo(cx + 40, cy + h * 0.48, cx + 5, cy + h * 0.52); }, 0x5cf08a, 2, 0.7);
  // Cracked speaker cabinet in the chest.
  const sx = cx - 120, sy = cy + 40;
  ctx.fillStyle = linear(ctx, sx, sy, sx + 240, sy + 210, [[0, 0x55596a], [0.5, 0x2c2f3a], [1, 0x14151c]]);
  roundRect(ctx, sx, sy, 240, 210, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(200,210,230,0.35)'; ctx.lineWidth = 3;
  roundRect(ctx, sx + 4, sy + 4, 232, 202, 15); ctx.stroke();
  const woofer = (x: number, y: number, r: number) => {
    ctx.fillStyle = radial(ctx, x, y, 0, r, [[0, 0x6a6e80], [0.25, 0x1c1e28], [0.55, 0x353948], [0.85, 0x14151c], [1, 0x9aa0b2]], x - r * 0.3, y - r * 0.3);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(220,225,240,0.55)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r * 0.92, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = radial(ctx, x - r * 0.1, y - r * 0.1, 0, r * 0.22, [[0, 0xd0d4e0], [1, 0x3a3e4c]]);
    ctx.beginPath(); ctx.arc(x, y, r * 0.2, 0, Math.PI * 2); ctx.fill();
  };
  woofer(sx + 92, sy + 92, 68);
  woofer(sx + 186, sy + 158, 36);
  ctx.strokeStyle = 'rgba(10,10,14,0.9)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(sx + 160, sy + 10); ctx.lineTo(sx + 140, sy + 60); ctx.lineTo(sx + 172, sy + 96); ctx.lineTo(sx + 150, sy + 140); ctx.stroke();
  for (let i = 0; i < 3; i++) glowDot(ctx, sx + 190 + i * 16, sy + 40, 7, [0xd7ff4a, 0x3fe0ff, 0xff4fd0][i], 0.9);
  // Glowing eye slits.
  for (const side of [-1, 1]) {
    const ex = cx + side * 82, ey = cy - 30;
    glowStroke(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(ex - side * 52, ey + 6);
      ctx.quadraticCurveTo(ex, ey - 26, ex + side * 50, ey - 4);
      ctx.quadraticCurveTo(ex, ey + 14, ex - side * 52, ey + 6);
    }, 0xe8fbff, 4, 1);
    ctx.fillStyle = rgba(0xffffff);
    ctx.beginPath(); ctx.moveTo(ex - side * 48, ey + 5); ctx.quadraticCurveTo(ex, ey - 20, ex + side * 46, ey - 3); ctx.quadraticCurveTo(ex, ey + 10, ex - side * 48, ey + 5); ctx.fill();
  }
  // Neon waveforms slashing through the storm.
  const wave = (y: number, amp: number, color: number, freq: number, seed: number) => {
    const r2 = rng(seed);
    glowStroke(ctx, () => {
      ctx.beginPath();
      for (let x = 20; x <= w - 20; x += 6) {
        const env = Math.sin(((x - 20) / (w - 40)) * Math.PI);
        const y2 = y + Math.sin(x * freq) * amp * env + (r2() - 0.5) * amp * 0.9 * env;
        if (x === 20) ctx.moveTo(x, y2); else ctx.lineTo(x, y2);
      }
    }, color, 3.2, 1);
  };
  wave(cy - 120, 60, 0x9dff4a, 0.05, 1);
  wave(cy + 10, 50, 0x3fe0ff, 0.07, 2);
  wave(cy + 120, 70, 0xff4fd0, 0.045, 3);
  // Glitch shards drifting around.
  for (let i = 0; i < 46; i++) {
    const a = rand() * Math.PI * 2, d = w * (0.25 + rand() * 0.25);
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.95;
    const bw = 10 + rand() * 46, bh = 6 + rand() * 8;
    const color = [0x9dff4a, 0x3fe0ff, 0xff4fd0, 0xd7ff4a, 0xb09cff][i % 5];
    ctx.fillStyle = rgba(color, 0.18);
    roundRect(ctx, x - 4, y - 4, bw + 8, bh + 8, 6); ctx.fill();
    ctx.fillStyle = linear(ctx, x, y, x + bw, y, [[0, shade(color, 0.3), 0.95], [1, color, 0.7]]);
    roundRect(ctx, x, y, bw, bh, 3); ctx.fill();
  }
}

// ── Broken Signal ────────────────────────────────────────────────────────

function brokenSignal(ctx: Ctx, w: number, h: number): void {
  const rand = rng(202);
  const cx = w / 2, cy = h * 0.55;
  ctx.fillStyle = radial(ctx, cx, cy, 0, w * 0.55, [[0, 0xff5a2a, 0.22], [1, 0x000000, 0]]);
  ctx.fillRect(0, 0, w, h);
  // Antennas.
  for (const side of [-1, 1]) {
    const bx = cx + side * 80, by = cy - h * 0.12;
    const tx = cx + side * 190, ty = h * 0.04;
    ctx.lineCap = 'round';
    ctx.strokeStyle = linear(ctx, bx, by, tx, ty, [[0, 0x2a1f1a], [1, 0x8a6a3c]]);
    ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,160,0.4)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(bx - 4, by - 2); ctx.lineTo(tx - 4, ty); ctx.stroke();
    for (let k = 1; k < 5; k++) {
      const t = k / 5;
      ctx.fillStyle = rgba(0xc29a5a);
      ctx.beginPath(); ctx.arc(bx + (tx - bx) * t, by + (ty - by) * t, 9, 0, Math.PI * 2); ctx.fill();
    }
    glowDot(ctx, tx, ty, 26, 0xff8a3a, 0.9);
    for (let k = 0; k < 6; k++) glowDot(ctx, tx + (rand() - 0.5) * 50, ty + (rand() - 0.5) * 40, 4 + rand() * 4, 0xffb35a, 0.8);
  }
  // Heart of tangled cables.
  const heart = (t: number, s: number): [number, number] => {
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    return [cx + x * s, cy + y * s];
  };
  ctx.fillStyle = radial(ctx, cx, cy, 0, w * 0.45, [[0, 0x4a1418], [1, 0x1a0608]]);
  ctx.beginPath();
  for (let i = 0; i <= 80; i++) { const [x, y] = heart((i / 80) * Math.PI * 2, 16.5); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.closePath(); ctx.fill();
  ctx.lineCap = 'round';
  for (let i = 0; i < 160; i++) {
    const t0 = rand() * Math.PI * 2, t1 = t0 + (rand() - 0.5) * 2.2;
    const [x0, y0] = heart(t0, 15.4 * (0.5 + rand() * 0.55));
    const [x1, y1] = heart(t1, 15.4 * (0.5 + rand() * 0.55));
    const tone = [0x7a1a1e, 0xa42a22, 0xc8442a, 0x5a1016, 0xe06a3a][i % 5];
    ctx.strokeStyle = rgba(tone, 0.85);
    ctx.lineWidth = 3 + rand() * 7;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx + (rand() - 0.5) * w * 0.5, cy + (rand() - 0.5) * h * 0.5, x1, y1); ctx.stroke();
    if (i % 4 === 0) { ctx.strokeStyle = 'rgba(255,190,150,0.35)'; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
  // Brass speaker eyes.
  for (const side of [-1, 1]) {
    const ex = cx + side * w * 0.27, ey = cy - h * 0.1, r = h * 0.15;
    ctx.fillStyle = radial(ctx, ex - r * 0.3, ey - r * 0.3, r * 0.1, r * 1.25, [[0, 0xf0c878], [0.6, 0xa8783a], [1, 0x4a2e14]]);
    ctx.beginPath(); ctx.arc(ex, ey, r * 1.22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = radial(ctx, ex, ey, 0, r, [[0, 0xff5a2a], [0.2, 0x5a1a12], [0.6, 0x2a1210], [1, 0x120808]]);
    ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,140,90,0.45)'; ctx.lineWidth = 2;
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.arc(ex, ey, r * (k / 4), 0, Math.PI * 2); ctx.stroke(); }
    glowDot(ctx, ex, ey, r * 0.35, 0xff6a2a, 0.9);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ctx.fillStyle = rgba(0x3a2210);
      ctx.beginPath(); ctx.arc(ex + Math.cos(a) * r * 1.1, ey + Math.sin(a) * r * 1.1, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Tuner display as a mouth.
  const mx = cx - w * 0.2, my = cy + h * 0.02, mw = w * 0.4, mh = h * 0.13;
  ctx.fillStyle = linear(ctx, 0, my, 0, my + mh, [[0, 0xb08848], [1, 0x5a3a1c]]);
  roundRect(ctx, mx - 8, my - 8, mw + 16, mh + 16, 16); ctx.fill();
  ctx.fillStyle = linear(ctx, 0, my, 0, my + mh, [[0, 0x1a0e0a], [1, 0x0a0606]]);
  roundRect(ctx, mx, my, mw, mh, 10); ctx.fill();
  for (let k = 0; k < 18; k++) {
    const x = mx + 14 + k * (mw - 28) / 17;
    ctx.fillStyle = rgba(k % 3 ? 0xff9a4a : 0xffd08a, 0.85);
    ctx.fillRect(x - 1.5, my + 10, 3, k % 3 ? 14 : 22);
  }
  glowStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(mx + mw * 0.62, my + 6); ctx.lineTo(mx + mw * 0.6, my + mh - 6); }, 0xff6a2a, 2.4, 1);
  glowDot(ctx, mx + mw * 0.61, my + mh * 0.55, 24, 0xffd08a, 1);
  // Ember trail.
  for (let i = 0; i < 70; i++) {
    const t = i / 70;
    glowDot(ctx, cx + w * 0.1 + t * w * 0.35, cy + h * 0.32 - Math.sin(t * Math.PI) * h * 0.2 + (rand() - 0.5) * 20, 3 + rand() * 5, 0xffa040, 0.7 * (1 - t * 0.5));
  }
}

// ── Silence ───────────────────────────────────────────────────────────────

function silence(ctx: Ctx, w: number, h: number): void {
  const rand = rng(303);
  const cx = w / 2;
  ctx.fillStyle = radial(ctx, cx, h * 0.55, 0, w * 0.5, [[0, 0x3ff0e8, 0.16], [1, 0x000000, 0]]);
  ctx.fillRect(0, 0, w, h);
  // Ash clouds.
  for (let i = 0; i < 24; i++) {
    const x = cx + (rand() - 0.5) * w * 0.8, y = h * (0.3 + rand() * 0.5), r = 30 + rand() * 50;
    ctx.fillStyle = radial(ctx, x, y, 0, r, [[0, 0x8a8794, 0.28], [1, 0x8a8794, 0]]);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // Shadow pool.
  ctx.fillStyle = radial(ctx, cx, h * 0.92, 0, w * 0.32, [[0, 0x140a1e, 0.85], [1, 0x140a1e, 0]]);
  ctx.save(); ctx.translate(cx, h * 0.92); ctx.scale(1, 0.18); ctx.beginPath(); ctx.arc(0, 0, w * 0.32, 0, Math.PI * 2); ctx.restore(); ctx.fill();
  // The clef body: a thick smoky ribbon.
  const s = w / 600;
  const clef = () => {
    ctx.beginPath();
    ctx.moveTo(cx + 20 * s, h * 0.9);
    ctx.bezierCurveTo(cx + 40 * s, h * 0.8, cx - 20 * s, h * 0.72, cx - 10 * s, h * 0.62);
    ctx.bezierCurveTo(cx + 10 * s, h * 0.45, cx + 140 * s, h * 0.38, cx + 90 * s, h * 0.24);
    ctx.bezierCurveTo(cx + 60 * s, h * 0.12, cx - 40 * s, h * 0.16, cx - 30 * s, h * 0.3);
    ctx.bezierCurveTo(cx - 20 * s, h * 0.42, cx + 150 * s, h * 0.5, cx + 120 * s, h * 0.62);
    ctx.bezierCurveTo(cx + 90 * s, h * 0.74, cx - 140 * s, h * 0.72, cx - 130 * s, h * 0.58);
    ctx.bezierCurveTo(cx - 120 * s, h * 0.47, cx + 10 * s, h * 0.44, cx + 30 * s, h * 0.52);
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [width, color, alpha] of [[90, 0x0c0712, 0.5], [70, 0x1a1024, 1], [46, 0x2a1c38, 1], [18, 0x4a3a5c, 0.6]] as Array<[number, number, number]>) {
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = width * s;
    clef(); ctx.stroke();
  }
  // Descending stem to the bottom curl.
  ctx.strokeStyle = rgba(0x1a1024);
  ctx.lineWidth = 40 * s;
  ctx.beginPath(); ctx.moveTo(cx + 70 * s, h * 0.25); ctx.bezierCurveTo(cx + 40 * s, h * 0.5, cx + 60 * s, h * 0.7, cx + 10 * s, h * 0.86); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx - 40 * s, h * 0.84, 34 * s, 0, Math.PI * 2);
  ctx.fillStyle = radial(ctx, cx - 50 * s, h * 0.83, 0, 40 * s, [[0, 0x3a2a4c], [1, 0x140c1c]]); ctx.fill();
  // Cyan heart of the silence with two eyes.
  const gx = cx - 10 * s, gy = h * 0.6;
  ctx.fillStyle = radial(ctx, gx, gy, 0, 120 * s, [[0, 0xbffff8, 0.95], [0.25, 0x3ff0e8, 0.7], [0.6, 0x1a6a7a, 0.35], [1, 0x1a6a7a, 0]]);
  ctx.beginPath(); ctx.arc(gx, gy, 120 * s, 0, Math.PI * 2); ctx.fill();
  for (const side of [-1, 1]) {
    glowDot(ctx, gx + side * 34 * s, gy - 10 * s, 26 * s, 0xe8ffff, 1);
    ctx.fillStyle = rgba(0xffffff);
    ctx.beginPath(); ctx.ellipse(gx + side * 34 * s, gy - 10 * s, 12 * s, 18 * s, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Crack of light through the bulb.
  glowStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(gx - 80 * s, gy + 40 * s); ctx.lineTo(gx - 40 * s, gy + 10 * s); ctx.lineTo(gx - 60 * s, gy - 30 * s); }, 0x7ff8ff, 2.5 * s * 2, 0.8);
  // Glitch fragments.
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2, d = w * (0.22 + rand() * 0.22);
    const x = cx + Math.cos(a) * d, y = h * 0.5 + Math.sin(a) * d * 1.3;
    const color = i % 2 ? 0x9a5cff : 0x3fe0e8;
    ctx.fillStyle = rgba(color, 0.2);
    roundRect(ctx, x - 6, y - 6, 34, 22, 6); ctx.fill();
    ctx.fillStyle = linear(ctx, x, y, x + 22, y + 10, [[0, shade(color, 0.35), 0.95], [1, color, 0.75]]);
    roundRect(ctx, x, y, 14 + rand() * 18, 8 + rand() * 6, 3); ctx.fill();
  }
}

// ── The Gatekeeper ───────────────────────────────────────────────────────

const GATE_PHASE = [
  { glow: 0x3ff0d8, crack: 0x3ff0d8, armor: 0x1f2a3e, rim: 0x5a6e8e, eyes: 0xb8fff4 },
  { glow: 0x3ff0d8, crack: 0xff8a3a, armor: 0x24283a, rim: 0x6e6a88, eyes: 0xffd2a0 },
  { glow: 0xff4a3a, crack: 0xff3a2a, armor: 0x2a1e2a, rim: 0x8a5a6a, eyes: 0xffe0d0 },
];

function gatekeeper(ctx: Ctx, w: number, h: number, phase: number): void {
  const p = GATE_PHASE[phase];
  const rand = rng(404 + phase);
  const cx = w / 2;
  const s = w / 600;
  ctx.fillStyle = radial(ctx, cx, h * 0.45, 0, w * 0.6, [[0, p.glow, 0.18 + phase * 0.06], [1, 0x000000, 0]]);
  ctx.fillRect(0, 0, w, h);

  const armor = (path: () => void, x0: number, y0: number, x1: number, y1: number, base = p.armor) => {
    path();
    ctx.fillStyle = linear(ctx, x0, y0, x1, y1, [[0, shade(base, 0.35)], [0.45, base], [1, shade(base, -0.45)]]);
    ctx.fill();
    ctx.strokeStyle = rgba(shade(base, -0.6), 0.95);
    ctx.lineWidth = 3 * s;
    ctx.stroke();
    ctx.save();
    path();
    ctx.clip();
    ctx.strokeStyle = rgba(p.rim, 0.55);
    ctx.lineWidth = 4 * s;
    ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
    ctx.restore();
  };

  // Horns sweeping up from the shoulders: a thick ridged curve tapering to a point.
  for (const side of [-1, 1]) {
    const broken = phase === 2 && side === 1;
    const steps = broken ? 9 : 14;
    const hornPoint = (t: number): [number, number] => {
      const x = cx + side * (80 + Math.sin(t * Math.PI * 0.62) * 140) * s;
      const y = h * (0.3 - t * 0.25) - Math.sin(t * Math.PI) * 18 * s;
      return [x, y];
    };
    const horn = () => {
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = i / 14;
        const [x, y] = hornPoint(t);
        const width = (1 - t) * 34 * s + 3 * s;
        if (i === 0) ctx.moveTo(x - side * width * 0.4, y + width * 0.6); else ctx.lineTo(x - side * width * 0.4, y + width * 0.6);
      }
      for (let i = steps; i >= 0; i--) {
        const t = i / 14;
        const [x, y] = hornPoint(t);
        const width = (1 - t) * 34 * s + 3 * s;
        ctx.lineTo(x + side * width * 0.4, y - width * 0.6);
      }
      ctx.closePath();
    };
    armor(horn, cx + side * 60 * s, h * 0.04, cx + side * 230 * s, h * 0.34, mix(p.armor, 0x7a7466, 0.45));
    // Growth rings along the horn.
    for (let i = 1; i < steps; i += 2) {
      const [x, y] = hornPoint(i / 14);
      const width = (1 - i / 14) * 34 * s;
      ctx.strokeStyle = rgba(0x0a0b10, 0.55);
      ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.moveTo(x - side * width * 0.42, y + width * 0.62); ctx.lineTo(x + side * width * 0.42, y - width * 0.62); ctx.stroke();
    }
    // Chain looping off the horn.
    ctx.strokeStyle = rgba(0x6a6e78, 0.95);
    ctx.lineWidth = 3 * s;
    for (let k = 0; k < 9; k++) {
      const t = k / 8;
      const x = cx + side * (165 - t * 60) * s, y = h * (0.12 + t * 0.26);
      ctx.beginPath(); ctx.ellipse(x, y, 7 * s, 11 * s, side * 0.5 + (k % 2) * 1.2, 0, Math.PI * 2); ctx.stroke();
    }
    if (phase > 0) glowStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(cx + side * 120 * s, h * 0.27); ctx.lineTo(cx + side * 150 * s, h * 0.2); ctx.lineTo(cx + side * 140 * s, h * 0.15); }, p.crack, 2 * s, 0.9);
  }

  // Crouched legs: heavy thighs bent outward, armoured shins down to the talons.
  for (const side of [-1, 1]) {
    const thigh = () => {
      ctx.beginPath();
      ctx.moveTo(cx + side * 40 * s, h * 0.56);
      ctx.quadraticCurveTo(cx + side * 120 * s, h * 0.54, cx + side * 160 * s, h * 0.66);
      ctx.quadraticCurveTo(cx + side * 150 * s, h * 0.72, cx + side * 118 * s, h * 0.72);
      ctx.quadraticCurveTo(cx + side * 80 * s, h * 0.68, cx + side * 30 * s, h * 0.66);
      ctx.closePath();
    };
    const shin = () => {
      ctx.beginPath();
      ctx.moveTo(cx + side * 122 * s, h * 0.66);
      ctx.lineTo(cx + side * 162 * s, h * 0.68);
      ctx.quadraticCurveTo(cx + side * 150 * s, h * 0.78, cx + side * 128 * s, h * 0.87);
      ctx.lineTo(cx + side * 78 * s, h * 0.87);
      ctx.quadraticCurveTo(cx + side * 104 * s, h * 0.78, cx + side * 122 * s, h * 0.66);
      ctx.closePath();
    };
    armor(shin, cx + side * 78 * s, h * 0.66, cx + side * 162 * s, h * 0.87);
    armor(thigh, cx + side * 30 * s, h * 0.54, cx + side * 160 * s, h * 0.72);
    // Knee spike.
    ctx.fillStyle = linear(ctx, cx + side * 150 * s, h * 0.66, cx + side * 180 * s, h * 0.6, [[0, 0x4a5262], [1, 0xb0aa98]]);
    ctx.beginPath(); ctx.moveTo(cx + side * 146 * s, h * 0.64); ctx.lineTo(cx + side * 186 * s, h * 0.6); ctx.lineTo(cx + side * 156 * s, h * 0.69); ctx.closePath(); ctx.fill();
    // Talons.
    for (let k = 0; k < 3; k++) {
      const tx = cx + side * (84 + k * 18) * s, ty = h * 0.865;
      ctx.fillStyle = linear(ctx, tx, ty, tx + side * 16 * s, ty + 30 * s, [[0, 0x9a968a], [1, 0x2a2826]]);
      ctx.beginPath(); ctx.moveTo(tx - 8 * s, ty); ctx.quadraticCurveTo(tx + side * 10 * s, ty + 10 * s, tx + side * 14 * s, ty + 34 * s); ctx.lineTo(tx + 8 * s, ty); ctx.closePath(); ctx.fill();
    }
  }

  // Massive torso with rib plates.
  const torso = () => {
    ctx.beginPath();
    ctx.moveTo(cx - 110 * s, h * 0.3);
    ctx.bezierCurveTo(cx - 40 * s, h * 0.26, cx + 40 * s, h * 0.26, cx + 110 * s, h * 0.3);
    ctx.bezierCurveTo(cx + 130 * s, h * 0.45, cx + 70 * s, h * 0.62, cx, h * 0.66);
    ctx.bezierCurveTo(cx - 70 * s, h * 0.62, cx - 130 * s, h * 0.45, cx - 110 * s, h * 0.3);
    ctx.closePath();
  };
  armor(torso, cx - 120 * s, h * 0.26, cx + 120 * s, h * 0.66);
  ctx.save();
  torso();
  ctx.clip();
  for (let k = 0; k < 6; k++) {
    const y = h * (0.36 + k * 0.045);
    ctx.strokeStyle = rgba(0x0a0c12, 0.75); ctx.lineWidth = 6 * s;
    ctx.beginPath(); ctx.moveTo(cx - 100 * s, y); ctx.quadraticCurveTo(cx, y + 16 * s, cx + 100 * s, y); ctx.stroke();
    ctx.strokeStyle = rgba(p.rim, 0.45); ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(cx - 100 * s, y - 4 * s); ctx.quadraticCurveTo(cx, y + 12 * s, cx + 100 * s, y - 4 * s); ctx.stroke();
  }
  ctx.restore();
  // The resonant core.
  const coreY = h * 0.47;
  ctx.fillStyle = radial(ctx, cx, coreY, 0, 70 * s, [[0, 0xffffff], [0.2, shade(p.glow, 0.5)], [0.55, p.glow], [1, shade(p.glow, -0.7)]]);
  ctx.beginPath(); ctx.arc(cx, coreY, 50 * s, 0, Math.PI * 2); ctx.fill();
  for (let k = 1; k <= 4; k++) {
    ctx.strokeStyle = rgba(shade(p.glow, -0.5), 0.8); ctx.lineWidth = 2.5 * s;
    ctx.beginPath(); ctx.arc(cx, coreY, k * 11 * s, 0, Math.PI * 2); ctx.stroke();
  }
  glowDot(ctx, cx, coreY, 110 * s, p.glow, 0.55);
  if (phase > 0) {
    for (let k = 0; k < 4 + phase * 3; k++) {
      let x = cx + (rand() - 0.5) * 160 * s, y = h * (0.3 + rand() * 0.3);
      const pts: Array<[number, number]> = [[x, y]];
      for (let j = 0; j < 4; j++) { x += (rand() - 0.5) * 50 * s; y += (rand() - 0.2) * 30 * s; pts.push([x, y]); }
      glowStroke(ctx, () => { ctx.beginPath(); pts.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); }, p.crack, 1.6 * s, 0.9);
    }
  }

  // Arms with spiked pauldrons, perforated forearms and claws.
  for (const side of [-1, 1]) {
    const shoulder = () => {
      ctx.beginPath();
      ctx.moveTo(cx + side * 70 * s, h * 0.27);
      ctx.bezierCurveTo(cx + side * 180 * s, h * 0.22, cx + side * 230 * s, h * 0.32, cx + side * 210 * s, h * 0.42);
      ctx.bezierCurveTo(cx + side * 170 * s, h * 0.44, cx + side * 120 * s, h * 0.4, cx + side * 95 * s, h * 0.36);
      ctx.closePath();
    };
    const arm = () => {
      ctx.beginPath();
      ctx.moveTo(cx + side * 160 * s, h * 0.38);
      ctx.bezierCurveTo(cx + side * 250 * s, h * 0.48, cx + side * 255 * s, h * 0.66, cx + side * 235 * s, h * 0.8);
      ctx.lineTo(cx + side * 180 * s, h * 0.8);
      ctx.bezierCurveTo(cx + side * 190 * s, h * 0.66, cx + side * 170 * s, h * 0.52, cx + side * 130 * s, h * 0.44);
      ctx.closePath();
    };
    armor(arm, cx + side * 130 * s, h * 0.38, cx + side * 255 * s, h * 0.8);
    // Speaker-like perforations along the forearm.
    for (let k = 0; k < 6; k++) {
      const hx = cx + side * (215 - (k % 2) * 16) * s, hy = h * (0.58 + k * 0.032);
      ctx.fillStyle = radial(ctx, hx, hy, 0, 7 * s, [[0, phase === 2 ? 0xff6a3a : 0x0a0c10], [1, 0x2a3040]]);
      ctx.beginPath(); ctx.arc(hx, hy, 6 * s, 0, Math.PI * 2); ctx.fill();
    }
    // Chain wrapped around the wrist.
    ctx.strokeStyle = rgba(0x7a7e88, 0.95); ctx.lineWidth = 3 * s;
    for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.ellipse(cx + side * (190 + k * 9) * s, h * 0.76, 6 * s, 9 * s, 0.4, 0, Math.PI * 2); ctx.stroke(); }
    armor(shoulder, cx + side * 70 * s, h * 0.22, cx + side * 230 * s, h * 0.44);
    // Pauldron spikes.
    for (let k = 0; k < 3; k++) {
      const bx = cx + side * (130 + k * 30) * s, by = h * (0.25 + k * 0.01);
      ctx.fillStyle = linear(ctx, bx, by, bx + side * 20 * s, by - 50 * s, [[0, 0x4a5262], [1, 0xb0aa98]]);
      ctx.beginPath(); ctx.moveTo(bx - 12 * s, by + 6 * s); ctx.lineTo(bx + side * 8 * s, by - (44 + k * 8) * s); ctx.lineTo(bx + 14 * s, by + 8 * s); ctx.closePath(); ctx.fill();
    }
    // Claws on the ground.
    for (let k = 0; k < 4; k++) {
      const tx = cx + side * (182 + k * 17) * s, ty = h * 0.8;
      ctx.fillStyle = linear(ctx, tx, ty, tx + side * 14 * s, ty + 50 * s, [[0, 0xc0baa8], [1, 0x2a2826]]);
      ctx.beginPath(); ctx.moveTo(tx - 7 * s, ty); ctx.quadraticCurveTo(tx + side * 12 * s, ty + 18 * s, tx + side * 10 * s, ty + 56 * s); ctx.lineTo(tx + 7 * s, ty); ctx.closePath(); ctx.fill();
    }
  }

  // Armoured head with crest, glowing eyes and a toothed maw.
  const hy = h * 0.27;
  const head = () => {
    ctx.beginPath();
    ctx.moveTo(cx, hy - 70 * s);
    ctx.lineTo(cx + 52 * s, hy - 10 * s);
    ctx.lineTo(cx + 40 * s, hy + 40 * s);
    ctx.lineTo(cx, hy + 70 * s);
    ctx.lineTo(cx - 40 * s, hy + 40 * s);
    ctx.lineTo(cx - 52 * s, hy - 10 * s);
    ctx.closePath();
  };
  armor(head, cx - 52 * s, hy - 70 * s, cx + 52 * s, hy + 70 * s, mix(p.armor, 0x5a5e6a, 0.25));
  ctx.fillStyle = rgba(0x08090c);
  ctx.beginPath(); ctx.moveTo(cx - 30 * s, hy + 26 * s); ctx.quadraticCurveTo(cx, hy + 64 * s, cx + 30 * s, hy + 26 * s); ctx.quadraticCurveTo(cx, hy + 40 * s, cx - 30 * s, hy + 26 * s); ctx.fill();
  for (let k = 0; k < 7; k++) {
    const tx = cx - 24 * s + k * 8 * s;
    ctx.fillStyle = rgba(0xe8e2d0);
    ctx.beginPath(); ctx.moveTo(tx - 3 * s, hy + 30 * s); ctx.lineTo(tx, hy + 42 * s); ctx.lineTo(tx + 3 * s, hy + 30 * s); ctx.fill();
  }
  for (const side of [-1, 1]) {
    glowDot(ctx, cx + side * 22 * s, hy + 4 * s, 22 * s, p.glow, 1);
    ctx.fillStyle = rgba(p.eyes);
    ctx.beginPath(); ctx.ellipse(cx + side * 22 * s, hy + 4 * s, 8 * s, 4.5 * s, side * -0.35, 0, Math.PI * 2); ctx.fill();
  }
  glowStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(cx, hy - 66 * s); ctx.lineTo(cx, hy - 20 * s); }, p.glow, 2.4 * s, 0.7);
  // Embers or sparks drifting off in later phases.
  for (let i = 0; i < 12 + phase * 26; i++) glowDot(ctx, cx + (rand() - 0.5) * w * 0.9, rand() * h * 0.85, (3 + rand() * 5) * s, phase === 2 ? 0xff6a3a : p.glow, 0.6);
}

// ── Registration ─────────────────────────────────────────────────────────

const PORTRAIT_W = 600, PORTRAIT_H = 900;

export const BATTLE_TEXTURES: Array<{ key: string; w: number; h: number; paint: (ctx: Ctx, w: number, h: number) => void }> = [
  { key: 'battle-bg-normal', w: ARENA_W, h: ARENA_H, paint: forestArena },
  { key: 'battle-bg-boss', w: ARENA_W, h: ARENA_H, paint: coreArena },
  { key: 'staticnoise-battle', w: PORTRAIT_W, h: PORTRAIT_H, paint: staticNoise },
  { key: 'brokensignal-battle', w: 720, h: 545, paint: brokenSignal },
  { key: 'silence-battle', w: PORTRAIT_W, h: PORTRAIT_H, paint: silence },
  { key: 'boss-gatekeeper-battle-phase1', w: PORTRAIT_W, h: PORTRAIT_H, paint: (c, w, h) => gatekeeper(c, w, h, 0) },
  { key: 'boss-gatekeeper-battle-phase2', w: PORTRAIT_W, h: PORTRAIT_H, paint: (c, w, h) => gatekeeper(c, w, h, 1) },
  { key: 'boss-gatekeeper-battle-phase3', w: PORTRAIT_W, h: PORTRAIT_H, paint: (c, w, h) => gatekeeper(c, w, h, 2) },
];

export function paintBattleTexture(key: string): HTMLCanvasElement | undefined {
  const entry = BATTLE_TEXTURES.find(t => t.key === key);
  if (!entry) return undefined;
  const { canvas, ctx } = makeCanvas(entry.w, entry.h);
  entry.paint(ctx, entry.w, entry.h);
  return canvas;
}

export function createBattleTextures(scene: Phaser.Scene): void {
  BATTLE_TEXTURES.forEach(({ key }) => {
    if (scene.textures.exists(key)) return;
    const canvas = paintBattleTexture(key);
    if (canvas) scene.textures.addCanvas(key, canvas);
  });
}
