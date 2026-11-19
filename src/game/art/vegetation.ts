import Phaser from 'phaser';
import { blobPoints, linear, mix, radial, rgba, rng, shade, smoothPath, softEllipse, type Ctx } from './paint';
import { worldTexture } from './worldTexture';

/** Sunlight comes from the upper left throughout the world. */
const LIGHT = { x: -0.62, y: -0.78 };

function blade(
  ctx: Ctx, x: number, y: number, height: number, lean: number, width: number,
  base: number, tip: number, curl: number,
): void {
  const tx = x + lean, ty = y - height;
  const cx = x + lean * 0.25 + curl, cy = y - height * 0.58;
  ctx.fillStyle = linear(ctx, x, y, tx, ty, [[0, base], [0.55, mix(base, tip, 0.55)], [1, tip]]);
  ctx.beginPath();
  ctx.moveTo(x - width / 2, y);
  ctx.quadraticCurveTo(cx - width * 0.35, cy, tx, ty);
  ctx.quadraticCurveTo(cx + width * 0.35, cy, x + width / 2, y);
  ctx.closePath();
  ctx.fill();
}

const GRASS_BASES = [0x223f18, 0x2a4b1c, 0x2f5420, 0x274719];
const GRASS_TIPS = [0x8fb455, 0x9fc15e, 0xb3c565, 0x7fa84f, 0xa6bd5c];

/** Encounter grass: a tall, wild clump (back) and a shorter tuft that covers feet (front). */
function paintTallGrass(ctx: Ctx, w: number, h: number, seed: number, front: boolean): void {
  const rand = rng(seed);
  const groundY = h - 1;
  if (!front) softEllipse(ctx, w / 2, groundY - 1, w * 0.48, 3.2, 0x0d1a08, 0.45);
  const count = front ? 13 : 24;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const x = 1.5 + rand() * (w - 3);
    const centre = 1 - Math.abs(x - w / 2) / (w / 2);
    const height = front
      ? 4 + rand() * 3.8 + centre * 2.2
      : 6.4 + rand() * 5 + centre * 3.6;
    const lean = (x - w / 2) * (0.18 + rand() * 0.25) + (rand() - 0.5) * 4;
    const y = groundY - (front ? rand() * 1.5 : rand() * 3);
    const base = GRASS_BASES[Math.floor(rand() * GRASS_BASES.length)];
    let tip = GRASS_TIPS[Math.floor(rand() * GRASS_TIPS.length)];
    // Blades turned toward the sun catch more light.
    if (lean < 0) tip = shade(tip, 0.12);
    else tip = shade(tip, -0.08);
    blade(ctx, x, y, height, lean, 1.3 + rand() * 1.1, front ? shade(base, 0.08) : base, tip, (rand() - 0.5) * 3 + t * 0.4);
  }
  if (!front) {
    // A few seed heads give the meadow its wild silhouette.
    for (let i = 0; i < 3; i++) {
      const x = 3 + rand() * (w - 6), top = 2 + rand() * 4;
      ctx.strokeStyle = rgba(0x6d7a3a, 0.9);
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(x, groundY - 4); ctx.quadraticCurveTo(x + 1, (groundY + top) / 2, x + 1.5, top); ctx.stroke();
      ctx.fillStyle = rgba(0xc7b878, 0.95);
      ctx.beginPath(); ctx.ellipse(x + 1.5, top, 0.9, 2, 0.2, 0, Math.PI * 2); ctx.fill();
    }
  }
}

const FLOWER_SETS: Array<{ petal: number; centre: number; size: number; petals: number }> = [
  { petal: 0xe4553b, centre: 0x2a1b12, size: 2.1, petals: 5 },
  { petal: 0xf1c440, centre: 0xa1621f, size: 1.8, petals: 6 },
  { petal: 0xf5f1e3, centre: 0xf0c23e, size: 1.9, petals: 8 },
  { petal: 0x9f74d9, centre: 0xf1d36a, size: 1.6, petals: 5 },
  { petal: 0x63b8dc, centre: 0xf6e7a2, size: 1.6, petals: 5 },
];

function paintFlowers(ctx: Ctx, w: number, h: number, seed: number, set: number): void {
  const rand = rng(seed);
  const style = FLOWER_SETS[set % FLOWER_SETS.length];
  softEllipse(ctx, w / 2, h - 2, w * 0.42, 2.6, 0x0f1c09, 0.3);
  const heads: Array<[number, number]> = [];
  for (let i = 0; i < 6; i++) {
    const x = 3 + rand() * (w - 6);
    const y = h - 2 - rand() * 1.5;
    const top = 3 + rand() * (h - 9);
    ctx.strokeStyle = rgba(0x3d6a2a, 1);
    ctx.lineWidth = 0.55;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (rand() - 0.5) * 3, (y + top) / 2, x + (rand() - 0.5) * 2, top); ctx.stroke();
    ctx.fillStyle = rgba(rand() < 0.5 ? 0x4f8a34 : 0x5f9a3c, 1);
    ctx.beginPath(); ctx.ellipse(x + 1.3, (y + top) / 2 + 1, 1.6, 0.7, -0.6, 0, Math.PI * 2); ctx.fill();
    heads.push([x + (rand() - 0.5) * 1.5, top]);
  }
  heads.sort((a, b) => a[1] - b[1]).forEach(([x, y]) => {
    const r = style.size * (0.8 + rand() * 0.35);
    for (let p = 0; p < style.petals; p++) {
      const a = (p / style.petals) * Math.PI * 2 + rand() * 0.3;
      const px = x + Math.cos(a) * r * 0.75, py = y + Math.sin(a) * r * 0.55;
      ctx.fillStyle = rgba(Math.cos(a) * LIGHT.x + Math.sin(a) * LIGHT.y > 0 ? shade(style.petal, 0.18) : shade(style.petal, -0.1), 1);
      ctx.beginPath(); ctx.ellipse(px, py, r * 0.62, r * 0.38, a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = rgba(style.centre, 1);
    ctx.beginPath(); ctx.arc(x, y, r * 0.36, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(x - r * 0.12, y - r * 0.14, r * 0.14, 0, Math.PI * 2); ctx.fill();
  });
}

interface CanopyStyle {
  base: number;
  light: number;
  dark: number;
}

const BROADLEAF: CanopyStyle[] = [
  { base: 0x4a7a32, light: 0xa6cc66, dark: 0x1f3a19 },
  { base: 0x55823a, light: 0xb4d06e, dark: 0x264220 },
  { base: 0x3f7040, light: 0x93c070, dark: 0x1a3420 },
  { base: 0x5b7f30, light: 0xbccb66, dark: 0x2c4219 },
];

function paintTrunk(ctx: Ctx, x: number, baseY: number, topY: number, width: number, rand: () => number): void {
  // Root flare and bark, lit from the left.
  ctx.fillStyle = linear(ctx, x - width, 0, x + width, 0, [[0, 0x7a5a40], [0.45, 0x5a3f2c], [1, 0x2f2118]]);
  ctx.beginPath();
  ctx.moveTo(x - width * 1.25, baseY);
  ctx.quadraticCurveTo(x - width * 0.55, baseY - 3, x - width * 0.45, topY);
  ctx.lineTo(x + width * 0.45, topY);
  ctx.quadraticCurveTo(x + width * 0.6, baseY - 3, x + width * 1.3, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,20,14,0.45)';
  ctx.lineWidth = 0.45;
  for (let i = 0; i < 5; i++) {
    const bx = x - width * 0.35 + rand() * width * 0.7;
    ctx.beginPath(); ctx.moveTo(bx, baseY - 1); ctx.quadraticCurveTo(bx + (rand() - 0.5) * 1.5, (baseY + topY) / 2, bx + (rand() - 0.5), topY); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(190,160,120,0.35)';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(x - width * 0.38, baseY - 2); ctx.lineTo(x - width * 0.3, topY + 1); ctx.stroke();
}

/** Broadleaf canopy built from many lit leaf clusters, back to front. */
function paintCanopy(
  ctx: Ctx, cx: number, cy: number, rx: number, ry: number, style: CanopyStyle, rand: () => number,
  clusters = 46, clusterScale = 1,
): void {
  // Shaded inner mass so gaps between clusters read as depth, not holes.
  ctx.fillStyle = radial(ctx, cx, cy, rx * 0.15, rx, [[0, mix(style.dark, style.base, 0.5)], [1, style.dark]], cx - rx * 0.3, cy - ry * 0.35);
  smoothPath(ctx, blobPoints(cx, cy, rx * 0.92, ry * 0.9, 16, 0.1, rand));
  ctx.fill();
  const items: Array<{ x: number; y: number; r: number }> = [];
  for (let i = 0; i < clusters; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand());
    items.push({ x: cx + Math.cos(a) * rx * d * 0.84, y: cy + Math.sin(a) * ry * d * 0.84, r: (2.6 + rand() * 3.2) * clusterScale });
  }
  items.sort((a, b) => a.y - b.y);
  items.forEach(({ x, y, r }) => {
    const nx = (x - cx) / rx, ny = (y - cy) / ry;
    const lit = Phaser.Math.Clamp(0.5 + (nx * LIGHT.x + ny * LIGHT.y) * 0.5 + (-ny) * 0.12, 0, 1);
    const body = mix(mix(style.dark, style.base, 0.45 + lit * 0.45), style.light, Math.pow(lit, 1.8) * 0.55);
    ctx.fillStyle = radial(ctx, x, y, r * 0.1, r * 1.05, [[0, shade(body, 0.1)], [0.7, body], [1, shade(body, -0.3)]], x - r * 0.35, y - r * 0.4);
    smoothPath(ctx, blobPoints(x, y, r, r * 0.86, 9, 0.2, rand));
    ctx.fill();
    // Individual leaves: lighter where they turn to the sun, darker beneath.
    const leaves = 6 + Math.floor(rand() * 5);
    for (let k = 0; k < leaves; k++) {
      const la = rand() * Math.PI * 2;
      const ld = Math.sqrt(rand()) * r * 0.85;
      const lx = x + Math.cos(la) * ld, ly = y + Math.sin(la) * ld * 0.86;
      const facing = Phaser.Math.Clamp(0.5 + (Math.cos(la) * LIGHT.x + Math.sin(la) * LIGHT.y) * 0.5, 0, 1);
      const tone = facing > 0.55 ? mix(body, style.light, 0.25 + lit * 0.45) : shade(body, -0.18);
      ctx.fillStyle = rgba(tone, 0.85);
      ctx.beginPath();
      ctx.ellipse(lx, ly, (1.0 + rand() * 0.7) * clusterScale, (0.5 + rand() * 0.3) * clusterScale, la + Math.PI / 2 + (rand() - 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  // Sun wash from the upper left and soft occlusion where the crown curves under.
  ctx.fillStyle = radial(ctx, cx - rx * 0.45, cy - ry * 0.55, 0, rx * 1.3, [[0, 0xfff6d8, 0.16], [1, 0xfff6d8, 0]]);
  ctx.fillRect(cx - rx - 4, cy - ry - 4, rx * 2 + 8, ry * 2 + 8);
  ctx.fillStyle = linear(ctx, 0, cy - ry, 0, cy + ry, [[0, 0x000000, 0], [0.6, 0x000000, 0], [1, 0x0b1408, 0.4]]);
  ctx.fillRect(cx - rx - 4, cy - ry - 4, rx * 2 + 8, ry * 2 + 8);
  ctx.restore();
}

function paintBroadleafTree(ctx: Ctx, w: number, h: number, seed: number): void {
  const rand = rng(seed);
  const style = BROADLEAF[seed % BROADLEAF.length];
  const baseY = h - 2;
  softEllipse(ctx, w / 2, baseY, 8, 2.4, 0x0a1206, 0.55);
  paintTrunk(ctx, w / 2, baseY, h * 0.42, 3.4, rand);
  // Two limbs disappear into the crown.
  ctx.strokeStyle = rgba(0x4a3424, 1);
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(w / 2, h * 0.5); ctx.quadraticCurveTo(w / 2 - 6, h * 0.44, w / 2 - 9, h * 0.36); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w / 2 + 0.5, h * 0.52); ctx.quadraticCurveTo(w / 2 + 6, h * 0.45, w / 2 + 8, h * 0.38); ctx.stroke();
  const rx = w * 0.46 - rand() * 2, ry = h * 0.33 - rand() * 2;
  paintCanopy(ctx, w / 2 + (rand() - 0.5) * 2, h * 0.34, rx, ry, style, rand);
}

function paintConifer(ctx: Ctx, w: number, h: number, seed: number): void {
  const rand = rng(seed);
  const baseY = h - 2;
  softEllipse(ctx, w / 2, baseY, 6, 2, 0x0a1206, 0.55);
  paintTrunk(ctx, w / 2, baseY, h - 12, 2.2, rand);
  const tiers = 6;
  const dark = 0x15291c, base = seed % 2 ? 0x2c5236 : 0x274a33, light = seed % 2 ? 0x6f9a62 : 0x638f60;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const tierY = 6 + t * (h - 22);
    const half = 3 + t * (w * 0.44);
    const drop = 7 + t * 4;
    const pts: Array<[number, number]> = [[w / 2, tierY - 4 - (i === 0 ? 4 : 0)]];
    const steps = 7;
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const x = w / 2 + half - u * half * 2;
      const sag = Math.sin(u * Math.PI) * 2;
      const jag = s % 2 === 0 ? drop : drop - 2.5 - rand() * 1.5;
      pts.push([x, tierY + jag - sag]);
    }
    ctx.fillStyle = linear(ctx, w / 2 - half, tierY, w / 2 + half, tierY + drop, [[0, mix(base, light, 0.55)], [0.42, base], [1, dark]]);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    pts.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.closePath();
    ctx.fill();
    // Needle texture strokes.
    ctx.strokeStyle = rgba(light, 0.35);
    ctx.lineWidth = 0.4;
    for (let k = 0; k < 10; k++) {
      const sx = w / 2 - half * 0.8 + rand() * half * 0.9, sy = tierY + rand() * drop * 0.6;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 1.4, sy + 1.8); ctx.stroke();
    }
  }
}

function paintBush(ctx: Ctx, w: number, h: number, seed: number): void {
  const rand = rng(seed);
  softEllipse(ctx, w / 2, h - 3, w * 0.46, 3.2, 0x0a1206, 0.5);
  paintCanopy(ctx, w / 2, h * 0.55, w * 0.44, h * 0.38, BROADLEAF[(seed + 1) % BROADLEAF.length], rand, 30, 0.72);
  if (seed % 3 === 0) {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = rgba(i % 2 ? 0xd8474a : 0xf0d35c, 0.95);
      ctx.beginPath(); ctx.arc(4 + rand() * (w - 8), 4 + rand() * (h - 9), 0.9, 0, Math.PI * 2); ctx.fill();
    }
  }
}

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

function paintRock(ctx: Ctx, w: number, h: number, seed: number): void {
  const rand = rng(seed);
  softEllipse(ctx, w / 2 + 1, h - 3, w * 0.46, 3, 0x0b0f0a, 0.45);
  const pts = blobPoints(w / 2, h * 0.58, w * 0.42, h * 0.36, 10, 0.18, rand);
  ctx.fillStyle = radial(ctx, w / 2, h * 0.6, 1, w * 0.5, [[0, 0x9a988c], [0.6, 0x77756b], [1, 0x45443e]], w * 0.35, h * 0.35);
  smoothPath(ctx, pts);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(80,110,50,0.55)';
  ctx.beginPath(); ctx.ellipse(w * 0.4, h * 0.32, w * 0.3, h * 0.14, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(40,38,34,0.5)';
  ctx.lineWidth = 0.4;
  ctx.beginPath(); ctx.moveTo(w * 0.35, h * 0.55); ctx.lineTo(w * 0.55, h * 0.68); ctx.lineTo(w * 0.62, h * 0.82); ctx.stroke();
  ctx.restore();
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
  variants: { tallGrass: 4, flowers: 5, broadleaf: 4, conifer: 2, bush: 3, rock: 3, lily: 2 },
} as const;

/** Tree painters work in a fixed design space; the textures are grown from it. */
const TREE_DESIGN = { broadleaf: { w: 50, h: 62 }, conifer: { w: 36, h: 66 } } as const;
/** Grown so a tree stands about three characters tall, level with a cottage roof. */
const TREE_GROWTH = 1.35;
const grown = ({ w, h }: { w: number; h: number }) => ({ w: w * TREE_GROWTH, h: h * TREE_GROWTH, footInset: 2 * TREE_GROWTH });
/** World size of a tree texture; `footInset` is the trunk base above the bottom edge. */
export const TREE_SIZE = { broadleaf: grown(TREE_DESIGN.broadleaf), conifer: grown(TREE_DESIGN.conifer) } as const;

export function createVegetationTextures(scene: Phaser.Scene): void {
  const v = VEGETATION.variants;
  for (let i = 0; i < v.tallGrass; i++) {
    worldTexture(scene, VEGETATION.tallGrassBack(i), 22, 19, (ctx, w, h) => paintTallGrass(ctx, w, h, 300 + i * 17, false));
    worldTexture(scene, VEGETATION.tallGrassFront(i), 22, 13, (ctx, w, h) => paintTallGrass(ctx, w, h, 900 + i * 23, true));
  }
  for (let i = 0; i < v.flowers; i++) worldTexture(scene, VEGETATION.flowers(i), 14, 10, (ctx, w, h) => paintFlowers(ctx, w, h, 50 + i * 7, i));
  const tree = (key: string, kind: keyof typeof TREE_DESIGN, paint: (ctx: Ctx, w: number, h: number) => void) =>
    worldTexture(scene, key, TREE_SIZE[kind].w, TREE_SIZE[kind].h, (ctx) => {
      ctx.scale(TREE_GROWTH, TREE_GROWTH);
      paint(ctx, TREE_DESIGN[kind].w, TREE_DESIGN[kind].h);
    });
  for (let i = 0; i < v.broadleaf; i++) tree(VEGETATION.broadleaf(i), 'broadleaf', (ctx, w, h) => paintBroadleafTree(ctx, w, h, i));
  for (let i = 0; i < v.conifer; i++) tree(VEGETATION.conifer(i), 'conifer', (ctx, w, h) => paintConifer(ctx, w, h, i));
  for (let i = 0; i < v.bush; i++) worldTexture(scene, VEGETATION.bush(i), 24, 18, (ctx, w, h) => paintBush(ctx, w, h, i));
  for (let i = 0; i < v.rock; i++) worldTexture(scene, VEGETATION.rock(i), 16, 12, (ctx, w, h) => paintRock(ctx, w, h, 70 + i));
  worldTexture(scene, VEGETATION.reeds, 14, 20, (ctx, w, h) => paintReeds(ctx, w, h, 5));
  for (let i = 0; i < v.lily; i++) worldTexture(scene, VEGETATION.lily(i), 12, 9, (ctx, w, h) => paintLily(ctx, w, h, i));
}
