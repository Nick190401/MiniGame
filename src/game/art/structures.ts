import Phaser from 'phaser';
import { hash2, linear, mix, radial, rgba, rng, roundRect, shade, softEllipse, type Ctx } from './paint';
import { worldTexture } from './worldTexture';

export const STRUCTURES = {
  sign: 'hd-sign',
  bridgeDeck: 'hd-bridge-deck',
  bridgeRail: 'hd-bridge-rail',
  bridgePost: 'hd-bridge-post',
  gateWall: 'hd-gate-wall',
  gateFrame: 'hd-gate-frame',
  gatePanelLeft: 'hd-gate-panel-left',
  gatePanelRight: 'hd-gate-panel-right',
} as const;

export const GATE_FRAME_SIZE = { w: 92, h: 66 } as const;

/** Weathered timber: base colour plus long grain lines across the board. */
export function woodBoard(ctx: Ctx, x: number, y: number, w: number, h: number, base: number, seed: number, vertical = false): void {
  const rand = rng(seed);
  ctx.fillStyle = vertical
    ? linear(ctx, x, y, x + w, y, [[0, shade(base, 0.16)], [0.5, base], [1, shade(base, -0.3)]])
    : linear(ctx, x, y, x, y + h, [[0, shade(base, 0.2)], [0.35, base], [1, shade(base, -0.32)]]);
  ctx.fillRect(x, y, w, h);
  ctx.lineWidth = 0.22;
  for (let i = 0; i < (vertical ? w : h) * 1.6; i++) {
    const t = rand();
    ctx.strokeStyle = rgba(rand() < 0.5 ? shade(base, -0.38) : shade(base, 0.22), 0.25 + rand() * 0.3);
    ctx.beginPath();
    if (vertical) {
      const gx = x + t * w;
      ctx.moveTo(gx, y); ctx.bezierCurveTo(gx + (rand() - 0.5), y + h * 0.3, gx + (rand() - 0.5), y + h * 0.7, gx, y + h);
    } else {
      const gy = y + t * h;
      ctx.moveTo(x, gy); ctx.bezierCurveTo(x + w * 0.3, gy + (rand() - 0.5) * 0.8, x + w * 0.7, gy + (rand() - 0.5) * 0.8, x + w, gy);
    }
    ctx.stroke();
  }
  // Knots.
  if (rand() < 0.6) {
    const kx = x + w * (0.2 + rand() * 0.6), ky = y + h * (0.25 + rand() * 0.5);
    ctx.fillStyle = rgba(shade(base, -0.45), 0.7);
    ctx.beginPath(); ctx.ellipse(kx, ky, vertical ? 0.6 : 1.2, vertical ? 1.2 : 0.55, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function paintSign(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  softEllipse(ctx, cx + 1, h - 1.2, 5, 1.4, 0x050805, 0.5);
  // Post.
  woodBoard(ctx, cx - 1.3, 5, 2.6, h - 6, 0x6b4a32, 3, true);
  ctx.fillStyle = 'rgba(20,12,8,0.35)';
  ctx.fillRect(cx - 1.3, h - 3, 2.6, 2);
  // Board with bevelled edge and two planks.
  const bx = 0.6, by = 1.2, bw = w - 1.2, bh = 8.4;
  ctx.fillStyle = 'rgba(10,6,4,0.4)';
  roundRect(ctx, bx + 0.5, by + 0.8, bw, bh, 1.2); ctx.fill();
  ctx.save();
  roundRect(ctx, bx, by, bw, bh, 1.2); ctx.clip();
  woodBoard(ctx, bx, by, bw, bh / 2, 0x9a7048, 11);
  woodBoard(ctx, bx, by + bh / 2, bw, bh / 2, 0x8d6540, 12);
  ctx.fillStyle = 'rgba(30,18,10,0.55)';
  ctx.fillRect(bx, by + bh / 2 - 0.15, bw, 0.3);
  ctx.restore();
  ctx.strokeStyle = 'rgba(40,24,14,0.9)';
  ctx.lineWidth = 0.4;
  roundRect(ctx, bx, by, bw, bh, 1.2); ctx.stroke();
  // Carved arrow inlaid with the signal orange.
  ctx.fillStyle = rgba(0x2b1a10, 0.85);
  ctx.beginPath();
  ctx.moveTo(bx + 2.5, by + 3.6); ctx.lineTo(bx + bw - 4.5, by + 3.6); ctx.lineTo(bx + bw - 4.5, by + 2.3);
  ctx.lineTo(bx + bw - 2, by + 4.3); ctx.lineTo(bx + bw - 4.5, by + 6.3); ctx.lineTo(bx + bw - 4.5, by + 5);
  ctx.lineTo(bx + 2.5, by + 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = rgba(0xff8a3d, 0.85);
  ctx.fillRect(bx + 2.8, by + 3.85, bw - 7.6, 0.55);
  // Nail heads.
  for (const nx of [bx + 1.3, bx + bw - 1.3]) {
    ctx.fillStyle = rgba(0x2a2a28, 1);
    ctx.beginPath(); ctx.arc(nx, by + 1.6, 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(220,220,210,0.6)';
    ctx.beginPath(); ctx.arc(nx - 0.12, by + 1.45, 0.16, 0, Math.PI * 2); ctx.fill();
  }
}

function paintBridgeDeck(ctx: Ctx, w: number, h: number): void {
  // Stone abutments on both banks.
  for (const [y0, y1] of [[0, 9], [h - 9, h]]) {
    ctx.fillStyle = linear(ctx, 0, y0, 0, y1, [[0, 0x9c9b8c], [1, 0x6c6c62]]);
    ctx.fillRect(0, y0, w, y1 - y0);
    const rand = rng(y0 + 3);
    for (let x = -4; x < w; x += 9 + rand() * 4) {
      ctx.strokeStyle = 'rgba(40,40,36,0.55)';
      ctx.lineWidth = 0.45;
      ctx.strokeRect(x, y0 + 0.4, 9 + rand() * 3, (y1 - y0) - 0.8);
      ctx.fillStyle = 'rgba(255,255,240,0.12)';
      ctx.fillRect(x + 0.4, y0 + 0.8, 7, 0.6);
    }
  }
  // Timber deck: boards run across the river, joints offset per board.
  const deckTop = 9, deckBottom = h - 9;
  const boardH = 5.2;
  let i = 0;
  for (let y = deckTop; y < deckBottom; y += boardH, i++) {
    const tone = [0x8e6a44, 0x86633f, 0x977249, 0x7f5c3a][i % 4];
    woodBoard(ctx, 1.5, y + 0.25, w - 3, boardH - 0.5, tone, 100 + i);
    ctx.fillStyle = 'rgba(16,30,30,0.75)';
    ctx.fillRect(1.5, y + boardH - 0.25, w - 3, 0.5);
    // Nail pairs over the stringers.
    for (const nx of [4, w / 2, w - 4]) {
      ctx.fillStyle = 'rgba(40,40,38,0.9)';
      ctx.beginPath(); ctx.arc(nx - 0.8, y + boardH / 2, 0.32, 0, Math.PI * 2); ctx.arc(nx + 0.8, y + boardH / 2, 0.32, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Foot traffic has worn the middle lighter.
  ctx.fillStyle = linear(ctx, 0, 0, w, 0, [[0, 0xffffff, 0], [0.35, 0xf3e2c0, 0.1], [0.65, 0xf3e2c0, 0.1], [1, 0xffffff, 0]]);
  ctx.fillRect(0, deckTop, w, deckBottom - deckTop);
  // Edge beams that carry the rails.
  for (const x of [0, w - 3.5]) woodBoard(ctx, x, deckTop - 1, 3.5, deckBottom - deckTop + 2, 0x5d4129, 70 + x, true);
}

function paintRail(ctx: Ctx, w: number, h: number): void {
  // A continuous top rail seen from above at a slight angle.
  ctx.fillStyle = 'rgba(8,18,18,0.3)';
  ctx.fillRect(w / 2 + 1.2, 0, 3.2, h);
  woodBoard(ctx, w / 2 - 2, 0, 4, h, 0x8a6741, 7, true);
  ctx.fillStyle = 'rgba(255,240,210,0.28)';
  ctx.fillRect(w / 2 - 2, 0, 0.8, h);
  ctx.fillStyle = 'rgba(30,18,10,0.45)';
  ctx.fillRect(w / 2 + 1.4, 0, 0.6, h);
}

function paintPost(ctx: Ctx, w: number, h: number): void {
  softEllipse(ctx, w / 2 + 1, h - 1.6, 4.5, 1.6, 0x061010, 0.5);
  woodBoard(ctx, w / 2 - 3, 4, 6, h - 5, 0x6f5034, 9, true);
  // Iron bands.
  for (const y of [8, h - 8]) {
    ctx.fillStyle = linear(ctx, 0, y, 0, y + 2.2, [[0, 0x6e746c], [1, 0x2c302c]]);
    ctx.fillRect(w / 2 - 3.2, y, 6.4, 2.2);
    ctx.fillStyle = 'rgba(230,230,220,0.5)';
    ctx.fillRect(w / 2 - 2.4, y + 0.3, 1.2, 0.4);
  }
  // Capped top seen from above.
  ctx.fillStyle = radial(ctx, w / 2, 4.2, 0.4, 4, [[0, 0xc7a676], [1, 0x7a5a38]], w / 2 - 1.2, 3.2);
  ctx.beginPath(); ctx.ellipse(w / 2, 4.2, 3.6, 2.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(40,26,14,0.7)';
  ctx.lineWidth = 0.35;
  ctx.stroke();
}

/** Masonry wall segment that tiles horizontally (cap on top, coursed face below). */
function paintGateWall(ctx: Ctx, w: number, h: number): void {
  const capH = 14;
  const rand = rng(77);
  // Coping stones seen from above.
  ctx.fillStyle = linear(ctx, 0, 0, 0, capH, [[0, 0x8f9488], [1, 0x6a6f66]]);
  ctx.fillRect(0, 0, w, capH);
  for (let x = 0; x < w; x += 16) {
    const tone = mix(0x80857a, 0x9ea397, rand());
    ctx.fillStyle = linear(ctx, x, 0, x + 16, capH, [[0, shade(tone, 0.1)], [1, shade(tone, -0.18)]]);
    roundRect(ctx, x + 0.5, 0.6, 15, capH - 1.6, 1.4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,245,0.16)';
    ctx.fillRect(x + 1.2, 1.2, 13, 0.7);
    // Moss on the cap.
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = rgba(rand() < 0.5 ? 0x4c6a32 : 0x5f7a3a, 0.55);
      ctx.beginPath(); ctx.ellipse(x + rand() * 16, 1 + rand() * (capH - 3), 1 + rand() * 2.6, 0.6 + rand(), 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Lip shadow under the coping.
  ctx.fillStyle = linear(ctx, 0, capH - 1, 0, capH + 3, [[0, 0x101410, 0.7], [1, 0x101410, 0]]);
  ctx.fillRect(0, capH - 1, w, 4);
  // Coursed ashlar face, darker because it faces away from the sun.
  const faceTop = capH, faceBottom = h - 4;
  const courseH = 7.5;
  let row = 0;
  for (let y = faceTop; y < faceBottom; y += courseH, row++) {
    let x = row % 2 ? -7 : 0;
    while (x < w) {
      const bw = 13 + Math.floor(rand() * 3) * 2;
      const tone = mix(0x5b5f57, 0x787c72, rand());
      ctx.fillStyle = linear(ctx, 0, y, 0, y + courseH, [[0, shade(tone, 0.08)], [1, shade(tone, -0.22)]]);
      roundRect(ctx, x + 0.45, y + 0.45, bw - 0.9, courseH - 0.9, 1);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,240,0.1)';
      ctx.fillRect(x + 1, y + 0.8, bw - 2, 0.45);
      if (rand() < 0.25) {
        ctx.strokeStyle = 'rgba(25,26,22,0.45)';
        ctx.lineWidth = 0.3;
        ctx.beginPath(); ctx.moveTo(x + bw * rand(), y + 1); ctx.lineTo(x + bw * rand(), y + courseH - 1); ctx.stroke();
      }
      x += bw;
    }
  }
  // Damp base and contact shadow.
  ctx.fillStyle = linear(ctx, 0, faceBottom - 6, 0, h, [[0, 0x0a0d0a, 0], [0.6, 0x0a0d0a, 0.45], [1, 0x0a0d0a, 0.15]]);
  ctx.fillRect(0, faceBottom - 6, w, h - faceBottom + 6);
  void hash2;
}

function paintGateFrame(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const pillarW = 13;
  const archTop = 6;
  const baseY = h - 2;
  softEllipse(ctx, cx + 4, baseY, w * 0.5, 4, 0x050806, 0.45);
  // Two heavy pylons.
  for (const side of [-1, 1]) {
    const x = side < 0 ? 2 : w - 2 - pillarW;
    ctx.fillStyle = linear(ctx, x, 0, x + pillarW, 0, [[0, side < 0 ? 0x8e9388 : 0x5d6159], [0.6, 0x6d7168], [1, 0x3e413b]]);
    roundRect(ctx, x, archTop + 6, pillarW, baseY - archTop - 6, 1.6);
    ctx.fill();
    for (let y = archTop + 12; y < baseY - 4; y += 8) {
      ctx.fillStyle = 'rgba(20,22,18,0.4)';
      ctx.fillRect(x + 0.5, y, pillarW - 1, 0.5);
    }
    // Inset signal conduit.
    ctx.fillStyle = rgba(0x101a1c, 1);
    roundRect(ctx, x + pillarW / 2 - 1.6, archTop + 14, 3.2, baseY - archTop - 22, 1.2); ctx.fill();
    ctx.fillStyle = radial(ctx, x + pillarW / 2, baseY - 18, 0, 8, [[0, 0x6ef0ff, 0.9], [1, 0x6ef0ff, 0]]);
    ctx.fillRect(x + pillarW / 2 - 1, archTop + 15, 2, baseY - archTop - 24);
    // Capstone.
    ctx.fillStyle = linear(ctx, 0, archTop, 0, archTop + 8, [[0, 0xa9ad9f], [1, 0x6a6e64]]);
    roundRect(ctx, x - 1.5, archTop + 2, pillarW + 3, 7, 1.4); ctx.fill();
  }
  // Lintel bridging the doorway with the gate's emblem.
  ctx.fillStyle = linear(ctx, 0, archTop, 0, archTop + 12, [[0, 0x9a9e92], [0.5, 0x777b71], [1, 0x4b4e47]]);
  roundRect(ctx, 6, archTop, w - 12, 12, 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,240,0.18)';
  ctx.fillRect(8, archTop + 1, w - 16, 0.8);
  ctx.fillStyle = rgba(0x111a1b, 1);
  ctx.beginPath(); ctx.ellipse(cx, archTop + 6, 9, 4.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = rgba(0x7ff3ff, 0.95);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const x = cx - 7.5 + t * 15;
    const y = archTop + 6 + Math.sin(t * Math.PI * 4) * 2.2 * Math.sin(t * Math.PI);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function paintGatePanel(ctx: Ctx, w: number, h: number, side: -1 | 1): void {
  ctx.fillStyle = linear(ctx, 0, 0, w, h, [[0, 0x3d4648], [0.5, 0x2b3234], [1, 0x171c1d]]);
  roundRect(ctx, 0.6, 0.6, w - 1.2, h - 1.2, 1.2); ctx.fill();
  // Recessed panels.
  for (const y of [3, h / 2 + 1]) {
    ctx.fillStyle = linear(ctx, 0, y, 0, y + h / 2 - 4, [[0, 0x1c2223], [1, 0x2f3739]]);
    roundRect(ctx, 3, y, w - 6, h / 2 - 4, 1); ctx.fill();
    ctx.strokeStyle = 'rgba(150,170,170,0.25)';
    ctx.lineWidth = 0.35;
    roundRect(ctx, 3, y, w - 6, h / 2 - 4, 1); ctx.stroke();
  }
  // Glowing frequency line that continues across both doors.
  ctx.strokeStyle = rgba(0x8af6ff, 0.95);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    const x = t * w;
    const phase = side < 0 ? t : 1 + t;
    const y = h / 2 + Math.sin(phase * Math.PI * 3) * 3.5 * Math.sin((phase / 2) * Math.PI);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = rgba(0x8af6ff, 0.25);
  ctx.lineWidth = 2.6;
  ctx.stroke();
  // Rivets.
  for (let y = 2.5; y < h; y += 6) {
    for (const x of [1.8, w - 1.8]) {
      ctx.fillStyle = rgba(0x8a9592, 1);
      ctx.beginPath(); ctx.arc(x, y, 0.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Meeting edge highlight.
  ctx.fillStyle = 'rgba(200,240,240,0.3)';
  ctx.fillRect(side < 0 ? w - 1.2 : 0.6, 1, 0.6, h - 2);
}

export function createStructureTextures(scene: Phaser.Scene): void {
  worldTexture(scene, STRUCTURES.sign, 15, 18, paintSign);
  worldTexture(scene, STRUCTURES.bridgeDeck, 128, 96, paintBridgeDeck);
  worldTexture(scene, STRUCTURES.bridgeRail, 10, 16, paintRail);
  worldTexture(scene, STRUCTURES.bridgePost, 12, 24, paintPost);
  worldTexture(scene, STRUCTURES.gateWall, 64, 54, paintGateWall);
  worldTexture(scene, STRUCTURES.gateFrame, GATE_FRAME_SIZE.w, GATE_FRAME_SIZE.h, paintGateFrame);
  worldTexture(scene, STRUCTURES.gatePanelLeft, 32, 32, (ctx, w, h) => paintGatePanel(ctx, w, h, -1));
  worldTexture(scene, STRUCTURES.gatePanelRight, 32, 32, (ctx, w, h) => paintGatePanel(ctx, w, h, 1));
}
