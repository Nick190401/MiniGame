import { linear, mix, radial, rgba, shade, type Ctx } from '../paint';

/*
 * Character rig. Figures are drawn in design units: the feet stand on (0, 0),
 * the top of the head is at about y = -100. Light comes from the upper left.
 * Every body part is a filled path with a soft gradient and a thin outline in
 * a darker tint of its own colour, which keeps silhouettes readable at small
 * sizes without the hard black line of pixel art.
 */

export type Facing = 'down' | 'up' | 'left' | 'right';

export interface Pose {
  facing: Facing;
  /** 0..1 position in the walk cycle, or -1 when standing. */
  phase: number;
  /** Slight turn of the head and torso for portraits (-1 left .. 1 right). */
  yaw: number;
  /** Upper-body vertical offset (bob). */
  bob: number;
  /** Leg swing, -1..1 (left leg forward when positive). */
  swing: number;
  /** Breath scale for idle portraits. */
  breath: number;
  /** 0 = relaxed, 1 = wide battle stance (front view only). */
  stance: number;
}

export function makePose(facing: Facing, phase: number, yaw = 0, stance = 0): Pose {
  if (phase < 0) return { facing, phase, yaw, bob: 0, swing: 0, breath: 0, stance };
  const swing = Math.sin(phase * Math.PI * 2);
  // Highest at the passing position, lowest at contact.
  const bob = -Math.abs(Math.cos(phase * Math.PI * 2)) * 1.6 + 0.8;
  return { facing, phase, yaw, bob, swing, breath: 0, stance: 0 };
}

export interface Shading {
  light?: number;
  dark?: number;
  /** Outline darkness (0 = no outline). */
  line?: number;
  lineWidth?: number;
  angle?: 'diag' | 'vertical' | 'horizontal';
}

/** Fills the current path with a lit gradient over the given bounds and outlines it. */
export function paintPath(ctx: Ctx, color: number, x0: number, y0: number, x1: number, y1: number, s: Shading = {}): void {
  const light = s.light ?? 0.16, dark = s.dark ?? 0.3;
  const g = s.angle === 'vertical' ? ctx.createLinearGradient(0, y0, 0, y1)
    : s.angle === 'horizontal' ? ctx.createLinearGradient(x0, 0, x1, 0)
      : ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, rgba(shade(color, light)));
  g.addColorStop(0.45, rgba(color));
  g.addColorStop(1, rgba(shade(color, -dark)));
  ctx.fillStyle = g;
  ctx.fill();
  if ((s.line ?? 0.55) > 0) {
    ctx.strokeStyle = rgba(shade(color, -(s.line ?? 0.55)), 0.9);
    ctx.lineWidth = s.lineWidth ?? 0.7;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

/** Tapered limb between two points with given widths (sleeve, trouser leg). */
export function limbPath(ctx: Ctx, ax: number, ay: number, bx: number, by: number, wa: number, wb: number, bulge = 0): void {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const wm = (wa + wb) / 2 + bulge;
  ctx.beginPath();
  ctx.moveTo(ax + nx * wa / 2, ay + ny * wa / 2);
  ctx.quadraticCurveTo(mx + nx * wm / 2 * 1.05, my + ny * wm / 2 * 1.05, bx + nx * wb / 2, by + ny * wb / 2);
  ctx.quadraticCurveTo(bx + dx / len * wb * 0.35, by + dy / len * wb * 0.35, bx - nx * wb / 2, by - ny * wb / 2);
  ctx.quadraticCurveTo(mx - nx * wm / 2 * 1.05, my - ny * wm / 2 * 1.05, ax - nx * wa / 2, ay - ny * wa / 2);
  ctx.quadraticCurveTo(ax - dx / len * wa * 0.3, ay - dy / len * wa * 0.3, ax + nx * wa / 2, ay + ny * wa / 2);
  ctx.closePath();
}

export function ellipsePath(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
}

/** Soft ambient occlusion blob (used under chins, hems and arms). */
export function occlusion(ctx: Ctx, x: number, y: number, rx: number, ry: number, alpha = 0.35): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = radial(ctx, 0, 0, 0, rx, [[0, 0x000000, alpha], [1, 0x000000, 0]]);
  ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export interface HandStyle { skin: number; glove?: number }

export function hand(ctx: Ctx, x: number, y: number, angle: number, style: HandStyle, size = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(size, size);
  const color = style.glove ?? style.skin;
  ctx.beginPath();
  ctx.moveTo(-2, -1.2);
  ctx.quadraticCurveTo(-2.6, 2.4, -0.8, 4.2);
  ctx.quadraticCurveTo(0.6, 5, 2, 3.6);
  ctx.quadraticCurveTo(2.8, 1.2, 2.1, -1.2);
  ctx.closePath();
  paintPath(ctx, color, -2.5, -1.2, 2.5, 5, { light: 0.15, dark: 0.25, line: 0.45, lineWidth: 0.5 });
  // Thumb.
  ctx.beginPath();
  ctx.ellipse(-1.9, 0.9, 0.85, 1.5, 0.5, 0, Math.PI * 2);
  paintPath(ctx, shade(color, -0.04), -2.8, -0.6, -1, 2.4, { light: 0.1, dark: 0.2, line: 0.45, lineWidth: 0.4 });
  ctx.restore();
}

export interface ShoeStyle { upper: number; sole: number; accent?: number; boot?: boolean }

/** A shoe seen from the front (toe toward camera) or side. */
export function shoe(ctx: Ctx, x: number, y: number, style: ShoeStyle, view: 'front' | 'back' | 'side', flip = 1, lift = 0): void {
  ctx.save();
  ctx.translate(x, y - lift);
  ctx.scale(flip, 1);
  if (view === 'side') {
    ctx.beginPath();
    ctx.moveTo(-3.6, -3.4 - (style.boot ? 3 : 0));
    ctx.lineTo(1.2, -3.6 - (style.boot ? 3 : 0));
    ctx.quadraticCurveTo(2.6, -2.8, 5.6, -1.8);
    ctx.quadraticCurveTo(7, -1.2, 6.6, 0);
    ctx.lineTo(-4, 0);
    ctx.quadraticCurveTo(-4.6, -1.6, -3.6, -3.4 - (style.boot ? 3 : 0));
    ctx.closePath();
    paintPath(ctx, style.upper, -4, -4, 7, 0, { light: 0.2, dark: 0.28 });
    ctx.fillStyle = rgba(style.sole);
    ctx.fillRect(-4.1, -0.9, 10.6, 1);
    if (style.accent !== undefined) {
      ctx.strokeStyle = rgba(style.accent, 0.95);
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(-2.5, -1.6); ctx.quadraticCurveTo(1, -2.6, 4, -1.4); ctx.stroke();
    }
  } else {
    const front = view === 'front';
    ctx.beginPath();
    ctx.moveTo(-3.2, -3.6 - (style.boot ? 3.2 : 0));
    ctx.lineTo(3.2, -3.6 - (style.boot ? 3.2 : 0));
    ctx.quadraticCurveTo(4.2, -1, 3.6, front ? 0.3 : 0);
    ctx.quadraticCurveTo(0, front ? 1.6 : 0.4, -3.6, front ? 0.3 : 0);
    ctx.quadraticCurveTo(-4.2, -1, -3.2, -3.6 - (style.boot ? 3.2 : 0));
    ctx.closePath();
    paintPath(ctx, style.upper, -4, -4, 4, 1, { light: 0.22, dark: 0.3 });
    ctx.fillStyle = rgba(style.sole);
    ctx.beginPath();
    ctx.moveTo(-3.7, -0.4); ctx.quadraticCurveTo(0, front ? 1.9 : 0.8, 3.7, -0.4); ctx.lineTo(3.6, 0.5); ctx.quadraticCurveTo(0, front ? 2.4 : 1.2, -3.6, 0.5); ctx.closePath();
    ctx.fill();
    if (style.accent !== undefined && front) {
      ctx.strokeStyle = rgba(style.accent, 0.95);
      ctx.lineWidth = 0.55;
      ctx.beginPath(); ctx.moveTo(-2.4, -2.2); ctx.lineTo(2.4, -2.2); ctx.stroke();
    }
    if (front && !style.boot) {
      // Laces.
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 0.35;
      for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(-1.2, -3 + i * 0.9); ctx.lineTo(1.2, -3 + i * 0.9); ctx.stroke(); }
    }
  }
  ctx.restore();
}

export interface FaceStyle {
  skin: number;
  eyes: number;
  brows: number;
  lips: number;
  age?: 'young' | 'elder';
  freckles?: boolean;
}

/** Front-facing head (with yaw for 3/4 portraits). cx, cy = centre of the face. */
export function faceFront(ctx: Ctx, cx: number, cy: number, f: FaceStyle, yaw = 0): void {
  const w = 7.6, h = 9.2;
  const yx = yaw * 1.6;
  // Ears.
  for (const side of [-1, 1]) {
    const ex = cx + side * (w - 0.4) - yaw * side * 0.6;
    ctx.beginPath(); ctx.ellipse(ex, cy + 0.2, 1.4, 2.3, side * 0.15, 0, Math.PI * 2);
    paintPath(ctx, shade(f.skin, -0.06), ex - 1.4, cy - 2, ex + 1.4, cy + 2.5, { light: 0.08, dark: 0.22, line: 0.4, lineWidth: 0.45 });
  }
  // Face: wider cheekbones, softer jaw.
  ctx.beginPath();
  ctx.moveTo(cx - w, cy - 3);
  ctx.bezierCurveTo(cx - w, cy - h, cx + w, cy - h, cx + w, cy - 3);
  ctx.bezierCurveTo(cx + w + 0.2, cy + 2.6, cx + w * 0.55 + yx * 0.2, cy + h * 0.85, cx + yx * 0.4, cy + h * 0.92);
  ctx.bezierCurveTo(cx - w * 0.55 + yx * 0.2, cy + h * 0.85, cx - w - 0.2, cy + 2.6, cx - w, cy - 3);
  ctx.closePath();
  const g = ctx.createRadialGradient(cx - 2.4 + yx, cy - 3, 0.5, cx, cy, h * 1.15);
  g.addColorStop(0, rgba(shade(f.skin, 0.14)));
  g.addColorStop(0.55, rgba(f.skin));
  g.addColorStop(1, rgba(shade(f.skin, -0.22)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = rgba(shade(f.skin, -0.5), 0.85);
  ctx.lineWidth = 0.55;
  ctx.stroke();
  // Turned-away side falls into shadow.
  ctx.save();
  ctx.clip();
  ctx.fillStyle = linear(ctx, cx - w, 0, cx + w, 0, [[0, 0x000000, 0], [0.62, 0x000000, 0], [1, 0x2a140c, 0.22]]);
  ctx.fillRect(cx - w, cy - h, w * 2, h * 2);
  // Cheek warmth.
  for (const side of [-1, 1]) {
    ctx.fillStyle = radial(ctx, cx + side * 4.2 + yx, cy + 2.4, 0, 2.6, [[0, 0xe07a68, 0.22], [1, 0xe07a68, 0]]);
    ctx.fillRect(cx - w, cy - h, w * 2, h * 2);
  }
  ctx.restore();

  const eyeY = cy - 0.4;
  for (const side of [-1, 1]) {
    const ex = cx + side * 3.25 + yx * (side > 0 ? 0.85 : 1.15);
    const squeeze = 1 - Math.max(0, yaw * side) * 0.25;
    // Socket shading, sclera, iris, pupil and catch-light.
    ctx.fillStyle = rgba(shade(f.skin, -0.18), 0.5);
    ctx.beginPath(); ctx.ellipse(ex, eyeY - 0.3, 2.2 * squeeze, 1.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgba(0xf6f2ea);
    ctx.beginPath(); ctx.ellipse(ex, eyeY, 1.7 * squeeze, 1.05, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = radial(ctx, ex + yaw * 0.4, eyeY, 0, 1.05, [[0, shade(f.eyes, 0.25)], [0.7, f.eyes], [1, shade(f.eyes, -0.4)]]);
    ctx.beginPath(); ctx.arc(ex + yaw * 0.4, eyeY + 0.05, 0.95, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgba(0x120c0a);
    ctx.beginPath(); ctx.arc(ex + yaw * 0.4, eyeY + 0.05, 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(ex + yaw * 0.4 - 0.35, eyeY - 0.35, 0.28, 0, Math.PI * 2); ctx.fill();
    // Upper lid and lashes.
    ctx.strokeStyle = rgba(0x1d120d, 0.95);
    ctx.lineWidth = 0.55;
    ctx.beginPath(); ctx.ellipse(ex, eyeY + 0.2, 1.8 * squeeze, 1.25, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    // Brow.
    ctx.strokeStyle = rgba(f.brows, 0.95);
    ctx.lineWidth = f.age === 'elder' ? 0.6 : 0.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - side * 1.9, eyeY - 2.3);
    ctx.quadraticCurveTo(ex, eyeY - 3.3, ex + side * 1.8, eyeY - 2.6);
    ctx.stroke();
    if (f.age === 'elder') {
      ctx.strokeStyle = rgba(shade(f.skin, -0.35), 0.5);
      ctx.lineWidth = 0.3;
      ctx.beginPath(); ctx.moveTo(ex + side * 1.8, eyeY + 0.4); ctx.lineTo(ex + side * 2.6, eyeY + 0.9); ctx.stroke();
    }
  }
  // Nose: shadow on the far side, highlight on the bridge.
  const nx = cx + yx * 1.3;
  ctx.strokeStyle = rgba(shade(f.skin, -0.32), 0.7);
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(nx + 0.5, cy + 0.6); ctx.quadraticCurveTo(nx + 1.4, cy + 3, nx + 0.4, cy + 3.5); ctx.stroke();
  ctx.fillStyle = rgba(shade(f.skin, -0.28), 0.55);
  ctx.beginPath(); ctx.ellipse(nx - 0.8, cy + 3.5, 0.55, 0.3, 0, 0, Math.PI * 2); ctx.ellipse(nx + 0.8, cy + 3.5, 0.55, 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath(); ctx.ellipse(nx - 0.3, cy + 1.6, 0.4, 1.2, 0, 0, Math.PI * 2); ctx.fill();
  // Mouth: a calm, slight smile.
  const my = cy + 5.6;
  ctx.strokeStyle = rgba(shade(f.lips, -0.35), 0.9);
  ctx.lineWidth = 0.55;
  ctx.beginPath(); ctx.moveTo(nx - 1.9, my - 0.2); ctx.quadraticCurveTo(nx, my + 0.9, nx + 1.9, my - 0.3); ctx.stroke();
  ctx.fillStyle = rgba(f.lips, 0.55);
  ctx.beginPath(); ctx.ellipse(nx, my + 0.75, 1.2, 0.45, 0, 0, Math.PI * 2); ctx.fill();
  if (f.freckles) {
    ctx.fillStyle = rgba(shade(f.skin, -0.3), 0.45);
    for (const [fx, fy] of [[-3.2, 2], [-2.4, 2.6], [-4, 2.8], [3.2, 2], [2.4, 2.6], [4, 2.8]]) {
      ctx.beginPath(); ctx.arc(cx + fx + yx, cy + fy, 0.22, 0, Math.PI * 2); ctx.fill();
    }
  }
}

/** Profile head facing right. cx, cy = centre of the skull mass. */
export function faceSide(ctx: Ctx, cx: number, cy: number, f: FaceStyle): void {
  ctx.beginPath();
  ctx.moveTo(cx - 6.6, cy - 2);
  ctx.bezierCurveTo(cx - 6.8, cy - 9.6, cx + 5.4, cy - 10.2, cx + 6.4, cy - 3.4);
  // Brow, nose and lips silhouette.
  ctx.quadraticCurveTo(cx + 7, cy - 1.2, cx + 7.2, cy + 0.4);
  ctx.lineTo(cx + 8.4, cy + 2.6);
  ctx.quadraticCurveTo(cx + 8.3, cy + 3.4, cx + 7.1, cy + 3.5);
  ctx.quadraticCurveTo(cx + 7.4, cy + 4.6, cx + 6.8, cy + 5.2);
  ctx.quadraticCurveTo(cx + 7.1, cy + 6, cx + 6.4, cy + 6.6);
  ctx.quadraticCurveTo(cx + 5.4, cy + 8.8, cx + 2.4, cy + 8.6);
  ctx.quadraticCurveTo(cx - 1.4, cy + 8.2, cx - 3.4, cy + 5.4);
  ctx.quadraticCurveTo(cx - 6.6, cy + 3.4, cx - 6.6, cy - 2);
  ctx.closePath();
  const g = ctx.createRadialGradient(cx + 2, cy - 2, 0.5, cx, cy, 10);
  g.addColorStop(0, rgba(shade(f.skin, 0.14)));
  g.addColorStop(0.6, rgba(f.skin));
  g.addColorStop(1, rgba(shade(f.skin, -0.24)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = rgba(shade(f.skin, -0.5), 0.85);
  ctx.lineWidth = 0.55;
  ctx.stroke();
  // Ear.
  ctx.beginPath(); ctx.ellipse(cx - 1.4, cy + 0.6, 1.5, 2.3, 0.1, 0, Math.PI * 2);
  paintPath(ctx, shade(f.skin, -0.05), cx - 3, cy - 2, cx + 0.2, cy + 3, { light: 0.06, dark: 0.22, line: 0.42, lineWidth: 0.45 });
  // Eye.
  const ex = cx + 4.6, ey = cy - 0.6;
  ctx.fillStyle = rgba(0xf6f2ea);
  ctx.beginPath(); ctx.ellipse(ex, ey, 0.9, 1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rgba(f.eyes);
  ctx.beginPath(); ctx.arc(ex + 0.35, ey + 0.05, 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rgba(0x120c0a);
  ctx.beginPath(); ctx.arc(ex + 0.5, ey + 0.05, 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = rgba(0x1d120d, 0.95);
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(ex - 0.8, ey - 0.7); ctx.quadraticCurveTo(ex + 0.4, ey - 1.4, ex + 1.2, ey - 0.6); ctx.stroke();
  ctx.strokeStyle = rgba(f.brows, 0.95);
  ctx.lineWidth = 0.75;
  ctx.beginPath(); ctx.moveTo(ex - 1.2, ey - 2.3); ctx.quadraticCurveTo(ex + 0.4, ey - 3, ex + 1.8, ey - 2.4); ctx.stroke();
  // Mouth.
  ctx.strokeStyle = rgba(shade(f.lips, -0.35), 0.9);
  ctx.lineWidth = 0.45;
  ctx.beginPath(); ctx.moveTo(cx + 5.4, cy + 5.6); ctx.lineTo(cx + 6.8, cy + 5.3); ctx.stroke();
}

/** Back of the head (hair covers it; characters add their own style). */
export function headBack(ctx: Ctx, cx: number, cy: number, skin: number): void {
  for (const side of [-1, 1]) {
    const ex = cx + side * 7.2;
    ctx.beginPath(); ctx.ellipse(ex, cy + 0.2, 1.3, 2.2, side * 0.15, 0, Math.PI * 2);
    paintPath(ctx, shade(skin, -0.08), ex - 1.3, cy - 2, ex + 1.3, cy + 2.4, { light: 0.06, dark: 0.22, line: 0.4, lineWidth: 0.45 });
  }
  ellipsePath(ctx, cx, cy, 7.5, 9.2);
  paintPath(ctx, skin, cx - 7.5, cy - 9, cx + 7.5, cy + 9, { light: 0.08, dark: 0.3 });
}

export function neck(ctx: Ctx, cx: number, top: number, bottom: number, width: number, skin: number): void {
  ctx.beginPath();
  ctx.moveTo(cx - width / 2, top);
  ctx.lineTo(cx + width / 2, top);
  ctx.lineTo(cx + width / 2 + 0.6, bottom);
  ctx.lineTo(cx - width / 2 - 0.6, bottom);
  ctx.closePath();
  paintPath(ctx, shade(skin, -0.12), cx - width / 2, top, cx + width / 2, bottom, { light: 0.05, dark: 0.25, line: 0.45, lineWidth: 0.45 });
  occlusion(ctx, cx, top + 0.8, width * 0.7, 1.6, 0.4);
}

/** Quilted channels across a puffer garment within the current clip. */
export function quilting(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, step: number, color: number, alpha = 0.45): void {
  for (let y = y0 + step; y < y1; y += step) {
    ctx.strokeStyle = rgba(shade(color, -0.45), alpha);
    ctx.lineWidth = 0.45;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo((x0 + x1) / 2, y + 0.6, x1, y); ctx.stroke();
    ctx.strokeStyle = rgba(shade(color, 0.35), alpha * 0.55);
    ctx.lineWidth = 0.35;
    ctx.beginPath(); ctx.moveTo(x0, y - step * 0.42); ctx.quadraticCurveTo((x0 + x1) / 2, y - step * 0.42 + 0.6, x1, y - step * 0.42); ctx.stroke();
  }
}

export const tone = { mix, shade };
