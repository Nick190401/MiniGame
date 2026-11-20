import Phaser from 'phaser';
import { angDiff, gauss, softTexture, step } from './healFx';

/**
 * Textures only Guard Quincy's heal uses (the record: crescents and grooves). Keys start with 'hfx-quincy-'.
 * The painters are exported by ./healFx (alphaTexture, softTexture, discAlpha,
 * lineArt, glyphTexture, gauss, step). healFx imports this file too: the cycle
 * is harmless as long as nothing of healFx is used at module level here.
 */
export const HFX_QUINCY = {
  /** The platter of light: rim, three bands of grooves with highlights, label with one mark. Turn it. */
  disc: 'hfx-quincy-disc',
  /** Two static gloss wedges over the grooves; do not turn it. */
  sheen: 'hfx-quincy-sheen',
  /** Pieces of a circle, see QUINCY_ARC: thin groove arcs and the thick crescent front. */
  arc: 'hfx-quincy-arc',
  arcShort: 'hfx-quincy-arc-short',
  front: 'hfx-quincy-front',
} as const;

const TAU = Math.PI * 2;
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
  short: arcPiece(HFX_QUINCY.arcShort, 17),
  /** A crescent: thick in the middle with a crisp leading edge, tapering to its tips. */
  front: arcPiece(HFX_QUINCY.front, 34, 0.66),
} as const;

/** Texels per unit of radius of the arc pieces: the crest stays crisp up to a radius of about 60 units. */
const ARC_DENSITY = 210;

/** Where light catches each band of grooves (radians), so the turn reads. */
const TRACK_LIGHT: readonly (readonly number[])[] = [[0.3, 0.3 + Math.PI], [1.4, 3.5, 5.6], [-0.8, 2.34]];
const TRACK_WIDTH = [0.35, 0.28, 0.45];

function discAt(u: number, v: number): number {
  const x = u * 2 - 1;
  const y = v * 2 - 1;
  const r = Math.sqrt(x * x + y * y);
  if (r >= 0.985) return 0;
  let a = 0.5 * gauss(r - 0.93, 0.014) + 0.18 * gauss(r - 0.93, 0.045);
  if (r > 0.33 && r < 0.91) {
    // About eleven grooves in three bands; broad enough not to shimmer as it turns.
    const groove = 0.5 + 0.5 * Math.cos(((r - 0.34) / 0.05) * TAU);
    const gaps = 1 - 0.8 * gauss(r - 0.53, 0.011) - 0.8 * gauss(r - 0.72, 0.011);
    const band = r < 0.53 ? 0 : r < 0.72 ? 1 : 2;
    const th = Math.atan2(y, x);
    let light = 0;
    for (const c of TRACK_LIGHT[band]) light = Math.max(light, gauss(angDiff(th, c), TRACK_WIDTH[band]));
    a += (0.2 + 0.38 * groove) * gaps * (0.25 + 0.75 * light) * step(0.33, 0.37, r) * step(0.91, 0.87, r);
  }
  if (r < 0.32) {
    a += 0.4 * step(0.03, 0.06, r) * step(0.3, 0.27, r) + 0.45 * gauss(r - 0.29, 0.012);
    // One mark on the label, so the turn reads even when the grooves blur.
    a += 0.55 * gauss(x, 0.025) * step(-0.1, -0.13, y) * step(-0.26, -0.23, y);
  }
  return Math.min(1, a);
}

function sheenAt(u: number, v: number): number {
  const x = u * 2 - 1;
  const y = v * 2 - 1;
  const r = Math.sqrt(x * x + y * y);
  if (r >= 0.95) return 0;
  const th = Math.atan2(y, x);
  const wedges = gauss(angDiff(th, -0.87), 0.38) + gauss(angDiff(th, 2.27), 0.38);
  return 0.6 * wedges * step(0.33, 0.42, r) * step(0.92, 0.84, r) * (0.5 + 0.5 * r);
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

/** Called once by createHealFxTextures while the game loads. */
export function createQuincyHealTextures(scene: Phaser.Scene): void {
  softTexture(scene, HFX_QUINCY.disc, 200, 200, discAt);
  softTexture(scene, HFX_QUINCY.sheen, 96, 96, sheenAt);
  paintArc(scene, QUINCY_ARC.long);
  paintArc(scene, QUINCY_ARC.short);
  paintFront(scene, QUINCY_ARC.front);
}
