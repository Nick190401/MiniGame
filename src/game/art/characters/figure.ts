import { linear, mix, rgba, shade, type Ctx } from '../paint';
import {
  ellipsePath, faceFront, faceSide, hand, headBack, limbPath, neck, occlusion, paintPath, shoe,
  type FaceStyle, type HandStyle, type Pose, type ShoeStyle,
} from './rig';

type P = [number, number];

export interface Skeleton {
  view: 'front' | 'back' | 'side';
  head: P;
  shoulderY: number;
  hipY: number;
  /** Screen-left / screen-right in front and back views; far / near in side view. */
  shoulder: [P, P];
  elbow: [P, P];
  wrist: [P, P];
  hip: [P, P];
  knee: [P, P];
  ankle: [P, P];
  lift: [number, number];
}

export interface Build {
  shoulder: number;
  hip: number;
  /** Overall height multiplier (1 = 100 units). */
  height: number;
}

export function skeleton(pose: Pose, build: Build): Skeleton {
  const c = pose.phase < 0 ? 0 : Math.sin(pose.phase * Math.PI * 2);
  const b = pose.bob;
  if (pose.facing === 'left' || pose.facing === 'right') {
    const hipX = 0.4;
    const legs = [-c, c].map((swing) => {
      const theta = swing * 0.31;
      const bend = Math.max(0, -theta) * 1.25 + 0.06;
      const knee: P = [hipX + Math.sin(theta) * 20.4, -44 + Math.cos(theta) * 20.4];
      const ankle: P = [knee[0] + Math.sin(theta - bend) * 20, knee[1] + Math.cos(theta - bend) * 20];
      return { knee, ankle };
    });
    // Keep the planted foot on the ground; the body rises and falls with it.
    const drop = -3.6 - Math.max(legs[0].ankle[1], legs[1].ankle[1]);
    const hipY = -44 + drop;
    const shoulderY = -71 + drop;
    const arms = [c, -c].map((swing) => {
      const phi = swing * 0.38;
      const elbow: P = [0.6 + Math.sin(phi) * 13.2, shoulderY + 1.5 + Math.cos(phi) * 13.2];
      const wrist: P = [elbow[0] + Math.sin(phi + 0.32) * 12, elbow[1] + Math.cos(phi + 0.32) * 12];
      return { elbow, wrist };
    });
    return {
      view: 'side',
      head: [1.6, -83.8 + drop],
      shoulderY, hipY,
      shoulder: [[0.4, shoulderY + 1.5], [0.6, shoulderY + 1.5]],
      elbow: [arms[0].elbow, arms[1].elbow],
      wrist: [arms[0].wrist, arms[1].wrist],
      hip: [[hipX, hipY], [hipX, hipY]],
      knee: [[legs[0].knee[0], legs[0].knee[1] + drop], [legs[1].knee[0], legs[1].knee[1] + drop]],
      ankle: [[legs[0].ankle[0], legs[0].ankle[1] + drop], [legs[1].ankle[0], legs[1].ankle[1] + drop]],
      lift: [Math.max(0, legs[0].ankle[1] + drop + 3.6) * -1, Math.max(0, legs[1].ankle[1] + drop + 3.6) * -1],
    };
  }
  const view = pose.facing === 'down' ? 'front' : 'back';
  const sw = build.shoulder;
  const shoulderY = -71 + b;
  const hipY = -44 + b * 0.6;
  const yaw = pose.yaw;
  // Screen-left leg steps "forward" (lower on screen) while the other trails.
  const adv = [c * 1.5, -c * 1.5];
  const lift = [Math.max(0, -c) * 2.4, Math.max(0, c) * 2.4];
  // A battle stance widens the feet and bends the arms, ready to move.
  const st = pose.stance;
  const legX = [-4.9 - st * 2.6 + yaw * 1.2, 4.9 + st * 2.6 + yaw * 1.2];
  const spread = st * 2.8;
  return {
    view,
    head: [yaw * 1.6, -83.8 + b + st * 0.8],
    shoulderY, hipY,
    shoulder: [[-sw + 2.4 + yaw, shoulderY + 1.2], [sw - 2.4 + yaw, shoulderY + 1.2]],
    elbow: [[-sw - 0.2 - st * 2.4 + yaw - c * 0.3, -57 + b + c * 1.1 + st * 1.5], [sw + 0.2 + st * 2.4 + yaw - c * 0.3, -57 + b - c * 1.1 + st * 1.5]],
    wrist: [[-sw + 1 + st * 1.6 + yaw + c * 0.7, -44.5 + b + c * 2.2 - st * 4], [sw - 1 - st * 1.6 + yaw + c * 0.7, -44.5 + b - c * 2.2 - st * 4]],
    hip: [[legX[0] + 0.2 + st, hipY], [legX[1] - 0.2 - st, hipY]],
    knee: [[legX[0] - 0.3 - spread * 0.4, -22.5 + adv[0] * 0.5 - lift[0] * 0.8 + st], [legX[1] + 0.3 + spread * 0.4, -22.5 + adv[1] * 0.5 - lift[1] * 0.8 + st]],
    ankle: [[legX[0] - 0.4 - spread, -3.6 + adv[0] - lift[0]], [legX[1] + 0.4 + spread, -3.6 + adv[1] - lift[1]]],
    lift: [lift[0], lift[1]],
  };
}

export interface Outfit {
  face: FaceStyle;
  hands: HandStyle;
  shoes: ShoeStyle;
  pants: { color: number; cargo?: boolean; piping?: number; width?: number };
  sleeves: { color: number; cuff?: number; width?: number; band?: { color: number; side: 0 | 1 }; patch?: { color: number; side: 0 | 1 } };
  build: Build;
  /** Optional long coat skirt that covers the upper legs (front/back/side). */
  coatSkirt?: { color: number; length: number; motif?: number };
  torso: (ctx: Ctx, s: Skeleton, pose: Pose) => void;
  head: (ctx: Ctx, s: Skeleton, pose: Pose) => void;
  /** Drawn first (behind everything) in front view, last in back view. */
  backItem?: (ctx: Ctx, s: Skeleton, pose: Pose, layer: 'behind' | 'front') => void;
  /** Hand-held item drawn on top. */
  held?: (ctx: Ctx, s: Skeleton, pose: Pose) => void;
  /** Accessories drawn over the torso (scarf, pendant, radio). */
  front?: (ctx: Ctx, s: Skeleton, pose: Pose) => void;
}

function drawLeg(ctx: Ctx, o: Outfit, s: Skeleton, i: 0 | 1, dim = 0): void {
  const pants = shade(o.pants.color, -dim);
  const w = o.pants.width ?? 9;
  const [hx, hy] = s.hip[i], [kx, ky] = s.knee[i], [ax, ay] = s.ankle[i];
  limbPath(ctx, hx, hy, kx, ky, w + 0.6, w - 0.6, 0.4);
  paintPath(ctx, pants, Math.min(hx, kx) - w, hy, Math.max(hx, kx) + w, ky, { light: 0.14, dark: 0.3, angle: 'horizontal' });
  limbPath(ctx, kx, ky, ax, ay - 1, w - 0.6, w - 1.4, 0.3);
  paintPath(ctx, pants, Math.min(kx, ax) - w, ky, Math.max(kx, ax) + w, ay, { light: 0.12, dark: 0.32, angle: 'horizontal' });
  // Knee crease.
  ctx.strokeStyle = rgba(shade(pants, -0.4), 0.55);
  ctx.lineWidth = 0.45;
  ctx.beginPath(); ctx.moveTo(kx - w * 0.3, ky - 1); ctx.quadraticCurveTo(kx, ky + 0.6, kx + w * 0.3, ky - 1.2); ctx.stroke();
  if (o.pants.cargo) {
    const px = (hx + kx) / 2 + (s.view === 'side' ? -1.2 : (i === 0 ? -1.4 : 1.4));
    const py = (hy + ky) / 2 + 1.2;
    ctx.beginPath();
    ctx.rect(px - 2.4, py - 2.6, 4.8, 5.4);
    paintPath(ctx, shade(pants, 0.04), px - 2.4, py - 2.6, px + 2.4, py + 2.8, { light: 0.12, dark: 0.25, line: 0.5, lineWidth: 0.45 });
    ctx.fillStyle = rgba(shade(pants, -0.25), 0.8);
    ctx.fillRect(px - 2.6, py - 2.8, 5.2, 1.4);
  }
  if (o.pants.piping !== undefined) {
    ctx.strokeStyle = rgba(o.pants.piping, 0.85);
    ctx.lineWidth = 0.45;
    const off = s.view === 'side' ? 0 : (i === 0 ? -w * 0.42 : w * 0.42);
    ctx.beginPath(); ctx.moveTo(hx + off, hy + 2); ctx.lineTo(kx + off * 0.9, ky); ctx.lineTo(ax + off * 0.8, ay - 2); ctx.stroke();
  }
  // Hem over the shoe.
  occlusion(ctx, ax, ay - 0.6, w * 0.5, 1, 0.3);
}

function drawShoes(ctx: Ctx, o: Outfit, s: Skeleton, i: 0 | 1, dim = 0): void {
  const style = { ...o.shoes, upper: shade(o.shoes.upper, -dim) };
  const [ax, ay] = s.ankle[i];
  if (s.view === 'side') shoe(ctx, ax, ay + 3.6, style, 'side', 1, 0);
  else shoe(ctx, ax, ay + 3.6, style, s.view, i === 0 ? -1 : 1, 0);
}

function drawArm(ctx: Ctx, o: Outfit, s: Skeleton, i: 0 | 1, dim = 0, showHand = true): void {
  const sleeve = shade(o.sleeves.color, -dim);
  const w = o.sleeves.width ?? 7.6;
  const [sx, sy] = s.shoulder[i], [ex, ey] = s.elbow[i], [wx, wy] = s.wrist[i];
  limbPath(ctx, sx, sy, ex, ey, w + 0.8, w - 0.2, 0.6);
  paintPath(ctx, sleeve, Math.min(sx, ex) - w, sy - 2, Math.max(sx, ex) + w, ey, { light: 0.2, dark: 0.3 });
  limbPath(ctx, ex, ey, wx, wy, w - 0.2, w - 1.2, 0.3);
  paintPath(ctx, sleeve, Math.min(ex, wx) - w, ey, Math.max(ex, wx) + w, wy, { light: 0.16, dark: 0.34 });
  if (o.sleeves.cuff !== undefined) {
    const dx = wx - ex, dy = wy - ey, len = Math.hypot(dx, dy) || 1;
    limbPath(ctx, wx - dx / len * 2.2, wy - dy / len * 2.2, wx, wy, w - 0.9, w - 1.1, 0);
    paintPath(ctx, shade(o.sleeves.cuff, -dim), wx - w, wy - 3, wx + w, wy, { light: 0.1, dark: 0.3, line: 0.5, lineWidth: 0.45 });
  }
  if (o.sleeves.band && o.sleeves.band.side === i) {
    const bx = sx + (ex - sx) * 0.55, by = sy + (ey - sy) * 0.55;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(Math.atan2(ey - sy, ex - sx) - Math.PI / 2);
    ctx.beginPath(); ctx.rect(-w / 2 - 0.3, -1.4, w + 0.6, 2.8);
    paintPath(ctx, o.sleeves.band.color, -w / 2, -1.4, w / 2, 1.4, { light: 0.25, dark: 0.2, line: 0.45, lineWidth: 0.4 });
    ctx.fillStyle = 'rgba(20,30,10,0.55)';
    ctx.fillRect(-w / 2 + 0.8, -0.3, w - 1.6, 0.5);
    ctx.restore();
  }
  if (o.sleeves.patch && o.sleeves.patch.side === i) {
    const bx = sx + (ex - sx) * 0.45, by = sy + (ey - sy) * 0.45;
    ctx.beginPath(); ctx.rect(bx - 1.8, by - 1.6, 3.6, 3.2);
    paintPath(ctx, o.sleeves.patch.color, bx - 1.8, by - 1.6, bx + 1.8, by + 1.6, { light: 0.15, dark: 0.2, line: 0.4, lineWidth: 0.35 });
    ctx.setLineDash([0.5, 0.5]);
    ctx.strokeStyle = 'rgba(255,240,220,0.5)';
    ctx.lineWidth = 0.25;
    ctx.strokeRect(bx - 1.3, by - 1.1, 2.6, 2.2);
    ctx.setLineDash([]);
  }
  if (showHand) {
    const ang = Math.atan2(wy - ey, wx - ex) - Math.PI / 2;
    hand(ctx, wx, wy - 0.4, ang, { ...o.hands, skin: shade(o.hands.skin, -dim * 0.6) }, 0.95);
  }
}

function drawCoatSkirt(ctx: Ctx, o: Outfit, s: Skeleton, pose: Pose, back: boolean): void {
  const coat = o.coatSkirt!;
  const top = s.hipY - 4;
  const bottom = s.hipY + coat.length;
  const c = pose.phase < 0 ? 0 : Math.sin(pose.phase * Math.PI * 2);
  if (s.view === 'side') {
    const sway = c * 2.2;
    ctx.beginPath();
    ctx.moveTo(-6.4, top);
    ctx.lineTo(6.6, top);
    ctx.quadraticCurveTo(9.4 + sway, (top + bottom) / 2, 10.4 + sway, bottom);
    ctx.quadraticCurveTo(1.4 + sway, bottom + 1.6, -8.6 + sway * 0.6, bottom - 0.4);
    ctx.quadraticCurveTo(-8.2, (top + bottom) / 2, -6.4, top);
    ctx.closePath();
    paintPath(ctx, coat.color, -8, top, 10, bottom, { light: 0.18, dark: 0.32 });
  } else {
    const hw = o.build.hip + 1.6;
    const flare = 4.2;
    ctx.beginPath();
    ctx.moveTo(-hw, top);
    ctx.lineTo(hw, top);
    ctx.quadraticCurveTo(hw + flare * 0.6, (top + bottom) / 2, hw + flare + c * 0.8, bottom);
    ctx.quadraticCurveTo(0, bottom + 1.8, -hw - flare + c * 0.8, bottom);
    ctx.quadraticCurveTo(-hw - flare * 0.6, (top + bottom) / 2, -hw, top);
    ctx.closePath();
    paintPath(ctx, coat.color, -hw - flare, top, hw + flare, bottom, { light: 0.16, dark: 0.3, angle: 'horizontal' });
    if (!back) {
      // Open front shows the dark inner layer between the panels.
      ctx.beginPath();
      ctx.moveTo(-1.4, top); ctx.lineTo(1.4, top); ctx.lineTo(3.2 + c, bottom + 0.6); ctx.lineTo(-3.2 + c, bottom + 0.6); ctx.closePath();
      ctx.fillStyle = rgba(0x1b1a1f);
      ctx.fill();
    }
    // Quilted diamonds on the skirt.
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = rgba(shade(coat.color, -0.35), 0.45);
    ctx.lineWidth = 0.35;
    for (let k = -24; k < 24; k += 3.2) {
      ctx.beginPath(); ctx.moveTo(k, top); ctx.lineTo(k + 18, bottom); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(k, top); ctx.lineTo(k - 18, bottom); ctx.stroke();
    }
    ctx.restore();
    if (coat.motif !== undefined) {
      ctx.strokeStyle = rgba(coat.motif, 0.8);
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.moveTo(-hw - flare + 1.6, bottom - 3);
      for (let k = 0; k <= 8; k++) ctx.lineTo(-hw - flare + 1.6 + k * 1.3, bottom - 3 - Math.sin(k * 1.4) * 1.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hw + flare - 11.6, bottom - 2.6);
      for (let k = 0; k <= 8; k++) ctx.lineTo(hw + flare - 11.6 + k * 1.3, bottom - 2.6 - Math.cos(k * 1.4) * 1.4);
      ctx.stroke();
    }
  }
}

const HEAD_SCALE = 1.1;

/** Heads are drawn slightly larger than anatomical for readability at game scale. */
function withHeadScale(ctx: Ctx, s: Skeleton, draw: () => void): void {
  const [hx, hy] = s.head;
  ctx.save();
  ctx.translate(hx, hy + 6);
  ctx.scale(HEAD_SCALE, HEAD_SCALE);
  ctx.translate(-hx, -(hy + 6));
  draw();
  ctx.restore();
}

/** Draws a complete character for the given pose, feet at (0, 0). */
export function drawFigure(ctx: Ctx, o: Outfit, pose: Pose): void {
  const s = skeleton(pose, o.build);
  ctx.save();
  ctx.scale(o.build.height, o.build.height);
  if (s.view === 'front') {
    o.backItem?.(ctx, s, pose, 'behind');
    // Lifted foot is farther from the camera: draw it first.
    const order: Array<0 | 1> = s.ankle[0][1] < s.ankle[1][1] ? [0, 1] : [1, 0];
    order.forEach(i => { drawLeg(ctx, o, s, i); drawShoes(ctx, o, s, i); });
    if (o.coatSkirt) drawCoatSkirt(ctx, o, s, pose, false);
    const [hx, hy] = s.head;
    // The neck goes under the collar, so it is painted before the torso.
    neck(ctx, hx * 0.6, hy + 6.5, s.shoulderY + 3, 6.4, o.face.skin);
    o.torso(ctx, s, pose);
    drawArm(ctx, o, s, 0);
    drawArm(ctx, o, s, 1);
    o.front?.(ctx, s, pose);
    withHeadScale(ctx, s, () => {
      faceFront(ctx, hx, hy, o.face, pose.yaw);
      o.head(ctx, s, pose);
    });
    o.held?.(ctx, s, pose);
  } else if (s.view === 'back') {
    const order: Array<0 | 1> = s.ankle[0][1] < s.ankle[1][1] ? [0, 1] : [1, 0];
    order.forEach(i => { drawLeg(ctx, o, s, i); drawShoes(ctx, o, s, i); });
    if (o.coatSkirt) drawCoatSkirt(ctx, o, s, pose, true);
    const [hx, hy] = s.head;
    neck(ctx, hx, hy + 6.5, s.shoulderY + 3, 6.4, shade(o.face.skin, -0.08));
    o.torso(ctx, s, pose);
    drawArm(ctx, o, s, 0);
    drawArm(ctx, o, s, 1);
    withHeadScale(ctx, s, () => {
      headBack(ctx, hx, hy, o.face.skin);
      o.head(ctx, s, pose);
    });
    o.backItem?.(ctx, s, pose, 'front');
    o.held?.(ctx, s, pose);
  } else {
    // Side view faces right; mirrored by the caller for "left".
    drawArm(ctx, o, s, 0, 0.22);
    drawLeg(ctx, o, s, 0, 0.18);
    drawShoes(ctx, o, s, 0, 0.18);
    drawLeg(ctx, o, s, 1);
    drawShoes(ctx, o, s, 1);
    if (o.coatSkirt) drawCoatSkirt(ctx, o, s, pose, false);
    o.backItem?.(ctx, s, pose, 'behind');
    const [hx, hy] = s.head;
    neck(ctx, hx - 1.2, hy + 6, s.shoulderY + 3, 6, o.face.skin);
    o.torso(ctx, s, pose);
    withHeadScale(ctx, s, () => {
      faceSide(ctx, hx, hy, o.face);
      o.head(ctx, s, pose);
    });
    o.front?.(ctx, s, pose);
    drawArm(ctx, o, s, 1);
    o.held?.(ctx, s, pose);
  }
  ctx.restore();
}

// ── Shared torso builders ─────────────────────────────────────────────────

export interface TorsoShape { top: number; bottom: number; shoulder: number; waist: number; hem: number }

/** Front/back torso silhouette: shoulders, chest and a hem slightly wider than the waist. */
export function torsoPath(ctx: Ctx, _s: Skeleton, shape: TorsoShape, yaw = 0): void {
  const { top, bottom, shoulder, waist, hem } = shape;
  ctx.beginPath();
  ctx.moveTo(-shoulder + 3 + yaw, top - 1.2);
  ctx.quadraticCurveTo(yaw, top - 2.6, shoulder - 3 + yaw, top - 1.2);
  ctx.quadraticCurveTo(shoulder + 0.6 + yaw, top - 0.4, shoulder + 0.8 + yaw, top + 4.5);
  ctx.quadraticCurveTo(waist + 1.2 + yaw * 0.6, (top + bottom) / 2, hem + yaw * 0.4, bottom);
  ctx.quadraticCurveTo(yaw * 0.4, bottom + 1.4, -hem + yaw * 0.4, bottom);
  ctx.quadraticCurveTo(-waist - 1.2 + yaw * 0.6, (top + bottom) / 2, -shoulder - 0.8 + yaw, top + 4.5);
  ctx.quadraticCurveTo(-shoulder - 0.6 + yaw, top - 0.4, -shoulder + 3 + yaw, top - 1.2);
  ctx.closePath();
}

/** Side torso silhouette facing right: chest forward, back slightly curved. */
export function torsoSidePath(ctx: Ctx, top: number, bottom: number, depth: number, front = 0): void {
  ctx.beginPath();
  ctx.moveTo(-depth * 0.55, top);
  ctx.quadraticCurveTo(depth * 0.2, top - 2.2, depth * 0.62 + front, top + 2.6);
  ctx.quadraticCurveTo(depth * 0.72 + front, (top + bottom) / 2, depth * 0.6 + front * 0.6, bottom);
  ctx.quadraticCurveTo(0, bottom + 1.4, -depth * 0.6, bottom);
  ctx.quadraticCurveTo(-depth * 0.78, (top + bottom) / 2, -depth * 0.55, top);
  ctx.closePath();
}

export function shadeTorso(ctx: Ctx, color: number, top: number, bottom: number, half: number): void {
  paintPath(ctx, color, -half, top, half, bottom, { light: 0.18, dark: 0.32 });
}

/** A simple stitched emblem patch. */
export function emblem(ctx: Ctx, x: number, y: number, r: number, bg: number, fg: number, glyph: (ctx: Ctx) => void): void {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  paintPath(ctx, bg, x - r, y - r, x + r, y + r, { light: 0.25, dark: 0.2, line: 0.4, lineWidth: 0.35 });
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = rgba(fg);
  ctx.fillStyle = rgba(fg);
  glyph(ctx);
  ctx.restore();
}

export const palette = { mix, shade, linear, rgba, ellipsePath };
