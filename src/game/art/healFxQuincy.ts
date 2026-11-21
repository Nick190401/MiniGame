import Phaser from 'phaser';
import { gauss, softTexture, step } from './healFx';

/**
 * Textures only Guard Quincy's heal uses: the record as light, never as an object (turning rings, grooves,
 * crescents). Keys start with 'hfx-quincy-'.
 * The painters are exported by ./healFx (alphaTexture, softTexture, discAlpha,
 * lineArt, glyphTexture, gauss, step). healFx imports this file too: the cycle
 * is harmless as long as nothing of healFx is used at module level here.
 */
export const HFX_QUINCY = {
  /**
   * The platter, of light only: a rim and four grooves, each a ring with two lights running round it that fade
   * along the ring behind them. Nothing in the middle. Turn it clockwise.
   */
  disc: 'hfx-quincy-disc',
  /** Pieces of a circle, see QUINCY_ARC: a thin groove arc, the thick crescent front and a band of three fine grooves. */
  arc: 'hfx-quincy-arc',
  front: 'hfx-quincy-front',
  groove: 'hfx-quincy-groove',
} as const;

const DEG = Math.PI / 180;

/**
 * An arc piece is the bounding box of one segment of a circle of radius 1 (crisp crest at 1, a
 * trail inside it), centred on +x and `half` radians to either side. Shown at radius r: display
 * size (w r, h r) and origin (-x0 / w, 0.5), so the image's position is the circle's centre and
 * its angle turns the segment around that centre.
 */
export interface ArcPiece { readonly key: string; readonly half: number; readonly x0: number; readonly w: number; readonly h: number }
const arcPiece = (key: string, halfDeg: number, inner = 0.8): ArcPiece => {
  const half = halfDeg * DEG;
  const x0 = inner * Math.cos(half);
  return { key, half, x0, w: 1.08 - x0, h: 2 * (1.08 * Math.sin(half) + 0.02) };
};
export const QUINCY_ARC = {
  long: arcPiece(HFX_QUINCY.arc, 42),
  /** A crescent: thick in the middle with a crisp leading edge, tapering to its tips. */
  front: arcPiece(HFX_QUINCY.front, 34, 0.66),
  /** Three fine grooves side by side, brightest at the clockwise end: for radii of 45 to 220 units. */
  groove: arcPiece(HFX_QUINCY.groove, 50, 0.84),
} as const;

/** Texels per unit of radius of the arc pieces: the crest stays crisp up to a radius of about 60 units. */
const ARC_DENSITY = 210;

/** The platter's rings: radius, where its two lights sit (radians) and its strength. */
const DISC_RINGS: ReadonlyArray<readonly [radius: number, head: number, level: number]> = [
  [0.93, 0, 1], [0.79, 1.3, 0.8], [0.64, 2.6, 0.72], [0.49, 3.9, 0.64], [0.34, 5.2, 0.56],
];
/** How far round the ring a light's trail runs behind it (radians); the two lights are half a turn apart. */
const DISC_TRAIL = 2.4;

function discAt(u: number, v: number): number {
  const x = u * 2 - 1;
  const y = v * 2 - 1;
  const r = Math.sqrt(x * x + y * y);
  if (r >= 0.985 || r < 0.24) return 0;
  const th = Math.atan2(y, x);
  let a = 0;
  for (const [radius, head, level] of DISC_RINGS) {
    const d = r - radius;
    if (Math.abs(d) > 0.1) continue;
    // Angle back from the nearest light ahead (clockwise is the way it turns).
    const back = (((head - th) % Math.PI) + Math.PI) % Math.PI;
    const light = back < DISC_TRAIL ? (1 - back / DISC_TRAIL) ** 1.5 * step(0, 0.14, back) : 0;
    a += level * (0.08 + 0.92 * light) * (0.85 * gauss(d, 0.012) + 0.2 * gauss(d, 0.034));
  }
  return Math.min(1, a);
}

function paintArc(scene: Phaser.Scene, p: ArcPiece): void {
  softTexture(scene, p.key, Math.round(p.w * ARC_DENSITY), Math.round(p.h * ARC_DENSITY), (u, v) => {
    const x = p.x0 + u * p.w;
    const y = (v - 0.5) * p.h;
    const along = Math.abs(Math.atan2(y, x)) / p.half;
    if (along >= 1) return 0;
    const d = Math.sqrt(x * x + y * y) - 1;
    const crest = 0.85 * gauss(d, 0.013) + 0.26 * gauss(d, 0.036);
    const trail = d < 0 ? 0.3 * Math.exp(d / 0.05) : 0;
    return (1 - along * along) ** 1.4 * (crest + trail);
  });
}

/** The crescent front: soft, so a lower density holds it. */
function paintFront(scene: Phaser.Scene, p: ArcPiece): void {
  const density = 160;
  softTexture(scene, p.key, Math.round(p.w * density), Math.round(p.h * density), (u, v) => {
    const x = p.x0 + u * p.w;
    const y = (v - 0.5) * p.h;
    const along = Math.abs(Math.atan2(y, x)) / p.half;
    if (along >= 1) return 0;
    const w = 1 - along * along;
    const d = Math.sqrt(x * x + y * y) - 1;
    const edge = 0.9 * gauss(d, 0.012 + 0.02 * w);
    const body = d < 0 ? 0.5 * w * Math.exp(d / (0.025 + 0.1 * w)) : 0;
    return w ** 0.8 * Math.min(1, edge + body);
  });
}

/** The band of grooves: fine lines, shown three to four times larger than the other pieces, so denser. */
function paintGroove(scene: Phaser.Scene, p: ArcPiece): void {
  const density = 250;
  softTexture(scene, p.key, Math.round(p.w * density), Math.round(p.h * density), (u, v) => {
    const x = p.x0 + u * p.w;
    const y = (v - 0.5) * p.h;
    const th = Math.atan2(y, x);
    const along = Math.abs(th) / p.half;
    if (along >= 1) return 0;
    const r = Math.sqrt(x * x + y * y);
    let lines = 0;
    for (let i = 0; i < 3; i++) {
      const d = r - (1 - 0.05 * i);
      lines += (1 - 0.26 * i) * (0.9 * gauss(d, 0.0058) + 0.2 * gauss(d, 0.016));
    }
    // From a faint tail to a bright head at the clockwise end, so the turn reads.
    const lead = 0.5 + (0.5 * th) / p.half;
    return Math.min(1, lines) * step(1, 0.78, along) * (0.3 + 0.7 * lead ** 1.4);
  });
}

/** Called once by createHealFxTextures while the game loads. */
export function createQuincyHealTextures(scene: Phaser.Scene): void {
  softTexture(scene, HFX_QUINCY.disc, 200, 200, discAt);
  paintArc(scene, QUINCY_ARC.long);
  paintFront(scene, QUINCY_ARC.front);
  paintGroove(scene, QUINCY_ARC.groove);
}
