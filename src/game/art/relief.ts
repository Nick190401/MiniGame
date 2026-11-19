import { makeCanvas, type Ctx } from './paint';
import { lightBuffers, type LightingOptions } from './litSprite';

/**
 * Lit paintings for built objects. While a building is painted, shapes can
 * also be written into a material map (height, gloss, glow) via withHeight();
 * the finished painting is then lit per pixel (see lightBuffers): eaves shade
 * the walls below them, sills and frames cast small shadows, stones and tiles
 * get bevels, glass catches the sun and lit windows glow.
 *
 * Material heights are 0..1 of HEIGHT_SCALE world units above the ground.
 */

export interface Material {
  height: number;
  gloss?: number;
  glow?: number;
}
type MaterialStyle = Material | CanvasGradient;

const HEIGHT_SCALE = 10;
/** Calls that build paths or move the pen: always mirrored on both maps. */
const SHARED = new Set([
  'beginPath', 'closePath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'arcTo',
  'ellipse', 'rect', 'roundRect', 'save', 'restore', 'translate', 'scale', 'rotate', 'transform',
  'setTransform', 'resetTransform', 'clip',
]);
/** Calls that put paint down: go to whichever maps are switched on. */
const DRAW = new Set(['fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'drawImage']);
/** Pen settings that also shape the material map. */
const SHARED_PROPS = new Set(['lineWidth', 'lineCap', 'lineJoin', 'miterLimit', 'font', 'textAlign', 'textBaseline', 'globalCompositeOperation']);

let active: Relief | null = null;

class Relief {
  readonly albedo: Ctx;
  readonly material: Ctx;
  readonly ctx: Ctx;
  heightOn = false;
  colorOn = true;

  constructor(readonly w: number, readonly h: number, readonly density: number) {
    this.albedo = makeCanvas(w * density, h * density).ctx;
    this.material = makeCanvas(w * density, h * density).ctx;
    this.albedo.scale(density, density);
    this.material.scale(density, density);
    const relief = this;
    this.ctx = new Proxy(this.albedo, {
      get(target, prop) {
        const value = Reflect.get(target, prop, target);
        if (typeof value !== 'function') return value;
        const name = String(prop);
        if (SHARED.has(name)) {
          return (...args: unknown[]) => {
            (relief.material as unknown as Record<string, (...a: unknown[]) => unknown>)[name](...args);
            return (value as (...a: unknown[]) => unknown).apply(target, args);
          };
        }
        if (DRAW.has(name)) {
          return (...args: unknown[]) => {
            if (relief.heightOn) (relief.material as unknown as Record<string, (...a: unknown[]) => unknown>)[name](...args);
            if (relief.colorOn) return (value as (...a: unknown[]) => unknown).apply(target, args);
            return undefined;
          };
        }
        return (value as (...a: unknown[]) => unknown).bind(target);
      },
      set(target, prop, value) {
        Reflect.set(target, prop, value, target);
        if (SHARED_PROPS.has(String(prop))) Reflect.set(relief.material, prop, value, relief.material);
        return true;
      },
    });
  }

  style(m: MaterialStyle): string | CanvasGradient {
    if (m instanceof CanvasGradient) return m;
    return materialColor(m);
  }

  render(opts: LightingOptions & { defaultHeight?: number }): HTMLCanvasElement {
    const pw = this.albedo.canvas.width, ph = this.albedo.canvas.height;
    const a = this.albedo.getImageData(0, 0, pw, ph).data;
    const m = this.material.getImageData(0, 0, pw, ph).data;
    const n = pw * ph;
    const height = new Float32Array(n), color = new Float32Array(n * 3), cover = new Float32Array(n);
    const spec = new Float32Array(n), emit = new Float32Array(n), trans = new Float32Array(n);
    const fallback = (opts.defaultHeight ?? 0.3) * HEIGHT_SCALE;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      cover[i] = a[o + 3] / 255;
      color[i * 3] = a[o] / 255; color[i * 3 + 1] = a[o + 1] / 255; color[i * 3 + 2] = a[o + 2] / 255;
      const ma = m[o + 3] / 255;
      height[i] = ma > 0 ? (m[o] / 255) * HEIGHT_SCALE * ma + fallback * (1 - ma) : fallback;
      spec[i] = (m[o + 1] / 255) * ma;
      emit[i] = (m[o + 2] / 255) * ma;
    }
    return lightBuffers({ w: pw, h: ph, density: this.density, height, color, cover, trans, spec, emit }, opts);
  }
}

function materialColor({ height, gloss = 0, glow = 0 }: Material): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgb(${c(height)},${c(gloss)},${c(glow)})`;
}

/**
 * Paints `paint` with material mapping switched on and returns the lit result
 * (w x h world units at `density` pixels per unit).
 */
export function paintRelief(
  w: number, h: number, density: number, paint: (ctx: Ctx, w: number, h: number) => void,
  opts: LightingOptions & { defaultHeight?: number } = {},
): HTMLCanvasElement {
  const relief = new Relief(w, h, density);
  active = relief;
  try {
    paint(relief.ctx, w, h);
  } finally {
    active = null;
  }
  return relief.render({
    backgroundDrop: 0, maxSlope: 1.6, smooth: 0.12, aoRadius: 1.4, formRadius: 1, formWeight: 0,
    selfShadow: 0.88, shadowReach: 10, shadowHardness: 0.85, wrap: 0.15, occlusion: 1.1, ...opts,
  });
}

/** Draws with colour and writes `material` under the same shapes. */
export function withHeight(material: MaterialStyle | null, draw: () => void): void {
  if (!active || !material) { draw(); return; }
  const r = active;
  const style = r.style(material);
  r.material.fillStyle = style;
  r.material.strokeStyle = style;
  const prev = r.heightOn;
  r.heightOn = true;
  try { draw(); } finally { r.heightOn = prev; }
}

/** Writes only `material` (no colour), e.g. a bevel inside a stone. */
export function heightOnly(material: MaterialStyle | null, draw: () => void): void {
  if (!active || !material) return;
  const r = active;
  const prevColor = r.colorOn;
  r.colorOn = false;
  try { withHeight(material, draw); } finally { r.colorOn = prevColor; }
}

/** A height ramp between two points; null when not painting a relief. */
export function heightGradient(
  x0: number, y0: number, x1: number, y1: number, stops: Array<[number, number]>, gloss = 0, glow = 0,
): CanvasGradient | null {
  if (!active) return null;
  const g = active.material.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([offset, height]) => g.addColorStop(offset, materialColor({ height, gloss, glow })));
  return g;
}

/** Shorthand for a flat material. */
export const mat = (height: number, gloss = 0, glow = 0): Material => ({ height, gloss, glow });

/** Adds `material` heights on top of what is there (gloss/glow untouched), e.g. curved tiles. */
export function heightAdd(material: CanvasGradient | Material | null, draw: () => void): void {
  if (!active || !material) return;
  const r = active;
  const prevOp = r.material.globalCompositeOperation;
  r.material.globalCompositeOperation = 'lighter';
  try { heightOnly(material, draw); } finally { r.material.globalCompositeOperation = prevOp; }
}

/** A gradient of small height increments for heightAdd (gloss and glow stay 0). */
export function heightRamp(x0: number, y0: number, x1: number, y1: number, stops: Array<[number, number]>): CanvasGradient | null {
  return heightGradient(x0, y0, x1, y1, stops);
}

/** A dome-shaped height ramp around (x, y); null when not painting a relief. */
export function heightRadial(x: number, y: number, r: number, stops: Array<[number, number]>, gloss = 0, glow = 0): CanvasGradient | null {
  if (!active) return null;
  const g = active.material.createRadialGradient(x, y, 0, x, y, r);
  stops.forEach(([offset, height]) => g.addColorStop(offset, materialColor({ height, gloss, glow })));
  return g;
}
