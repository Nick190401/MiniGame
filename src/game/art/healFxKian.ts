import Phaser from 'phaser';
import { TEXEL } from '../render/RenderScale';
import { alphaTexture, gauss, lineArt, step } from './healFx';
import type { Ctx } from './paint';

/**
 * Textures only Kian Vero's heal uses (the harp of light: strings and their ringing). Keys start with 'hfx-kian-'.
 * The painters are exported by ./healFx (alphaTexture, softTexture, discAlpha,
 * lineArt, glyphTexture, gauss, step). healFx imports this file too: the cycle
 * is harmless as long as nothing of healFx is used at module level here.
 */
export const HFX_KIAN = {
  /** Taut string: crisp core over a narrow halo, along u. Display it len x 3.5-7. */
  string: 'hfx-kian-string',
  /** Long exposure of a string ringing in its first harmonic, one slender bulge with no crossing; see KIAN_WAVE. */
  wave: 'hfx-kian-wave',
} as const;

/**
 * The wave textures in units: the string runs from x0 to x1 on the middle line and swings `swing` to each side.
 * Display a string of length L swinging A as L * w / (x1 - x0) by A * h / swing.
 */
export const KIAN_WAVE = { w: 48, h: 11, x0: 1.5, x1: 46.5, swing: 4 } as const;

/** Snapshots of the swing (phase, alpha, line width): a ringing string spends longest at its extremes. */
const SNAPSHOTS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0.95, 0.34], [-1, 0.95, 0.34], [0.72, 0.5, 0.26], [-0.72, 0.5, 0.26], [0.36, 0.26, 0.22], [-0.36, 0.26, 0.22],
];

function ringing() {
  return (ctx: Ctx) => {
    const { w, h, x0, x1, swing } = KIAN_WAVE;
    for (const [phase, alpha, width] of SNAPSHOTS) {
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const f = i / 120;
        const x = x0 + (x1 - x0) * f;
        const y = h / 2 + swing * phase * Math.sin(Math.PI * f);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // The snapshots all meet the string at its ends: fade them there so no hot dot marks the hand or the peg.
    ctx.globalCompositeOperation = 'destination-in';
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(x0 / w, 'rgba(255,255,255,0)');
    g.addColorStop((x0 + 4) / w, '#ffffff');
    g.addColorStop((x1 - 4) / w, '#ffffff');
    g.addColorStop(x1 / w, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  };
}

/** Called once by createHealFxTextures while the game loads. */
export function createKianHealTextures(scene: Phaser.Scene): void {
  alphaTexture(scene, HFX_KIAN.string, 128, 24, (u, v) => {
    const y = v * 2 - 1;
    return (0.95 * gauss(y, 0.11) + 0.3 * gauss(y, 0.34)) * step(0, 0.04, u) * step(1, 0.96, u);
  });
  // Twice world density: the long exposures are stretched up to about 3x along a string.
  const density = 2 * Math.min(TEXEL, 4);
  const { w, h } = KIAN_WAVE;
  lineArt(scene, HFX_KIAN.wave, w, h, density, 0.5, ringing());
}
