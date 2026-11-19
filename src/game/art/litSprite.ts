import { makeCanvas } from './paint';

/**
 * Software "pre-render" for organic sprites (trees, bushes, rocks). Shapes are
 * rasterised into height, colour and material buffers and then lit per pixel:
 * one sun from the upper left, sky and ground ambient, ambient occlusion from
 * the height field, self-shadowing and light scattered through thin leaves.
 * The result reads as a rendered 3D object instead of flat vector fills.
 *
 * Coordinates are in world units (like every other painter); `density` is
 * pixels per unit. Heights are in units, pointing towards the viewer.
 */

export type RGB = [number, number, number];

export const rgb = (hex: number): RGB => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];

export interface SurfaceOptions {
  /** Light passing through the surface near its edges (leaves ~0.6). */
  translucency?: number;
  /** Specular strength (0..1); wet leaves ~0.15, stone ~0.05. */
  specular?: number;
  /** Per-pixel height offset in units, e.g. leaf or bark relief. */
  bump?: (x: number, y: number) => number;
  /** Per-pixel colour multiplier around 1, e.g. leaf-to-leaf variation. */
  tint?: (x: number, y: number) => number;
  /** Per-pixel colour, e.g. moss on the upper side of a rock. */
  paint?: (x: number, y: number, base: RGB) => RGB;
}

/** Sun from the upper left and slightly in front, shared with the vector art. */
const SUN_DIR: RGB = normalize([-0.52, -0.62, 0.59]);

function normalize(v: RGB): RGB {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

export interface LightingOptions {
  sun?: RGB;
  sky?: RGB;
  ground?: RGB;
  /** Wrap lighting softens the terminator (foliage ~0.45, stone ~0.1). */
  wrap?: number;
  /** Strength of contact/crevice darkening. */
  occlusion?: number;
  /** Strength of shadows cast by the object onto itself. */
  selfShadow?: number;
  /**
   * Radius (units) of the smoothed overall form whose normals are blended
   * into the fine ones, so a whole crown has a lit and a shaded side.
   */
  formRadius?: number;
  /** Share of the overall form in the final normal (0..1). */
  formWeight?: number;
  /** How far (units) the object can shadow itself. */
  shadowReach?: number;
  /** Darkening per blocked step: low for porous foliage, near 1 for solid eaves and walls. */
  shadowHardness?: number;
  /** Radius (units) of the neighbourhood used for ambient occlusion. */
  aoRadius?: number;
  /** Blur (units) applied to the height field first, for painted 8-bit relief. */
  smooth?: number;
  /** Steepest slope used for normals; low values keep hard edges from rimming. */
  maxSlope?: number;
  /**
   * Background height relative to the lowest surface: -1 lets silhouettes
   * curve away (organic shapes); 0 keeps flat-faced objects flat to the edge.
   */
  backgroundDrop?: number;
}

/** Raw buffers for lightBuffers (see LitSprite and paintRelief). */
export interface LightBuffers {
  w: number;
  h: number;
  density: number;
  height: Float32Array;
  color: Float32Array;
  cover: Float32Array;
  trans: Float32Array;
  spec: Float32Array;
  /** Self-lit share (lit windows, neon): shown regardless of light. */
  emit?: Float32Array;
}

export class LitSprite {
  readonly w: number;
  readonly h: number;
  private readonly height: Float32Array;
  private readonly color: Float32Array;
  private readonly cover: Float32Array;
  private readonly trans: Float32Array;
  private readonly spec: Float32Array;

  constructor(readonly widthUnits: number, readonly heightUnits: number, readonly density: number) {
    this.w = Math.max(1, Math.ceil(widthUnits * density));
    this.h = Math.max(1, Math.ceil(heightUnits * density));
    const n = this.w * this.h;
    this.height = new Float32Array(n).fill(-1e9);
    this.color = new Float32Array(n * 3);
    this.cover = new Float32Array(n);
    this.trans = new Float32Array(n);
    this.spec = new Float32Array(n);
  }

  private write(i: number, z: number, edge: number, c: RGB, x: number, y: number, o: SurfaceOptions): void {
    const zz = z + (o.bump ? o.bump(x, y) : 0);
    if (zz <= this.height[i]) return; // hidden behind a nearer surface
    this.height[i] = zz;
    const col = o.paint ? o.paint(x, y, c) : c;
    const t = o.tint ? o.tint(x, y) : 1;
    this.color[i * 3] = col[0] * t;
    this.color[i * 3 + 1] = col[1] * t;
    this.color[i * 3 + 2] = col[2] * t;
    this.cover[i] = Math.max(this.cover[i], edge);
    this.trans[i] = o.translucency ?? 0;
    this.spec[i] = o.specular ?? 0;
  }

  /**
   * An ellipsoid cap: footprint ellipse (cx, cy, rx, ry, rotated by `angle`)
   * whose surface rises from `z` at the rim to `z + depth` at the centre.
   */
  ellipsoid(cx: number, cy: number, rx: number, ry: number, z: number, depth: number, c: RGB, o: SurfaceOptions = {}, angle = 0): void {
    const d = this.density;
    const r = Math.max(rx, ry);
    const x0 = Math.max(0, Math.floor((cx - r) * d)), x1 = Math.min(this.w - 1, Math.ceil((cx + r) * d));
    const y0 = Math.max(0, Math.floor((cy - r) * d)), y1 = Math.min(this.h - 1, Math.ceil((cy + r) * d));
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const edgePx = Math.min(rx, ry) * d;
    for (let py = y0; py <= y1; py++) {
      const y = (py + 0.5) / d;
      for (let px = x0; px <= x1; px++) {
        const x = (px + 0.5) / d;
        const lx = (x - cx) * cos + (y - cy) * sin, ly = -(x - cx) * sin + (y - cy) * cos;
        const q = (lx / rx) ** 2 + (ly / ry) ** 2;
        if (q >= 1) continue;
        const k = Math.sqrt(1 - q);
        const edge = Math.min(1, (1 - Math.sqrt(q)) * edgePx * 1.6);
        this.write(py * this.w + px, z + depth * k, edge, c, x, y, o);
      }
    }
  }

  /** A tapered round limb from (x0, y0) to (x1, y1), e.g. a trunk or branch. */
  limb(x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, z: number, c: RGB, o: SurfaceOptions = {}): void {
    const d = this.density;
    const rMax = Math.max(r0, r1);
    const bx0 = Math.max(0, Math.floor((Math.min(x0, x1) - rMax) * d)), bx1 = Math.min(this.w - 1, Math.ceil((Math.max(x0, x1) + rMax) * d));
    const by0 = Math.max(0, Math.floor((Math.min(y0, y1) - rMax) * d)), by1 = Math.min(this.h - 1, Math.ceil((Math.max(y0, y1) + rMax) * d));
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy || 1;
    for (let py = by0; py <= by1; py++) {
      const y = (py + 0.5) / d;
      for (let px = bx0; px <= bx1; px++) {
        const x = (px + 0.5) / d;
        const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / len2));
        const ax = x0 + dx * t, ay = y0 + dy * t;
        const dist = Math.hypot(x - ax, y - ay);
        const r = r0 + (r1 - r0) * t;
        if (dist >= r) continue;
        const k = Math.sqrt(1 - (dist / r) ** 2);
        const edge = Math.min(1, (r - dist) * d * 1.6);
        this.write(py * this.w + px, z + r * k, edge, c, x, y, o);
      }
    }
  }

  /** Lights the buffers and returns the finished sprite. */
  render(opts: LightingOptions = {}): HTMLCanvasElement {
    return lightBuffers({
      w: this.w, h: this.h, density: this.density,
      height: this.height, color: this.color, cover: this.cover, trans: this.trans, spec: this.spec,
    }, opts);
  }
}

/** Per-pixel lighting of a height/colour/material field (see LitSprite). */
export function lightBuffers(buf: LightBuffers, opts: LightingOptions = {}): HTMLCanvasElement {
  const { w, h, height, color, cover, trans, spec, emit } = buf;
  const sun = opts.sun ?? [1.3, 1.17, 0.95];
  const sky = opts.sky ?? [0.3, 0.37, 0.48];
  const ground = opts.ground ?? [0.17, 0.15, 0.1];
  const wrap = opts.wrap ?? 0.3;
  const maxSlope = opts.maxSlope ?? 3;
  const occlusion = opts.occlusion ?? 1;
  const selfShadow = opts.selfShadow ?? 0.75;
  const d = buf.density;
  const n = w * h;

  // Height with the empty background set relative to the nearest surface.
  let hz: Float32Array = new Float32Array(n);
  let minZ = Infinity;
  for (let i = 0; i < n; i++) if (cover[i] > 0 && height[i] < minZ) minZ = height[i];
  if (!Number.isFinite(minZ)) minZ = 0;
  const backgroundZ = minZ + (opts.backgroundDrop ?? -1);
  for (let i = 0; i < n; i++) hz[i] = cover[i] > 0 ? height[i] : backgroundZ;
  if (opts.smooth) hz = boxBlur(hz, w, h, Math.max(1, Math.round(opts.smooth * d)));

  // Ambient occlusion: lower than the blurred neighbourhood means occluded.
  const aoR = Math.max(2, Math.round((opts.aoRadius ?? 2.2) * d));
  const blurred = boxBlur(boxBlur(hz, w, h, aoR), w, h, aoR);
  // Overall form: a heavily smoothed height field gives the big light/shade split.
  const formR = Math.max(2, Math.round((opts.formRadius ?? 6) * d));
  const form = boxBlur(boxBlur(hz, w, h, formR), w, h, formR);
  const formWeight = opts.formWeight ?? 0.5;
  let maxForm = -Infinity;
  for (let i = 0; i < n; i++) if (cover[i] > 0 && form[i] > maxForm) maxForm = form[i];

  const out = new Uint8ClampedArray(n * 4);
  const [Lx, Ly, Lz] = SUN_DIR;
  // Half vector for a viewer looking straight into the screen.
  const H = normalize([Lx, Ly, Lz + 1]);
  const planar = Math.hypot(Lx, Ly);
  const stepX = (Lx / planar), stepY = (Ly / planar);
  const rise = Lz / planar; // units of height gained per unit travelled
  const reach = opts.shadowReach ?? 14;
  const stepLen = Math.max(1, 1.1 * d);
  const steps = Math.max(4, Math.round((reach * d) / stepLen));
  const hardness = opts.shadowHardness ?? 0.2;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = py * w + px;
      const a = cover[i];
      if (a <= 0) continue;
      const z = hz[i];
      const zl = px > 0 ? hz[i - 1] : z, zr = px < w - 1 ? hz[i + 1] : z;
      const zu = py > 0 ? hz[i - w] : z, zd = py < h - 1 ? hz[i + w] : z;
      // Slopes in height units per world unit, clamped at silhouettes.
      const gx = Math.max(-maxSlope, Math.min(maxSlope, (zr - zl) * 0.5 * d));
      const gy = Math.max(-maxSlope, Math.min(maxSlope, (zd - zu) * 0.5 * d));
      const fl = px > 0 ? form[i - 1] : form[i], fr = px < w - 1 ? form[i + 1] : form[i];
      const fu = py > 0 ? form[i - w] : form[i], fd = py < h - 1 ? form[i + w] : form[i];
      const fgx = Math.max(-2.5, Math.min(2.5, (fr - fl) * 0.5 * d));
      const fgy = Math.max(-2.5, Math.min(2.5, (fd - fu) * 0.5 * d));
      const mgx = gx * (1 - formWeight) + fgx * formWeight;
      const mgy = gy * (1 - formWeight) + fgy * formWeight;
      const nl = Math.hypot(mgx, mgy, 1);
      const nx = -mgx / nl, ny = -mgy / nl, nz = 1 / nl;
      // Thin outer parts of the form (near its silhouette) let more light through.
      const thin = Math.max(0, Math.min(1, 1 - (form[i] - minZ) / Math.max(1, maxForm - minZ)));

      const ndl = nx * Lx + ny * Ly + nz * Lz;
      const diffuse = Math.max(0, (ndl + wrap) / (1 + wrap));

      // March towards the sun through the height field.
      let lit = 1;
      if (selfShadow > 0) {
        for (let s = 1; s <= steps; s++) {
          const sx = Math.round(px + stepX * stepLen * s), sy = Math.round(py + stepY * stepLen * s);
          if (sx < 0 || sy < 0 || sx >= w || sy >= h) break;
          const rayZ = z + (stepLen * s / d) * rise;
          const block = hz[sy * w + sx] - rayZ;
          if (block > 0) { lit -= Math.min(1, block * 0.7) * hardness; if (lit <= 0) { lit = 0; break; } }
        }
        lit = 1 - (1 - lit) * selfShadow;
      }

      const crevice = Math.max(0, blurred[i] - z);
      const ao = Math.max(0.25, 1 - crevice * 0.32 * occlusion);

      // Sky from above and in front, warm bounce from the ground below.
      const up = Math.max(0, Math.min(1, 0.5 + nz * 0.35 - ny * 0.45));
      const ar = ground[0] + (sky[0] - ground[0]) * up;
      const ag = ground[1] + (sky[1] - ground[1]) * up;
      const ab = ground[2] + (sky[2] - ground[2]) * up;

      const cr = color[i * 3], cg = color[i * 3 + 1], cb = color[i * 3 + 2];
      let r = cr * (ar * ao + sun[0] * diffuse * lit);
      let g = cg * (ag * ao + sun[1] * diffuse * lit);
      let b = cb * (ab * ao + sun[2] * diffuse * lit);

      // Thin leaves glow where light passes through them at the edges.
      const tr = trans[i];
      if (tr > 0) {
        const rim = (Math.pow(1 - nz, 1.5) * 0.6 + thin * thin * 0.5) * Math.max(0, -(nx * Lx + ny * Ly) / (planar || 1) * 0.6 + 0.4);
        const scatter = tr * rim * (0.45 + 0.55 * lit);
        r += cr * sun[0] * scatter * 0.9;
        g += cg * sun[1] * scatter * 1.05;
        b += cb * sun[2] * scatter * 0.55;
      }
      const sp = spec[i];
      if (sp > 0) {
        const ndh = Math.max(0, nx * H[0] + ny * H[1] + nz * H[2]);
        const highlight = sp * Math.pow(ndh, 28) * lit;
        r += highlight; g += highlight; b += highlight * 0.95;
      }

      const em = emit ? emit[i] : 0;
      if (em > 0) {
        r = r * (1 - em) + cr * em * 1.15;
        g = g * (1 - em) + cg * em * 1.15;
        b = b * (1 - em) + cb * em * 1.15;
      }

      // Gentle filmic shoulder keeps highlights from clipping to flat white.
      const o = i * 4;
      out[o] = 255 * tone(r);
      out[o + 1] = 255 * tone(g);
      out[o + 2] = 255 * tone(b);
      out[o + 3] = 255 * Math.min(1, a);
    }
  }
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.putImageData(new ImageData(out, w, h), 0, 0);
  return canvas;
}

/** Linear up to 0.8, then a soft shoulder so highlights never clip flat. */
const tone = (v: number) => {
  const x = Math.max(0, v);
  return x < 0.8 ? x : 0.8 + 0.2 * (1 - Math.exp(-(x - 0.8) / 0.2));
};

/** Separable box blur of a float field. */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const dst = new Float32Array(src.length);
  const size = r * 2 + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    const row = y * w;
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / size;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = acc / size;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return dst;
}
