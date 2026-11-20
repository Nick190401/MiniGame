import Phaser from 'phaser';
import { CHARACTER_FRAME, CHARACTER_HEIGHT } from '../../art/characters';
import { FX } from '../../art/fx';
import { HFX } from '../../art/healFx';
import type { Npc } from '../../entities/Npc';
import type { Player } from '../../entities/Player';
import { IS_IOS } from '../../../platform';

/**
 * What every part of the NPC heal shares: the types, the maths, tracks and
 * shots, and the HealKit that the sequence (index.ts) builds once and hands
 * to the healer's opening (krys.ts, quincy.ts, kian.ts).
 *
 * For a healer's signature, beyond the original kit:
 * - Scale: `heroK` / `npcK` are the live size of hero and healer against the 27-unit sprite the
 *   offsets were measured on (1, or 1.2 once the overworld characters grew). The kit's own
 *   geometry (C, ux/uy, forkOffset, head and body boxes, routes, labelY, liftMax, tick) is
 *   already multiplied; multiply your own body-attached offsets and sizes (hands, instrument,
 *   glints on a body) yourself, or use onHero(). onNpc() takes world units. World-sized things
 *   (ground rings, columns, sigils, shock fronts) keep their sizes.
 * - Time: `T` has peak 1435, drop 1700, handBack 2600, dialog 2680 and end 4000. The clock runs to T.end; after
 *   T.handBack nothing may touch hero, healer or camera, and frame() keeps running to T.end.
 *   at() may be called at any moment, also from inside a cue or frame(), for any time up to T.end.
 *   ONSETS lists the sound's measured onsets; level(t) is its loudness 0..1 (HEAL_LEVEL, 50 ms
 *   windows, interpolated): let glow, bar heights or ring thickness breathe with it.
 * - Colour: `pal` is the healer's palette (deep, glow, core, spark, accent). One colour idea per healer.
 * - Depth: BACK / MID / FRONT are behind both, between and in front of the pair inside the world's
 *   band. The world dimmer sits at VIG: everything below it is darkened away from the pair, and
 *   SKY, AIR, NOTES and GLARE above it are not.
 * - Particles: particle(key, o) is one sprite on the master clock with velocity, drag, gravity or
 *   a path. A signature may have particleCap alive (90 desktop, 40 on the iOS path); spawns over
 *   that are dropped and particle() returns false. `lite` is the iOS path (no FX pipeline).
 *   shot() also takes delay, move, height and origin. rnd() is a seeded random for repeatable runs.
 * - `view` is the camera's world view at t = 0 (the widest of the sequence): view.top is the top
 *   edge, so a light that must leave the frame ends above it.
 */

export interface NpcHealOptions {
  npc: Npc;
  player: Player;
  playerShadow?: Phaser.GameObjects.Image;
  /** Re-places the hero's cast shadow after a facing change. */
  syncHeroShadow(): void;
  accent: number;
  amount: number;
  reducedMotion: boolean;
  onSound(): void;
  onRestoreHp(): void;
  onNotice(): void;
  onDone(): void;
}

export interface NpcHealHandle {
  /** True until the hero is handed back to the dialog. */
  readonly busy: boolean;
  destroy(): void;
}

export type Ease = (v: number) => number;
export type Key = readonly [start: number, duration: number, target: number, ease: Ease];
export type Blend = 'add' | 'screen' | 'normal';
export type Box = readonly [x0: number, y0: number, x1: number, y1: number];
export type Point = { x: number; y: number };

const E = Phaser.Math.Easing;
export const SINE_IO: Ease = E.Sine.InOut;
export const SINE_O: Ease = E.Sine.Out;
export const SINE_I: Ease = E.Sine.In;
export const QUAD_O: Ease = E.Quadratic.Out;
export const QUAD_I: Ease = E.Quadratic.In;
export const CUBIC_O: Ease = E.Cubic.Out;
export const EXPO_O: Ease = E.Expo.Out;
export const EXPO_I: Ease = E.Expo.In;
export const BACK_O: Ease = v => E.Back.Out(v);

export const WARM = 0xfff1c4;
export const GOLD = 0xf2c35f;
export const CREAM = 0xffe7c2;
export const INK = 0x1a0f0a;
export const ICE = 0xe6f3ff;
export const EPS = 0.00001;

/** The heal sound's RMS loudness per 50 ms window, normalised to its loudest (index i = i * 50 ms). */
export const HEAL_LEVEL: readonly number[] = [
  0.02, 0.04, 0.09, 0.10, 0.24, 0.35, 0.30, 0.23, 0.26, 0.29, 0.31, 0.36, 0.39, 0.44, 0.49, 0.51, 0.44, 0.31, 0.38, 0.52,
  0.63, 0.65, 0.73, 0.78, 0.80, 0.83, 0.88, 0.89, 0.87, 0.92, 1.00, 0.99, 0.96, 0.98, 0.43, 0.32, 0.44, 0.42, 0.43, 0.44,
  0.50, 0.45, 0.47, 0.43, 0.43, 0.42, 0.39, 0.44, 0.40, 0.38, 0.35, 0.30, 0.23, 0.22, 0.26, 0.27, 0.30, 0.27, 0.28, 0.25,
  0.25, 0.24, 0.23, 0.22, 0.19, 0.20, 0.17, 0.17, 0.13, 0.09, 0.11, 0.12, 0.13, 0.12, 0.11, 0.12, 0.10, 0.09, 0.08, 0.06,
  0.05, 0.04, 0.03, 0.02, 0.01, 0, 0, 0,
];
/** The sound's loudness at t ms, 0..1, interpolated between the 50 ms windows (each value sits at its window's middle). */
export const level = (t: number) => {
  const f = t / 50 - 0.5;
  if (f <= 0) return HEAL_LEVEL[0];
  const i = Math.floor(f);
  if (i >= HEAL_LEVEL.length - 1) return 0;
  return HEAL_LEVEL[i] + (HEAL_LEVEL[i + 1] - HEAL_LEVEL[i]) * (f - i);
};
/** The sound's measured onsets in ms. */
export const ONSETS = {
  gather: [215, 300, 595, 680, 955, 1110, 1195],
  lock: 1350,
  peak: 1435,
  plateau: [1555, 1675],
  drop: 1700,
  chimes: [1765, 1830, 1970, 2030, 2235, 2360],
} as const;
/**
 * The sequence's own times in ms: hero, healer and camera are handed back at handBack; at end (4000) everything
 * is destroyed, so an afterglow has to have faded out by about 3950.
 */
export const T = { peak: 1435, drop: 1700, handBack: 2600, dialog: 2680, end: 4000 } as const;

/** A healer's light: one colour idea, from its saturated depth to its near-white core. */
export interface Palette {
  /** The healer's accent as given. */
  accent: number;
  /** Saturated: wide soft light under brighter cores, far rays, ground pools. */
  deep: number;
  /** The main light. */
  glow: number;
  /** Hot cores: near white with the healer's cast. */
  core: number;
  /** Sparks, motes and notes. */
  spark: number;
}
const PALETTES: Record<Npc['npcId'], Omit<Palette, 'accent'>> = {
  professor: { deep: 0x3f7fe6, glow: 0x8cc6ff, core: 0xeaf5ff, spark: 0xc4e2ff },
  guard: { deep: 0xff5a24, glow: 0xff9c4f, core: 0xfff0dc, spark: 0xffc58a },
  musician: { deep: 0xe79a22, glow: 0xf8cc62, core: 0xfff7da, spark: 0xffe394 },
};

const BLEND: Record<Blend, Phaser.BlendModes> = {
  add: Phaser.BlendModes.ADD,
  screen: Phaser.BlendModes.SCREEN,
  normal: Phaser.BlendModes.NORMAL,
};

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const progress = (t: number, start: number, duration: number) => clamp01((t - start) / duration);
export const smoothstep = (e0: number, e1: number, x: number) => {
  const k = clamp01((x - e0) / (e1 - e0));
  return k * k * (3 - 2 * k);
};
export const lerpColor = (a: number, b: number, k: number) => {
  const r = lerp((a >> 16) & 0xff, (b >> 16) & 0xff, k);
  const g = lerp((a >> 8) & 0xff, (b >> 8) & 0xff, k);
  const bl = lerp(a & 0xff, b & 0xff, k);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
};
/** Every channel times k, clamped. */
export const scaleColor = (c: number, k: number) => {
  const r = Math.min(255, Math.round(((c >> 16) & 0xff) * k));
  const g = Math.min(255, Math.round(((c >> 8) & 0xff) * k));
  const b = Math.min(255, Math.round((c & 0xff) * k));
  return (r << 16) | (g << 8) | b;
};
/** A bump of `amp` that rises over `up` ms from `start`, then settles over `down` ms. */
export const pulse = (t: number, start: number, amp: number, up: number, down: number) => {
  const d = t - start;
  if (d < 0 || d >= up + down) return 0;
  return amp * (d < up ? QUAD_O(d / up) : 1 - SINE_IO((d - up) / down));
};
/** Distance from a point to a box; 0 inside it. */
export const boxDistance = (x: number, y: number, b: Box) => Math.hypot(Math.max(b[0] - x, 0, x - b[2]), Math.max(b[1] - y, 0, y - b[3]));
export const inflate = (b: Box, d: number): Box => [b[0] - d, b[1] - d, b[2] + d, b[3] + d];
export const around = (x: number, y: number, hw: number, hh: number): Box => [x - hw, y - hh, x + hw, y + hh];
export const overlaps = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/** A value that eases from key to key and holds in between. */
export class Track {
  constructor(private readonly initial: number, private readonly keys: readonly Key[]) {}

  at(t: number): number {
    let v = this.initial;
    for (let i = 0; i < this.keys.length; i++) {
      const [start, duration, target, ease] = this.keys[i];
      if (t <= start) break;
      const next = this.keys[i + 1];
      const until = next && next[0] < t ? next[0] : t;
      const k = duration <= 0 ? 1 : Math.min(1, (until - start) / duration);
      v += (target - v) * ease(k);
      if (until === t) break;
    }
    return v;
  }
}

/** A short light that grows and fades on its own, then is destroyed. */
interface Shot {
  image: Phaser.GameObjects.Image;
  t0: number;
  duration: number;
  size0: number;
  size1: number;
  /** The size eases over this many ms, then drifts to size1 * settle over the rest of the life. */
  grow: number;
  settle: number;
  aspect: number;
  peak: number;
  /** Linear rise to the peak alpha, then a hold, then the fade. */
  rise: number;
  hold: number;
  angle: number;
  spin: number;
  ease: Ease;
  fadeEase: Ease;
  /** Opening ripples: faded by the 1195 gather and gone at 1350. */
  gather: boolean;
  /** Height from, to when it does not follow the width. */
  height?: readonly [number, number];
  x: number;
  y: number;
  moveX: number;
  moveY: number;
}

interface Particle {
  image: Phaser.GameObjects.Image;
  core: boolean;
  t0: number;
  life: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  drag: number;
  path?: (k: number, out: Point) => void;
  size0: number;
  size1: number;
  aspect: number;
  peak: number;
  rise: number;
  angle: number;
  spin: number;
  align: boolean;
  twinkle: number;
  phase: number;
  sizeEase: Ease;
  fadeEase: Ease;
}

/** One sprite on the master clock. Give a velocity (with drag and acceleration) or a path. */
export interface ParticleOptions {
  x: number;
  y: number;
  /** Units per second. */
  vx?: number;
  vy?: number;
  /** Units per second squared: negative ay rises. */
  ax?: number;
  ay?: number;
  /** Velocity decay rate per second: 0 none, 3 has it almost still within a second. */
  drag?: number;
  /** Instead of the velocity: the position over the life, k from 0 to 1. */
  path?: (k: number, out: Point) => void;
  /** Life in ms, after `delay` ms in which it is not shown. */
  life: number;
  delay?: number;
  /** Width from, to; height = width x aspect. */
  size: readonly [number, number];
  aspect?: number;
  /** Peak alpha, reached after `rise`, then fading to 0. `rise` is a share of the life up to 1 (default 0.12), ms above 1. */
  alpha: number;
  rise?: number;
  color: number;
  depth: number;
  blend: Blend;
  /** Degrees at the start, and degrees turned over the life. */
  angle?: number;
  spin?: number;
  /** Points its top along its motion, also on a path (streaks). */
  align?: boolean;
  /** 0..1: how deep it flickers. */
  twinkle?: number;
  sizeEase?: Ease;
  fadeEase?: Ease;
}

export interface ShotOptions {
  size: readonly [number, number];
  alpha: number;
  duration: number;
  color: number;
  depth: number;
  blend: Blend;
  aspect?: number;
  rise?: number;
  hold?: number;
  grow?: number;
  settle?: number;
  angle?: number;
  spin?: number;
  ease?: Ease;
  fadeEase?: Ease;
  gather?: boolean;
  /** Starts after this many ms (hidden until then). */
  delay?: number;
  /** Drift over the life in units, eased like the size. */
  move?: readonly [number, number];
  /** Height from, to, for lights that do not keep their aspect (columns). */
  height?: readonly [number, number];
  /** Texture origin, default the centre. */
  origin?: readonly [number, number];
}

/** A straight path for something that travels from the healer to the hero. */
export interface Route { x0: number; y0: number; x1: number; y1: number; chest: boolean; column: boolean }

/** A healer's own part of the sequence: the lean of the healer, and its per-frame update. */
export type Opening = { angle(t: number): number; frame(t: number, dt: number): void };

/**
 * What an opening works with. Positions are world units. The geometry is
 * captured at t = 0: it follows neither the hero's lift nor the healer's lean
 * (heroY() and onNpc() do). Every member is a plain value or a closure, safe
 * to destructure, except `clock`, which must be read from the kit.
 */
export interface HealKit {
  readonly scene: Phaser.Scene;
  readonly opts: NpcHealOptions;
  readonly npc: Npc;
  readonly player: Player;
  readonly cam: Phaser.Cameras.Scene2D.Camera;
  /** The healer's accent colour. */
  readonly A: number;
  /** Reduced motion. */
  readonly calm: boolean;

  /** The hero's feet. */
  readonly pX: number;
  readonly pY: number;
  /** The healer's feet. */
  readonly nX: number;
  readonly nY: number;
  /** The hero's scale. */
  readonly s0x: number;
  readonly s0y: number;
  /** Depth of the hero, and of the healer. */
  readonly hD: number;
  readonly nD: number;
  /** From the healer's feet to the hero's; adx is |dx|. */
  readonly dx: number;
  readonly dy: number;
  readonly adx: number;
  /** The hero's side of the healer: 1 right, -1 left, and 1 when they are less than a unit apart in x. */
  readonly sx: number;
  /** 1 when the hero's x is at or right of the healer's, else -1. */
  readonly s: number;
  /** The hero's chest. */
  readonly C: Readonly<Point>;
  /** Unit vector from the healer's chest to the hero's. */
  readonly ux: number;
  readonly uy: number;
  /** That vector is within 60 degrees of level: the two stand beside rather than above each other. */
  readonly horizontal: boolean;
  /** The gap on the ground plane, in ellipse-normalised units. */
  readonly gG: number;
  readonly facing: Npc['facing'];
  /** Tip of Professor Krys's tuning-fork staff, from her feet. */
  readonly forkOffset: Readonly<Point>;
  /**
   * Live size of the hero and of the healer against the 27-unit sprite all body offsets were
   * measured on, read at t = 0. Multiply everything attached to a body by its factor.
   */
  readonly heroK: number;
  readonly npcK: number;
  /** How high the hero is lifted at the release, in units (already scaled). */
  readonly liftMax: number;
  /** The y of the HP label's baseline. */
  readonly labelY: number;
  /** The camera's world view at t = 0, the widest of the sequence. */
  readonly view: Readonly<{ left: number; right: number; top: number; bottom: number; width: number; height: number; cx: number; cy: number }>;
  /** The healer's palette. */
  readonly pal: Readonly<Palette>;
  /** The sequence's times: peak, drop, handBack, dialog, end. */
  readonly T: typeof T;
  /** The iOS path: no FX pipeline, fewer particles. */
  readonly lite: boolean;
  /** How many particles a signature may have alive at once. */
  readonly particleCap: number;

  /** Healer light: the accent mixed 35, 40, 45, 55 and 60 % toward ice (Krys) or warm (the others). */
  readonly Lb: number;
  readonly Lp: number;
  readonly Lr: number;
  readonly Lc: number;
  readonly Le: number;

  /** Depths on the ground, under the characters' band (5 + y / 10000): shade, light, a ring's trough, a ring's crest. */
  readonly DUSK: number;
  readonly GROUND: number;
  readonly TROUGH: number;
  readonly RIPPLE: number;
  /** Just behind the hero, back to front. */
  readonly BLOOM: number;
  readonly ARCS: number;
  /** Just in front of the hero, back to front. */
  readonly SELF: number;
  readonly CHEST: number;
  readonly TICK: number;
  /** The healer's instrument: just in front of the healer, just behind when the healer faces up. */
  readonly INSTR: number;
  /** Above the world, back to front: vignette, lights in the air, painted notes, the HP label. */
  readonly VIG: number;
  readonly AIR: number;
  readonly NOTES: number;
  readonly LABEL: number;
  /** Inside the world's band: behind both characters, between them, in front of both. */
  readonly BACK: number;
  readonly MID: number;
  readonly FRONT: number;
  /** Above the world dimmer (VIG): wide soft light behind AIR, and the hottest light in front of NOTES. */
  readonly SKY: number;
  readonly GLARE: number;

  /** A point given from the healer's feet that follows the healer's lean; written to `out`. */
  readonly onNpc: (ox: number, oy: number, out: Point) => Point;
  /** A point given from the hero's feet on the 27-unit sprite: scaled by heroK and following his lift. */
  readonly onHero: (ox: number, oy: number, out: Point) => Point;
  /** Faces of the healer and the hero (his spans his lift), then both padded by 1.5. */
  readonly headN: Box;
  readonly headH: Box;
  readonly headNi: Box;
  readonly headHi: Box;
  /** Bodies of the healer and the hero. */
  readonly bodyN: Box;
  readonly bodyH: Box;
  /** The point is more than `pad` away from both faces (from their padded boxes if `inflated`). */
  readonly clearOfFaces: (x: number, y: number, pad: number, inflated: boolean) => boolean;
  /** The box touches neither the healer's body nor the healer's face. */
  readonly missesNpc: (b: Box) => boolean;
  /** Every sampled point from a (not included) to b is clearOfFaces by `pad`. */
  readonly pathClear: (ax: number, ay: number, bx: number, by: number, pad: number, steps?: number) => boolean;
  /**
   * Paths from the healer to the hero, best first: to the edge of his chest, low past his flank, then a
   * column beside both faces. Hand and column start are given from the healer's feet, colEndX from the
   * hero's. Take the first one that fits what travels along it.
   */
  readonly routes: (handX: number, handY: number, colX: number, colY: number, colEndX: number) => Route[];
  readonly routeLength: (r: Route) => number;

  /** Registers an object to be destroyed at teardown. */
  readonly own: <T extends Phaser.GameObjects.GameObject>(obj: T) => T;
  /** Destroys an owned object now. */
  readonly drop: (obj: Phaser.GameObjects.GameObject | undefined) => void;
  /** An owned image at display size w x h. */
  readonly image: (key: string, x: number, y: number, w: number, h: number, color: number, depth: number, blend: Blend) => Phaser.GameObjects.Image;
  /** A short light that starts now, grows and fades on its own, then is destroyed. */
  readonly shot: (key: string, x: number, y: number, o: ShotOptions) => Phaser.GameObjects.Image;
  /** A ground ring growing from radius rx0 to rx1. With `gather` it fades with the 1195 gather and is gone at 1350. */
  readonly ring: (x: number, y: number, rx0: number, rx1: number, alpha: number, duration: number, color: number, gather?: boolean) => Phaser.GameObjects.Image;
  /** A glint that pops in place and turns a little (calm: a plain fade). */
  readonly glint: (x: number, y: number, size: number, alpha: number, color: number, depth: number, fade: number, rise: number, settle: number) => Phaser.GameObjects.Image;
  /** A soft light at the hero's chest, for whenever something arrives. */
  readonly tick: () => Phaser.GameObjects.Image;
  /**
   * Runs fn once when the clock reaches `time` ms. Cues of one time run in the order they were registered.
   * May be called at any moment, also from a cue or from frame(); a time already past runs on the next frame.
   */
  readonly at: (time: number, fn: () => void) => void;
  /** One particle on the master clock; false when the signature's particleCap is reached and it was dropped. */
  readonly particle: (key: string, o: ParticleOptions) => boolean;
  /** The sound's loudness at t ms, 0..1. */
  readonly level: (t: number) => number;
  /** Seeded random 0..1, the same sequence on every heal. */
  readonly rnd: () => number;
  /** The y of the hero's feet right now, lift included. */
  readonly heroY: () => number;
  /** The master clock in ms. */
  readonly clock: number;
}

/** Where the healer will stand once the staging walk has ended; the geometry is built from it instead of the live sprite. */
export interface StagedSpot { x: number; y: number; facing: Npc['facing'] }

/** The kit plus what only the sequence drives: the clock, the hero's lift, the cues and the shots. */
export interface HealDriver extends HealKit {
  clock: number;
  /** How far the hero is off the ground right now (0 or negative). */
  lift: number;
  /** Kept for the sequence's old call: at() keeps the cues ordered by itself. */
  sortCues(): void;
  /** A particle of the shared sequence, counted against its own cap. */
  coreParticle(key: string, o: ParticleOptions): boolean;
  /** Particles alive right now, shared and signature together. */
  particleCount(): number;
  /** Runs every cue that is due at t. */
  runCues(t: number): void;
  /** Advances every shot and destroys the finished ones. */
  updateShots(t: number): void;
  /** Destroys everything owned and forgets the shots. */
  destroyAll(): void;
}

export function createHealKit(scene: Phaser.Scene, opts: NpcHealOptions, staged?: StagedSpot): HealDriver {
  const { npc, player, accent: A, reducedMotion: calm } = opts;
  const cam = scene.cameras.main;
  const owned = new Set<Phaser.GameObjects.GameObject>();
  const shots: Shot[] = [];
  const particles: Particle[] = [];
  // Body offsets below were measured on the 27-unit sprite; the characters' live scale carries them.
  // From the drawn height, so a sharper bake of the character textures changes nothing here.
  const FRAME_UNITS = (CHARACTER_HEIGHT * CHARACTER_FRAME.h) / CHARACTER_FRAME.figure;
  const heroK = player.displayHeight / FRAME_UNITS;
  const npcK = npc.displayHeight / FRAME_UNITS;
  const liftMax = 4 * heroK;
  const lite = IS_IOS || !('pipelines' in scene.renderer) || !scene.renderer.pipelines.FX_PIPELINE;
  const particleCap = lite ? 40 : 90;
  const coreCap = lite ? 80 : 160;
  const pal: Palette = { accent: A, ...PALETTES[npc.npcId] };
  const wv = cam.worldView;
  const view = {
    left: wv.x, right: wv.x + wv.width, top: wv.y, bottom: wv.y + wv.height,
    width: wv.width, height: wv.height, cx: wv.x + wv.width / 2, cy: wv.y + wv.height / 2,
  };
  let seed = 0x9e3779b9;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };

  // ── Geometry, captured at t = 0 ─────────────────────────────────────────
  const pX = player.x;
  const pY = player.y;
  const nX = staged ? staged.x : npc.x;
  const nY = staged ? staged.y : npc.y;
  const s0x = player.scaleX;
  const s0y = player.scaleY;
  const hD = player.depth;
  // The healer's depth follows its feet (same band as the hero's).
  const nD = npc.depth + (nY - npc.y) / 10000;
  const dx = pX - nX;
  const dy = pY - nY;
  const adx = Math.abs(dx);
  const sx = adx < 1 ? 1 : Math.sign(dx);
  const s = pX >= nX ? 1 : -1;
  const C = { x: pX, y: pY - 14 * heroK };
  let ux = C.x - nX;
  let uy = C.y - (nY - 13 * npcK);
  const ul = Math.hypot(ux, uy) || 1;
  ux /= ul;
  uy /= ul;
  const horizontal = Math.abs(ux) >= 0.5;
  /** The gap on the ground plane, in ellipse-normalised units. */
  const gG = Math.hypot(dx, dy / 0.36);
  const facing = staged ? staged.facing : npc.facing;
  // Tip of Professor Krys's tuning-fork staff, measured on her standing frames.
  const fork = facing === 'right' ? { x: 4.8, y: -22.6 }
    : facing === 'left' ? { x: -4.8, y: -22.6 }
      : facing === 'up' ? { x: 4.4, y: -22.5 }
        : { x: -4.4, y: -22.5 };
  const forkOffset = { x: fork.x * npcK, y: fork.y * npcK };

  // Healer light: Krys mixes toward ice so she stays blue-steel; the others toward warm.
  const lightTo = npc.npcId === 'professor' ? ICE : WARM;
  const Lb = lerpColor(A, lightTo, 0.35);
  const Lp = lerpColor(A, lightTo, 0.4);
  const Lr = lerpColor(A, lightTo, 0.45);
  const Lc = lerpColor(A, lightTo, 0.55);
  const Le = lerpColor(A, lightTo, 0.6);

  const DUSK = 2.9;
  const GROUND = 4.6;
  const TROUGH = 4.605;
  const RIPPLE = 4.61;
  const BLOOM = hD - 5 * EPS;
  const ARCS = hD - 3 * EPS;
  const SELF = hD + 2 * EPS;
  const CHEST = hD + 5 * EPS;
  const TICK = hD + 6 * EPS;
  const INSTR = facing === 'up' ? nD - 4 * EPS : nD + 4 * EPS;
  const VIG = 16;
  const AIR = 18;
  const NOTES = 18.5;
  const LABEL = 21;
  const BACK = Math.min(hD, nD) - 9 * EPS;
  const MID = (hD + nD) / 2;
  const FRONT = Math.max(hD, nD) + 9 * EPS;
  const SKY = 17;
  const GLARE = 19.5;

  /** A point relative to the NPC's feet that follows the NPC's lean. */
  const onNpc = (ox: number, oy: number, out: Point) => {
    const r = npc.rotation;
    const c = Math.cos(r);
    const sn = Math.sin(r);
    out.x = nX + ox * c - oy * sn;
    out.y = nY + ox * sn + oy * c;
    return out;
  };
  const onHero = (ox: number, oy: number, out: Point) => {
    out.x = pX + ox * heroK;
    out.y = pY + currentLift + oy * heroK;
    return out;
  };

  // ── Placement solver: runs once, keeps every travelling element off both faces ──
  const headN: Box = [nX - 4.5 * npcK, nY - 28 * npcK, nX + 4.5 * npcK, nY - 18 * npcK];
  // The hero's box spans both of his heights: standing and lifted.
  const headH: Box = [pX - 4.5 * heroK, pY - 28 * heroK - liftMax, pX + 4.5 * heroK, pY - 18 * heroK];
  const headNi = inflate(headN, 1.5);
  const headHi = inflate(headH, 1.5);
  // The HP label stands over the hero's head; where that would cover the healer's face (the hero right below the healer) it stands above that.
  const labelOverHero = pY - 39 * heroK;
  const labelY = overlaps([pX - 18, labelOverHero - 15, pX + 18, labelOverHero + 2], headNi) ? headNi[1] - 2 : labelOverHero;
  const bodyN: Box = [nX - 6 * npcK, nY - 27 * npcK, nX + 6 * npcK, nY + npcK];
  const bodyH: Box = [pX - 5 * heroK, pY - 27 * heroK - liftMax, pX + 5 * heroK, pY + heroK];
  const clearOfFaces = (x: number, y: number, pad: number, inflated: boolean) =>
    boxDistance(x, y, inflated ? headNi : headN) > pad && boxDistance(x, y, inflated ? headHi : headH) > pad;
  const missesNpc = (b: Box) => !overlaps(b, bodyN) && !overlaps(b, headN);
  const pathClear = (ax: number, ay: number, bx: number, by: number, pad: number, steps = 10) => {
    for (let k = 1; k <= steps; k++) {
      if (!clearOfFaces(lerp(ax, bx, k / steps), lerp(ay, by, k / steps), pad, false)) return false;
    }
    return true;
  };

  /** Front (toward the chest edge), flank (low), then the side column clear of both faces. */
  const routes = (handX: number, handY: number, colX: number, colY: number, colEndX: number): Route[] => {
    const column: Route = { x0: nX + colX, y0: nY + colY, x1: pX + colEndX, y1: pY - 15 * heroK, chest: false, column: true };
    const len = Math.hypot(column.x1 - column.x0, column.y1 - column.y0);
    if (len < 12) {
      const ex = len > 0.01 ? (column.x1 - column.x0) / len : 0;
      const ey = len > 0.01 ? (column.y1 - column.y0) / len : Math.sign(dy) || -1;
      column.x1 = column.x0 + ex * 12;
      column.y1 = column.y0 + ey * 12;
    }
    return [
      { x0: nX + handX, y0: nY + handY, x1: pX - 4.5 * sx * heroK, y1: pY - 14 * heroK, chest: true, column: false },
      { x0: nX + handX, y0: nY + handY, x1: pX - 6 * sx * heroK, y1: pY - 12 * heroK, chest: false, column: false },
      column,
    ];
  };
  const routeLength = (r: Route) => Math.hypot(r.x1 - r.x0, r.y1 - r.y0);

  // ── Object helpers ──────────────────────────────────────────────────────
  const own = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
    owned.add(obj);
    return obj;
  };
  const drop = (obj: Phaser.GameObjects.GameObject | undefined) => {
    if (!obj) return;
    owned.delete(obj);
    obj.destroy();
  };
  const image = (key: string, x: number, y: number, w: number, h: number, color: number, depth: number, blend: Blend) =>
    own(scene.add.image(x, y, key).setDisplaySize(w, h).setTint(color).setDepth(depth).setBlendMode(BLEND[blend]));
  const shot = (key: string, x: number, y: number, o: ShotOptions) => {
    const aspect = o.aspect ?? 1;
    const rise = o.rise ?? 0;
    const delay = o.delay ?? 0;
    const img = image(key, x, y, o.size[0], o.height ? o.height[0] : o.size[0] * aspect, o.color, o.depth, o.blend)
      .setAngle(o.angle ?? 0).setAlpha(rise > 0 || delay > 0 ? 0 : o.alpha);
    if (o.origin) img.setOrigin(o.origin[0], o.origin[1]);
    shots.push({
      image: img, t0: clock + delay, duration: o.duration, size0: o.size[0], size1: o.size[1], grow: o.grow ?? o.duration,
      settle: o.settle ?? 1, aspect, peak: o.alpha, rise, hold: o.hold ?? 0, angle: o.angle ?? 0, spin: o.spin ?? 0,
      ease: o.ease ?? QUAD_O, fadeEase: o.fadeEase ?? QUAD_O, gather: o.gather ?? false,
      height: o.height, x, y, moveX: o.move ? o.move[0] : 0, moveY: o.move ? o.move[1] : 0,
    });
    return img;
  };
  /** A soft light at the hero's chest whenever something arrives. */
  const tick = () => shot(FX.glow, C.x, C.y, calm
    ? { size: [8 * heroK, 8 * heroK], alpha: 0.3, duration: 300, color: Le, depth: TICK, blend: 'screen', rise: 150, fadeEase: SINE_IO }
    : { size: [6 * heroK, 10 * heroK], alpha: 0.3, duration: 220, color: Le, depth: TICK, blend: 'screen' });
  /** A ground ring: soft crest on a 0.36 ellipse, rising over 15 % of its life, then fading. */
  const ring = (x: number, y: number, rx0: number, rx1: number, alpha: number, duration: number, color: number, gather = false) =>
    shot(HFX.ring, x, y, {
      size: [2 * rx0, 2 * rx1], aspect: 0.36, alpha, duration, color, depth: RIPPLE, blend: 'screen',
      rise: 0.15 * duration, ease: CUBIC_O, fadeEase: QUAD_I, gather,
    });
  /** A glint that pops in place and turns a little (calm: a plain fade). */
  const glint = (x: number, y: number, size: number, alpha: number, color: number, depth: number, fade: number, rise: number, settle: number) =>
    shot(HFX.glint, x, y, calm
      ? { size: [size, size], alpha: Math.min(alpha, 0.6), duration: 300, color, depth, blend: 'add', rise: 150, fadeEase: SINE_IO }
      : { size: [0.6 * size, size], alpha, duration: rise + fade, color, depth, blend: 'add', rise, grow: 40, settle, spin: 15 });

  // ── Cues on the master clock ────────────────────────────────────────────
  const cues: Array<[number, () => void]> = [];
  let cueIndex = 0;
  // Kept ordered on insert, after every cue of the same time and never before one that already ran.
  const at = (time: number, fn: () => void) => {
    let i = cues.length;
    while (i > cueIndex && cues[i - 1][0] > time) i--;
    cues.splice(i, 0, [time, fn]);
  };
  let clock = 0;
  let currentLift = 0;
  const heroY = () => pY + currentLift;

  // ── Particles on the master clock ───────────────────────────────────────
  let coreAlive = 0;
  let signatureAlive = 0;
  const spawn = (key: string, o: ParticleOptions, core: boolean) => {
    if (core ? coreAlive >= coreCap : signatureAlive >= particleCap) return false;
    if (core) coreAlive++;
    else signatureAlive++;
    const aspect = o.aspect ?? 1;
    const img = image(key, o.x, o.y, o.size[0], o.size[0] * aspect, o.color, o.depth, o.blend).setAngle(o.angle ?? 0).setAlpha(0);
    particles.push({
      image: img, core, t0: clock + (o.delay ?? 0), life: o.life, x: o.x, y: o.y, vx: o.vx ?? 0, vy: o.vy ?? 0, ax: o.ax ?? 0, ay: o.ay ?? 0,
      drag: o.drag ?? 0, path: o.path, size0: o.size[0], size1: o.size[1], aspect, peak: o.alpha,
      rise: o.rise === undefined ? 0.12 : o.rise > 1 ? Math.min(0.9, o.rise / o.life) : o.rise,
      angle: o.angle ?? 0, spin: o.spin ?? 0, align: o.align ?? false, twinkle: o.twinkle ?? 0, phase: rnd() * 6.283,
      sizeEase: o.sizeEase ?? QUAD_O, fadeEase: o.fadeEase ?? QUAD_I,
    });
    return true;
  };
  const particle = (key: string, o: ParticleOptions) => spawn(key, o, false);
  const coreParticle = (key: string, o: ParticleOptions) => spawn(key, o, true);
  const particleCount = () => particles.length;
  const P: Point = { x: 0, y: 0 };
  let particleClock = 0;
  const updateParticles = (t: number) => {
    const dt = Math.max(0, t - particleClock);
    particleClock = t;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const age = t - p.t0;
      if (age < 0) continue;
      const k = age / p.life;
      if (k >= 1) {
        drop(p.image);
        particles.splice(i, 1);
        if (p.core) coreAlive--;
        else signatureAlive--;
        continue;
      }
      if (p.path) {
        p.path(k, P);
        if (p.align && (P.x !== p.x || P.y !== p.y)) {
          p.vx = P.x - p.x;
          p.vy = P.y - p.y;
        }
        p.x = P.x;
        p.y = P.y;
      } else {
        const h = Math.min(dt, age) / 1000;
        p.vx += p.ax * h;
        p.vy += p.ay * h;
        if (p.drag) {
          const d = Math.exp(-p.drag * h);
          p.vx *= d;
          p.vy *= d;
        }
        p.x += p.vx * h;
        p.y += p.vy * h;
      }
      const size = lerp(p.size0, p.size1, p.sizeEase(k));
      let alpha = p.peak * (k < p.rise ? k / p.rise : 1 - p.fadeEase((k - p.rise) / (1 - p.rise)));
      if (p.twinkle) alpha *= 1 - p.twinkle * (0.5 + 0.5 * Math.sin(p.phase + age * 0.021));
      p.image.setPosition(p.x, p.y).setDisplaySize(size, size * p.aspect).setAlpha(alpha);
      if (p.align && (p.vx || p.vy)) p.image.setRotation(Math.atan2(p.vy, p.vx) + Math.PI / 2);
      else if (p.spin) p.image.setAngle(p.angle + p.spin * k);
    }
  };

  // ── Driven by the sequence ──────────────────────────────────────────────
  const sortCues = () => {};
  const runCues = (t: number) => {
    while (cueIndex < cues.length && cues[cueIndex][0] <= t) cues[cueIndex++][1]();
  };
  const updateShots = (t: number) => {
    updateParticles(t);
    for (let i = shots.length - 1; i >= 0; i--) {
      const sh = shots[i];
      const age = t - sh.t0;
      if (age < 0) continue;
      const k = clamp01(age / sh.duration);
      const g = age < sh.grow ? sh.ease(age / sh.grow) : 1;
      const size = age < sh.grow ? lerp(sh.size0, sh.size1, g)
        : lerp(sh.size1, sh.size1 * sh.settle, clamp01((age - sh.grow) / Math.max(1, sh.duration - sh.grow)));
      let alpha = sh.peak;
      if (age < sh.rise) alpha *= age / sh.rise;
      else alpha *= 1 - sh.fadeEase(clamp01((age - sh.rise - sh.hold) / Math.max(1, sh.duration - sh.rise - sh.hold)));
      if (sh.gather) alpha *= 1 - QUAD_I(progress(t, 1195, 155));
      sh.image.setDisplaySize(size, sh.height ? lerp(sh.height[0], sh.height[1], g) : size * sh.aspect).setAlpha(alpha);
      if (sh.moveX || sh.moveY) sh.image.setPosition(sh.x + sh.moveX * g, sh.y + sh.moveY * g);
      if (sh.spin) sh.image.setAngle(sh.angle + sh.spin * QUAD_O(k));
      if (k >= 1 || (sh.gather && t >= 1350)) {
        drop(sh.image);
        shots.splice(i, 1);
      }
    }
  };
  const destroyAll = () => {
    [...owned].forEach(obj => obj.destroy());
    owned.clear();
    shots.length = 0;
    particles.length = 0;
    coreAlive = 0;
    signatureAlive = 0;
    cues.length = 0;
    cueIndex = 0;
  };

  return {
    scene, opts, npc, player, cam, A, calm,
    pX, pY, nX, nY, s0x, s0y, hD, nD, dx, dy, adx, sx, s, C, ux, uy, horizontal, gG, facing, forkOffset,
    heroK, npcK, liftMax, labelY, view, pal, T, lite, particleCap,
    Lb, Lp, Lr, Lc, Le,
    DUSK, GROUND, TROUGH, RIPPLE, BLOOM, ARCS, SELF, CHEST, TICK, INSTR, VIG, AIR, NOTES, LABEL,
    BACK, MID, FRONT, SKY, GLARE,
    onNpc, onHero, headN, headH, headNi, headHi, bodyN, bodyH, clearOfFaces, missesNpc, pathClear, routes, routeLength,
    own, drop, image, shot, ring, glint, tick, at, heroY, particle, level, rnd,
    get clock() { return clock; },
    set clock(t) { clock = t; },
    get lift() { return currentLift; },
    set lift(y) { currentLift = y; },
    sortCues, runCues, updateShots, destroyAll, coreParticle, particleCount,
  };
}
