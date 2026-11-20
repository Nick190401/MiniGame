import Phaser from 'phaser';
import { RENDER_SCALE } from '../render/RenderScale';
import { blobPoints, fbm, makeCanvas, rng, type Ctx } from './paint';
import { addStaticCanvas } from './worldTexture';

/**
 * Battle effect textures, painted once while the game loads. Everything is
 * white on transparent (tinted at use) unless noted, authored in logical
 * pixels and stored at the canvas density so it stays sharp under the battle
 * camera.
 */
export const BFX = {
  glow: 'bfx-glow',
  core: 'bfx-core',
  ring: 'bfx-ring',
  ringSoft: 'bfx-ring-soft',
  streak: 'bfx-streak',
  flare: 'bfx-flare',
  beam: 'bfx-beam',
  star: 'bfx-star',
  smoke: 'bfx-smoke',
  shard: 'bfx-shard',
  chunk: 'bfx-chunk',
  slash: 'bfx-slash',
  wave: 'bfx-wave',
  crack: 'bfx-crack',
  vignette: 'bfx-vignette',
  note: 'bfx-note',
  dot: 'bfx-dot',
  speck: 'bfx-speck',
  speedline: 'bfx-speedline',
  scan: 'bfx-scan',
} as const;

export type BfxKey = (typeof BFX)[keyof typeof BFX];

/** Authored size of one frame of each texture, in logical px. */
export const BFX_SIZE: Record<BfxKey, { w: number; h: number; frames?: number }> = {
  [BFX.glow]: { w: 64, h: 64 },
  [BFX.core]: { w: 32, h: 32 },
  [BFX.ring]: { w: 128, h: 128 },
  [BFX.ringSoft]: { w: 128, h: 128 },
  [BFX.streak]: { w: 48, h: 6 },
  [BFX.flare]: { w: 256, h: 12 },
  [BFX.beam]: { w: 32, h: 32 },
  [BFX.star]: { w: 32, h: 32 },
  [BFX.smoke]: { w: 48, h: 48, frames: 4 },
  [BFX.shard]: { w: 10, h: 24 },
  [BFX.chunk]: { w: 12, h: 10, frames: 3 },
  [BFX.slash]: { w: 160, h: 80 },
  [BFX.wave]: { w: 48, h: 128 },
  [BFX.crack]: { w: 256, h: 24 },
  [BFX.vignette]: { w: 128, h: 128 },
  [BFX.note]: { w: 24, h: 24, frames: 5 },
  [BFX.dot]: { w: 8, h: 8 },
  [BFX.speck]: { w: 4, h: 4 },
  [BFX.speedline]: { w: 128, h: 4 },
  [BFX.scan]: { w: 128, h: 8, frames: 3 },
};

/** Texels per logical px. */
export const BFX_DENSITY = RENDER_SCALE;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Hermite step from e0 to e1; e0 may be larger than e1 for a falling edge. */
const step = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const gauss = (x: number, s: number) => Math.exp(-(x * x) / (2 * s * s));

type AlphaFn = (u: number, v: number, frame: number) => number;

function register(scene: Phaser.Scene, key: BfxKey, canvas: HTMLCanvasElement): void {
  const { w, h, frames = 1 } = BFX_SIZE[key];
  const texture = addStaticCanvas(scene, key, canvas);
  if (!texture) return;
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  if (frames > 1) {
    const fw = Math.ceil(w * BFX_DENSITY);
    const fh = Math.ceil(h * BFX_DENSITY);
    for (let f = 0; f < frames; f++) texture.add(f, 0, f * fw, 0, fw, fh);
  }
}

/**
 * Fills a texture from an analytic alpha function of normalised coordinates
 * (u, v in 0..1 per frame). A half-step of noise keeps wide, faint gradients
 * from banding once they are scaled up and blended.
 */
function alphaTexture(scene: Phaser.Scene, key: BfxKey, alphaAt: AlphaFn, shade = 255): void {
  const { w, h, frames = 1 } = BFX_SIZE[key];
  const fw = Math.ceil(w * BFX_DENSITY);
  const fh = Math.ceil(h * BFX_DENSITY);
  const { canvas, ctx } = makeCanvas(fw * frames, fh);
  const image = ctx.createImageData(fw * frames, fh);
  const data = image.data;
  const dither = rng(key.length * 7919);
  for (let f = 0; f < frames; f++) {
    for (let y = 0; y < fh; y++) {
      const v = (y + 0.5) / fh;
      for (let x = 0; x < fw; x++) {
        const a = clamp01(alphaAt((x + 0.5) / fw, v, f));
        const i = (y * fw * frames + f * fw + x) * 4;
        data[i] = shade;
        data[i + 1] = shade;
        data[i + 2] = shade;
        data[i + 3] = Math.max(0, Math.min(255, Math.round(a * 255 + dither() - 0.5)));
      }
    }
  }
  ctx.putImageData(image, 0, 0);
  register(scene, key, canvas);
}

/** Draws a texture with the 2D canvas API in logical px. */
function drawnTexture(scene: Phaser.Scene, key: BfxKey, draw: (ctx: Ctx, w: number, h: number, frame: number) => void): void {
  const { w, h, frames = 1 } = BFX_SIZE[key];
  const fw = Math.ceil(w * BFX_DENSITY);
  const fh = Math.ceil(h * BFX_DENSITY);
  const { canvas, ctx } = makeCanvas(fw * frames, fh);
  for (let f = 0; f < frames; f++) {
    ctx.save();
    ctx.translate(f * fw, 0);
    ctx.beginPath();
    ctx.rect(0, 0, fw, fh);
    ctx.clip();
    ctx.scale(fw / w, fh / h);
    draw(ctx, w, h, f);
    ctx.restore();
  }
  register(scene, key, canvas);
}

/** Distance from the centre in units of the half-size (0 centre, 1 edge midpoint). */
const radius = (u: number, v: number) => Math.hypot(u * 2 - 1, v * 2 - 1);

/** Crescent band of a circle: `t` runs -1..1 along the arc, `d` -1..1 across it (positive = outer edge). */
function arcCoords(px: number, py: number, cx: number, cy: number, rc: number, spread: number, angleOf: (dx: number, dy: number) => number) {
  const dx = px - cx;
  const dy = py - cy;
  return { rho: Math.hypot(dx, dy) - rc, t: angleOf(dx, dy) / spread };
}

export function createBattleFxTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(BFX.glow)) return;

  alphaTexture(scene, BFX.glow, (u, v) => {
    const r = radius(u, v);
    return (0.62 * gauss(r, 0.16) + 0.38 * gauss(r, 0.4)) * step(1, 0.82, r);
  });

  alphaTexture(scene, BFX.core, (u, v) => {
    const r = radius(u, v);
    return Math.min(1, 1.35 * gauss(r, 0.26)) * step(1, 0.7, r);
  });

  alphaTexture(scene, BFX.ring, (u, v) => {
    const r = radius(u, v);
    const haze = r < 0.86 ? 0.1 * step(0.35, 0.86, r) : 0;
    return (gauss(r - 0.86, 0.028) + haze) * step(1, 0.95, r);
  });

  alphaTexture(scene, BFX.ringSoft, (u, v) => {
    const r = radius(u, v);
    return (0.85 * gauss(r - 0.78, 0.07) + 0.3 * gauss(r - 0.6, 0.16)) * step(1, 0.94, r);
  });

  // Tail on the left, hot rounded head on the right: particles fly toward +x.
  alphaTexture(scene, BFX.streak, (u, v) => {
    const across = v * 2 - 1;
    const along = u < 0.82 ? Math.pow(u / 0.82, 1.8) : gauss((u - 0.82) / 0.18, 0.45);
    const body = along * gauss(across, 0.18 + 0.22 * along);
    const hot = 0.5 * gauss((u - 0.84) / 0.1, 0.6) * gauss(across, 0.25);
    return body + hot;
  });

  alphaTexture(scene, BFX.flare, (u, v) => {
    const across = v * 2 - 1;
    const along = 0.55 * gauss(u - 0.5, 0.16) + 0.45 * gauss(u - 0.5, 0.04);
    return along * gauss(across, 0.3) + 0.15 * gauss(u - 0.5, 0.08) * gauss(across, 0.8);
  });

  // Uniform along its length, so it can be stretched into beams and bolts.
  alphaTexture(scene, BFX.beam, (_u, v) => {
    const across = v * 2 - 1;
    return (0.7 * gauss(across, 0.36) + 0.3 * gauss(across, 0.12)) * step(1, 0.9, Math.abs(across));
  });

  alphaTexture(scene, BFX.star, (u, v) => {
    const x = u * 2 - 1;
    const y = v * 2 - 1;
    const r = Math.hypot(x, y);
    const arms = Math.max(gauss(y, 0.045) * gauss(x, 0.42), gauss(x, 0.045) * gauss(y, 0.42));
    const diagonals = 0.3 * Math.max(gauss((x - y) / Math.SQRT2, 0.035), gauss((x + y) / Math.SQRT2, 0.035)) * gauss(r, 0.22);
    return Math.min(1, arms + diagonals + 0.8 * gauss(r, 0.13)) * step(1, 0.9, r);
  });

  alphaTexture(scene, BFX.smoke, (u, v, frame) => {
    const r = radius(u, v);
    const noise = fbm(u, v, 4, 4, 401 + frame * 37);
    return 0.85 * clamp01((step(1, 0.25, r) - (1 - noise) * 0.75) * 1.6);
  });

  drawnTexture(scene, BFX.shard, (ctx, w, h) => {
    const fill = ctx.createLinearGradient(0, 0, 0, h);
    fill.addColorStop(0, 'rgba(255,255,255,1)');
    fill.addColorStop(1, 'rgba(255,255,255,0.5)');
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, 0);
    ctx.lineTo(w, h * 0.38);
    ctx.lineTo(w * 0.62, h);
    ctx.lineTo(0, h * 0.52);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  });

  // Lit from the upper left like the rest of the game; tinted to an earth colour at use.
  drawnTexture(scene, BFX.chunk, (ctx, w, h, frame) => {
    const rand = rng(83 + frame * 17);
    const points = blobPoints(w / 2, h / 2, w * 0.42, h * 0.4, 6 + frame, 0.32, rand);
    const fill = ctx.createLinearGradient(0, 0, w, h);
    fill.addColorStop(0, '#ffffff');
    fill.addColorStop(0.55, '#b9b9b9');
    fill.addColorStop(1, '#6a6a6a');
    ctx.fillStyle = fill;
    ctx.beginPath();
    points.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,70,70,0.8)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  });

  // A blade trail arching upward: faint tail on the left, bright cutting edge on the right.
  alphaTexture(scene, BFX.slash, (u, v) => {
    const { w, h } = BFX_SIZE[BFX.slash];
    const { rho, t } = arcCoords(u * w, v * h, 80, 128, 100, 0.9, (dx, dy) => Math.atan2(dx, -dy));
    if (Math.abs(t) >= 1) return 0;
    const lead = (t + 1) / 2;
    const thickness = 22 * Math.pow(1 - t * t, 0.9) * (0.55 + 0.45 * lead);
    const d = rho / Math.max(0.001, thickness / 2);
    if (d > 1 || d < -1) return 0;
    const profile = d > 0 ? step(1, 0.55, d) : Math.pow(step(-1, 0.3, d), 1.4);
    const brightness = 0.25 + 0.75 * Math.pow(lead, 1.3);
    return profile * brightness * 0.85 + 0.8 * gauss(d - 0.72, 0.09) * brightness;
  });

  // Sound-wave front travelling toward +x: sharp leading edge, haze trailing behind.
  alphaTexture(scene, BFX.wave, (u, v) => {
    const { w, h } = BFX_SIZE[BFX.wave];
    const { rho, t } = arcCoords(u * w, v * h, -44, 64, 76, 0.85, (dx, dy) => Math.atan2(dy, dx));
    if (Math.abs(t) >= 1) return 0;
    const fade = 1 - t * t;
    const thickness = 9 * Math.pow(fade, 0.7);
    const d = rho / Math.max(0.001, thickness / 2);
    const edge = d > 0 ? step(1, 0.35, d) : step(-1.2, 0.1, d);
    const haze = rho < 0 ? 0.28 * gauss((rho + 9) / 14, 1) : 0;
    return (edge + haze) * (0.35 + 0.65 * fade);
  });

  drawnTexture(scene, BFX.crack, (ctx, w, h) => {
    const rand = rng(1907);
    const points: Array<[number, number]> = [[0, h / 2]];
    let y = h / 2;
    for (let x = 7; x < w; x += 5 + rand() * 6) {
      y = Math.max(h * 0.25, Math.min(h * 0.75, y + (rand() - 0.5) * 6));
      points.push([x, y]);
    }
    points.push([w, h / 2]);
    const stroke = (width: number, alpha: number) => {
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      points.forEach(([px, py], index) => (index === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.stroke();
    };
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'round';
    stroke(10, 0.08);
    stroke(6, 0.16);
    stroke(3.2, 0.45);
    stroke(1.5, 1);
    for (let b = 0; b < 9; b++) {
      const [bx, by] = points[2 + Math.floor(rand() * (points.length - 4))];
      const dir = rand() < 0.5 ? -1 : 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + 4 + rand() * 6, by + dir * (3 + rand() * 4));
      ctx.lineTo(bx + 8 + rand() * 9, by + dir * (5 + rand() * 5));
      ctx.stroke();
    }
  });

  // Transparent at the centre: a spotlight laid over the arena, tinted at use.
  alphaTexture(scene, BFX.vignette, (u, v) => Math.pow(step(0.15, 0.75, radius(u, v)), 1.3) * 0.96);

  drawnTexture(scene, BFX.note, (ctx, w, h, frame) => {
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 3 * BFX_DENSITY;
    ctx.font = 'bold 19px "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(['♪', '♫', '♩', '♬', '♯'][frame], w / 2, h / 2 + 1);
  });

  alphaTexture(scene, BFX.dot, (u, v) => {
    const r = radius(u, v);
    return gauss(r, 0.36) * step(1, 0.8, r);
  });

  alphaTexture(scene, BFX.speck, (u, v) => step(1, 0.55, Math.max(Math.abs(u * 2 - 1), Math.abs(v * 2 - 1))));

  alphaTexture(scene, BFX.speedline, (u, v) => {
    const across = v * 2 - 1;
    return Math.pow(Math.sin(Math.PI * u), 0.6) * (0.4 + 0.6 * u) * gauss(across, 0.35);
  });

  // Torn signal band for glitch tears: broken into noisy segments along its length.
  alphaTexture(scene, BFX.scan, (u, v, frame) => {
    const across = v * 2 - 1;
    const segments = step(0.42, 0.56, fbm(u, frame / 3, 16, 2, 211 + frame * 13));
    return gauss(across, 0.5) * (0.3 + 0.7 * segments);
  });
}
