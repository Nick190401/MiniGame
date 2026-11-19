import Phaser from 'phaser';
import { TILE_ID as T } from '../data/tileIds';
import { linear, rgba, rng, roundRect, shade, softEllipse, type Ctx } from './paint';
import { woodBoard } from './structures';
import { worldTexture } from './worldTexture';

/**
 * House pieces the world editor paints tile by tile (the authored map uses
 * whole landmark buildings instead). Every tile is painted for its
 * neighbourhood: outer corners get posts or quoins, a roof's top row gets a
 * ridge and its lowest row a gutter, and facades under a roof sit in its
 * shadow. Textures are painted on first use, so maps without free-form
 * buildings pay nothing.
 */

const S = 16;
const ROOF_COLOR = new Map<number, number>([
  [T.ROOF, 0xa2573b],
  [T.ROOF_BLUE, 0x43648f],
  [T.ROOF_GRAY, 0x60686e],
]);
const PLASTER_FACADE = new Set<number>([T.BUILDING_WALL, T.WALL_WINDOW, T.DOOR]);
const STONE_FACADE = new Set<number>([T.STONE_WALL, T.STONE_WINDOW, T.IRON_DOOR]);
const TIMBER = 0x5c412e;
const VARIANTS = 3;

const isRoof = (t: number | undefined) => t !== undefined && ROOF_COLOR.has(t);
const isFacade = (t: number | undefined) => t !== undefined && (PLASTER_FACADE.has(t) || STONE_FACADE.has(t));

export const isBuildingTile = (t: number | undefined) => isRoof(t) || isFacade(t);
export const isDoorTile = (t: number | undefined) => t === T.DOOR || t === T.IRON_DOOR;

interface Edges { top: boolean; bottom: boolean; left: boolean; right: boolean }

/** Texture for the building tile at (row, col), or undefined for any other tile. */
export function buildingTileTexture(scene: Phaser.Scene, grid: number[][], row: number, col: number): string | undefined {
  const t = grid[row]?.[col];
  if (t === undefined || !isBuildingTile(t)) return undefined;
  const roof = isRoof(t);
  const same = roof ? isRoof : isFacade;
  const edges: Edges = {
    // Roof: ridge on its top row, gutter on its lowest. Facade: eave shadow, plinth.
    top: roof ? !isRoof(grid[row - 1]?.[col]) : isRoof(grid[row - 1]?.[col]),
    bottom: roof ? !isRoof(grid[row + 1]?.[col]) : !isFacade(grid[row + 1]?.[col]),
    left: !same(grid[row]?.[col - 1]),
    right: !same(grid[row]?.[col + 1]),
  };
  const variant = (col * 7 + row * 3) % VARIANTS;
  const bits = `${+edges.top}${+edges.bottom}${+edges.left}${+edges.right}`;
  const key = `hd-building-${t}-${bits}-${variant}`;
  return worldTexture(scene, key, S, S, (ctx) => paintTile(ctx, t, edges, 97 + t * 131 + variant * 17));
}

function paintTile(ctx: Ctx, t: number, edges: Edges, seed: number): void {
  const roofColor = ROOF_COLOR.get(t);
  if (roofColor !== undefined) {
    paintRoof(ctx, roofColor, t === T.ROOF, edges, seed);
    return;
  }
  if (STONE_FACADE.has(t)) paintStoneWall(ctx, edges, seed);
  else paintPlaster(ctx, edges, seed);
  if (t === T.WALL_WINDOW) paintCasement(ctx, seed);
  if (t === T.STONE_WINDOW) paintArchedWindow(ctx);
  if (t === T.DOOR) paintWoodDoor(ctx, seed);
  if (t === T.IRON_DOOR) paintIronDoor(ctx);
  if (edges.top) {
    ctx.fillStyle = linear(ctx, 0, 0, 0, 5, [[0, 0x120a06, 0.6], [1, 0x120a06, 0]]);
    ctx.fillRect(0, 0, S, 5);
  }
}

// ── Facades ─────────────────────────────────────────────────────────────────

function paintPlaster(ctx: Ctx, edges: Edges, seed: number): void {
  const rand = rng(seed);
  ctx.fillStyle = linear(ctx, 0, 0, 0, S, [[0, 0xece0c6], [1, 0xd3bf9b]]);
  ctx.fillRect(0, 0, S, S);
  // Lime-wash mottling and the odd hairline crack.
  for (let i = 0; i < 24; i++) {
    softEllipse(ctx, rand() * S, rand() * S, 1 + rand() * 2.6, 0.6 + rand() * 1.4, rand() < 0.55 ? 0xa48d68 : 0xfff7e6, 0.07 + rand() * 0.08);
  }
  if (rand() < 0.6) {
    ctx.strokeStyle = rgba(0x7d6850, 0.3);
    ctx.lineWidth = 0.14;
    let x = 2 + rand() * 12, y = 1 + rand() * 6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (rand() - 0.5) * 2; y += 0.7 + rand(); ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // Half-timbering: a head beam under the roof, a sill beam over the plinth, corner posts.
  if (edges.top) woodBoard(ctx, 0, 0, S, 1.3, TIMBER, seed + 1);
  if (edges.bottom) {
    plinth(ctx, seed + 2);
    woodBoard(ctx, 0, S - 4.5, S, 1.3, TIMBER, seed + 3);
  }
  if (edges.left) woodBoard(ctx, 0, 0, 1.7, S, TIMBER, seed + 4, true);
  if (edges.right) {
    woodBoard(ctx, S - 1.7, 0, 1.7, S, TIMBER, seed + 5, true);
    ctx.fillStyle = 'rgba(16,10,6,0.25)';
    ctx.fillRect(S - 0.5, 0, 0.5, S);
  }
}

/** Running-bond ashlar; block edges wrap so neighbouring tiles join seamlessly. */
function paintStoneWall(ctx: Ctx, edges: Edges, seed: number): void {
  const rand = rng(seed);
  ctx.fillStyle = rgba(0x5f5a53);
  ctx.fillRect(0, 0, S, S);
  const course = 4;
  const widths = [5.5, 5, 5.5];
  for (let r = 0; r < S / course; r++) {
    // Odd courses start half a block early and run past the edge, matching the next tile.
    let x = r % 2 ? -2.75 : 0;
    for (let i = 0; x < S; i++) {
      const w = widths[i % widths.length];
      ashlar(ctx, x, r * course, w, course, rand);
      x += w;
    }
  }
  if (edges.bottom) plinth(ctx, seed + 7);
  // Light from the upper left: the left corner catches it, the right falls into shade.
  if (edges.left) {
    ctx.fillStyle = linear(ctx, 0, 0, 2.2, 0, [[0, 0xfff2dc, 0.22], [1, 0xfff2dc, 0]]);
    ctx.fillRect(0, 0, 2.2, S);
  }
  if (edges.right) {
    ctx.fillStyle = linear(ctx, S - 2.6, 0, S, 0, [[0, 0x0c0907, 0], [1, 0x0c0907, 0.38]]);
    ctx.fillRect(S - 2.6, 0, 2.6, S);
  }
}

function ashlar(ctx: Ctx, x: number, y: number, w: number, h: number, rand: () => number): void {
  const base = shade(0x9d968a, (rand() - 0.5) * 0.22);
  const gap = 0.28;
  ctx.save();
  roundRect(ctx, x + gap, y + gap, w - gap * 2, h - gap * 2, 0.45);
  ctx.clip();
  ctx.fillStyle = linear(ctx, x, y, x + w * 0.4, y + h, [[0, shade(base, 0.16)], [0.55, base], [1, shade(base, -0.2)]]);
  ctx.fillRect(x, y, w, h);
  for (let i = 0; i < 5; i++) {
    softEllipse(ctx, x + rand() * w, y + rand() * h, 0.5 + rand() * 1.2, 0.3 + rand() * 0.6, rand() < 0.5 ? 0x3e3a34 : 0xe8e1d2, 0.12 + rand() * 0.12);
  }
  ctx.fillStyle = 'rgba(255,248,232,0.28)';
  ctx.fillRect(x + gap, y + gap, w - gap * 2, 0.35);
  ctx.fillStyle = 'rgba(20,16,12,0.32)';
  ctx.fillRect(x + gap, y + h - gap - 0.4, w - gap * 2, 0.4);
  ctx.restore();
}

/** Heavy footing course where a facade meets the ground. */
function plinth(ctx: Ctx, seed: number): void {
  const rand = rng(seed);
  const top = S - 3.2;
  ctx.fillStyle = rgba(0x3d3832);
  ctx.fillRect(0, top, S, 3.2);
  let x = -1.5;
  while (x < S) {
    const w = 3.4 + rand() * 1.6;
    const base = shade(0x7c766c, (rand() - 0.5) * 0.2);
    ctx.fillStyle = linear(ctx, 0, top, 0, S, [[0, shade(base, 0.12)], [1, shade(base, -0.28)]]);
    roundRect(ctx, x + 0.25, top + 0.25, w - 0.5, 2.7, 0.5);
    ctx.fill();
    x += w;
  }
  ctx.fillStyle = linear(ctx, 0, S - 1.2, 0, S, [[0, 0x0a0806, 0], [1, 0x0a0806, 0.45]]);
  ctx.fillRect(0, S - 1.2, S, 1.2);
}

function paintCasement(ctx: Ctx, seed: number): void {
  const x = 3.8, y = 2.8, w = 8.4, h = 8.2;
  ctx.fillStyle = 'rgba(40,28,18,0.35)';
  ctx.fillRect(x + 0.5, y + 0.7, w + 0.4, h + 0.4);
  woodBoard(ctx, x - 0.7, y - 0.7, w + 1.4, h + 1.4, 0x6a4a33, seed + 11);
  glass(ctx, x, y, w, h, 0xffb763, 0.38);
  ctx.fillStyle = rgba(0x4a3322);
  ctx.fillRect(x + w / 2 - 0.35, y, 0.7, h);
  ctx.fillRect(x, y + h / 2 - 0.35, w, 0.7);
  woodBoard(ctx, x - 1.3, y + h + 0.4, w + 2.6, 1.1, 0x8c6747, seed + 13);
  ctx.fillStyle = 'rgba(32,20,12,0.3)';
  ctx.fillRect(x - 1.1, y + h + 1.5, w + 2.2, 0.6);
}

function paintArchedWindow(ctx: Ctx): void {
  const x = 4.6, y = 2.6, w = 6.8, h = 8.8, r = w / 2;
  const arch = (inset: number) => {
    ctx.beginPath();
    ctx.moveTo(x + inset, y + h - inset);
    ctx.lineTo(x + inset, y + r);
    ctx.arc(x + r, y + r, r - inset, Math.PI, 0);
    ctx.lineTo(x + w - inset, y + h - inset);
    ctx.closePath();
  };
  // Dressed stone surround, 0.9 wider than the opening all round.
  const m = 0.9;
  ctx.fillStyle = linear(ctx, x - m, y - m, x + w + m, y + h, [[0, 0xc9c1b2], [1, 0x8f887b]]);
  ctx.beginPath();
  ctx.moveTo(x - m, y + h + m);
  ctx.lineTo(x - m, y + r);
  ctx.arc(x + r, y + r, r + m, Math.PI, 0);
  ctx.lineTo(x + w + m, y + h + m);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  arch(0);
  ctx.clip();
  glass(ctx, x, y, w, h, 0x9fd7ff, 0.18);
  // Leaded quarries.
  ctx.strokeStyle = 'rgba(30,34,40,0.55)';
  ctx.lineWidth = 0.18;
  for (let d = -h; d < w + h; d += 1.7) {
    ctx.beginPath(); ctx.moveTo(x + d, y); ctx.lineTo(x + d + h, y + h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = rgba(0x2d3036);
  ctx.lineWidth = 0.5;
  arch(0.2);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + r, y + 0.4); ctx.lineTo(x + r, y + h); ctx.stroke();
  // Stone sill.
  ctx.fillStyle = linear(ctx, 0, y + h, 0, y + h + 1.4, [[0, 0xcfc7b8], [1, 0x8c8578]]);
  ctx.fillRect(x - 1.4, y + h, w + 2.8, 1.4);
  ctx.fillStyle = 'rgba(20,16,12,0.32)';
  ctx.fillRect(x - 1.2, y + h + 1.4, w + 2.4, 0.55);
}

/** Window glass: sky reflection above, a lit room below, one diagonal glare. */
function glass(ctx: Ctx, x: number, y: number, w: number, h: number, roomLight: number, roomAlpha: number): void {
  ctx.fillStyle = linear(ctx, 0, y, 0, y + h, [[0, 0xa9cbdc], [0.42, 0x53707d], [1, 0x23292a]]);
  ctx.fillRect(x, y, w, h);
  softEllipse(ctx, x + w * 0.6, y + h * 0.74, w * 0.42, h * 0.3, roomLight, roomAlpha);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.72);
  ctx.lineTo(x + w * 0.46, y);
  ctx.lineTo(x + w * 0.64, y);
  ctx.lineTo(x + w * 0.1, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function paintWoodDoor(ctx: Ctx, seed: number): void {
  const x = 3.2, y = 3, w = 9.6, h = S - 3;
  // Recess shadow, then vertical planks.
  ctx.fillStyle = rgba(0x1c120b);
  ctx.fillRect(x - 0.6, y - 0.6, w + 1.2, h + 0.6);
  const planks = 4;
  for (let i = 0; i < planks; i++) {
    woodBoard(ctx, x + (w / planks) * i, y, w / planks - 0.15, h - 1, shade(0x7a5234, (i % 2) * 0.06 - 0.03), seed + 20 + i, true);
  }
  ctx.fillStyle = linear(ctx, x, y, x + 2, y + 2, [[0, 0x0e0905, 0.55], [1, 0x0e0905, 0]]);
  ctx.fillRect(x, y, w, h - 1);
  // Strap hinges with rivets and a ring pull.
  for (const by of [y + 2.6, y + h - 4.6]) {
    ctx.fillStyle = linear(ctx, 0, by, 0, by + 1, [[0, 0x55514c], [1, 0x23211f]]);
    ctx.fillRect(x + 0.4, by, w * 0.66, 1);
    ctx.fillStyle = rgba(0x8d8a84);
    for (const rx of [x + 1.2, x + 3.4, x + 5.6]) { ctx.beginPath(); ctx.arc(rx, by + 0.5, 0.22, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.strokeStyle = rgba(0xc9a35a);
  ctx.lineWidth = 0.35;
  ctx.beginPath(); ctx.arc(x + w - 2, y + h * 0.55, 0.75, 0, Math.PI * 2); ctx.stroke();
  // Lintel and threshold.
  woodBoard(ctx, x - 1.2, y - 1.6, w + 2.4, 1.3, TIMBER, seed + 30);
  ctx.fillStyle = linear(ctx, 0, S - 1.1, 0, S, [[0, 0xa59f93], [1, 0x6c675e]]);
  ctx.fillRect(x - 1, S - 1.1, w + 2, 1.1);
}

function paintIronDoor(ctx: Ctx): void {
  const x = 3.4, y = 3.2, w = 9.2, h = S - 3.2;
  ctx.fillStyle = rgba(0x1a1c1f);
  ctx.fillRect(x - 0.7, y - 0.7, w + 1.4, h + 0.7);
  ctx.fillStyle = linear(ctx, x, 0, x + w, 0, [[0, 0x5d646b], [0.45, 0x464c53], [1, 0x2c3036]]);
  ctx.fillRect(x, y, w, h - 1);
  // Two leaves, a cross bar and rivet rows.
  ctx.fillStyle = 'rgba(10,12,14,0.6)';
  ctx.fillRect(x + w / 2 - 0.2, y, 0.4, h - 1);
  ctx.fillStyle = linear(ctx, 0, y + h * 0.45, 0, y + h * 0.45 + 1.2, [[0, 0x737b83], [1, 0x30353a]]);
  ctx.fillRect(x, y + h * 0.45, w, 1.2);
  ctx.fillStyle = rgba(0x9aa3aa);
  for (const ry of [y + 1, y + h - 2.2]) {
    for (let rx = x + 0.9; rx < x + w; rx += 1.85) { ctx.beginPath(); ctx.arc(rx, ry, 0.22, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x + 0.3, y + 0.3, 0.5, h - 1.6);
  // Stone lintel and step.
  ctx.fillStyle = linear(ctx, 0, y - 1.9, 0, y - 0.4, [[0, 0xc2baab], [1, 0x8a8377]]);
  ctx.fillRect(x - 1.4, y - 1.9, w + 2.8, 1.5);
  ctx.fillStyle = linear(ctx, 0, S - 1.1, 0, S, [[0, 0xa59f93], [1, 0x6c675e]]);
  ctx.fillRect(x - 1, S - 1.1, w + 2, 1.1);
}

// ── Roofs ───────────────────────────────────────────────────────────────────

function paintRoof(ctx: Ctx, base: number, clay: boolean, edges: Edges, seed: number): void {
  const rand = rng(seed);
  ctx.fillStyle = rgba(shade(base, -0.62));
  ctx.fillRect(0, 0, S, S);
  const course = 4;
  const shingle = 4;
  for (let r = 0; r < S / course; r++) {
    const y = r * course;
    const offset = r % 2 ? shingle / 2 : 0;
    for (let x = offset - shingle; x < S; x += shingle) {
      const tone = shade(base, (rand() - 0.5) * 0.2);
      ctx.save();
      ctx.beginPath();
      if (clay) {
        // Pantiles: rounded lower edge.
        ctx.moveTo(x + 0.15, y - 0.4);
        ctx.lineTo(x + shingle - 0.15, y - 0.4);
        ctx.lineTo(x + shingle - 0.15, y + course - 1.2);
        ctx.quadraticCurveTo(x + shingle / 2, y + course + 0.9, x + 0.15, y + course - 1.2);
      } else {
        ctx.rect(x + 0.12, y - 0.4, shingle - 0.24, course + 0.25 + (rand() - 0.5) * 0.35);
      }
      ctx.closePath();
      ctx.clip();
      // Upper part lies in the shadow of the course above; the lower lip catches light.
      ctx.fillStyle = linear(ctx, 0, y, 0, y + course, [[0, shade(tone, -0.32)], [0.55, tone], [1, shade(tone, 0.14)]]);
      ctx.fillRect(x, y - 0.5, shingle, course + 1.5);
      if (clay) {
        ctx.fillStyle = linear(ctx, x, 0, x + shingle, 0, [[0, 0xffffff, 0.1], [0.4, 0xffffff, 0], [1, 0x000000, 0.2]]);
        ctx.fillRect(x, y - 0.5, shingle, course + 1.5);
      }
      ctx.restore();
    }
    // Shadow line cast by this course onto the one below.
    ctx.fillStyle = 'rgba(12,8,6,0.32)';
    ctx.fillRect(0, y + course - 0.05, S, 0.4);
  }
  // Weathering: moss on clay, lichen on slate.
  for (let i = 0; i < 6; i++) {
    softEllipse(ctx, rand() * S, rand() * S, 0.8 + rand() * 1.5, 0.4 + rand() * 0.7, clay ? 0x5f6e2f : 0xb8bca2, 0.12 + rand() * 0.1);
  }
  if (edges.top) {
    // Ridge cap.
    ctx.fillStyle = linear(ctx, 0, 0, 0, 2.8, [[0, shade(base, -0.35)], [0.45, shade(base, 0.22)], [1, shade(base, -0.4)]]);
    ctx.fillRect(0, 0, S, 2.8);
    ctx.fillStyle = 'rgba(10,6,4,0.35)';
    for (let x = 1; x < S; x += 4) ctx.fillRect(x, 0, 0.3, 2.8);
    ctx.fillRect(0, 2.8, S, 0.5);
  }
  if (edges.bottom) {
    // Fascia and gutter.
    ctx.fillStyle = linear(ctx, 0, S - 1.6, 0, S, [[0, 0x3a2a1f], [1, 0x1f1712]]);
    ctx.fillRect(0, S - 1.6, S, 1.6);
    ctx.fillStyle = 'rgba(210,214,212,0.35)';
    ctx.fillRect(0, S - 1.6, S, 0.3);
  }
  if (edges.left) {
    ctx.fillStyle = linear(ctx, 0, 0, 1.6, 0, [[0, 0x2a1e16], [1, 0x2a1e16, 0]]);
    ctx.fillRect(0, 0, 1.6, S);
  }
  if (edges.right) {
    ctx.fillStyle = linear(ctx, S - 1.6, 0, S, 0, [[0, 0x140e0a, 0], [1, 0x140e0a, 0.65]]);
    ctx.fillRect(S - 1.6, 0, 1.6, S);
  }
  // Sky light falls across the whole roof plane.
  ctx.fillStyle = linear(ctx, 0, 0, S, S, [[0, 0xfff4e0, 0.08], [1, 0x000000, 0.12]]);
  ctx.fillRect(0, 0, S, S);
}
