import Phaser from 'phaser';
import { BFX, BFX_DENSITY, BFX_SIZE } from '../art/battleFx';
import type { Combatant } from './Combatant';

export interface Point {
  x: number;
  y: number;
}

export type Blend = 'add' | 'normal' | 'screen';
export type HitWeight = 'light' | 'medium' | 'heavy' | 'massive';

/**
 * Battle layers. The dim sits between the arena art and the fighters, so the
 * world darkens while the fighters and their effects stay lit.
 */
export const DEPTH = { dim: 4.6, behind: 4.8, front: 22, top: 30 } as const;

/** How hard each kind of hit lands: hit-stop, push, camera. */
const WEIGHT: Record<HitWeight, { flash: number; push: number; hold: number; trauma: number; punch: number; kick: number; split: number }> = {
  light: { flash: 30, push: 6, hold: 30, trauma: 0.24, punch: 0.012, kick: 1.5, split: 0 },
  medium: { flash: 34, push: 12, hold: 55, trauma: 0.4, punch: 0.022, kick: 3, split: 5 },
  heavy: { flash: 40, push: 18, hold: 75, trauma: 0.56, punch: 0.034, kick: 4.5, split: 7 },
  massive: { flash: 50, push: 26, hold: 100, trauma: 0.78, punch: 0.05, kick: 6.5, split: 10 },
};

/** Shake at full trauma, in logical px. Trauma is squared, so small hits stay small. */
const MAX_SHAKE = 9;
const TRAUMA_DECAY_PER_S = 1.7;
/** Full-arena flashes allowed per second (WCAG 2.3.1 general flash threshold). */
const MAX_FLASHES_PER_S = 3;

const ease = (name: string) => Phaser.Tweens.Builders.GetEaseFunction(name) as (t: number) => number;
const blendMode = (blend: Blend = 'add') => (
  blend === 'add' ? Phaser.BlendModes.ADD : blend === 'screen' ? Phaser.BlendModes.SCREEN : Phaser.BlendModes.NORMAL
);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function lerpColor(a: number, b: number, t: number): number {
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
  const bl = Math.round(lerp(a & 255, b & 255, t));
  return (r << 16) | (g << 8) | bl;
}

type Range = readonly [number, number];

interface ImageOptions {
  frame?: string | number;
  color?: number;
  alpha?: number;
  blend?: Blend;
  depth?: number;
  w?: number;
  h?: number;
  angle?: number;
  origin?: readonly [number, number];
}

interface PulseOptions {
  color: number;
  size: number;
  life: number;
  alpha?: number;
  grow?: number;
  squash?: number;
  angle?: number;
  blend?: Blend;
  depth?: number;
  /** Ease of the fade: 'Quad.easeIn' holds the light, 'Quad.easeOut' drops it fast. */
  fade?: string;
}

interface RingOptions {
  color: number;
  from: number;
  to: number;
  life: number;
  alpha?: number;
  soft?: boolean;
  /** Height over width: below 1 lays the ring flat on the ground. */
  squash?: number;
  angle?: number;
  blend?: Blend;
  depth?: number;
  ease?: string;
  /** Part of the life spent fading in, for rings that gather inward. */
  fadeIn?: number;
}

interface SparkOptions {
  count: number;
  colors: number[];
  speed: Range;
  /** Degrees, 0 = +x, 90 = down. */
  angle?: Range;
  life: Range;
  gravity?: number;
  /** Streak length and thickness at birth, in logical px. */
  length?: number;
  thickness?: number;
  depth?: number;
  blend?: Blend;
  spread?: number;
}

interface PuffOptions {
  count: number;
  color: number;
  alpha: number;
  /** Size at birth and at death, logical px. */
  size: Range;
  speed: Range;
  angle?: Range;
  life: Range;
  gravity?: number;
  spread?: Point;
  depth?: number;
  blend?: Blend;
}

interface DebrisOptions {
  count: number;
  color: number;
  size: Range;
  speed: Range;
  angle: Range;
  life: Range;
  gravity: number;
  spread?: Point;
  depth?: number;
  blend?: Blend;
  texture?: typeof BFX.chunk | typeof BFX.shard;
}

interface ConvergeOptions {
  count: number;
  radius: number;
  colors: number[];
  life: Range;
  size?: number;
  squash?: number;
  streak?: boolean;
  depth?: number;
  blend?: Blend;
  /** Keep emitting for this long instead of a single burst. */
  duration?: number;
  frequency?: number;
}

interface MoteOptions {
  count: number;
  colors: number[];
  speed: Range;
  angle?: Range;
  life: Range;
  size: Range;
  gravity?: number;
  spread?: Point;
  depth?: number;
  texture?: typeof BFX.dot | typeof BFX.speck | typeof BFX.note;
  /** Note glyphs to pick from (♪ ♫ ♩ ♬ ♯). */
  frames?: number[];
  blend?: Blend;
}

export interface StrandLayer {
  width: number;
  color: number;
  alpha: number;
  blend?: Blend;
}

type SparkParticle = Phaser.GameObjects.Particles.Particle & { heading?: number; spin?: number; spin0?: number };

/**
 * A glowing polyline made of stretched beam slices: beams, bolts, waveforms
 * and tendrils. Each layer is drawn over the previous one.
 */
export class Strand {
  private readonly slices: Phaser.GameObjects.Image[][];
  private alphaScale = 1;
  private widthScale = 1;
  private points: Point[] = [];

  constructor(private readonly fx: BattleFx, private readonly layers: StrandLayer[], private readonly depth: number = DEPTH.front) {
    this.slices = layers.map(() => []);
  }

  setPoints(points: Point[]): this {
    this.points = points;
    this.layers.forEach((layer, index) => {
      const slices = this.slices[index];
      // The widest layer glows along a simplified path, so its overlapping
      // joints do not bead into bright dots.
      const path = layer.width > 12 ? simplify(points, 4) : points;
      const needed = Math.max(0, path.length - 1);
      while (slices.length < needed) {
        slices.push(this.fx.image(BFX.beam, 0, 0, { color: layer.color, blend: layer.blend ?? 'add', depth: this.depth, origin: [0, 0.5] }));
      }
      slices.forEach((slice, i) => {
        if (i >= needed) { slice.setVisible(false); return; }
        const a = path[i];
        const b = path[i + 1];
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        const width = layer.width * this.widthScale;
        slice.setVisible(true)
          .setPosition(a.x, a.y)
          .setRotation(Math.atan2(b.y - a.y, b.x - a.x))
          .setDisplaySize(length + width * 0.35, width)
          .setAlpha(layer.alpha * this.alphaScale);
      });
    });
    return this;
  }

  setAlpha(alpha: number): this {
    this.alphaScale = alpha;
    this.layers.forEach((layer, index) => this.slices[index].forEach(slice => slice.setAlpha(layer.alpha * alpha)));
    return this;
  }

  setWidth(scale: number): this {
    this.widthScale = scale;
    return this.setPoints(this.points);
  }

  destroy(): void {
    this.slices.forEach(layer => layer.forEach(slice => slice.destroy()));
  }
}

function simplify(points: Point[], every: number): Point[] {
  if (points.length <= 3) return points;
  const out = points.filter((_, index) => index % every === 0);
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}

/** Jagged path from `a` to `b` by midpoint displacement. */
export function boltPath(a: Point, b: Point, jag: number, levels = 4): Point[] {
  let points = [a, b];
  let amplitude = jag * Math.hypot(b.x - a.x, b.y - a.y);
  for (let level = 0; level < levels; level++) {
    const next: Point[] = [points[0]];
    for (let i = 0; i < points.length - 1; i++) {
      const p = points[i];
      const q = points[i + 1];
      const length = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      const offset = (Math.random() * 2 - 1) * amplitude;
      next.push({ x: (p.x + q.x) / 2 - ((q.y - p.y) / length) * offset, y: (p.y + q.y) / 2 + ((q.x - p.x) / length) * offset }, q);
    }
    points = next;
    amplitude *= 0.5;
  }
  return points;
}

export class Bolt {
  private readonly main: Strand;
  private readonly branches: Strand[] = [];

  constructor(
    fx: BattleFx,
    private from: Point,
    private to: Point,
    private readonly options: { color: number; width?: number; glow?: number; jag?: number; branches?: number; depth?: number },
  ) {
    const width = options.width ?? 3;
    const glow = options.glow ?? 16;
    const layers: StrandLayer[] = [
      { width: glow, color: options.color, alpha: 0.38 },
      { width: width * 2.2, color: options.color, alpha: 0.9 },
      { width, color: 0xffffff, alpha: 1 },
    ];
    this.main = new Strand(fx, layers, options.depth);
    for (let i = 0; i < (options.branches ?? 0); i++) {
      this.branches.push(new Strand(fx, [
        { width: glow * 0.5, color: options.color, alpha: 0.3 },
        { width: width * 0.9, color: options.color, alpha: 0.85 },
        { width: width * 0.45, color: 0xffffff, alpha: 0.9 },
      ], options.depth));
    }
    this.regenerate();
  }

  /** A new random path, optionally between new ends. */
  regenerate(from: Point = this.from, to: Point = this.to): this {
    this.from = from;
    this.to = to;
    const path = boltPath(this.from, this.to, this.options.jag ?? 0.16);
    this.main.setPoints(path);
    const length = Math.hypot(this.to.x - this.from.x, this.to.y - this.from.y);
    const heading = Math.atan2(this.to.y - this.from.y, this.to.x - this.from.x);
    this.branches.forEach(branch => {
      const start = path[2 + Math.floor(Math.random() * Math.max(1, path.length - 5))];
      const angle = heading + (Math.random() < 0.5 ? -1 : 1) * (0.45 + Math.random() * 0.5);
      const reach = length * (0.16 + Math.random() * 0.2);
      branch.setPoints(boltPath(start, { x: start.x + Math.cos(angle) * reach, y: start.y + Math.sin(angle) * reach }, 0.22, 3));
    });
    return this;
  }

  setAlpha(alpha: number): this {
    this.main.setAlpha(alpha);
    this.branches.forEach(branch => branch.setAlpha(alpha * 0.85));
    return this;
  }

  destroy(): void {
    this.main.destroy();
    this.branches.forEach(branch => branch.destroy());
  }
}

/** A rim of light hugging a sprite's silhouette, kept in step with it every frame. */
export class Aura {
  level = 0;
  constructor(
    readonly sprite: Phaser.GameObjects.Sprite,
    readonly layers: { image: Phaser.GameObjects.Image; scale: number; alpha: number }[],
  ) {}
}

export interface BattleFxOptions {
  /** Height of the arena band; effects and flashes stay inside it. */
  arenaHeight: number;
  reducedMotion: boolean;
}

/**
 * Everything the battle draws on top of its fighters: lights, rings, sparks,
 * beams, character copies, and the camera (trauma shake, punch zoom, kicks).
 *
 * All timing runs on the tween clock, the same wall-clock source the sound
 * plays on, so beats keep their sync with the cues even when frames drop.
 */
export class BattleFx {
  readonly reducedMotion: boolean;
  readonly width: number;
  readonly height: number;
  readonly arenaHeight: number;

  private readonly scene: Phaser.Scene;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly baseZoom: number;
  private readonly live = new Set<Phaser.GameObjects.GameObject>();
  private readonly auras = new Set<Aura>();
  private readonly flashTokens = new WeakMap<Phaser.GameObjects.Sprite, number>();
  private flashTimes: number[] = [];
  private disposed = false;

  // Camera state
  private trauma = 0;
  private rumbleLevel = 0;
  private rumbleUntil = 0;
  private readonly kickPos = { x: 0, y: 0 };
  private readonly kickVel = { x: 0, y: 0 };
  private readonly zoom = { punch: 0, push: 0 };
  private punchTween?: Phaser.Tweens.Tween;
  private pushTween?: Phaser.Tweens.Tween;
  private readonly anchor: Point;
  private readonly anchorTarget: Point;
  private readonly seed = Math.random() * 100;
  private cameraMoved = false;
  private clock = 0;

  private dimRect?: Phaser.GameObjects.Rectangle;
  private dimTween?: Phaser.Tweens.Tween;
  private vignette?: Phaser.GameObjects.Image;
  private vignetteTween?: Phaser.Tweens.Tween;
  private moodImage?: Phaser.GameObjects.Image;
  private moodTween?: Phaser.Tweens.Tween;
  private grade?: Phaser.FX.ColorMatrix;
  private gradeTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, options: BattleFxOptions) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.baseZoom = this.camera.zoom;
    this.width = this.camera.width / this.baseZoom;
    this.height = this.camera.height / this.baseZoom;
    this.arenaHeight = options.arenaHeight;
    this.reducedMotion = options.reducedMotion;
    this.anchor = { x: this.width / 2, y: this.arenaHeight };
    this.anchorTarget = { ...this.anchor };
  }

  // ── Time ────────────────────────────────────────────────────────────────

  /** Runs `fn` after `ms` on the tween clock. */
  at(ms: number, fn: () => void): void {
    if (ms <= 0) { fn(); return; }
    this.scene.tweens.addCounter({
      from: 0, to: 1, duration: ms,
      onComplete: () => { if (!this.disposed) fn(); },
    });
  }

  /** Calls `step` with linear progress 0..1 over `ms`. */
  animate(ms: number, step: (t: number) => void, done?: () => void): Phaser.Tweens.Tween {
    return this.scene.tweens.addCounter({
      from: 0, to: 1, duration: Math.max(1, ms),
      onUpdate: tween => { if (!this.disposed) step(tween.getValue() ?? 0); },
      onComplete: () => {
        if (this.disposed) return;
        step(1);
        done?.();
      },
    });
  }

  // ── Camera ──────────────────────────────────────────────────────────────

  /** Adds trauma (0..1). The shake is trauma squared, decaying over about half a second. */
  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Holds the shake at no less than `level` for `ms`: a sustained rumble. */
  rumble(level: number, ms: number): void {
    this.rumbleLevel = level;
    this.rumbleUntil = this.clock + ms;
  }

  /** A directional jolt of the camera that springs back. */
  kick(dx: number, dy: number): void {
    this.kickVel.x += dx * 26;
    this.kickVel.y += dy * 26;
  }

  /** A fast zoom toward `x, y` and back, for impacts. */
  punch(x: number, y: number, amount: number, inMs = 55, outMs = 380): void {
    this.aim(x, y);
    const start = this.zoom.punch;
    const peak = Math.max(start, amount);
    const split = inMs / (inMs + outMs);
    const rise = ease('Quad.easeOut');
    const fall = ease('Sine.easeInOut');
    this.punchTween?.stop();
    this.punchTween = this.animate(inMs + outMs, t => {
      this.zoom.punch = t < split ? lerp(start, peak, rise(t / split)) : peak * (1 - fall((t - split) / (1 - split)));
    });
  }

  /** A slow sustained push-in toward `x, y`; push to 0 to release. */
  push(x: number, y: number, amount: number, ms: number): void {
    if (amount > 0) this.aim(x, y);
    const start = this.zoom.push;
    const curve = ease('Sine.easeInOut');
    this.pushTween?.stop();
    this.pushTween = this.animate(ms, t => { this.zoom.push = lerp(start, amount, curve(t)); });
  }

  private aim(x: number, y: number): void {
    // Zoom about a point near the arena floor, so the seam with the controls
    // below barely moves while the view closes in on the action.
    this.anchorTarget.x = Phaser.Math.Clamp(x, 0, this.width);
    this.anchorTarget.y = lerp(Phaser.Math.Clamp(y, 0, this.arenaHeight), this.arenaHeight, 0.6);
    if (this.zoom.punch + this.zoom.push < 0.002) {
      this.anchor.x = this.anchorTarget.x;
      this.anchor.y = this.anchorTarget.y;
    }
  }

  update(time: number, delta: number): void {
    if (this.disposed) return;
    this.clock = time;
    const dt = Math.min(delta, 50) / 1000;

    this.trauma = Math.max(0, this.trauma - dt * TRAUMA_DECAY_PER_S);
    const level = Math.max(this.trauma, time < this.rumbleUntil ? this.rumbleLevel : 0);

    // Damped spring for kicks.
    const stiffness = 620;
    const damping = 2 * Math.sqrt(stiffness) * 0.42;
    for (const axis of ['x', 'y'] as const) {
      this.kickVel[axis] += (-stiffness * this.kickPos[axis] - damping * this.kickVel[axis]) * dt;
      this.kickPos[axis] += this.kickVel[axis] * dt;
    }

    this.auras.forEach(aura => this.syncAura(aura, time));

    const motion = this.reducedMotion ? 0 : 1;
    const amplitude = MAX_SHAKE * level * level * motion;
    const s = (time / 1000) * 62 + this.seed;
    const ox = amplitude * (Math.sin(s) * 0.5 + Math.sin(s * 2.13 + 1.3) * 0.3 + Math.sin(s * 3.71 + 2.1) * 0.2);
    const oy = amplitude * 0.75 * (Math.sin(s * 1.07 + 4.2) * 0.5 + Math.sin(s * 2.41 + 0.4) * 0.3 + Math.sin(s * 3.33 + 5.3) * 0.2);
    const kx = this.kickPos.x * motion;
    const ky = this.kickPos.y * motion;

    const follow = 1 - Math.exp(-delta / 70);
    this.anchor.x += (this.anchorTarget.x - this.anchor.x) * follow;
    this.anchor.y += (this.anchorTarget.y - this.anchor.y) * follow;

    let zr = (1 + this.zoom.punch * motion) * (1 + this.zoom.push * motion);
    const needX = amplitude + Math.abs(kx);
    const needY = amplitude * 0.75 + Math.abs(ky);
    if (needX + needY < 0.05 && zr < 1.0005) {
      if (this.cameraMoved) {
        this.camera.setZoom(this.baseZoom).setScroll(0, 0);
        this.cameraMoved = false;
      }
      return;
    }

    // Zoom in just enough that the shake never shows past the arena's edges.
    const roomX = Math.max(1, Math.min(this.anchor.x, this.width - this.anchor.x));
    const roomY = Math.max(1, Math.min(this.anchor.y, this.height - this.anchor.y));
    zr = Math.max(zr, 1 / Math.max(0.5, 1 - (needX + 0.5) / roomX), 1 / Math.max(0.5, 1 - (needY + 0.5) / roomY));

    const scrollX = Phaser.Math.Clamp(this.anchor.x * (1 - 1 / zr) + ox + kx, 0, this.width - this.width / zr);
    const scrollY = Phaser.Math.Clamp(this.anchor.y * (1 - 1 / zr) + oy + ky, 0, this.height - this.height / zr);
    this.camera.setZoom(this.baseZoom * zr).setScroll(scrollX, scrollY);
    this.cameraMoved = true;
  }

  // ── Arena light ─────────────────────────────────────────────────────────

  /** Darkens the arena art behind the fighters. */
  dim(alpha: number, ms: number): void {
    if (!this.dimRect) {
      this.dimRect = this.track(this.scene.add.rectangle(0, 0, this.width, this.arenaHeight, 0x000000, 1)
        .setOrigin(0).setDepth(DEPTH.dim).setAlpha(0));
    }
    this.dimTween?.stop();
    this.dimTween = this.scene.tweens.add({ targets: this.dimRect, alpha, duration: ms, ease: 'Sine.easeInOut' });
  }

  /** A soft spotlight: the arena falls off into shadow around `x, y`. */
  spotlight(x: number, y: number, alpha: number, ms: number, color = 0x000000): void {
    const size = Math.max(this.width, this.arenaHeight) * 2.6;
    if (!this.vignette) {
      this.vignette = this.image(BFX.vignette, x, y, { blend: 'normal', depth: DEPTH.dim + 0.05, w: size, h: size, alpha: 0 });
    }
    this.vignette.setTint(color);
    this.vignetteTween?.stop();
    this.vignetteTween = this.scene.tweens.add({ targets: this.vignette, x, y, alpha, duration: ms, ease: 'Sine.easeInOut' });
  }

  /** A lasting tint at the arena's edges, for the mood of a boss phase. */
  mood(color: number, alpha: number, ms: number): void {
    if (!this.moodImage) {
      this.moodImage = this.image(BFX.vignette, this.width / 2, this.arenaHeight / 2, {
        blend: 'normal', depth: DEPTH.dim - 0.05, w: this.width * 1.25, h: this.arenaHeight * 1.5, alpha: 0,
      });
    }
    this.moodImage.setTint(color);
    this.moodTween?.stop();
    this.moodTween = this.scene.tweens.add({ targets: this.moodImage, alpha, duration: ms, ease: 'Sine.easeInOut' });
  }

  /** Drains the colour from the whole view. */
  desaturate(amount: number, ms: number): void {
    const postFX = this.camera.postFX;
    if (!postFX) return;
    if (!this.grade) {
      if (amount <= 0) return;
      this.grade = postFX.addColorMatrix();
      this.grade.grayscale(1);
      this.grade.alpha = 0;
    }
    const grade = this.grade;
    this.gradeTween?.stop();
    this.gradeTween = this.scene.tweens.add({
      targets: grade, alpha: amount, duration: ms, ease: 'Sine.easeInOut',
      onComplete: () => {
        if (amount > 0 || this.grade !== grade) return;
        postFX.remove(grade as unknown as Phaser.FX.Controller);
        this.grade = undefined;
      },
    });
  }

  /** Reserves one of the few full-arena flashes allowed per second. */
  private takeFlash(): boolean {
    const now = performance.now();
    this.flashTimes = this.flashTimes.filter(time => now - time < 1000);
    if (this.flashTimes.length >= MAX_FLASHES_PER_S) return false;
    this.flashTimes.push(now);
    return true;
  }

  screenFlash(color: number, alpha: number, life: number, blend: Blend = 'add'): void {
    if (!this.takeFlash()) return;
    const flash = this.track(this.scene.add.rectangle(0, 0, this.width, this.arenaHeight, color, 1)
      .setOrigin(0).setDepth(DEPTH.top).setBlendMode(blendMode(blend))
      .setAlpha(alpha * (this.reducedMotion ? 0.35 : 1)));
    this.scene.tweens.add({ targets: flash, alpha: 0, duration: life, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
  }

  /**
   * The picture switching off like an old tube screen: it collapses into a
   * bright line across the arena, the line shrinks to a dot, the dot dies.
   * `done` runs on the black frame; the black stays until the scene ends.
   */
  powerOff(done: () => void, depth = 50): void {
    const W = this.width;
    const H = this.arenaHeight;
    const half = H / 2;
    const shutters = [
      this.track(this.scene.add.rectangle(0, 0, W, half, 0x000000, 1).setOrigin(0, 0)),
      this.track(this.scene.add.rectangle(0, H, W, half, 0x000000, 1).setOrigin(0, 1)),
    ];
    shutters.forEach(shutter => shutter.setDepth(depth).setScale(1, 0));
    const line = this.track(this.scene.add.rectangle(W / 2, half, W, 3, 0xffffff, 1)
      .setDepth(depth + 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
    const close = ease('Expo.easeIn');
    this.animate(170, t => {
      shutters.forEach(shutter => shutter.setScale(1, close(t) * (1 - 1.5 / half)));
      line.setAlpha(close(t));
    }, () => {
      shutters.forEach(shutter => shutter.setScale(1, 1));
      const dot = this.image(BFX.core, W / 2, half, { color: 0xffffff, w: 18, depth: depth + 2, alpha: 0 });
      this.animate(150, t => {
        line.setScale(Math.max(0.004, 1 - close(t)), 1 - 0.4 * t);
        dot.setAlpha(Math.min(1, t * 2));
      }, () => {
        line.destroy();
        this.animate(140, t => dot.setAlpha(1 - t).setDisplaySize(18 * (1 - 0.6 * t), 18 * (1 - 0.6 * t)), () => {
          dot.destroy();
          done();
        });
      });
    });
  }

  /** A couple of frames in inverted monochrome: the hardest-hitting moment only. */
  impactFrame(ms = 50): void {
    const postFX = this.camera.postFX;
    if (this.reducedMotion || !postFX || !this.takeFlash()) return;
    const frame = postFX.addColorMatrix();
    frame.negative();
    frame.grayscale(1, true);
    this.at(ms, () => postFX.remove(frame as unknown as Phaser.FX.Controller));
  }

  // ── Primitives ──────────────────────────────────────────────────────────

  private track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.live.add(object);
    object.once(Phaser.GameObjects.Events.DESTROY, () => this.live.delete(object));
    return object;
  }

  image(key: string, x: number, y: number, o: ImageOptions = {}): Phaser.GameObjects.Image {
    const image = this.track(this.scene.add.image(x, y, key, o.frame));
    image.setDepth(o.depth ?? DEPTH.front).setBlendMode(blendMode(o.blend)).setTint(o.color ?? 0xffffff).setAlpha(o.alpha ?? 1);
    if (o.origin) image.setOrigin(o.origin[0], o.origin[1]);
    if (o.w !== undefined) image.setDisplaySize(o.w, o.h ?? o.w);
    if (o.angle) image.setAngle(o.angle);
    return image;
  }

  /** A light that blooms from `size` toward `size * grow` and fades. */
  glow(x: number, y: number, o: PulseOptions, key: string = BFX.glow): Phaser.GameObjects.Image {
    const squash = o.squash ?? 1;
    const image = this.image(key, x, y, { color: o.color, alpha: o.alpha ?? 1, blend: o.blend, depth: o.depth, w: o.size, h: o.size * squash, angle: o.angle });
    const a0 = image.alpha;
    const grow = o.grow ?? 1.25;
    const sizeCurve = ease('Cubic.easeOut');
    const fade = ease(o.fade ?? 'Quad.easeIn');
    this.animate(o.life, t => {
      const size = o.size * lerp(1, grow, sizeCurve(t));
      image.setDisplaySize(size, size * squash).setAlpha(a0 * (1 - fade(t)));
    }, () => image.destroy());
    return image;
  }

  /** White-hot centre plus a coloured bloom. */
  flash(x: number, y: number, color: number, size: number, life = 160, depth: number = DEPTH.front): void {
    this.glow(x, y, { color, size: size * 2.2, life: life * 2.2, alpha: 0.85, grow: 1.35, depth });
    this.glow(x, y, { color: 0xffffff, size, life, grow: 1.5, fade: 'Quad.easeOut', depth: depth + 0.1 }, BFX.core);
  }

  ring(x: number, y: number, o: RingOptions): Phaser.GameObjects.Image {
    const squash = o.squash ?? 1;
    const image = this.image(o.soft ? BFX.ringSoft : BFX.ring, x, y, {
      color: o.color, alpha: 0, blend: o.blend, depth: o.depth ?? DEPTH.front, w: o.from, h: o.from * squash, angle: o.angle,
    });
    const peak = o.alpha ?? 1;
    const curve = ease(o.ease ?? 'Cubic.easeOut');
    const fadeIn = o.fadeIn ?? 0;
    this.animate(o.life, t => {
      const size = lerp(o.from, o.to, curve(t));
      const alpha = fadeIn > 0 && t < fadeIn ? t / fadeIn : Math.pow(1 - (t - fadeIn) / (1 - fadeIn), 1.7);
      image.setDisplaySize(size, size * squash).setAlpha(peak * Math.max(0, alpha));
    }, () => image.destroy());
    return image;
  }

  /** An anamorphic lens streak. */
  streakFlare(x: number, y: number, o: { color: number; width: number; height?: number; life: number; alpha?: number; angle?: number; depth?: number }): void {
    const height = o.height ?? 14;
    const image = this.image(BFX.flare, x, y, { color: o.color, alpha: o.alpha ?? 1, depth: o.depth, w: o.width * 0.6, h: height, angle: o.angle });
    const a0 = image.alpha;
    const grow = ease('Expo.easeOut');
    this.animate(o.life, t => {
      image.setDisplaySize(o.width * lerp(0.6, 1.15, grow(t)), height * lerp(1, 0.35, t)).setAlpha(a0 * (1 - t * t));
    }, () => image.destroy());
  }

  star(x: number, y: number, o: { color: number; size: number; life: number; spin?: number; alpha?: number; depth?: number }): void {
    const image = this.image(BFX.star, x, y, { color: o.color, alpha: o.alpha ?? 1, depth: o.depth, w: o.size });
    const a0 = image.alpha;
    const spin = o.spin ?? 25;
    this.animate(o.life, t => {
      const size = o.size * lerp(0.6, 1.2, ease('Expo.easeOut')(t)) * (1 - 0.5 * t * t);
      image.setDisplaySize(size, size).setAngle(spin * t).setAlpha(a0 * (1 - t * t));
    }, () => image.destroy());
  }

  /** A strand whose layers fade out together over `life`, then go. */
  fadeStrand(strand: Strand | Bolt, life: number, from = 1): void {
    this.animate(life, t => strand.setAlpha(from * (1 - t)), () => strand.destroy());
  }

  strand(layers: StrandLayer[], depth: number = DEPTH.front): Strand {
    return new Strand(this, layers, depth);
  }

  bolt(from: Point, to: Point, options: ConstructorParameters<typeof Bolt>[3]): Bolt {
    return new Bolt(this, from, to, options);
  }

  // ── Particles ───────────────────────────────────────────────────────────

  private emitter(x: number, y: number, key: string, config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, depth: number) {
    const emitter = this.track(this.scene.add.particles(x, y, key, config));
    emitter.setDepth(depth);
    return emitter;
  }

  private burst(emitter: Phaser.GameObjects.Particles.ParticleEmitter, count: number, maxLife: number): void {
    emitter.explode(count);
    this.at(maxLife + 60, () => emitter.destroy());
  }

  /** Streaks that point along their flight and arc under gravity. */
  sparks(x: number, y: number, o: SparkOptions): void {
    const k = 1 / BFX_DENSITY;
    const { w, h } = BFX_SIZE[BFX.streak];
    const length = ((o.length ?? 16) / w) * k;
    const thickness = ((o.thickness ?? 2.2) / h) * k;
    const [a0, a1] = o.angle ?? [0, 360];
    const spread = o.spread ?? 0;
    const emitter = this.emitter(x, y, BFX.streak, {
      emitting: false,
      lifespan: { min: o.life[0], max: o.life[1] },
      speed: { min: o.speed[0], max: o.speed[1] },
      x: spread ? { min: -spread, max: spread } : 0,
      y: spread ? { min: -spread, max: spread } : 0,
      rotate: {
        onEmit: (particle?: Phaser.GameObjects.Particles.Particle) => {
          const heading = a0 + Math.random() * (a1 - a0);
          if (particle) (particle as SparkParticle).heading = heading;
          return heading;
        },
        onUpdate: (particle: Phaser.GameObjects.Particles.Particle) => Phaser.Math.RadToDeg(Math.atan2(particle.velocityY, particle.velocityX)),
      },
      angle: { onEmit: (particle?: Phaser.GameObjects.Particles.Particle) => (particle as SparkParticle | undefined)?.heading ?? 0 },
      scaleX: { start: length, end: length * 0.2, ease: 'Quad.easeIn' },
      scaleY: { start: thickness, end: thickness * 0.5 },
      alpha: { start: 1, end: 0, ease: 'Quad.easeIn' },
      ...this.colorOps(o.colors),
      gravityY: o.gravity ?? 0,
      blendMode: blendMode(o.blend),
    } as Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, o.depth ?? DEPTH.front);
    this.burst(emitter, o.count, o.life[1]);
  }

  private colorOps(colors: number[]): Partial<Phaser.Types.GameObjects.Particles.ParticleEmitterConfig> {
    return colors.length > 1 ? { color: colors, colorEase: 'Quad.easeOut' } : { tint: colors[0] ?? 0xffffff };
  }

  /** Soft rolling puffs: dust, smoke, mist. */
  puffs(x: number, y: number, o: PuffOptions): void {
    const k = 1 / BFX_DENSITY;
    const base = BFX_SIZE[BFX.smoke].w;
    const [a0, a1] = o.angle ?? [0, 360];
    const spread = o.spread ?? { x: 0, y: 0 };
    const emitter = this.emitter(x, y, BFX.smoke, {
      emitting: false,
      frame: [0, 1, 2, 3],
      lifespan: { min: o.life[0], max: o.life[1] },
      speed: { min: o.speed[0], max: o.speed[1] },
      angle: { min: a0, max: a1 },
      x: { min: -spread.x, max: spread.x },
      y: { min: -spread.y, max: spread.y },
      rotate: { min: 0, max: 360 },
      scale: { start: (o.size[0] / base) * k, end: (o.size[1] / base) * k, ease: 'Quad.easeOut' },
      alpha: { start: o.alpha, end: 0, ease: 'Sine.easeIn' },
      tint: o.color,
      gravityY: o.gravity ?? 0,
      blendMode: blendMode(o.blend ?? 'normal'),
    }, o.depth ?? DEPTH.front);
    this.burst(emitter, o.count, o.life[1]);
  }

  /** Tumbling chunks or splinters under gravity. */
  debris(x: number, y: number, o: DebrisOptions): void {
    const key = o.texture ?? BFX.chunk;
    const k = 1 / BFX_DENSITY;
    const base = BFX_SIZE[key].w;
    const spread = o.spread ?? { x: 0, y: 0 };
    const emitter = this.emitter(x, y, key, {
      emitting: false,
      frame: key === BFX.chunk ? [0, 1, 2] : undefined,
      lifespan: { min: o.life[0], max: o.life[1] },
      speed: { min: o.speed[0], max: o.speed[1] },
      angle: { min: o.angle[0], max: o.angle[1] },
      x: { min: -spread.x, max: spread.x },
      y: { min: -spread.y, max: spread.y },
      scale: { min: (o.size[0] / base) * k, max: (o.size[1] / base) * k },
      rotate: {
        onEmit: (particle?: Phaser.GameObjects.Particles.Particle) => {
          const p = particle as SparkParticle | undefined;
          const start = Math.random() * 360;
          if (p) { p.spin0 = start; p.spin = (Math.random() < 0.5 ? -1 : 1) * (300 + Math.random() * 500); }
          return start;
        },
        onUpdate: (particle: Phaser.GameObjects.Particles.Particle, _key: string, t: number) => {
          const p = particle as SparkParticle;
          return (p.spin0 ?? 0) + (p.spin ?? 0) * t;
        },
      },
      alpha: { start: 1, end: 0, ease: 'Expo.easeIn' },
      tint: o.color,
      gravityY: o.gravity,
      blendMode: blendMode(o.blend ?? 'normal'),
    } as Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, o.depth ?? DEPTH.front);
    this.burst(emitter, o.count, o.life[1]);
  }

  /** Small soft dots, specks or music notes drifting outward. */
  motes(x: number, y: number, o: MoteOptions): void {
    const key = o.texture ?? BFX.dot;
    const k = 1 / BFX_DENSITY;
    const base = BFX_SIZE[key].w;
    const [a0, a1] = o.angle ?? [0, 360];
    const spread = o.spread ?? { x: 0, y: 0 };
    const emitter = this.emitter(x, y, key, {
      emitting: false,
      frame: key === BFX.note ? (o.frames ?? [0, 1, 2, 3, 4]) : undefined,
      lifespan: { min: o.life[0], max: o.life[1] },
      speed: { min: o.speed[0], max: o.speed[1] },
      angle: { min: a0, max: a1 },
      x: { min: -spread.x, max: spread.x },
      y: { min: -spread.y, max: spread.y },
      scale: { start: (o.size[0] / base) * k, end: (o.size[1] / base) * k },
      rotate: key === BFX.note ? { min: -18, max: 18 } : 0,
      alpha: { start: 1, end: 0, ease: 'Quad.easeIn' },
      ...this.colorOps(o.colors),
      gravityY: o.gravity ?? 0,
      blendMode: blendMode(o.blend),
    } as Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, o.depth ?? DEPTH.front);
    this.burst(emitter, o.count, o.life[1]);
  }

  /** Energy drawn in toward `x, y` from a ring around it. */
  converge(x: number, y: number, o: ConvergeOptions): Phaser.GameObjects.Particles.ParticleEmitter {
    const key = o.streak ? BFX.streak : BFX.dot;
    const k = 1 / BFX_DENSITY;
    const base = BFX_SIZE[key];
    const size = o.size ?? (o.streak ? 14 : 5);
    const squash = o.squash ?? 1;
    const source = {
      getRandomPoint: (point: Phaser.Types.Math.Vector2Like) => {
        const angle = Math.random() * Math.PI * 2;
        const r = o.radius * (0.7 + Math.random() * 0.3);
        point.x = Math.cos(angle) * r;
        point.y = Math.sin(angle) * r * squash;
        return point;
      },
    };
    // A burst fires `count` at once; a stream fires `count` every `frequency` ms.
    const emitter = this.emitter(x, y, key, {
      emitting: o.duration !== undefined,
      frequency: o.frequency ?? 30,
      quantity: o.duration !== undefined ? o.count : 1,
      emitZone: { type: 'random', source } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: o.life[0], max: o.life[1] },
      moveToX: 0,
      moveToY: 0,
      rotate: o.streak ? {
        onEmit: (particle?: Phaser.GameObjects.Particles.Particle) => (particle ? Phaser.Math.RadToDeg(Math.atan2(-particle.y, -particle.x)) : 0),
        onUpdate: (particle: Phaser.GameObjects.Particles.Particle) => Phaser.Math.RadToDeg(Math.atan2(particle.velocityY, particle.velocityX)),
      } : 0,
      scaleX: { start: (size / base.w) * k * 0.6, end: (size / base.w) * k },
      scaleY: { start: ((o.streak ? 2 : size) / base.h) * k * 0.6, end: ((o.streak ? 2 : size) / base.h) * k },
      alpha: { start: 0, end: 1, ease: 'Quad.easeOut' },
      ...this.colorOps(o.colors),
      blendMode: blendMode(o.blend),
    } as Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, o.depth ?? DEPTH.front);
    if (o.duration === undefined) {
      this.burst(emitter, o.count, o.life[1]);
    } else {
      this.at(o.duration, () => emitter.stop());
      this.at(o.duration + o.life[1] + 60, () => emitter.destroy());
    }
    return emitter;
  }

  /** Particles shed from a moving point; stop the returned emitter to end it. */
  trail(target: Phaser.Types.Math.Vector2Like, o: { colors: number[]; size: Range; life: Range; frequency: number; speed?: Range; gravity?: number; depth?: number; spread?: number }): Phaser.GameObjects.Particles.ParticleEmitter {
    const k = 1 / BFX_DENSITY;
    const base = BFX_SIZE[BFX.dot].w;
    const spread = o.spread ?? 3;
    const emitter = this.emitter(0, 0, BFX.dot, {
      frequency: o.frequency,
      quantity: 1,
      follow: target,
      lifespan: { min: o.life[0], max: o.life[1] },
      speed: { min: o.speed?.[0] ?? 0, max: o.speed?.[1] ?? 20 },
      x: { min: -spread, max: spread },
      y: { min: -spread, max: spread },
      scale: { start: (o.size[0] / base) * k, end: (o.size[1] / base) * k },
      alpha: { start: 0.9, end: 0 },
      ...this.colorOps(o.colors),
      gravityY: o.gravity ?? 0,
      blendMode: Phaser.BlendModes.ADD,
    } as Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, o.depth ?? DEPTH.front);
    return emitter;
  }

  /** Ends a trail and removes it once its last particle has died. */
  endTrail(emitter: Phaser.GameObjects.Particles.ParticleEmitter, maxLife: number): void {
    emitter.stop();
    this.at(maxLife + 60, () => emitter.destroy());
  }

  /** Motion streaks across a region, travelling along `angle` (degrees). */
  speedLines(o: { region: { x: number; y: number; w: number; h: number }; angle: number; color: number; alpha?: number; length: Range; thickness?: number; speed: Range; life: number; duration: number; frequency?: number; depth?: number }): void {
    const k = 1 / BFX_DENSITY;
    const base = BFX_SIZE[BFX.speedline];
    const emitter = this.emitter(0, 0, BFX.speedline, {
      frequency: o.frequency ?? 14,
      quantity: 1,
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(o.region.x, o.region.y, o.region.w, o.region.h) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: o.life,
      speed: { min: o.speed[0], max: o.speed[1] },
      angle: o.angle,
      rotate: o.angle,
      scaleX: { min: (o.length[0] / base.w) * k, max: (o.length[1] / base.w) * k },
      scaleY: ((o.thickness ?? 2) / base.h) * k,
      alpha: { start: o.alpha ?? 0.5, end: 0 },
      tint: o.color,
      blendMode: Phaser.BlendModes.ADD,
    } as Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, o.depth ?? DEPTH.front);
    this.at(o.duration, () => emitter.stop());
    this.at(o.duration + o.life + 60, () => emitter.destroy());
  }

  /**
   * A slanted banner sweeping across the arena with a portrait in it, for the
   * ultimate move. `crop` is the slice of the portrait shown (fractions of its
   * height); the head may break out of the banner's top edge.
   */
  cutIn(o: { texture: string; color: number; hold: number; crop: readonly [number, number] }, done: () => void): void {
    const W = this.width;
    const H = this.arenaHeight;
    const bandH = H * 0.36;
    const cy = H * 0.46;
    const skew = W * 0.055;
    const band = this.track(this.scene.add.graphics());
    const top = cy - bandH / 2;
    const bottom = cy + bandH / 2;
    const corners = [
      new Phaser.Math.Vector2(-60, top + skew), new Phaser.Math.Vector2(W + 60, top - skew),
      new Phaser.Math.Vector2(W + 60, bottom - skew), new Phaser.Math.Vector2(-60, bottom + skew),
    ];
    band.fillStyle(0x0c0705, 0.9).fillPoints(corners, true);
    band.lineStyle(3, o.color, 1).lineBetween(-60, top + skew, W + 60, top - skew).lineBetween(-60, bottom + skew, W + 60, bottom - skew);
    band.lineStyle(1, 0xffffff, 0.55).lineBetween(-60, top + skew + 5, W + 60, top - skew + 5).lineBetween(-60, bottom + skew - 5, W + 60, bottom - skew - 5);
    const tilt = Math.atan2(-2 * skew, W + 120);
    const stripe = this.image(BFX.beam, W / 2, cy, { color: o.color, alpha: 0.42, w: W + 160, h: bandH * 0.95 }).setRotation(tilt);

    const source = this.scene.textures.get(o.texture).getSourceImage();
    const [from, to] = o.crop;
    const shown = bandH * 1.28;
    const displayH = shown / (to - from);
    const scale = displayH / source.height;
    const portrait = this.scene.add.image(W * 0.3, bottom + skew * 0.25 - to * displayH, o.texture)
      .setOrigin(0.5, 0).setScale(scale).setCrop(0, from * source.height, source.width, (to - from) * source.height);
    const rim = this.scene.add.image(portrait.x, portrait.y, o.texture).setOrigin(0.5, 0).setScale(scale * 1.025)
      .setCrop(0, from * source.height, source.width, (to - from) * source.height)
      .setTintFill(o.color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.85);
    const banner = this.track(this.scene.add.container(-W * 1.1, 0, [band, stripe, rim, portrait]).setDepth(DEPTH.top - 1));
    this.speedLines({
      region: { x: 0, y: top - skew, w: W, h: bandH }, angle: 180, color: 0xffffff, alpha: 0.4,
      length: [60, 160], thickness: 2, speed: [1500, 2100], life: 160, duration: 160 + o.hold, frequency: 12, depth: DEPTH.top,
    });
    const slideIn = ease('Expo.easeOut');
    const slideOut = ease('Expo.easeIn');
    this.animate(160, t => banner.setX(-W * 1.1 * (1 - slideIn(t))), () => {
      this.animate(o.hold, t => { portrait.setX(W * 0.3 + 18 * t); rim.setX(portrait.x); });
      this.at(o.hold, () => this.animate(140, t => banner.setX(W * 1.1 * slideOut(t)), () => {
        banner.destroy();
        done();
      }));
    });
  }

  // ── Fighters ────────────────────────────────────────────────────────────

  /** A copy of the sprite as it is drawn right now, beside it in its parent. */
  private copy(sprite: Phaser.GameObjects.Sprite, behind: boolean): Phaser.GameObjects.Image {
    const image = this.scene.make.image({ key: sprite.texture.key, frame: sprite.frame.name }, false);
    image.setPosition(sprite.x, sprite.y)
      .setOrigin(sprite.originX, sprite.originY)
      .setScale(sprite.scaleX, sprite.scaleY)
      .setRotation(sprite.rotation)
      .setFlip(sprite.flipX, sprite.flipY);
    const parent = sprite.parentContainer;
    if (parent) {
      parent.addAt(image, parent.getIndex(sprite) + (behind ? 0 : 1));
    } else {
      this.scene.add.existing(image);
      image.setDepth(sprite.depth + (behind ? -0.01 : 0.01));
    }
    return this.track(image);
  }

  /** A tinted ghost of the sprite left behind (or thrown) as it moves. */
  afterimage(sprite: Phaser.GameObjects.Sprite, o: { color: number; alpha?: number; life?: number; dx?: number; dy?: number; grow?: number; fill?: boolean; blend?: Blend; behind?: boolean }): void {
    const image = this.copy(sprite, o.behind ?? true);
    if (o.fill ?? true) image.setTintFill(o.color); else image.setTint(o.color);
    image.setBlendMode(blendMode(o.blend)).setAlpha(o.alpha ?? 0.5);
    const { x: x0, y: y0, scaleX: sx, scaleY: sy, alpha: a0 } = image;
    const grow = o.grow ?? 1;
    const curve = ease('Cubic.easeOut');
    this.animate(o.life ?? 220, t => {
      const e = curve(t);
      image.setPosition(x0 + (o.dx ?? 0) * e, y0 + (o.dy ?? 0) * e)
        .setScale(sx * lerp(1, grow, e), sy * lerp(1, grow, e))
        .setAlpha(a0 * (1 - t));
    }, () => image.destroy());
  }

  /** Lights the sprite's silhouette from behind; fade it with `auraTo`. */
  aura(sprite: Phaser.GameObjects.Sprite, color: number): Aura {
    const layers = [{ scale: 1.035, alpha: 0.6 }, { scale: 1.085, alpha: 0.3 }].map(layer => {
      const image = this.copy(sprite, true).setTintFill(color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      return { image, ...layer };
    });
    const aura = new Aura(sprite, layers);
    this.auras.add(aura);
    return aura;
  }

  auraTo(aura: Aura, level: number, ms: number, thenRelease = false): void {
    const start = aura.level;
    this.animate(ms, t => { aura.level = lerp(start, level, t); }, () => {
      if (!thenRelease) return;
      this.auras.delete(aura);
      aura.layers.forEach(layer => layer.image.destroy());
    });
  }

  private syncAura(aura: Aura, time: number): void {
    const sprite = aura.sprite;
    const pulse = 0.85 + 0.15 * Math.sin(time / 90);
    aura.layers.forEach(layer => {
      if (!layer.image.active) return;
      layer.image.setPosition(sprite.x, sprite.y)
        .setScale(sprite.scaleX * layer.scale, sprite.scaleY * layer.scale)
        .setRotation(sprite.rotation)
        .setVisible(sprite.visible)
        .setAlpha(layer.alpha * aura.level * pulse * sprite.alpha);
    });
  }

  /** Two frames of pure white, then the blow's colour draining away. */
  hitFlash(sprite: Phaser.GameObjects.Sprite, color: number, hold = 45, fade = 230): void {
    const token = (this.flashTokens.get(sprite) ?? 0) + 1;
    this.flashTokens.set(sprite, token);
    const current = () => this.flashTokens.get(sprite) === token && sprite.active;
    sprite.setTintFill(0xffffff);
    this.at(hold, () => {
      if (!current()) return;
      const curve = ease('Sine.easeOut');
      this.animate(fade, t => { if (current()) sprite.setTint(lerpColor(color, 0xffffff, curve(t))); }, () => {
        if (current()) sprite.clearTint();
      });
    });
  }

  /** Red and cyan ghosts pulled apart and snapping back: a torn signal. */
  rgbSplit(sprite: Phaser.GameObjects.Sprite, amount: number, life = 220, alpha = 0.45): void {
    [[0xff2a3a, -1], [0x2ad8ff, 1]].forEach(([color, side]) => {
      const image = this.copy(sprite, false).setTintFill(color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(alpha);
      const x0 = image.x;
      this.animate(life, t => {
        image.setX(x0 + side * amount * (1 - ease('Cubic.easeOut')(t))).setAlpha(alpha * (1 - t));
      }, () => image.destroy());
    });
  }

  /** Horizontal bands of the sprite jump sideways for a few frames. */
  glitch(sprite: Phaser.GameObjects.Sprite, o: { slices?: number; amount?: number; life?: number; tint?: number } = {}): void {
    const frameW = sprite.frame.width;
    const frameH = sprite.frame.height;
    const amount = o.amount ?? 10;
    for (let i = 0; i < (o.slices ?? 4); i++) {
      const height = frameH * (0.05 + Math.random() * 0.12);
      const top = Math.random() * (frameH - height);
      const image = this.copy(sprite, false).setCrop(0, top, frameW, height);
      if (o.tint !== undefined) image.setTint(o.tint);
      image.setX(image.x + (Math.random() < 0.5 ? -1 : 1) * amount * (0.4 + Math.random() * 0.6));
      this.at(o.life ?? 80, () => image.destroy());
    }
  }

  /**
   * The target's reaction to a landed blow: a white flash, a torn-signal
   * split, the push with its hit-stop, and the camera.
   */
  react(target: Combatant, hit: { weight: HitWeight; color: number; dir: Point; lift?: number }, at: Point = target.center): void {
    const w = WEIGHT[hit.weight];
    this.hitFlash(target.sprite, hit.color, w.flash);
    if (w.split > 0) this.rgbSplit(target.sprite, w.split);
    target.knock(hit.dir, w.push, w.hold, hit.lift ?? 0);
    this.shake(w.trauma);
    this.punch(at.x, at.y, w.punch);
    this.kick(hit.dir.x * w.kick, hit.dir.y * w.kick);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    [...this.live].forEach(object => object.destroy());
    this.live.clear();
    this.auras.clear();
    const postFX = this.camera.postFX;
    if (this.grade && postFX) postFX.remove(this.grade as unknown as Phaser.FX.Controller);
    this.grade = undefined;
    this.camera.setZoom(this.baseZoom).setScroll(0, 0);
  }
}

export { lerp, ease };
