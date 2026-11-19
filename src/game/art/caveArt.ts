import Phaser from 'phaser';
import { blobPoints, linear, mix, radial, rgba, rng, shade, smoothPath, softEllipse, type Ctx } from './paint';
import { addWorldImage, standingDepth, worldTexture } from './worldTexture';
import { TEXEL } from '../render/RenderScale';
import { heightAdd, heightGradient, heightRadial, heightRamp, mat, paintRelief, withHeight } from './relief';
import { FX } from './fx';

export const CAVE_ART = {
  crystal: 'hd-cave-crystal',
  crystalPurified: 'hd-cave-crystal-purified',
  pillar: 'hd-cave-pillar',
  pillarPurified: 'hd-cave-pillar-purified',
  rune: 'hd-cave-rune',
  runePurified: 'hd-cave-rune-purified',
  bones: 'hd-cave-bones',
  stalagmite: 'hd-cave-stalagmite',
  stalagmitePurified: 'hd-cave-stalagmite-purified',
  boulder: 'hd-cave-boulder',
  boulderPurified: 'hd-cave-boulder-purified',
  fissure: 'hd-cave-fissure',
  portalFrame: 'landmark-universe-portal',
  portalEnergy: 'universe-portal-energy',
  coreCircle: 'hd-core-circle',
  brazier: 'hd-cave-brazier',
  arch: 'hd-core-arch',
  drawCoreCircle,
  drawCaveAtmosphere,
} as const;

interface StonePalette { dark: number; mid: number; light: number; accent: number }
const CORRUPT: StonePalette = { dark: 0x0e1214, mid: 0x2c3336, light: 0x55605f, accent: 0xff5a3c };
const LIVING: StonePalette = { dark: 0x2a211b, mid: 0x5d4e40, light: 0x9c8a72, accent: 0x6fd8ff };

function paintCrystal(ctx: Ctx, w: number, h: number, purified: boolean): void {
  const rand = rng(purified ? 12 : 11);
  softEllipse(ctx, w / 2, h - 2, w * 0.42, 2.4, 0x000000, 0.5);
  const shards = [
    { x: w / 2, h: h - 4, lean: -0.05, width: 5.2 },
    { x: w / 2 - 4.5, h: h * 0.62, lean: -0.32, width: 3.6 },
    { x: w / 2 + 4.6, h: h * 0.56, lean: 0.36, width: 3.4 },
    { x: w / 2 - 1.5, h: h * 0.38, lean: -0.15, width: 2.6 },
    { x: w / 2 + 2.2, h: h * 0.42, lean: 0.12, width: 2.8 },
  ];
  const deep = purified ? 0x1d6f8f : 0x0d3b3a;
  const body = purified ? 0x5fd6f2 : 0x2a8a80;
  const glint = purified ? 0xf2feff : 0x9ff2df;
  shards.forEach(({ x, h: sh, lean, width }) => {
    const baseY = h - 2.5 - rand() * 1.2;
    const tipX = x + lean * sh, tipY = baseY - sh;
    const lx = x - width / 2, rx = x + width / 2;
    // Two facets: the lit left face and the shaded right face.
    ctx.fillStyle = linear(ctx, lx, tipY, x, baseY, [[0, mix(body, glint, 0.6), 0.95], [1, body, 0.85]]);
    ctx.beginPath(); ctx.moveTo(lx, baseY); ctx.lineTo(tipX - width * 0.12, tipY + width * 0.7); ctx.lineTo(tipX, tipY); ctx.lineTo(x + lean * 1.5, baseY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = linear(ctx, x, tipY, rx, baseY, [[0, body, 0.9], [1, deep, 0.95]]);
    ctx.beginPath(); ctx.moveTo(x + lean * 1.5, baseY); ctx.lineTo(tipX, tipY); ctx.lineTo(tipX + width * 0.18, tipY + width * 0.8); ctx.lineTo(rx, baseY); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgba(glint, 0.75);
    ctx.lineWidth = 0.3;
    ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(x + lean * 1.5, baseY - 0.5); ctx.stroke();
  });
  // Inner light.
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = radial(ctx, w / 2, h * 0.62, 0, w * 0.45, [[0, glint, purified ? 0.55 : 0.3], [1, glint, 0]]);
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

function paintPillar(ctx: Ctx, w: number, h: number, p: StonePalette, purified: boolean): void {
  const rand = rng(purified ? 22 : 21);
  softEllipse(ctx, w / 2 + 2, h - 2.5, w * 0.5, 3, 0x000000, 0.55);
  const top = 4, bottom = h - 3, cx = w / 2, half = w / 2 - 2;
  // Weathered standing stone with a rounded top and lit left flank.
  ctx.fillStyle = linear(ctx, cx - half, 0, cx + half, 0, [[0, shade(p.mid, 0.12)], [0.5, p.mid], [1, shade(p.mid, -0.12)]]);
  withHeight(heightGradient(cx - half, 0, cx + half, 0, [[0, 0.3], [0.5, 0.62], [1, 0.3]]), () => {
    ctx.beginPath();
    ctx.moveTo(cx - half, bottom);
    ctx.lineTo(cx - half + 0.8, top + 4);
    ctx.quadraticCurveTo(cx - half + 1, top, cx, top);
    ctx.quadraticCurveTo(cx + half - 1, top, cx + half - 0.6, top + 4);
    ctx.lineTo(cx + half, bottom);
    ctx.closePath();
    ctx.fill();
  });
  // Weathering: pits and lighter grains across the stone.
  for (let i = 0; i < 26; i++) {
    const gx = cx - half + 1 + rand() * (half * 2 - 2), gy = top + 2 + rand() * (bottom - top - 4);
    ctx.fillStyle = rgba(rand() < 0.5 ? shade(p.mid, -0.3) : shade(p.mid, 0.25), 0.35);
    ctx.beginPath(); ctx.ellipse(gx, gy, 0.3 + rand() * 0.6, 0.25 + rand() * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    heightAdd(mat(0.012), () => ctx.fill());
  }
  // Top surface.
  ctx.fillStyle = radial(ctx, cx - 1, top + 2.5, 0.5, half, [[0, shade(p.light, 0.08)], [1, p.mid]]);
  withHeight(heightRadial(cx, top + 2.6, half, [[0, 0.66], [1, 0.58]]), () => { ctx.beginPath(); ctx.ellipse(cx, top + 2.6, half - 0.8, 2.4, 0, 0, Math.PI * 2); ctx.fill(); });
  // Carved bands and the rune channel.
  for (const y of [top + 9, bottom - 6]) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    withHeight(heightGradient(cx - half, 0, cx + half, 0, [[0, 0.24], [0.5, 0.54], [1, 0.24]]), () => ctx.fillRect(cx - half + 0.5, y, half * 2 - 1, 0.9));
  }
  ctx.strokeStyle = rgba(p.accent, purified ? 0.85 : 0.7);
  ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(cx - 1, top + 12); ctx.lineTo(cx + 1.2, top + 15); ctx.lineTo(cx - 1, top + 18); ctx.lineTo(cx + 1, bottom - 8);
  withHeight(mat(0.56, 0, 1), () => ctx.stroke());
  ctx.strokeStyle = rgba(p.accent, 0.22);
  ctx.lineWidth = 2.4;
  ctx.stroke();
  if (purified) {
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = rgba(rand() < 0.5 ? 0x5f7d3a : 0x4c6a30, 0.8);
      ctx.beginPath(); ctx.ellipse(cx - half + rand() * half * 1.2, top + 2 + rand() * 6, 1 + rand() * 1.6, 0.6 + rand() * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    ctx.strokeStyle = 'rgba(255,90,60,0.45)';
    ctx.lineWidth = 0.35;
    ctx.beginPath(); ctx.moveTo(cx + half - 2, top + 6); ctx.lineTo(cx + half - 3.5, top + 11); ctx.lineTo(cx + half - 2.2, top + 15); ctx.stroke();
  }
}

function paintRune(ctx: Ctx, w: number, h: number, purified: boolean): void {
  const color = purified ? 0x7fe6ff : 0xff5536;
  const cx = w / 2, cy = h / 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const glyph = () => {
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy + 4.5); ctx.lineTo(cx - 4, cy - 4); ctx.lineTo(cx, cy - 1); ctx.lineTo(cx + 4, cy - 4); ctx.lineTo(cx + 4, cy + 4.5);
    ctx.moveTo(cx - 2, cy + 2); ctx.quadraticCurveTo(cx, cy + 5.5, cx + 2, cy + 2);
    ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy - 4.2);
  };
  // Carved groove, then the emissive line.
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2;
  ctx.save(); ctx.translate(0.4, 0.5); glyph(); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = rgba(color, 0.35);
  ctx.lineWidth = 2.6;
  glyph(); ctx.stroke();
  ctx.strokeStyle = rgba(shade(color, 0.45), 1);
  ctx.lineWidth = 0.8;
  glyph(); ctx.stroke();
}

function paintBones(ctx: Ctx, w: number, h: number): void {
  softEllipse(ctx, w / 2, h - 2, w * 0.45, 2, 0x000000, 0.45);
  const bone = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.strokeStyle = linear(ctx, x1, y1, x2, y2, [[0, 0xd8d0bd], [1, 0x9e9582]]);
    ctx.lineWidth = 1.1;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    for (const [x, y] of [[x1, y1], [x2, y2]]) {
      ctx.fillStyle = rgba(0xcfc6b2, 1);
      ctx.beginPath(); ctx.arc(x, y, 0.9, 0, Math.PI * 2); ctx.fill();
    }
  };
  bone(2, h - 3, 9, h - 5.5);
  bone(5, h - 6.5, 12, h - 2.5);
  // Skull.
  ctx.fillStyle = radial(ctx, 8, 4.4, 0.4, 4, [[0, 0xf0e8d6], [1, 0x9d927d]], 7, 3.4);
  ctx.beginPath(); ctx.ellipse(8.5, 4.6, 3.3, 2.9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(7, 6, 3, 2);
  ctx.fillStyle = 'rgba(20,14,10,0.85)';
  ctx.beginPath(); ctx.ellipse(7.3, 4.8, 0.75, 0.9, 0, 0, Math.PI * 2); ctx.ellipse(9.7, 4.8, 0.75, 0.9, 0, 0, Math.PI * 2); ctx.fill();
}

function paintStalagmite(ctx: Ctx, w: number, h: number, p: StonePalette): void {
  softEllipse(ctx, w / 2 + 1.5, h - 2, w * 0.48, 2.4, 0x000000, 0.55);
  const cx = w / 2, base = h - 2.5;
  ctx.fillStyle = linear(ctx, cx - w / 2, 0, cx + w / 2, 0, [[0, shade(p.mid, 0.12)], [0.5, p.mid], [1, shade(p.mid, -0.12)]]);
  withHeight(heightGradient(cx - w / 2, 0, cx + w / 2, 0, [[0, 0.24], [0.5, 0.62], [1, 0.24]], 0.15), () => {
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + 1, base);
    ctx.quadraticCurveTo(cx - 2.4, h * 0.45, cx - 0.4, 2);
    ctx.quadraticCurveTo(cx + 0.6, 1.4, cx + 0.8, 2.6);
    ctx.quadraticCurveTo(cx + 2.8, h * 0.5, cx + w / 2 - 1, base);
    ctx.closePath();
    ctx.fill();
  });
  // Growth rings of dripstone.
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 0.5;
  for (let y = 6; y < base - 2; y += 3.2) {
    ctx.beginPath(); ctx.moveTo(cx - (base - y) * 0.16, y); ctx.lineTo(cx + (base - y) * 0.12, y + 0.4); ctx.stroke();
    heightAdd(heightRamp(0, y - 0.3, 0, y + 0.7, [[0, 0.02], [1, 0]]), () => ctx.stroke());
  }
}

function paintBoulder(ctx: Ctx, w: number, h: number, p: StonePalette, purified: boolean): void {
  const rand = rng(purified ? 32 : 31);
  softEllipse(ctx, w / 2 + 2, h - 3, w * 0.5, 3.2, 0x000000, 0.6);
  const pts = blobPoints(w / 2, h * 0.55, w * 0.44, h * 0.4, 11, 0.16, rand);
  ctx.fillStyle = radial(ctx, w / 2, h * 0.6, 1, w * 0.55, [[0, shade(p.mid, 0.1)], [1, shade(p.mid, -0.1)]], w * 0.4, h * 0.4);
  withHeight(heightRadial(w / 2, h * 0.55, w * 0.46, [[0, 0.62], [0.65, 0.48], [1, 0.22]]), () => { smoothPath(ctx, pts); ctx.fill(); });
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.45;
  ctx.beginPath(); ctx.moveTo(w * 0.3, h * 0.35); ctx.lineTo(w * 0.48, h * 0.55); ctx.lineTo(w * 0.42, h * 0.8);
  withHeight(mat(0.3), () => ctx.stroke());
  if (purified) {
    ctx.fillStyle = 'rgba(90,120,60,0.6)';
    ctx.beginPath(); ctx.ellipse(w * 0.4, h * 0.3, w * 0.28, h * 0.12, -0.3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function paintFissure(ctx: Ctx, w: number, h: number): void {
  const rand = rng(5);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 9; i++) pts.push([2 + (i / 9) * (w - 4), h / 2 + (rand() - 0.5) * 3.2]);
  const path = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,70,40,0.25)'; ctx.lineWidth = 5; path(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,110,50,0.6)'; ctx.lineWidth = 2; path(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,170,0.95)'; ctx.lineWidth = 0.6; path(); ctx.stroke();
}

function paintPortalFrame(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h * 0.47, r = w * 0.36;
  softEllipse(ctx, cx + 4, h - 7, w * 0.42, 5, 0x000000, 0.55);
  // Two monoliths holding a broken ring of carved stone.
  for (const side of [-1, 1]) {
    const x = cx + side * (r + 3) - 7;
    ctx.fillStyle = linear(ctx, x, 0, x + 14, 0, [[0, side < 0 ? 0x6d6880 : 0x3d3a4a], [0.5, 0x4f4a60], [1, 0x27242f]]);
    ctx.beginPath();
    ctx.moveTo(x + 1, h - 8); ctx.lineTo(x + 2.5, cy - 10); ctx.lineTo(x + 7, cy - 16); ctx.lineTo(x + 12, cy - 10); ctx.lineTo(x + 13, h - 8);
    ctx.closePath(); ctx.fill();
  }
  ctx.lineWidth = 9;
  ctx.strokeStyle = linear(ctx, cx - r, cy - r, cx + r, cy + r, [[0, 0x77718c], [0.5, 0x4a4559], [1, 0x241f2c]]);
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.82, Math.PI * 2.18); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(230,220,255,0.22)';
  ctx.beginPath(); ctx.arc(cx, cy, r + 3.6, Math.PI * 0.9, Math.PI * 1.6); ctx.stroke();
  // Glyph inlays around the ring.
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.95 + (i / 8) * Math.PI * 1.1;
    const gx = cx + Math.cos(a) * r, gy = cy + Math.sin(a) * r;
    ctx.fillStyle = rgba(0xc5adff, 0.9);
    ctx.beginPath(); ctx.arc(gx, gy, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgba(0xc5adff, 0.25);
    ctx.beginPath(); ctx.arc(gx, gy, 2.4, 0, Math.PI * 2); ctx.fill();
  }
  // Base steps.
  ctx.fillStyle = linear(ctx, 0, h - 12, 0, h - 4, [[0, 0x5c576c], [1, 0x2a2633]]);
  ctx.beginPath(); ctx.ellipse(cx, h - 9, w * 0.4, 4.6, 0, 0, Math.PI * 2); ctx.fill();
}

function paintPortalEnergy(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h / 2;
  ctx.fillStyle = radial(ctx, cx, cy, 0, w * 0.5, [[0, 0xffffff, 0.95], [0.25, 0xc9b2ff, 0.7], [0.6, 0x6a46c8, 0.35], [1, 0x2a1460, 0]]);
  ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.46, h * 0.46, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineCap = 'round';
  for (let arm = 0; arm < 5; arm++) {
    ctx.strokeStyle = rgba(arm % 2 ? 0x9ee6ff : 0xe4d6ff, 0.55);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const a = arm * (Math.PI * 2 / 5) + t * 4.2;
      const rr = t * w * 0.42;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * (h / w);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function paintCoreCircle(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h / 2;
  const outer = w * 0.45, mid = outer * 0.7, inner = outer * 0.4;
  ctx.lineCap = 'round';
  const ring = (radius: number, width: number, color: number, alpha: number) => {
    ctx.strokeStyle = rgba(color, alpha * 0.3); ctx.lineWidth = width * 3;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = rgba(color, alpha); ctx.lineWidth = width;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
  };
  ring(outer, 1.4, 0xff6b3d, 0.85);
  ring(outer - 4, 0.5, 0xffb08a, 0.6);
  ring(mid, 1, 0xff4d5a, 0.7);
  ring(inner, 0.8, 0x49dfbf, 0.6);
  // Pentagram.
  const pts = Array.from({ length: 5 }, (_, i) => [cx + Math.cos((Math.PI * 2 / 5) * i - Math.PI / 2) * outer, cy + Math.sin((Math.PI * 2 / 5) * i - Math.PI / 2) * outer]);
  ctx.strokeStyle = rgba(0xff6b3d, 0.6);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 0; i <= 5; i++) {
    const [x, y] = pts[(i * 2) % 5];
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Glyph ticks between the outer rings.
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const r0 = outer - 3.5, r1 = outer - (i % 4 === 0 ? 0.5 : 2);
    ctx.strokeStyle = rgba(0xffc6a0, 0.7);
    ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
  }
}

function paintBrazier(ctx: Ctx, w: number, h: number): void {
  softEllipse(ctx, w / 2 + 1.5, h - 1.5, w * 0.45, 1.8, 0x000000, 0.6);
  // Tripod legs.
  ctx.strokeStyle = rgba(0x262624, 1);
  ctx.lineWidth = 0.9;
  for (const [x1, x2] of [[w / 2 - 1, 1.5], [w / 2 + 1, w - 1.5], [w / 2, w / 2 + 0.5]]) {
    ctx.beginPath(); ctx.moveTo(x1, h * 0.5); ctx.lineTo(x2, h - 1.5); ctx.stroke();
  }
  // Bowl with glowing embers.
  ctx.fillStyle = linear(ctx, 0, h * 0.32, 0, h * 0.56, [[0, 0x5a5550], [1, 0x1f1d1b]]);
  ctx.beginPath(); ctx.moveTo(1, h * 0.34); ctx.quadraticCurveTo(w / 2, h * 0.66, w - 1, h * 0.34); ctx.closePath(); ctx.fill();
  ctx.fillStyle = radial(ctx, w / 2, h * 0.36, 0.3, w * 0.45, [[0, 0xfff0b0], [0.4, 0xff8a2a], [1, 0x7a2010]]);
  ctx.beginPath(); ctx.ellipse(w / 2, h * 0.35, w / 2 - 1.2, 1.8, 0, 0, Math.PI * 2); ctx.fill();
}

function paintArch(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h - 6, r = w / 2 - 10;
  ctx.lineCap = 'butt';
  // Voussoir stones following the arc.
  const blocks = 23;
  for (let i = 0; i < blocks; i++) {
    const a0 = Math.PI + (i / blocks) * Math.PI, a1 = Math.PI + ((i + 0.92) / blocks) * Math.PI;
    const tone = mix(0x2a3234, 0x3f4a4b, (i * 37 % 11) / 11);
    ctx.strokeStyle = rgba(tone, 1);
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,220,215,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r - 4, a0, a1); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,107,61,0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(cx, cy, r - 7, Math.PI + 0.12, -0.12); ctx.stroke();
}

export function createCaveTextures(scene: Phaser.Scene): void {
  // Solid props are lit by a cold light from above the cave; glow effects stay unlit.
  const caveLight = { sun: [0.95, 0.98, 1.05] as [number, number, number], sky: [0.22, 0.26, 0.32] as [number, number, number], ground: [0.1, 0.09, 0.08] as [number, number, number] };
  const lit = (key: string, w: number, h: number, paint: (ctx: Ctx, w: number, h: number) => void) =>
    worldTexture(scene, key, w, h, (ctx) => ctx.drawImage(paintRelief(w, h, TEXEL, paint, caveLight), 0, 0, w, h));
  worldTexture(scene, CAVE_ART.crystal, 18, 22, (c, w, h) => paintCrystal(c, w, h, false));
  worldTexture(scene, CAVE_ART.crystalPurified, 18, 22, (c, w, h) => paintCrystal(c, w, h, true));
  lit(CAVE_ART.pillar, 16, 30, (c, w, h) => paintPillar(c, w, h, CORRUPT, false));
  lit(CAVE_ART.pillarPurified, 16, 30, (c, w, h) => paintPillar(c, w, h, LIVING, true));
  worldTexture(scene, CAVE_ART.rune, 16, 16, (c, w, h) => paintRune(c, w, h, false));
  worldTexture(scene, CAVE_ART.runePurified, 16, 16, (c, w, h) => paintRune(c, w, h, true));
  worldTexture(scene, CAVE_ART.bones, 14, 10, paintBones);
  lit(CAVE_ART.stalagmite, 12, 22, (c, w, h) => paintStalagmite(c, w, h, CORRUPT));
  lit(CAVE_ART.stalagmitePurified, 12, 22, (c, w, h) => paintStalagmite(c, w, h, LIVING));
  lit(CAVE_ART.boulder, 20, 18, (c, w, h) => paintBoulder(c, w, h, CORRUPT, false));
  lit(CAVE_ART.boulderPurified, 20, 18, (c, w, h) => paintBoulder(c, w, h, LIVING, true));
  worldTexture(scene, CAVE_ART.fissure, 26, 10, paintFissure);
  worldTexture(scene, CAVE_ART.portalFrame, 96, 96, paintPortalFrame);
  worldTexture(scene, CAVE_ART.portalEnergy, 48, 56, paintPortalEnergy);
  worldTexture(scene, CAVE_ART.coreCircle, 176, 176, paintCoreCircle);
  worldTexture(scene, CAVE_ART.brazier, 12, 16, paintBrazier);
  worldTexture(scene, CAVE_ART.arch, 276, 140, paintArch);
}

/** Ritual circle around the Gatekeeper's dais; destroyed once the cave is purified. */
function drawCoreCircle(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.GameObject[] {
  const circle = addWorldImage(scene, x, y, CAVE_ART.coreCircle).setDepth(1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9);
  scene.tweens.add({ targets: circle, alpha: 0.45, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  const eye = addWorldImage(scene, x, y, FX.glowHard).setDisplaySize(26, 26).setTint(0xd7ff4a).setDepth(3).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: eye, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });
  const pupil = scene.add.circle(x, y, 5, 0x050606, 1).setDepth(3.01);
  const markers: Phaser.GameObjects.GameObject[] = [];
  for (let i = 0; i < 5; i++) {
    const a = ((Math.PI * 2) / 5) * i - Math.PI / 2;
    const m = addWorldImage(scene, x + Math.cos(a) * 80, y + Math.sin(a) * 80, FX.spark)
      .setDisplaySize(14, 14).setTint(0xff6b3d).setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: m, alpha: 0.15, duration: 600 + i * 150, yoyo: true, repeat: -1 });
    markers.push(m);
  }
  return [circle, eye, pupil, ...markers];
}

/** Brazier positions (tile col, tile row) and flame colour. */
export const CAVE_BRAZIERS: ReadonlyArray<[number, number, number]> = [
  [27, 116, 0xff5a1f], [37, 116, 0xff5a1f], [8, 128, 0xff3d1f], [58, 128, 0xff3d1f],
  [17, 141, 0xd43560], [48, 140, 0xd43560], [18, 159, 0xff3d1f], [46, 159, 0xff3d1f],
];

interface AtmosphereLayout {
  tile: number; cols: number; rows: number; caveStartRow: number; coreStartRow: number;
  bossCore: { col: number; row: number };
}

/** Ash motes, entrance fog, braziers and the Core arch. */
function drawCaveAtmosphere(scene: Phaser.Scene, layout: AtmosphereLayout): Phaser.GameObjects.GameObject[] {
  const { tile: TILE, cols, rows, caveStartRow, coreStartRow, bossCore } = layout;
  const effects: Phaser.GameObjects.GameObject[] = [];
  const top = caveStartRow * TILE, bottom = (rows - 3) * TILE, left = 4 * TILE, right = (cols - 4) * TILE;
  const rand = rng(404);

  for (let i = 0; i < 46; i++) {
    const tint = rand() < 0.3 ? 0xff7a52 : rand() < 0.5 ? 0x46c4ae : 0x8a9e9a;
    const sx = left + rand() * (right - left), sy = top + rand() * (bottom - top);
    const size = 1.2 + rand() * 1.6;
    const mote = addWorldImage(scene, sx, sy, FX.mote).setTint(tint).setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(size, size).setDepth(41);
    effects.push(mote);
    const duration = 4000 + rand() * 5000;
    scene.tweens.add({
      targets: mote, y: sy - 30 - rand() * 40, x: sx + (rand() - 0.5) * 30,
      alpha: { from: 0.75, to: 0 }, duration, delay: rand() * duration, repeat: -1,
      onRepeat: () => mote.setPosition(left + Math.random() * (right - left), top + Math.random() * (bottom - top)),
    });
  }

  // Cold breath of fog rolling out of the cave mouth.
  for (let i = 0; i < 7; i++) {
    const fx = 25 * TILE + rand() * 14 * TILE, fy = (caveStartRow - 1) * TILE + rand() * 10;
    const fog = addWorldImage(scene, fx, fy, FX.glow).setTint(0x233f3c).setAlpha(0.2)
      .setDepth(8).setDisplaySize(70 + rand() * 40, 18 + rand() * 10);
    effects.push(fog);
    scene.tweens.add({ targets: fog, x: fx + (rand() < 0.5 ? 1 : -1) * (10 + rand() * 16), alpha: { from: 0.08, to: 0.26 }, duration: 3000 + rand() * 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // Braziers with live flames and a warm light pool.
  CAVE_BRAZIERS.forEach(([col, row, color], index) => {
    const bx = col * TILE, by = row * TILE + 6;
    const stand = addWorldImage(scene, bx, by, CAVE_ART.brazier).setOrigin(0.5, 1).setDepth(standingDepth(by));
    const pool = addWorldImage(scene, bx, by - 4, FX.glow).setDisplaySize(64, 40).setTint(color).setAlpha(0.32)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(41);
    const flame = addWorldImage(scene, bx, by - 9, FX.ember).setOrigin(0.5, 1).setDisplaySize(5, 9).setTint(0xffb347)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(41.1);
    const core = addWorldImage(scene, bx, by - 9, FX.ember).setOrigin(0.5, 1).setDisplaySize(2.6, 5.4).setTint(0xfff3c4)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(41.2);
    effects.push(stand, pool, flame, core);
    scene.tweens.add({ targets: flame, scaleY: flame.scaleY * 1.25, scaleX: flame.scaleX * 0.85, duration: 140 + index * 13, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: core, scaleY: core.scaleY * 1.3, duration: 110 + index * 9, yoyo: true, repeat: -1 });
    scene.tweens.add({ targets: pool, alpha: 0.2, duration: 220 + index * 20, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  });

  // Floor glow cracks radiating from the dais.
  const ax = bossCore.col * TILE, ay = bossCore.row * TILE;
  const cracks = scene.add.graphics().setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
  [15, 72, 130, 200, 255, 310].forEach(deg => {
    const rad = Phaser.Math.DegToRad(deg), len = 40 + rand() * 20;
    cracks.lineStyle(1.2, 0xff6b3d, 0.4).lineBetween(ax, ay, ax + Math.cos(rad) * len, ay + Math.sin(rad) * len);
    cracks.lineStyle(0.5, 0xffd0a0, 0.6).lineBetween(ax, ay, ax + Math.cos(rad) * len * 0.8, ay + Math.sin(rad) * len * 0.8);
  });
  effects.push(cracks);
  scene.tweens.add({ targets: cracks, alpha: 0.45, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  const arch = addWorldImage(scene, bossCore.col * TILE, (coreStartRow + 1) * TILE + 6, CAVE_ART.arch).setOrigin(0.5, 1).setDepth(3);
  effects.push(arch);
  return effects;
}
