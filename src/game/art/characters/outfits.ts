import { linear, radial, rgba, roundRect, shade, type Ctx } from '../paint';
import { ellipsePath, occlusion, paintPath, quilting, type Pose } from './rig';
import { emblem, shadeTorso, torsoPath, torsoSidePath, type Outfit, type Skeleton } from './figure';

export type CharacterId = 'player' | 'professor' | 'guard' | 'musician';

// ── Shared hair and headwear ──────────────────────────────────────────────

function capFront(ctx: Ctx, s: Skeleton, pose: Pose, color: number, logo: 'MR' | 'stripe', accent: number): void {
  const [hx, hy] = s.head;
  const yaw = pose.yaw;
  // Crown.
  ctx.beginPath();
  ctx.moveTo(hx - 8.4, hy - 3.6);
  ctx.bezierCurveTo(hx - 8.8, hy - 13.6, hx + 8.8, hy - 13.6, hx + 8.4, hy - 3.6);
  ctx.quadraticCurveTo(hx, hy - 5.4, hx - 8.4, hy - 3.6);
  ctx.closePath();
  paintPath(ctx, color, hx - 8, hy - 13, hx + 8, hy - 3, { light: 0.22, dark: 0.36 });
  // Panel seams and button.
  ctx.strokeStyle = rgba(shade(color, -0.4), 0.7);
  ctx.lineWidth = 0.4;
  for (const k of [-3.6, 3.6]) { ctx.beginPath(); ctx.moveTo(hx + k * 0.4, hy - 12.6); ctx.quadraticCurveTo(hx + k, hy - 9, hx + k * 1.15, hy - 4.6); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(hx, hy - 12.9, 0.7, 0, Math.PI * 2);
  paintPath(ctx, shade(color, 0.1), hx - 0.7, hy - 13.6, hx + 0.7, hy - 12.2, { line: 0.4, lineWidth: 0.3 });
  // Brim, seen from slightly above.
  ctx.beginPath();
  ctx.moveTo(hx - 8 + yaw, hy - 4.6);
  ctx.quadraticCurveTo(hx + yaw * 2, hy - 0.6, hx + 8 + yaw, hy - 4.6);
  ctx.quadraticCurveTo(hx + yaw * 2, hy - 3.2, hx - 8 + yaw, hy - 4.6);
  ctx.closePath();
  paintPath(ctx, shade(color, -0.12), hx - 8, hy - 5, hx + 8, hy - 1, { light: 0.25, dark: 0.3, line: 0.6, lineWidth: 0.5 });
  occlusion(ctx, hx, hy - 2.6, 7, 1.5, 0.35);
  if (logo === 'MR') {
    // Bold white MR wordmark on the front panel.
    ctx.save();
    ctx.translate(hx + yaw * 0.8, hy - 8.6);
    ctx.strokeStyle = rgba(0xfafafa);
    ctx.lineWidth = 1.05;
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(-4.3, 2); ctx.lineTo(-4.3, -1.9); ctx.lineTo(-2.6, 0.6); ctx.lineTo(-0.9, -1.9); ctx.lineTo(-0.9, 2);
    ctx.moveTo(0.9, 2); ctx.lineTo(0.9, -1.9); ctx.lineTo(2.9, -1.9);
    ctx.quadraticCurveTo(4.4, -1.9, 4.4, -0.7); ctx.quadraticCurveTo(4.4, 0.4, 2.9, 0.4); ctx.lineTo(0.9, 0.4);
    ctx.moveTo(2.6, 0.4); ctx.lineTo(4.5, 2);
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.strokeStyle = rgba(accent, 0.95);
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(hx + 0.3, hy - 12.4); ctx.lineTo(hx + 0.6, hy - 5.6); ctx.stroke();
    ctx.strokeStyle = rgba(accent, 0.3);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function capBack(ctx: Ctx, s: Skeleton, color: number): void {
  const [hx, hy] = s.head;
  ctx.beginPath();
  ctx.moveTo(hx - 8.4, hy - 3);
  ctx.bezierCurveTo(hx - 8.8, hy - 13.6, hx + 8.8, hy - 13.6, hx + 8.4, hy - 3);
  ctx.quadraticCurveTo(hx, hy - 1.6, hx - 8.4, hy - 3);
  ctx.closePath();
  paintPath(ctx, color, hx - 8, hy - 13, hx + 8, hy - 2, { light: 0.18, dark: 0.36 });
  // Adjuster strap opening.
  ctx.beginPath(); ctx.ellipse(hx, hy - 3.6, 2.6, 1.6, 0, Math.PI, 0); ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
  ctx.fillStyle = rgba(shade(color, 0.15));
  ctx.fillRect(hx - 2.4, hy - 3.6, 4.8, 0.7);
}

function capSide(ctx: Ctx, s: Skeleton, color: number, accent?: number): void {
  const [hx, hy] = s.head;
  ctx.beginPath();
  ctx.moveTo(hx - 7.6, hy - 2.4);
  ctx.bezierCurveTo(hx - 8.2, hy - 12.4, hx + 6.6, hy - 13.4, hx + 7.2, hy - 4.6);
  ctx.lineTo(hx - 7.6, hy - 2.4);
  ctx.closePath();
  paintPath(ctx, color, hx - 7, hy - 13, hx + 7, hy - 3, { light: 0.22, dark: 0.36 });
  ctx.beginPath();
  ctx.moveTo(hx + 5.2, hy - 5.4);
  ctx.quadraticCurveTo(hx + 12, hy - 5.4, hx + 13.2, hy - 3.6);
  ctx.quadraticCurveTo(hx + 9.6, hy - 2.6, hx + 5, hy - 3.6);
  ctx.closePath();
  paintPath(ctx, shade(color, -0.1), hx + 5, hy - 6, hx + 13, hy - 3, { light: 0.2, dark: 0.3, line: 0.6, lineWidth: 0.5 });
  if (accent !== undefined) {
    ctx.strokeStyle = rgba(accent, 0.9);
    ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(hx + 2.4, hy - 11.8); ctx.quadraticCurveTo(hx + 5.6, hy - 9, hx + 6.4, hy - 5.2); ctx.stroke();
  }
}

function shortHairSides(ctx: Ctx, s: Skeleton, color: number): void {
  const [hx, hy] = s.head;
  if (s.view === 'front') {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(hx + side * 7.9, hy - 4.2);
      ctx.quadraticCurveTo(hx + side * 8.2, hy - 0.4, hx + side * 7.2, hy + 1.2);
      ctx.lineTo(hx + side * 6.6, hy - 3.8);
      ctx.closePath();
      paintPath(ctx, color, hx - 8, hy - 4, hx + 8, hy + 1, { light: 0.15, dark: 0.3, line: 0.45, lineWidth: 0.4 });
    }
  } else if (s.view === 'back') {
    ctx.beginPath();
    ctx.moveTo(hx - 7.8, hy - 4);
    ctx.quadraticCurveTo(hx - 8, hy + 4.8, hx - 3.6, hy + 6.4);
    ctx.quadraticCurveTo(hx, hy + 7.2, hx + 3.6, hy + 6.4);
    ctx.quadraticCurveTo(hx + 8, hy + 4.8, hx + 7.8, hy - 4);
    ctx.closePath();
    paintPath(ctx, color, hx - 8, hy - 4, hx + 8, hy + 7, { light: 0.16, dark: 0.3 });
    ctx.strokeStyle = rgba(shade(color, -0.4), 0.6);
    ctx.lineWidth = 0.35;
    for (let k = -5; k <= 5; k += 2.2) { ctx.beginPath(); ctx.moveTo(hx + k, hy - 2); ctx.lineTo(hx + k * 0.8, hy + 5.6); ctx.stroke(); }
  } else {
    ctx.beginPath();
    ctx.moveTo(hx - 6.8, hy - 4);
    ctx.quadraticCurveTo(hx - 7.4, hy + 3.6, hx - 4.2, hy + 5.4);
    ctx.lineTo(hx - 2.2, hy - 1);
    ctx.quadraticCurveTo(hx + 2.4, hy - 2.6, hx + 3.6, hy - 3.6);
    ctx.closePath();
    paintPath(ctx, color, hx - 7, hy - 4, hx + 4, hy + 5, { light: 0.15, dark: 0.32 });
  }
}

// ── Player: MR cap, two-tone hoodie, black puffer vest, green cargos ──────

const PLAYER = {
  skin: 0xeab792, hoodie: 0xf2e27c, green: 0x3e9e48, vest: 0x1b1d24, cap: 0x15171f, hair: 0x4a2a18,
};

function trebleClef(ctx: Ctx): void {
  ctx.lineWidth = 0.55;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0.2, 2.6);
  ctx.bezierCurveTo(-1.6, 2.6, -1.6, 0, 0.2, 0);
  ctx.bezierCurveTo(1.8, 0, 1.6, -2.4, 0, -3.2);
  ctx.lineTo(-0.3, 3.6);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(-0.6, 3.6, 0.5, 0, Math.PI * 2); ctx.fill();
}

export const PLAYER_OUTFIT: Outfit = {
  face: { skin: PLAYER.skin, eyes: 0x3f8f52, brows: 0x4a2a18, lips: 0xc77a66 },
  hands: { skin: PLAYER.skin },
  shoes: { upper: 0xf3f3ef, sole: 0xc9cdcf, accent: 0x2f9fa3 },
  pants: { color: PLAYER.green, cargo: true },
  sleeves: { color: PLAYER.green, cuff: shade(PLAYER.green, -0.12), width: 7.6 },
  build: { shoulder: 13.4, hip: 9.6, height: 1 },
  torso(ctx, s, pose) {
    const top = s.shoulderY, bottom = s.hipY + 2.4;
    if (s.view === 'side') {
      torsoSidePath(ctx, top, bottom, 17.6, 1);
      shadeTorso(ctx, PLAYER.vest, top, bottom, 8);
      ctx.save(); ctx.clip();
      quilting(ctx, -9, top, 10, bottom, 4.2, PLAYER.vest, 0.6);
      // Hoodie hem showing under the vest.
      ctx.fillStyle = linear(ctx, 0, bottom - 3, 0, bottom, [[0, PLAYER.green], [1, shade(PLAYER.green, -0.3)]]);
      ctx.fillRect(-9, bottom - 2.6, 20, 3);
      ctx.restore();
      // Hood lying on the upper back.
      ctx.beginPath();
      ctx.moveTo(-7.4, top - 0.4); ctx.quadraticCurveTo(-10.4, top + 4, -6.6, top + 8.6); ctx.quadraticCurveTo(-3.4, top + 5.6, -2.6, top + 0.4); ctx.closePath();
      paintPath(ctx, PLAYER.hoodie, -10, top, -2, top + 9, { light: 0.15, dark: 0.3 });
      return;
    }
    const shape = { top, bottom, shoulder: 13.4, waist: 10.6, hem: 11.2 };
    // Hoodie: cream-yellow chest, green lower body.
    torsoPath(ctx, s, shape, pose.yaw);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = linear(ctx, -12, top, 12, bottom, [[0, shade(PLAYER.hoodie, 0.12)], [0.5, PLAYER.hoodie], [1, shade(PLAYER.hoodie, -0.25)]]);
    ctx.fillRect(-16, top - 4, 32, bottom - top + 6);
    const split = top + (bottom - top) * 0.55;
    ctx.fillStyle = linear(ctx, -12, split, 12, bottom, [[0, shade(PLAYER.green, 0.12)], [1, shade(PLAYER.green, -0.28)]]);
    ctx.beginPath(); ctx.moveTo(-16, split + 1.2); ctx.quadraticCurveTo(0, split - 0.8, 16, split + 1.2); ctx.lineTo(16, bottom + 3); ctx.lineTo(-16, bottom + 3); ctx.closePath(); ctx.fill();
    // Kangaroo pocket.
    if (s.view === 'front') {
      ctx.strokeStyle = rgba(shade(PLAYER.green, -0.4), 0.7);
      ctx.lineWidth = 0.45;
      ctx.beginPath(); ctx.moveTo(-5 + pose.yaw, bottom - 1); ctx.lineTo(-4 + pose.yaw, split + 3.6); ctx.lineTo(4 + pose.yaw, split + 3.6); ctx.lineTo(5 + pose.yaw, bottom - 1); ctx.stroke();
    }
    ctx.restore();
    torsoPath(ctx, s, shape, pose.yaw);
    ctx.strokeStyle = rgba(shade(PLAYER.hoodie, -0.5), 0.8);
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // Ribbed hem.
    ctx.fillStyle = rgba(shade(PLAYER.green, -0.18));
    ctx.fillRect(-11.2 + pose.yaw * 0.4, bottom - 1.6, 22.4, 1.8);

    // Puffer vest panels.
    const panel = (side: -1 | 1) => {
      const inner = s.view === 'front' ? 3.4 : -0.2;
      ctx.beginPath();
      ctx.moveTo(side * (inner + 0.6) + pose.yaw, top - 0.8);
      ctx.quadraticCurveTo(side * 9 + pose.yaw, top - 2.4, side * 13.6 + pose.yaw, top + 3.2);
      ctx.quadraticCurveTo(side * 12.8 + pose.yaw * 0.6, (top + bottom) / 2, side * 12 + pose.yaw * 0.4, bottom - 1.2);
      ctx.lineTo(side * (inner + 0.4) + pose.yaw * 0.4, bottom - 0.4);
      ctx.quadraticCurveTo(side * (inner - 0.4) + pose.yaw * 0.6, (top + bottom) / 2, side * inner + pose.yaw, top + 4);
      ctx.closePath();
    };
    for (const side of [-1, 1] as Array<-1 | 1>) {
      if (s.view === 'back' && side === 1) continue;
      const outline = () => (s.view === 'back' ? torsoPath(ctx, s, { ...shape, bottom: bottom - 0.6 }, 0) : panel(side));
      outline();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = linear(ctx, -13, top, 13, bottom, [[0, shade(PLAYER.vest, 0.32)], [0.4, shade(PLAYER.vest, 0.06)], [1, shade(PLAYER.vest, -0.2)]]);
      ctx.fillRect(-16, top - 4, 32, bottom - top + 6);
      quilting(ctx, -15, top, 15, bottom, 4.4, PLAYER.vest, 0.85);
      ctx.restore();
      outline();
      ctx.strokeStyle = rgba(0x050507, 0.9);
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
    if (s.view === 'front') {
      // Zipper edges and the gold treble clef on the chest.
      ctx.strokeStyle = 'rgba(190,195,205,0.55)';
      ctx.lineWidth = 0.35;
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * 3.6 + pose.yaw, top + 4); ctx.lineTo(side * 3.6 + pose.yaw * 0.4, bottom - 0.6); ctx.stroke(); }
      ctx.save();
      ctx.translate(7.2 + pose.yaw, top + 7.6);
      ctx.strokeStyle = rgba(0xf0c534);
      ctx.fillStyle = rgba(0xf0c534);
      ctx.scale(0.95, 0.95);
      trebleClef(ctx);
      ctx.restore();
      // Hood collar and drawstrings.
      const [hx] = s.head;
      // Thick hood collar bunched around the neck.
      ctx.beginPath();
      ctx.moveTo(-7.4 + hx * 0.5, top - 0.2);
      ctx.quadraticCurveTo(-6.4 + hx * 0.5, top - 4.6, hx * 0.5, top - 4.4);
      ctx.quadraticCurveTo(6.4 + hx * 0.5, top - 4.6, 7.4 + hx * 0.5, top - 0.2);
      ctx.quadraticCurveTo(hx * 0.5, top + 6.2, -7.4 + hx * 0.5, top - 0.2);
      ctx.closePath();
      paintPath(ctx, PLAYER.hoodie, -7, top - 4.5, 7, top + 6, { light: 0.2, dark: 0.3 });
      ctx.strokeStyle = rgba(shade(PLAYER.hoodie, -0.4), 0.55);
      ctx.lineWidth = 0.4;
      ctx.beginPath(); ctx.moveTo(-4.6 + hx * 0.5, top - 1.4); ctx.quadraticCurveTo(hx * 0.5, top + 3.4, 4.6 + hx * 0.5, top - 1.4); ctx.stroke();
      ctx.strokeStyle = rgba(0xf6f4ee, 0.95);
      ctx.lineWidth = 0.5;
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(side * 1.6 + hx * 0.5, top + 2.4); ctx.quadraticCurveTo(side * 2 + hx * 0.4, top + 6, side * 1.6 + hx * 0.3, top + 8.2); ctx.stroke();
      }
    } else {
      // Hood lying on the back.
      ctx.beginPath();
      ctx.moveTo(-7.6, top - 0.6);
      ctx.quadraticCurveTo(-8.6, top + 7, 0, top + 9.4);
      ctx.quadraticCurveTo(8.6, top + 7, 7.6, top - 0.6);
      ctx.quadraticCurveTo(0, top + 1.6, -7.6, top - 0.6);
      ctx.closePath();
      paintPath(ctx, PLAYER.hoodie, -8, top, 8, top + 9, { light: 0.15, dark: 0.32 });
      ctx.strokeStyle = rgba(shade(PLAYER.hoodie, -0.4), 0.6);
      ctx.lineWidth = 0.4;
      ctx.beginPath(); ctx.moveTo(-4.6, top + 2); ctx.quadraticCurveTo(0, top + 7.6, 4.6, top + 2); ctx.stroke();
    }
  },
  head(ctx, s, pose) {
    shortHairSides(ctx, s, PLAYER.hair);
    if (s.view === 'front') capFront(ctx, s, pose, PLAYER.cap, 'MR', 0);
    else if (s.view === 'back') capBack(ctx, s, PLAYER.cap);
    else capSide(ctx, s, PLAYER.cap);
  },
};

// ── Professorin Krys (Elder Muse): quilted olive coat, braided bun, staff ──

const PROF = {
  skin: 0x8c5a3a, coat: 0x76825a, teal: 0x2f8f86, hair: 0x18151a, inner: 0x1d1c22, gold: 0xd5a03e,
};

function braidedBun(ctx: Ctx, s: Skeleton): void {
  const [hx, hy] = s.head;
  const side = s.view === 'side';
  // Hairline framing the face.
  if (s.view === 'front') {
    ctx.beginPath();
    ctx.moveTo(hx - 8, hy - 1.4);
    ctx.bezierCurveTo(hx - 9.4, hy - 12.4, hx + 9.4, hy - 12.4, hx + 8, hy - 1.4);
    ctx.quadraticCurveTo(hx + 6.6, hy - 6.4, hx + 1.2, hy - 7.2);
    ctx.quadraticCurveTo(hx - 0.2, hy - 6.2, hx - 1.4, hy - 7.2);
    ctx.quadraticCurveTo(hx - 6.6, hy - 6.4, hx - 8, hy - 1.4);
    ctx.closePath();
    paintPath(ctx, PROF.hair, hx - 9, hy - 12, hx + 9, hy - 1, { light: 0.25, dark: 0.3 });
  } else {
    ctx.beginPath();
    ctx.moveTo(hx - 8.2, hy + 2);
    ctx.bezierCurveTo(hx - 9.6, hy - 12.8, hx + 9.6, hy - 12.8, hx + (side ? 5.6 : 8.2), hy + (side ? -2 : 2));
    ctx.quadraticCurveTo(hx, hy + 4.6, hx - 8.2, hy + 2);
    ctx.closePath();
    paintPath(ctx, PROF.hair, hx - 9, hy - 12, hx + 9, hy + 4, { light: 0.22, dark: 0.3 });
  }
  // Braided crown bun.
  const bx = hx + (side ? -2.4 : 0), by = hy - 12.6;
  ellipsePath(ctx, bx, by, 7.6, 5.4);
  paintPath(ctx, PROF.hair, bx - 7, by - 5, bx + 7, by + 5, { light: 0.3, dark: 0.3 });
  ctx.save();
  ellipsePath(ctx, bx, by, 7.6, 5.4);
  ctx.clip();
  ctx.strokeStyle = 'rgba(120,110,120,0.45)';
  ctx.lineWidth = 0.45;
  for (let r = 1.6; r < 8; r += 1.6) {
    for (let a = 0; a < Math.PI * 2; a += 0.7) {
      ctx.beginPath(); ctx.ellipse(bx + Math.cos(a) * r * 0.9, by + Math.sin(a) * r * 0.62, 0.9, 0.5, a + 0.6, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
}

function glassesFront(ctx: Ctx, s: Skeleton, pose: Pose): void {
  const [hx, hy] = s.head;
  for (const side of [-1, 1]) {
    const ex = hx + side * 3.25 + pose.yaw * 1.6 * (side > 0 ? 0.85 : 1.15);
    ctx.beginPath(); ctx.arc(ex, hy - 0.4, 2.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(120,200,190,0.22)';
    ctx.fill();
    ctx.strokeStyle = rgba(PROF.gold, 0.95);
    ctx.lineWidth = 0.45;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(ex - 0.8, hy - 1.3, 0.7, 0.4, -0.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = rgba(PROF.gold, 0.95);
  ctx.lineWidth = 0.4;
  ctx.beginPath(); ctx.moveTo(hx - 1 + pose.yaw * 1.6, hy - 0.7); ctx.quadraticCurveTo(hx + pose.yaw * 1.6, hy - 1.4, hx + 1 + pose.yaw * 1.6, hy - 0.7); ctx.stroke();
  // Teal drop earrings.
  for (const side of [-1, 1]) {
    ctx.fillStyle = radial(ctx, hx + side * 7.4, hy + 3.2, 0, 1, [[0, 0x7fe6d8], [1, PROF.teal]]);
    ctx.beginPath(); ctx.ellipse(hx + side * 7.4, hy + 3.2, 0.7, 1, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function staff(ctx: Ctx, x: number, footY: number, topY: number): void {
  ctx.save();
  // Wooden shaft with teal bands.
  ctx.beginPath();
  ctx.rect(x - 0.9, topY + 6, 1.8, footY - topY - 6);
  paintPath(ctx, 0x8a5a2e, x - 0.9, topY, x + 0.9, footY, { light: 0.25, dark: 0.3, angle: 'horizontal', line: 0.5, lineWidth: 0.35 });
  for (const t of [0.22, 0.3, 0.62]) {
    const y = topY + 6 + (footY - topY - 6) * t;
    ctx.fillStyle = rgba(PROF.teal);
    ctx.fillRect(x - 1.05, y, 2.1, 1.2);
  }
  // Teal orb and the golden tuning-fork head.
  ctx.fillStyle = radial(ctx, x - 0.4, topY + 6.4, 0, 2, [[0, 0xb8fff4], [0.5, 0x3fb8a8], [1, 0x14544e]]);
  ctx.beginPath(); ctx.arc(x, topY + 6.6, 1.9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = rgba(PROF.gold);
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 2.4, topY - 2.4); ctx.lineTo(x - 2.4, topY + 2.2); ctx.quadraticCurveTo(x - 2.4, topY + 4.6, x, topY + 4.6);
  ctx.quadraticCurveTo(x + 2.4, topY + 4.6, x + 2.4, topY + 2.2); ctx.lineTo(x + 2.4, topY - 2.4);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,190,0.7)';
  ctx.lineWidth = 0.35;
  ctx.beginPath(); ctx.moveTo(x - 2.7, topY - 2); ctx.lineTo(x - 2.7, topY + 2); ctx.stroke();
  ctx.restore();
}

export const PROFESSOR_OUTFIT: Outfit = {
  face: { skin: PROF.skin, eyes: 0x4a2a18, brows: 0x2a2224, lips: 0x7a4232, age: 'elder' },
  hands: { skin: PROF.skin },
  shoes: { upper: 0x18171b, sole: 0x2b2a2e, accent: PROF.gold, boot: true },
  pants: { color: PROF.inner, width: 7.6 },
  sleeves: { color: PROF.coat, cuff: shade(PROF.coat, -0.12), width: 8.2 },
  build: { shoulder: 12.6, hip: 9.8, height: 0.97 },
  coatSkirt: { color: PROF.coat, length: 30, motif: PROF.teal },
  torso(ctx, s, pose) {
    const top = s.shoulderY, bottom = s.hipY + 1;
    if (s.view === 'side') {
      torsoSidePath(ctx, top, bottom, 17, 0.8);
      shadeTorso(ctx, PROF.coat, top, bottom, 8);
      ctx.beginPath(); ctx.moveTo(1.2, top + 1); ctx.quadraticCurveTo(5, top - 1.4, 6.4, top + 3); ctx.lineTo(3.2, top + 5); ctx.closePath();
      paintPath(ctx, PROF.teal, 1, top - 1, 6.5, top + 5, { light: 0.2, dark: 0.3 });
      return;
    }
    const shape = { top, bottom, shoulder: 12.6, waist: 9.8, hem: 10.8 };
    torsoPath(ctx, s, shape, pose.yaw);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = linear(ctx, -12, top, 12, bottom, [[0, shade(PROF.coat, 0.16)], [0.5, PROF.coat], [1, shade(PROF.coat, -0.3)]]);
    ctx.fillRect(-16, top - 4, 32, bottom - top + 6);
    if (s.view === 'front') {
      // Dark tunic between the open lapels, with gold trim at the waist.
      ctx.beginPath(); ctx.moveTo(-3.4 + pose.yaw, top); ctx.lineTo(3.4 + pose.yaw, top); ctx.lineTo(2.2 + pose.yaw, bottom + 2); ctx.lineTo(-2.2 + pose.yaw, bottom + 2); ctx.closePath();
      ctx.fillStyle = linear(ctx, -3, top, 3, bottom, [[0, 0x2f2d36], [1, PROF.inner]]);
      ctx.fill();
      ctx.fillStyle = rgba(PROF.gold, 0.85);
      ctx.fillRect(-2.6 + pose.yaw, bottom - 4, 5.2, 0.7);
    }
    // Quilted diamonds.
    ctx.strokeStyle = rgba(shade(PROF.coat, -0.35), 0.5);
    ctx.lineWidth = 0.35;
    for (let k = -30; k < 30; k += 3.4) {
      ctx.beginPath(); ctx.moveTo(k, top); ctx.lineTo(k + 26, bottom + 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(k, top); ctx.lineTo(k - 26, bottom + 2); ctx.stroke();
    }
    ctx.restore();
    torsoPath(ctx, s, shape, pose.yaw);
    ctx.strokeStyle = rgba(shade(PROF.coat, -0.5), 0.8);
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // High teal collar.
    const [hx] = s.head;
    ctx.beginPath();
    ctx.moveTo(-6 + hx * 0.5, top - 1.8);
    ctx.quadraticCurveTo(hx * 0.5, top + 3.6, 6 + hx * 0.5, top - 1.8);
    ctx.lineTo(5 + hx * 0.5, top + 2.4);
    ctx.quadraticCurveTo(hx * 0.5, top + 6, -5 + hx * 0.5, top + 2.4);
    ctx.closePath();
    paintPath(ctx, PROF.teal, -6, top - 2, 6, top + 6, { light: 0.2, dark: 0.3 });
  },
  head(ctx, s, pose) {
    braidedBun(ctx, s);
    if (s.view === 'front') glassesFront(ctx, s, pose);
    if (s.view === 'side') {
      const [hx, hy] = s.head;
      ctx.beginPath(); ctx.arc(hx + 4.6, hy - 0.6, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(120,200,190,0.22)'; ctx.fill();
      ctx.strokeStyle = rgba(PROF.gold); ctx.lineWidth = 0.42; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx + 2.6, hy - 0.8); ctx.lineTo(hx - 1.6, hy - 0.2); ctx.stroke();
    }
  },
  front(ctx, s, pose) {
    if (s.view !== 'front') return;
    // Gold treble clef pendant.
    const px = 0.4 + pose.yaw, py = s.shoulderY + 8.6;
    ctx.strokeStyle = rgba(PROF.gold, 0.9);
    ctx.lineWidth = 0.3;
    ctx.beginPath(); ctx.moveTo(px - 3, s.shoulderY + 2); ctx.lineTo(px, py - 2.4); ctx.lineTo(px + 3, s.shoulderY + 2); ctx.stroke();
    ctx.save(); ctx.translate(px, py); ctx.scale(0.75, 0.75);
    ctx.strokeStyle = rgba(PROF.gold); ctx.fillStyle = rgba(PROF.gold);
    trebleClef(ctx);
    ctx.restore();
    // Musical notes embroidered on the sleeves.
    for (const i of [0, 1] as const) {
      const [ex, ey] = s.elbow[i];
      ctx.fillStyle = rgba(PROF.teal, 0.9);
      ctx.beginPath(); ctx.ellipse(ex + (i ? -0.8 : 0.8), ey + 3.6, 0.8, 0.6, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgba(PROF.teal, 0.9); ctx.lineWidth = 0.35;
      ctx.beginPath(); ctx.moveTo(ex + (i ? -0.1 : 1.5), ey + 3.4); ctx.lineTo(ex + (i ? -0.1 : 1.5), ey + 0.8); ctx.stroke();
    }
  },
  held(ctx, s) {
    const [wx, wy] = s.wrist[s.view === 'side' ? 1 : 0];
    staff(ctx, wx + (s.view === 'side' ? 1.6 : -0.4), 1.2, -103.6);
    // Fingers wrapped around the shaft.
    ctx.fillStyle = rgba(shade(PROF.skin, -0.05));
    ctx.beginPath(); ctx.ellipse(wx + (s.view === 'side' ? 1.6 : -0.4), wy + 1.6, 1.5, 1.2, 0, 0, Math.PI * 2); ctx.fill();
  },
};

// ── Quincy Guard: navy puffer with cyan piping, lime armband, radio ──────

const GUARD = { skin: 0xa86a43, navy: 0x1e2a3e, cyan: 0x3ad6e6, inner: 0x3a3e45, pants: 0x2a2d33, lime: 0xc8f040, orange: 0xf07a2a };

export const GUARD_OUTFIT: Outfit = {
  face: { skin: GUARD.skin, eyes: 0x3a2414, brows: 0x1a1210, lips: 0x8a4a38 },
  hands: { skin: GUARD.skin },
  shoes: { upper: 0x1c1e22, sole: GUARD.cyan, accent: GUARD.cyan, boot: true },
  pants: { color: GUARD.pants, cargo: true, piping: GUARD.cyan },
  sleeves: { color: GUARD.navy, cuff: shade(GUARD.navy, -0.2), width: 8.4, band: { color: GUARD.lime, side: 0 } },
  build: { shoulder: 14, hip: 9.8, height: 1 },
  torso(ctx, s, pose) {
    const top = s.shoulderY, bottom = s.hipY + 2.2;
    if (s.view === 'side') {
      torsoSidePath(ctx, top, bottom, 18.6, 1.2);
      shadeTorso(ctx, GUARD.navy, top, bottom, 8);
      ctx.save(); ctx.clip(); quilting(ctx, -10, top, 11, bottom, 4.4, GUARD.navy, 0.7); ctx.restore();
      ctx.strokeStyle = rgba(GUARD.cyan, 0.9); ctx.lineWidth = 0.45;
      ctx.beginPath(); ctx.moveTo(6, top + 3); ctx.quadraticCurveTo(7.6, (top + bottom) / 2, 6.6, bottom); ctx.stroke();
      return;
    }
    const shape = { top, bottom, shoulder: 14, waist: 11.4, hem: 12 };
    torsoPath(ctx, s, shape, pose.yaw);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = linear(ctx, -13, top, 13, bottom, [[0, shade(GUARD.navy, 0.3)], [0.45, GUARD.navy], [1, shade(GUARD.navy, -0.3)]]);
    ctx.fillRect(-16, top - 4, 32, bottom - top + 6);
    if (s.view === 'front') {
      // Open front: charcoal inner vest with the signal glyph and belt.
      ctx.beginPath(); ctx.moveTo(-4.4 + pose.yaw, top + 1); ctx.lineTo(4.4 + pose.yaw, top + 1); ctx.lineTo(4 + pose.yaw, bottom + 2); ctx.lineTo(-4 + pose.yaw, bottom + 2); ctx.closePath();
      ctx.fillStyle = linear(ctx, -4, top, 4, bottom, [[0, shade(GUARD.inner, 0.15)], [1, shade(GUARD.inner, -0.25)]]);
      ctx.fill();
      ctx.strokeStyle = rgba(GUARD.cyan, 0.95); ctx.lineWidth = 0.55;
      ctx.beginPath(); ctx.moveTo(-1.6 + pose.yaw, top + 9.6); ctx.lineTo(1.6 + pose.yaw, top + 9.6); ctx.lineTo(-1.6 + pose.yaw, top + 13); ctx.lineTo(1.6 + pose.yaw, top + 13); ctx.stroke();
      ctx.fillStyle = rgba(0x111214);
      ctx.fillRect(-12, bottom - 4.4, 24, 2.2);
      ctx.fillStyle = 'rgba(200,210,215,0.8)';
      ctx.fillRect(-1.2 + pose.yaw, bottom - 4.6, 2.4, 2.6);
    }
    quilting(ctx, -16, top, 16, bottom - 3, 4.6, GUARD.navy, 0.75);
    ctx.restore();
    torsoPath(ctx, s, shape, pose.yaw);
    ctx.strokeStyle = rgba(0x0b1018, 0.9);
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // Cyan piping along the zipper and pocket seams.
    ctx.strokeStyle = rgba(GUARD.cyan, 0.9);
    ctx.lineWidth = 0.45;
    if (s.view === 'front') {
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(side * 4.6 + pose.yaw, top + 1); ctx.lineTo(side * 4.4 + pose.yaw * 0.4, bottom - 0.6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(side * 6.4, top + 13); ctx.lineTo(side * 10.6, top + 13); ctx.stroke();
      }
    } else {
      ctx.beginPath(); ctx.moveTo(-11, top + 6); ctx.quadraticCurveTo(0, top + 8, 11, top + 6); ctx.stroke();
    }
    // Hood collar.
    const [hx] = s.head;
    ctx.beginPath();
    ctx.moveTo(-6.8 + hx * 0.5, top - 1.6);
    ctx.quadraticCurveTo(hx * 0.5, top + (s.view === 'front' ? 3.6 : 6), 6.8 + hx * 0.5, top - 1.6);
    ctx.quadraticCurveTo(hx * 0.5, top - 3.8, -6.8 + hx * 0.5, top - 1.6);
    ctx.closePath();
    paintPath(ctx, shade(GUARD.navy, 0.06), -7, top - 4, 7, top + 6, { light: 0.25, dark: 0.3 });
    ctx.strokeStyle = rgba(GUARD.cyan, 0.75); ctx.lineWidth = 0.4; ctx.stroke();
  },
  head(ctx, s, pose) {
    shortHairSides(ctx, s, 0x15100e);
    if (s.view === 'front') capFront(ctx, s, pose, 0x1b2436, 'stripe', GUARD.cyan);
    else if (s.view === 'back') capBack(ctx, s, 0x1b2436);
    else capSide(ctx, s, 0x1b2436, GUARD.cyan);
  },
  front(ctx, s, pose) {
    // Orange radio clipped to the belt.
    const x = s.view === 'side' ? 3.8 : 8.6 + pose.yaw * 0.4;
    const y = s.hipY - 4.6;
    ctx.beginPath(); ctx.rect(x - 1.5, y - 1, 3, 6.2);
    paintPath(ctx, GUARD.orange, x - 1.5, y - 1, x + 1.5, y + 5, { light: 0.3, dark: 0.3, line: 0.5, lineWidth: 0.4 });
    ctx.fillStyle = rgba(0x2a2a2a);
    ctx.fillRect(x - 0.35, y - 4, 0.7, 3.2);
    ctx.fillStyle = 'rgba(255,240,200,0.8)';
    ctx.fillRect(x - 0.9, y + 0.4, 1.8, 0.7);
  },
};

// ── Kian Vero: orange bomber, teal scarf, keytar on his back ─────────────

const KIAN = { skin: 0xd8955e, jacket: 0xd2582a, tee: 0x8d7c64, teal: 0x1f8b86, hair: 0x6e321c, olive: 0x5d6b36, strap: 0x6b4426 };

function messyHair(ctx: Ctx, s: Skeleton): void {
  const [hx, hy] = s.head;
  const view = s.view;
  const tufts: Array<[number, number, number]> = view === 'front'
    ? [[-7.4, -4, -2.3], [-5.6, -9.8, -1.5], [-2.4, -12.8, -0.6], [1.4, -13.4, 0.4], [4.6, -11.8, 1.1], [7.2, -7.6, 1.8], [8.2, -3.6, 2.4]]
    : view === 'back'
      ? [[-7.6, 0, -2.4], [-6, -9.4, -1.5], [-2.4, -12.8, -0.6], [1.4, -13.2, 0.4], [4.8, -11.6, 1.1], [7.4, -6, 2], [7.8, 1.2, 2.4]]
      : [[-7.4, 1, -2.6], [-6.8, -7, -2], [-3.6, -11.6, -1.2], [0.4, -13, -0.2], [3.8, -11.6, 0.8], [6.4, -8, 1.6]];
  // Base mass.
  ctx.beginPath();
  if (view === 'front') {
    ctx.moveTo(hx - 8.4, hy - 0.4);
    ctx.bezierCurveTo(hx - 9.6, hy - 13.2, hx + 9.6, hy - 13.2, hx + 8.4, hy - 0.4);
    ctx.quadraticCurveTo(hx + 6, hy - 6.4, hx + 2, hy - 5.6);
    ctx.quadraticCurveTo(hx - 1.2, hy - 7.6, hx - 3.4, hy - 5);
    ctx.quadraticCurveTo(hx - 6.6, hy - 6, hx - 8.4, hy - 0.4);
  } else {
    ctx.moveTo(hx - 8.4, hy + 3);
    ctx.bezierCurveTo(hx - 9.8, hy - 13.4, hx + 9.6, hy - 13.4, hx + (view === 'side' ? 5.6 : 8.4), hy + (view === 'side' ? -3 : 3));
    ctx.quadraticCurveTo(hx, hy + 6, hx - 8.4, hy + 3);
  }
  ctx.closePath();
  paintPath(ctx, KIAN.hair, hx - 9, hy - 13, hx + 9, hy + 3, { light: 0.25, dark: 0.32 });
  tufts.forEach(([tx, ty, lean]) => {
    ctx.beginPath();
    ctx.moveTo(hx + tx - 2.2, hy + ty + 2.4);
    ctx.quadraticCurveTo(hx + tx + lean * 0.4, hy + ty - 1.4, hx + tx + lean * 1.6, hy + ty - 3.2);
    ctx.quadraticCurveTo(hx + tx + lean * 0.2 + 1, hy + ty + 0.4, hx + tx + 2.2, hy + ty + 2.6);
    ctx.closePath();
    paintPath(ctx, shade(KIAN.hair, 0.05), hx + tx - 2, hy + ty - 3, hx + tx + 2, hy + ty + 2.5, { light: 0.3, dark: 0.25, line: 0.45, lineWidth: 0.4 });
  });
}

function keytar(ctx: Ctx, x: number, y: number, angle: number, scale = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  // Neck and head with tuning keys.
  ctx.beginPath(); ctx.rect(-1.2, -16, 2.4, 10);
  paintPath(ctx, 0x2b2d33, -1.2, -16, 1.2, -6, { light: 0.25, dark: 0.3, line: 0.5, lineWidth: 0.4 });
  for (let k = 0; k < 3; k++) {
    ctx.fillStyle = rgba(0xb8b8b0);
    ctx.beginPath(); ctx.arc(-1.8, -15 + k * 1.6, 0.5, 0, Math.PI * 2); ctx.arc(1.8, -15 + k * 1.6, 0.5, 0, Math.PI * 2); ctx.fill();
  }
  // Body with keys and a strip of glowing pads.
  roundRect(ctx, -4.6, -7, 9.2, 15, 1.6);
  paintPath(ctx, 0x34363d, -4.6, -7, 4.6, 8, { light: 0.22, dark: 0.3, line: 0.55, lineWidth: 0.45 });
  for (let k = 0; k < 6; k++) {
    ctx.fillStyle = rgba(0xf2f2ec);
    ctx.fillRect(-3.4, -4.6 + k * 1.7, 4.2, 1.3);
    if (k % 2 === 0) { ctx.fillStyle = rgba(0x15161a); ctx.fillRect(-3.4, -3.9 + k * 1.7, 2.4, 0.7); }
  }
  for (let k = 0; k < 4; k++) {
    ctx.fillStyle = rgba([0x7ef06a, 0x4fd6c8, 0xf0d24a, 0x7ef06a][k]);
    ctx.fillRect(1.6, -4.6 + k * 2.6, 1.8, 1.6);
  }
  ctx.restore();
}

export const MUSICIAN_OUTFIT: Outfit = {
  face: { skin: KIAN.skin, eyes: 0x5a3218, brows: 0x5a2814, lips: 0xb46a4c, freckles: true },
  hands: { skin: KIAN.skin },
  shoes: { upper: 0xbdb193, sole: 0xe8e4d8, accent: KIAN.teal },
  pants: { color: KIAN.olive, cargo: true },
  sleeves: { color: KIAN.jacket, cuff: shade(KIAN.jacket, -0.22), width: 8.4, patch: { color: KIAN.teal, side: 1 } },
  build: { shoulder: 13.6, hip: 9.6, height: 0.99 },
  backItem(ctx, s, pose, layer) {
    if (s.view === 'front' && layer === 'behind') keytar(ctx, -12.2 + pose.yaw, s.shoulderY + 1, -0.5, 0.95);
    if (s.view === 'back' && layer === 'front') keytar(ctx, 2.4, s.shoulderY + 12, 0.42, 1.05);
    if (s.view === 'side' && layer === 'behind') keytar(ctx, -8.4, s.shoulderY + 9, 0.32, 1);
  },
  torso(ctx, s, pose) {
    const top = s.shoulderY, bottom = s.hipY + 1.6;
    if (s.view === 'side') {
      torsoSidePath(ctx, top, bottom, 17.8, 1.4);
      shadeTorso(ctx, KIAN.jacket, top, bottom, 8);
      ctx.fillStyle = rgba(shade(KIAN.jacket, -0.22));
      ctx.fillRect(-8.6, bottom - 2.2, 17.6, 2.4);
      return;
    }
    const shape = { top, bottom, shoulder: 13.6, waist: 11.2, hem: 11 };
    torsoPath(ctx, s, shape, pose.yaw);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = linear(ctx, -13, top, 13, bottom, [[0, shade(KIAN.jacket, 0.18)], [0.5, KIAN.jacket], [1, shade(KIAN.jacket, -0.3)]]);
    ctx.fillRect(-16, top - 4, 32, bottom - top + 6);
    if (s.view === 'front') {
      ctx.beginPath(); ctx.moveTo(-4.2 + pose.yaw, top); ctx.lineTo(4.2 + pose.yaw, top); ctx.lineTo(3 + pose.yaw, bottom + 2); ctx.lineTo(-3 + pose.yaw, bottom + 2); ctx.closePath();
      ctx.fillStyle = linear(ctx, -4, top, 4, bottom, [[0, shade(KIAN.tee, 0.12)], [1, shade(KIAN.tee, -0.25)]]);
      ctx.fill();
      // Zip teeth.
      ctx.strokeStyle = 'rgba(220,200,160,0.7)';
      ctx.lineWidth = 0.35;
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * 4 + pose.yaw, top + 2); ctx.lineTo(side * 3 + pose.yaw, bottom); ctx.stroke(); }
      // Pins: lime note and teal wave.
      emblem(ctx, 7.4 + pose.yaw, top + 7.4, 1.6, 0xb8d83c, 0x24361a, c => { c.lineWidth = 0.4; c.beginPath(); c.moveTo(0.3, 0.9); c.lineTo(0.3, -1); c.lineTo(1, -0.6); c.stroke(); c.beginPath(); c.arc(-0.2, 0.9, 0.45, 0, Math.PI * 2); c.fill(); });
      emblem(ctx, 7 + pose.yaw, top + 11.4, 1.5, KIAN.teal, 0xd8fff6, c => { c.lineWidth = 0.4; c.beginPath(); c.moveTo(-1, 0); c.quadraticCurveTo(-0.5, -1, 0, 0); c.quadraticCurveTo(0.5, 1, 1, 0); c.stroke(); });
    }
    // Shoulder patch.
    ctx.beginPath(); ctx.rect(-12.4 + pose.yaw, top + 2.4, 3.6, 3.4);
    paintPath(ctx, 0xc49a62, -12.4, top + 2.4, -8.8, top + 5.8, { light: 0.1, dark: 0.2, line: 0.4, lineWidth: 0.3 });
    ctx.restore();
    torsoPath(ctx, s, shape, pose.yaw);
    ctx.strokeStyle = rgba(shade(KIAN.jacket, -0.5), 0.85);
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // Ribbed waistband.
    ctx.fillStyle = rgba(shade(KIAN.jacket, -0.24));
    ctx.fillRect(-11 + pose.yaw * 0.4, bottom - 2.2, 22, 2.4);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.3;
    for (let x = -10.4; x < 11; x += 1) { ctx.beginPath(); ctx.moveTo(x + pose.yaw * 0.4, bottom - 2.2); ctx.lineTo(x + pose.yaw * 0.4, bottom); ctx.stroke(); }
    // Leather strap across the chest.
    ctx.strokeStyle = rgba(KIAN.strap);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-10 + pose.yaw, top + 1); ctx.lineTo(9 + pose.yaw * 0.4, bottom - 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,190,0.25)'; ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.moveTo(-9.6 + pose.yaw, top + 0.6); ctx.lineTo(9.4 + pose.yaw * 0.4, bottom - 2.4); ctx.stroke();
    ctx.fillStyle = rgba(0xc8b070);
    ctx.fillRect(-3.6 + pose.yaw * 0.7, top + 7.4, 2.2, 1.6);
  },
  head(ctx, s) { messyHair(ctx, s); },
  front(ctx, s, pose) {
    const top = s.shoulderY;
    if (s.view === 'side') {
      ctx.beginPath(); ctx.moveTo(-1, top - 1); ctx.quadraticCurveTo(4, top - 2, 6.2, top + 2.2); ctx.quadraticCurveTo(2, top + 4, -1.4, top + 2.4); ctx.closePath();
      paintPath(ctx, KIAN.teal, -1.4, top - 2, 6.2, top + 4, { light: 0.2, dark: 0.3 });
      return;
    }
    // Knit teal scarf wrapped around the neck; one tail falls over the chest.
    const [hx] = s.head;
    const cx = hx * 0.5;
    ctx.beginPath();
    ctx.moveTo(-7.4 + cx, top - 1.6);
    ctx.quadraticCurveTo(cx, top + 4.6, 7.4 + cx, top - 1.6);
    ctx.lineTo(7 + cx, top + 2.4);
    ctx.quadraticCurveTo(cx, top + 8, -7 + cx, top + 2.4);
    ctx.closePath();
    paintPath(ctx, KIAN.teal, -7.4, top - 2, 7.4, top + 8, { light: 0.2, dark: 0.32 });
    if (s.view === 'front') {
      ctx.beginPath();
      ctx.moveTo(2 + cx, top + 3.6); ctx.lineTo(6 + cx, top + 3.2); ctx.lineTo(6.6 + cx + pose.yaw * 0.3, top + 15.6); ctx.lineTo(3.2 + cx + pose.yaw * 0.3, top + 16.2); ctx.closePath();
      paintPath(ctx, shade(KIAN.teal, -0.04), 2, top + 3, 7, top + 16, { light: 0.18, dark: 0.32 });
      ctx.strokeStyle = 'rgba(200,255,245,0.55)'; ctx.lineWidth = 0.35;
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(3.4 + cx + k * 0.9, top + 15.8); ctx.lineTo(3.4 + cx + k * 0.9, top + 17.6); ctx.stroke(); }
    }
    // Ribbed knit texture.
    ctx.strokeStyle = 'rgba(10,40,38,0.35)'; ctx.lineWidth = 0.3;
    for (let k = -6; k <= 6; k += 1.3) { ctx.beginPath(); ctx.moveTo(k + cx, top - 0.6 + Math.abs(k) * -0.2); ctx.lineTo(k * 0.94 + cx, top + 3.6 - Math.abs(k) * 0.3); ctx.stroke(); }
  },
};

export const OUTFITS: Record<CharacterId, Outfit> = {
  player: PLAYER_OUTFIT,
  professor: PROFESSOR_OUTFIT,
  guard: GUARD_OUTFIT,
  musician: MUSICIAN_OUTFIT,
};

