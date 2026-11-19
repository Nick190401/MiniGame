import Phaser from 'phaser';
import { linear, radial, rgba, rng, softEllipse, type Ctx } from './paint';
import { worldTexture } from './worldTexture';
import { TEXEL } from '../render/RenderScale';
import { renderBroadleaf, renderBush, renderConifer, renderFlowers, renderGrassTuft, renderLedgeStone, renderRock } from './foliage';

const FLOWER_SETS: Array<{ petal: number; centre: number; size: number; petals: number }> = [
  { petal: 0xe4553b, centre: 0x2a1b12, size: 2.1, petals: 5 },
  { petal: 0xf1c440, centre: 0xa1621f, size: 1.8, petals: 6 },
  { petal: 0xf5f1e3, centre: 0xf0c23e, size: 1.9, petals: 8 },
  { petal: 0x9f74d9, centre: 0xf1d36a, size: 1.6, petals: 5 },
  { petal: 0x63b8dc, centre: 0xf6e7a2, size: 1.6, petals: 5 },
];

function paintReeds(ctx: Ctx, w: number, h: number, seed: number): void {
  const rand = rng(seed);
  for (let i = 0; i < 7; i++) {
    const x = 2 + rand() * (w - 4), top = 2 + rand() * 7;
    ctx.strokeStyle = rgba(rand() < 0.5 ? 0x5d7d36 : 0x748f40, 1);
    ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(x, h - 1); ctx.quadraticCurveTo(x + (rand() - 0.5) * 3, h * 0.5, x + (rand() - 0.5) * 2, top); ctx.stroke();
    if (i % 2 === 0) {
      ctx.fillStyle = linear(ctx, x - 1, 0, x + 1, 0, [[0, 0x8a5a34], [1, 0x50311d]]);
      ctx.beginPath(); ctx.ellipse(x + 0.2, top + 2.5, 0.95, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function paintLily(ctx: Ctx, w: number, h: number, seed: number): void {
  const rand = rng(seed);
  const cx = w / 2, cy = h / 2;
  softEllipse(ctx, cx + 0.8, cy + 1, w * 0.42, h * 0.38, 0x052018, 0.35);
  ctx.fillStyle = radial(ctx, cx, cy, 0.5, w * 0.45, [[0, 0x8fbf5f], [0.7, 0x4f8a3a], [1, 0x2f5a2a]], cx - 1.5, cy - 1.5);
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.42, h * 0.38, 0, 0.25, Math.PI * 2 - 0.15);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,60,25,0.5)';
  ctx.lineWidth = 0.3;
  for (let i = 0; i < 6; i++) {
    const a = 0.5 + i * 0.95;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * w * 0.36, cy + Math.sin(a) * h * 0.32); ctx.stroke();
  }
  if (seed % 2 === 0) {
    for (let p = 0; p < 7; p++) {
      const a = (p / 7) * Math.PI * 2 + rand() * 0.2;
      ctx.fillStyle = rgba(p % 2 ? 0xf3c3d3 : 0xfbe4ea, 1);
      ctx.beginPath(); ctx.ellipse(cx - 1 + Math.cos(a) * 1.2, cy - 1.5 + Math.sin(a) * 0.8, 1.5, 0.75, a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = rgba(0xf6d45a, 1);
    ctx.beginPath(); ctx.arc(cx - 1, cy - 1.5, 0.6, 0, Math.PI * 2); ctx.fill();
  }
}

export const VEGETATION = {
  tallGrassBack: (v: number) => `hd-tallgrass-back-${v}`,
  tallGrassFront: (v: number) => `hd-tallgrass-front-${v}`,
  flowers: (v: number) => `hd-flowers-${v}`,
  broadleaf: (v: number) => `hd-tree-broadleaf-${v}`,
  conifer: (v: number) => `hd-tree-conifer-${v}`,
  bush: (v: number) => `hd-bush-${v}`,
  rock: (v: number) => `hd-rock-${v}`,
  reeds: 'hd-reeds',
  lily: (v: number) => `hd-lily-${v}`,
  ledge: (v: number) => `hd-ledge-${v}`,
  variants: { tallGrass: 6, flowers: 5, broadleaf: 4, conifer: 2, bush: 3, rock: 3, lily: 2, ledge: 4 },
} as const;

/**
 * World size of a tree texture (about three characters tall, level with a
 * cottage roof); `footInset` is the trunk base above the bottom edge.
 */
/** Ledge stones that line the rock terraces of the meadows. */
export const LEDGE_SIZE = { w: 24, h: 17 } as const;

export const TREE_SIZE = {
  broadleaf: { w: 67.5, h: 83.7, footInset: 2.6 },
  conifer: { w: 48.6, h: 89.1, footInset: 2.6 },
} as const;

export function createVegetationTextures(scene: Phaser.Scene): void {
  const v = VEGETATION.variants;
  const lit = (key: string, w: number, h: number, render: (w: number, h: number, density: number) => HTMLCanvasElement) =>
    worldTexture(scene, key, w, h, (ctx) => ctx.drawImage(render(w, h, TEXEL), 0, 0, w, h));
  // Encounter grass: a tall clump behind the walker and a short tuft in front of their legs.
  for (let i = 0; i < v.tallGrass; i++) {
    lit(VEGETATION.tallGrassBack(i), 22, 19, (w, h, d) => renderGrassTuft(w, h, i, d, false));
    lit(VEGETATION.tallGrassFront(i), 22, 13, (w, h, d) => renderGrassTuft(w, h, i, d, true));
  }
  for (let i = 0; i < v.flowers; i++) lit(VEGETATION.flowers(i), 14, 10, (w, h, d) => renderFlowers(w, h, FLOWER_SETS[i % FLOWER_SETS.length], 50 + i * 7, d));
  // Trees, bushes and rocks are rendered as lit volumes (see foliage.ts).
  for (let i = 0; i < v.broadleaf; i++) lit(VEGETATION.broadleaf(i), TREE_SIZE.broadleaf.w, TREE_SIZE.broadleaf.h, (w, h, d) => renderBroadleaf(w, h, i, d));
  for (let i = 0; i < v.conifer; i++) lit(VEGETATION.conifer(i), TREE_SIZE.conifer.w, TREE_SIZE.conifer.h, (w, h, d) => renderConifer(w, h, i, d));
  for (let i = 0; i < v.bush; i++) lit(VEGETATION.bush(i), 24, 18, (w, h, d) => renderBush(w, h, i, d));
  for (let i = 0; i < v.rock; i++) lit(VEGETATION.rock(i), 16, 12, (w, h, d) => renderRock(w, h, i, d));
  for (let i = 0; i < v.ledge; i++) lit(VEGETATION.ledge(i), LEDGE_SIZE.w, LEDGE_SIZE.h, (w, h, d) => renderLedgeStone(w, h, i, d));
  worldTexture(scene, VEGETATION.reeds, 14, 20, (ctx, w, h) => paintReeds(ctx, w, h, 5));
  for (let i = 0; i < v.lily; i++) worldTexture(scene, VEGETATION.lily(i), 12, 9, (ctx, w, h) => paintLily(ctx, w, h, i));
}
