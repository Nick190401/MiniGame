import Phaser from 'phaser';
import { BFX } from '../art/battleFx';
import { FX } from '../art/fx';
import { HFX, createHealFxTextures } from '../art/healFx';
import { RENDER_SCALE, WORLD_ZOOM } from '../render/RenderScale';
import type { Npc } from '../entities/Npc';
import type { Player } from '../entities/Player';

/**
 * The NPC heal, "Held note". The heal sound starts with the sequence and every
 * visual beat sits on one of its onsets: the healer's own opening over the
 * build-up (0-1350 ms), the heal on the sound's peak (1435 ms), the step-down
 * on the drop (1700 ms) and chimes through the release tail. The hero starts
 * drained of colour; on the peak, light climbs his own pixels while his colour
 * returns. Everything is soft light (no Graphics, no particles) and runs on
 * one counter tween, paused with the scene; there are no other tweens or timers.
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

type Ease = (v: number) => number;
type Key = readonly [start: number, duration: number, target: number, ease: Ease];
type Blend = 'add' | 'screen' | 'normal';
type Box = readonly [x0: number, y0: number, x1: number, y1: number];
type Point = { x: number; y: number };

const E = Phaser.Math.Easing;
const SINE_IO: Ease = E.Sine.InOut;
const SINE_O: Ease = E.Sine.Out;
const SINE_I: Ease = E.Sine.In;
const QUAD_O: Ease = E.Quadratic.Out;
const QUAD_I: Ease = E.Quadratic.In;
const CUBIC_O: Ease = E.Cubic.Out;
const EXPO_O: Ease = E.Expo.Out;
const EXPO_I: Ease = E.Expo.In;
const BACK_O: Ease = v => E.Back.Out(v);

const WARM = 0xfff1c4;
const GOLD = 0xf2c35f;
const CREAM = 0xffe7c2;
const INK = 0x1a0f0a;
const ICE = 0xe6f3ff;
const EPS = 0.00001;
const LENGTH = 2800;
const HAND_BACK = 2480;
const DIALOG = 2560;
/** Moves the visuals against the sound if a device's output latency needs it. */
const HEAL_AV_OFFSET_MS = 0;

const BLEND: Record<Blend, Phaser.BlendModes> = {
  add: Phaser.BlendModes.ADD,
  screen: Phaser.BlendModes.SCREEN,
  normal: Phaser.BlendModes.NORMAL,
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const progress = (t: number, start: number, duration: number) => clamp01((t - start) / duration);
const smoothstep = (e0: number, e1: number, x: number) => {
  const k = clamp01((x - e0) / (e1 - e0));
  return k * k * (3 - 2 * k);
};
const lerpColor = (a: number, b: number, k: number) => {
  const r = lerp((a >> 16) & 0xff, (b >> 16) & 0xff, k);
  const g = lerp((a >> 8) & 0xff, (b >> 8) & 0xff, k);
  const bl = lerp(a & 0xff, b & 0xff, k);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
};
/** Every channel times k, clamped. */
const scaleColor = (c: number, k: number) => {
  const r = Math.min(255, Math.round(((c >> 16) & 0xff) * k));
  const g = Math.min(255, Math.round(((c >> 8) & 0xff) * k));
  const b = Math.min(255, Math.round((c & 0xff) * k));
  return (r << 16) | (g << 8) | b;
};
/** A bump of `amp` that rises over `up` ms from `start`, then settles over `down` ms. */
const pulse = (t: number, start: number, amp: number, up: number, down: number) => {
  const d = t - start;
  if (d < 0 || d >= up + down) return 0;
  return amp * (d < up ? QUAD_O(d / up) : 1 - SINE_IO((d - up) / down));
};
/** Distance from a point to a box; 0 inside it. */
const boxDistance = (x: number, y: number, b: Box) => Math.hypot(Math.max(b[0] - x, 0, x - b[2]), Math.max(b[1] - y, 0, y - b[3]));
const inflate = (b: Box, d: number): Box => [b[0] - d, b[1] - d, b[2] + d, b[3] + d];
const around = (x: number, y: number, hw: number, hh: number): Box => [x - hw, y - hh, x + hw, y + hh];
const overlaps = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/** A value that eases from key to key and holds in between. */
class Track {
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
}

interface ShotOptions {
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
}

export function playNpcHeal(scene: Phaser.Scene, opts: NpcHealOptions): NpcHealHandle {
  createHealFxTextures(scene);
  const { npc, player, accent: A, reducedMotion: calm } = opts;
  const cam = scene.cameras.main;
  const zoom0 = cam.zoom;
  const owned = new Set<Phaser.GameObjects.GameObject>();
  const shots: Shot[] = [];

  // ── Geometry, captured at t = 0 ─────────────────────────────────────────
  const pX = player.x;
  const pY = player.y;
  const nX = npc.x;
  const nY = npc.y;
  const s0x = player.scaleX;
  const s0y = player.scaleY;
  const hD = player.depth;
  const nD = npc.depth;
  const shadow = opts.playerShadow;
  const shadowState = shadow ? { x: shadow.x, y: shadow.y, w: shadow.displayWidth, h: shadow.displayHeight, a: shadow.alpha } : undefined;
  const dx = pX - nX;
  const dy = pY - nY;
  const adx = Math.abs(dx);
  const sx = adx < 1 ? 1 : Math.sign(dx);
  const s = pX >= nX ? 1 : -1;
  const C = { x: pX, y: pY - 14 };
  let ux = C.x - nX;
  let uy = C.y - (nY - 13);
  const ul = Math.hypot(ux, uy) || 1;
  ux /= ul;
  uy /= ul;
  const horizontal = Math.abs(ux) >= 0.5;
  /** The gap on the ground plane, in ellipse-normalised units. */
  const gG = Math.hypot(dx, dy / 0.36);
  const facing = npc.facing;
  // Tip of Professor Krys's tuning-fork staff, measured on her standing frames.
  const forkOffset = facing === 'right' ? { x: 4.8, y: -22.6 }
    : facing === 'left' ? { x: -4.8, y: -22.6 }
      : facing === 'up' ? { x: 4.4, y: -22.5 }
        : { x: -4.4, y: -22.5 };

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

  /** A point relative to the NPC's feet that follows the NPC's lean. */
  const onNpc = (ox: number, oy: number, out: Point) => {
    const r = npc.rotation;
    const c = Math.cos(r);
    const sn = Math.sin(r);
    out.x = nX + ox * c - oy * sn;
    out.y = nY + ox * sn + oy * c;
    return out;
  };

  // ── Placement solver: runs once, keeps every travelling element off both faces ──
  const headN: Box = [nX - 4.5, nY - 28, nX + 4.5, nY - 18];
  // The hero's box spans both of his heights: standing and the -3 lift.
  const headH: Box = [pX - 4.5, pY - 31, pX + 4.5, pY - 18];
  const headNi = inflate(headN, 1.5);
  const headHi = inflate(headH, 1.5);
  const bodyN: Box = [nX - 6, nY - 27, nX + 6, nY + 1];
  const bodyH: Box = [pX - 5, pY - 30, pX + 5, pY + 1];
  const clearOfFaces = (x: number, y: number, pad: number, inflated: boolean) =>
    boxDistance(x, y, inflated ? headNi : headN) > pad && boxDistance(x, y, inflated ? headHi : headH) > pad;
  const missesNpc = (b: Box) => !overlaps(b, bodyN) && !overlaps(b, headN);
  const pathClear = (ax: number, ay: number, bx: number, by: number, pad: number, steps = 10) => {
    for (let k = 1; k <= steps; k++) {
      if (!clearOfFaces(lerp(ax, bx, k / steps), lerp(ay, by, k / steps), pad, false)) return false;
    }
    return true;
  };

  interface Route { x0: number; y0: number; x1: number; y1: number; chest: boolean; column: boolean }
  /** Front (toward the chest edge), flank (low), then the side column clear of both faces. */
  const routes = (handX: number, handY: number, colX: number, colY: number, colEndX: number): Route[] => {
    const column: Route = { x0: nX + colX, y0: nY + colY, x1: pX + colEndX, y1: pY - 15, chest: false, column: true };
    const len = Math.hypot(column.x1 - column.x0, column.y1 - column.y0);
    if (len < 12) {
      const ex = len > 0.01 ? (column.x1 - column.x0) / len : 0;
      const ey = len > 0.01 ? (column.y1 - column.y0) / len : Math.sign(dy) || -1;
      column.x1 = column.x0 + ex * 12;
      column.y1 = column.y0 + ey * 12;
    }
    return [
      { x0: nX + handX, y0: nY + handY, x1: pX - 4.5 * sx, y1: pY - 14, chest: true, column: false },
      { x0: nX + handX, y0: nY + handY, x1: pX - 6 * sx, y1: pY - 12, chest: false, column: false },
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
    const img = image(key, x, y, o.size[0], o.size[0] * aspect, o.color, o.depth, o.blend)
      .setAngle(o.angle ?? 0).setAlpha(rise > 0 ? 0 : o.alpha);
    shots.push({
      image: img, t0: clock, duration: o.duration, size0: o.size[0], size1: o.size[1], grow: o.grow ?? o.duration,
      settle: o.settle ?? 1, aspect, peak: o.alpha, rise, hold: o.hold ?? 0, angle: o.angle ?? 0, spin: o.spin ?? 0,
      ease: o.ease ?? QUAD_O, fadeEase: o.fadeEase ?? QUAD_O, gather: o.gather ?? false,
    });
    return img;
  };
  /** A soft light at the hero's chest whenever something arrives. */
  const tick = () => shot(FX.glow, C.x, C.y, calm
    ? { size: [8, 8], alpha: 0.3, duration: 300, color: Le, depth: TICK, blend: 'screen', rise: 150, fadeEase: SINE_IO }
    : { size: [6, 10], alpha: 0.3, duration: 220, color: Le, depth: TICK, blend: 'screen' });
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
  const at = (time: number, fn: () => void) => cues.push([time, fn]);
  let cueIndex = 0;
  let clock = 0;
  let lastClock = 0;
  let currentLift = 0;
  let hpApplied = false;
  let handedBack = false;
  let done = false;
  let tornDown = false;
  const heroY = () => pY + currentLift;

  // ── Shared tracks (multipliers of the captured state) ───────────────────
  const zoomTrack = new Track(1, calm ? [] : [
    [0, 1195, 1.05, SINE_IO], [1195, 155, 1.07, QUAD_I], [1435, 90, 1.1, EXPO_O], [1525, 175, 1.08, SINE_O], [1700, 780, 1, SINE_IO],
  ]);
  const scaleXTrack = new Track(1, calm ? [] : [
    [300, 800, 0.99, SINE_IO], [1195, 155, 1.05, SINE_I], [1350, 85, 0.96, BACK_O], [1435, 260, 1, BACK_O], [1890, 60, 1.03, QUAD_O], [1950, 200, 1, BACK_O],
  ]);
  const scaleYTrack = new Track(1, calm ? [] : [
    [300, 800, 1.02, SINE_IO], [1195, 155, 0.93, SINE_I], [1350, 85, 1.08, BACK_O], [1435, 260, 1, BACK_O], [1890, 60, 0.965, QUAD_O], [1950, 200, 1, BACK_O],
  ]);
  const liftTrack = new Track(0, calm ? [] : [[1435, 220, -3, BACK_O], [1700, 190, 0, QUAD_I]]);
  const vignetteAlpha = new Track(0, calm
    ? [[0, 1100, 0.3, SINE_IO], [1435, 400, 0.22, SINE_O], [1700, 780, 0, SINE_O]]
    : [[0, 1100, 0.5, SINE_IO], [1195, 150, 0.6, SINE_O], [1435, 200, 0.38, EXPO_O], [1700, 780, 0, SINE_O]]);
  const vignetteGrow = new Track(1, calm ? [] : [[1700, 780, 2.2, CUBIC_O]]);
  const duskAlpha = new Track(0, calm
    ? [[0, 600, 0.16, SINE_O], [1435, 400, 0.1, SINE_O], [1700, 600, 0, SINE_I]]
    : [[0, 600, 0.2, SINE_O], [1195, 150, 0.24, SINE_O], [1435, 200, 0.1, EXPO_O], [1700, 600, 0, SINE_I]]);
  // Weary: the hero drained of colour until the peak gives it back.
  const wearyTrack = new Track(0, calm ? [[0, 600, 1, SINE_IO], [1435, 400, 0, SINE_IO]] : [[0, 400, 1, SINE_IO], [1435, 265, 0, SINE_IO]]);
  const WEARY_END = calm ? 1900 : 1760;
  // Self-light: gain g, climb h (feet to cap) and evening-out e.
  const gainTrack = new Track(0, calm ? [[1435, 200, 0.3, SINE_IO], [1700, 500, 0, SINE_I]] : [[1435, 60, 0.4, QUAD_O], [1700, 60, 0.2, QUAD_O], [1760, 440, 0, SINE_I]]);
  const climbTrack = new Track(calm ? 1 : 0, calm ? [] : [[1435, 265, 1, SINE_IO]]);
  const evenTrack = new Track(calm ? 1 : 0, calm ? [] : [[1700, 200, 1, SINE_IO]]);
  const emberSize = new Track(calm ? 8 : 10, calm ? [] : [[1350, 80, 6, SINE_I], [1435, 160, 16, QUAD_O]]);
  const emberAlpha = new Track(0, calm
    ? [[1350, 150, 0.4, SINE_IO], [1435, 200, 0, SINE_IO]]
    : [[1350, 60, 0.5, QUAD_O], [1410, 20, 0.4, SINE_I], [1435, 20, 0.6, QUAD_O], [1455, 140, 0, QUAD_O]]);
  const bloomWidth = new Track(calm ? 36 : 30, calm ? [] : [[1435, 265, 40, SINE_O], [1700, 650, 46, SINE_O]]);
  const bloomAlpha = new Track(0, calm
    ? [[1435, 200, 0.4, SINE_IO], [1700, 650, 0, SINE_I]]
    : [[1435, 70, 0.55, QUAD_O], [1505, 195, 0.42, SINE_IO], [1700, 80, 0.22, QUAD_O], [1780, 570, 0, SINE_I]]);
  const krysPool: Key[] = npc.npcId !== 'professor' ? [] : calm
    ? [[680, 200, 0.15, SINE_IO], [955, 300, 0.3, SINE_IO]]
    : [[680, 80, 0.18, QUAD_O], [760, 300, 0.1, SINE_I], [955, 80, 0.32, QUAD_O], [1035, 75, 0.26, SINE_I], [1110, 80, 0.36, QUAD_O]];
  const poolAlpha = new Track(0, [...krysPool, ...(calm
    ? [[1350, 150, 0.4, SINE_IO], [1700, 780, 0, SINE_I]] as Key[]
    : [[1195, 155, 0.3, QUAD_I], [1350, 60, 0.4, QUAD_O], [1435, 60, 0.6, QUAD_O], [1700, 80, 0.35, QUAD_O], [1780, 700, 0, SINE_I]] as Key[])]);
  const poolWidth = new Track(calm ? 30 : npc.npcId === 'professor' ? 34 : 36, calm ? [] : [
    [1195, 155, 28, npc.npcId === 'professor' ? EXPO_I : QUAD_I], [1435, 60, 36, QUAD_O],
  ]);
  const labelScale = new Track(calm ? 1 : 0.6, calm ? [] : [[1435, 120, 1.06, BACK_O], [1555, 80, 1, SINE_O]]);
  const labelAlpha = new Track(0, [[1435, calm ? 150 : 60, 1, SINE_IO], [1760, 120, 0, QUAD_I]]);
  const labelLift = new Track(0, calm ? [] : [[1435, 325, -2, SINE_O], [1760, 120, -3.5, QUAD_I]]);

  // ── Objects that live through the whole sequence (created hidden, now) ──
  const view = cam.worldView;
  const M = { x: (nX + C.x) / 2, y: (nY - 13 + C.y) / 2 };
  const vignetteW = view.width * 1.7;
  const vignetteH = view.height * 1.7;
  const vignette = image(BFX.vignette, M.x, M.y, vignetteW, vignetteH, INK, VIG, 'normal').setAlpha(0);
  const dusk = image(FX.shadow, (pX + nX) / 2, (pY + nY) / 2 + 1, adx + 56, Math.abs(dy) + 28, 0x000000, DUSK, 'normal').setAlpha(0);
  const pool = image(FX.glow, pX, pY + 0.5, 36, 12.6, Lp, GROUND, 'screen').setAlpha(0);
  const ember = image(FX.glow, pX, pY - 14, 10, 10, Le, CHEST, 'screen').setAlpha(0);
  const bloom = image(FX.glow, pX, pY - 13, 30, 33, Lb, BLOOM, 'screen').setAlpha(0);
  // The hero's own pixels, added on top: an exposure gain that keeps his shading.
  // Hidden rather than alpha 0, which would clear the render flag the tint never sets again.
  const copy = own(scene.add.image(pX, pY, player.texture.key, player.frame.name)
    .setOrigin(player.originX, player.originY).setScale(s0x, s0y).setBlendMode(Phaser.BlendModes.ADD).setDepth(SELF).setVisible(false));
  const labelStyle = { fontFamily: 'Sora', fontStyle: 'bold', color: '#a6f5c6', stroke: '#0d1a12', strokeThickness: 1.2 };
  // setResolution is relative to the logical board (installHiDpiText); this is WORLD_ZOOM at the 1.10 peak.
  const labelResolution = Math.ceil(WORLD_ZOOM * 1.1) / RENDER_SCALE;
  const plusText = scene.add.text(0, 0, `+${opts.amount}`, { ...labelStyle, fontSize: '6px' }).setResolution(labelResolution);
  const hpText = scene.add.text(0, 0, 'HP', { ...labelStyle, fontSize: '4px' }).setResolution(labelResolution).setAlpha(0.9);
  const labelWidth = plusText.width + 1 + hpText.width;
  // Both baselines on the container's origin.
  plusText.setPosition(-labelWidth / 2, -(0.6 + plusText.getTextMetrics().ascent));
  hpText.setPosition(plusText.x + plusText.width + 1, -(0.6 + hpText.getTextMetrics().ascent));
  const label = own(scene.add.container(pX, pY - 39, [plusText, hpText]).setDepth(LABEL).setVisible(false));

  // ── Payoff and tail-chime placement ─────────────────────────────────────
  const CHIME_T = [1765, 1830, 1970, 2235, 2360];
  const CHIME_X = [6.5, -6.5, 7, -7, 2];
  const CHIME_Y = [-10, -14, -19, -24, -33];
  const CHIME_SIZE = [5, 5, 5.5, 5, 4.5];
  const chimeSide = horizontal ? sx : 1;
  const chimeX = new Float32Array(5);
  for (let i = 0; i < 5; i++) {
    let x = CHIME_X[i] * chimeSide;
    if (!missesNpc(around(pX + x, pY + CHIME_Y[i], 2.75, 2.75))) x = Math.abs(x) * chimeSide;
    if (i > 0 && Math.sign(x) === Math.sign(chimeX[i - 1])) x = 9.5 * Math.sign(x);
    chimeX[i] = x;
  }

  // ── Per-NPC openings ────────────────────────────────────────────────────
  type Opening = { angle(t: number): number; frame(t: number, dt: number): void };
  const opening: Opening = npc.npcId === 'professor' ? krysOpening()
    : npc.npcId === 'guard' ? quincyOpening()
      : kianOpening();

  /** Professor Krys strikes her fork: rings cross the ground, and on the lock he rings with her. */
  function krysOpening(): Opening {
    const o = forkOffset.x < 0 ? -1 : 1;
    // Beyond the tines, which are level with her face: far enough out that the
    // 7-unit strike glint stays off it.
    const gx = o * Math.max(8, Math.abs(forkOffset.x) + 1.2);
    const gy = forkOffset.y + 0.9;
    const G = { x: 0, y: 0 };
    const S = { x: 0, y: 0 };
    const Px = pX;
    const Py = pY + 0.5;
    const reach = clamp(1.05 * gG, 10, 26);
    const payoff = clamp(0.75 * gG, 10, 22);
    const shimmer = image(FX.glow, 0, 0, 3, 3, 0xcfe6ff, INSTR, 'screen').setAlpha(0);
    const shimmerSize = new Track(calm ? 5 : 3, calm ? [] : [[215, 120, 5, QUAD_O]]);
    const shimmerBase = new Track(0, calm
      ? [[215, 200, 0.4, SINE_IO], [1195, 200, 0.15, SINE_IO], [1700, 200, 0, SINE_I]]
      : [[215, 120, 0.4, QUAD_O], [1195, 150, 0.15, QUAD_I], [1700, 200, 0, SINE_I]]);
    const lean = new Track(0, calm ? [] : [
      [0, 200, -3 * sx, SINE_O], [290, 80, 5 * sx, BACK_O], [370, 230, 0, SINE_IO],
      [955, 60, 3 * sx, QUAD_O], [1015, 220, 0, SINE_IO], [1555, 60, 1.5 * sx, QUAD_O], [1615, 200, 0, SINE_IO],
    ]);
    const staffBase = () => onNpc(forkOffset.x, -0.3, S);
    const strike = (size: number) => {
      onNpc(gx, gy, G);
      if (calm) shot(HFX.glint, G.x, G.y, { size: [4, 4], alpha: 0.6, duration: 300, color: 0xfff4dc, depth: AIR, blend: 'add', rise: 150 });
      else shot(HFX.glint, G.x, G.y, { size: [size, size], alpha: 0.9, duration: 200, color: 0xfff4dc, depth: AIR, blend: 'add', spin: 20 });
    };
    const still = (x: number, y: number, rx: number, alpha: number, duration: number, color: number, depth: number, blend: Blend) =>
      shot(HFX.ring, x, y, { size: [2 * rx, 2 * rx], aspect: 0.36, alpha, duration, color, depth, blend, rise: duration / 2, fadeEase: SINE_IO });

    if (calm) {
      at(300, () => {
        strike(4);
        still(staffBase().x, S.y, 10, 0.5, 400, Lp, RIPPLE, 'screen');
      });
      at(955, () => {
        still(staffBase().x, S.y, 10, 0.5, 400, Lp, RIPPLE, 'screen');
        still(Px, Py, 8, 0.4, 400, Lp, RIPPLE, 'screen');
        tick();
      });
      at(1435, () => {
        const r = Math.min(14, payoff);
        still(Px, Py, r * 0.86, 0.16, 600, INK, TROUGH, 'normal');
        still(Px, Py, r, 0.45, 600, Lr, RIPPLE, 'screen');
      });
    } else {
      at(300, () => {
        strike(7);
        ring(staffBase().x, S.y, 2, reach, 0.5, 600, Lp, true);
      });
      at(595, () => ring(staffBase().x, S.y, 2, reach, 0.5, 600, Lp, true));
      // The lock: her ring and his first own ring start on the same frame.
      at(955, () => {
        ring(staffBase().x, S.y, 2, reach, 0.5, 600, Lp, true);
        ring(Px, Py, 2, 9, 0.4, 600, Lp, true);
        strike(6);
        tick();
      });
      at(1110, () => ring(Px, Py, 2, 9, 0.35, 600, Lp, true));
      // Pressure wave: a bright crest with a dark trough just inside it. It fades as it
      // slows, so it never sits around his feet like a selection ring.
      at(1435, () => {
        shot(HFX.ring, Px, Py, { size: [12 * 0.86, 2 * payoff * 0.86], aspect: 0.36, alpha: 0.22, duration: 620, color: INK, depth: TROUGH, blend: 'normal', rise: 40, ease: CUBIC_O, fadeEase: QUAD_O });
        shot(HFX.ring, Px, Py, { size: [12, 2 * payoff], aspect: 0.36, alpha: 0.6, duration: 620, color: Lr, depth: RIPPLE, blend: 'screen', rise: 40, ease: CUBIC_O, fadeEase: QUAD_O });
      });
      at(2030, () => ring(staffBase().x, S.y, 2, 9, 0.3, 600, Lp));
    }

    return {
      angle: t => (t >= 1900 ? 0 : lean.at(t)),
      frame(t) {
        if (t < 215 || t >= 1900) {
          if (shimmer.visible && t >= 1900) shimmer.setVisible(false);
          return;
        }
        onNpc(gx, gy, G);
        let a = shimmerBase.at(t);
        if (!calm) {
          if (t >= 300 && t < 1195) a += 0.06 * Math.sin((2 * Math.PI * 1.5 * (t - 300)) / 1000);
          a += pulse(t, 955, 0.25, 80, 300) + pulse(t, 1110, 0.15, 80, 250);
          const answers = (t >= 1555 ? Math.exp(-(t - 1555) / 140) : 0) + (t >= 1675 ? Math.exp(-(t - 1675) / 140) : 0);
          a += 0.3 * answers * (1 - progress(t, 1700, 200));
        }
        const size = shimmerSize.at(t);
        shimmer.setPosition(G.x, G.y).setDisplaySize(size, size).setAlpha(clamp01(a));
      },
    };
  }

  /** Quincy spins a painted record; soft fronts travel to the hero, worn at first, then clean. */
  function quincyOpening(): Opening {
    // Leaves a full disc (radius 6) half a unit short of the hero's body.
    const rOff = clamp(adx - 11.2, 3, 8.5);
    const candidates = routes(sx * rOff, -11, 7.5 * s, -11, 7.5 * s);
    const frontFits = (r: Route) => {
      const len = routeLength(r);
      const fx = (r.x1 - r.x0) / len;
      const fy = (r.y1 - r.y0) / len;
      const end = len - (r.chest ? 5 : 3);
      // The largest front (the third) decides; its tips are where the taper falls to a quarter.
      const h0 = r.column ? 6 : 7;
      const h1 = r.column ? 9 : 14;
      for (let k = 1; k <= 10; k++) {
        const d = lerp(4, end, k / 10);
        const cx = r.x0 + fx * d;
        const cy = r.y0 + fy * d;
        const tip = 0.355 * lerp(h0, h1, k / 10);
        if (!clearOfFaces(cx, cy, 1, true)) return false;
        if (!clearOfFaces(cx - fy * tip, cy + fx * tip, 0, false) || !clearOfFaces(cx + fy * tip, cy - fx * tip, 0, false)) return false;
      }
      return true;
    };
    const fitting = candidates.find(frontFits);
    const route = fitting ?? candidates[0];
    const dist = routeLength(route);
    const dirX = (route.x1 - route.x0) / dist;
    const dirY = (route.y1 - route.y0) / dist;
    const travel = dist - (route.chest ? 5 : 3) - 4;
    const close = !fitting || dist < 8 || travel < 4;
    const recordX = route.x0 - nX;
    const recordY = route.y0 - nY;
    const R = { x: route.x0, y: route.y0 };
    // Up close the record shrinks (to 45 % at most) rather than cover the hero.
    let recordSize = 1;
    while (recordSize > 0.45 && overlaps(around(R.x, R.y, 6 * recordSize, 2.6 * recordSize), bodyH)) recordSize -= 0.05;

    const vinyl = scene.add.image(0, 0, HFX.vinyl).setDisplaySize(12, 12);
    const sheen = scene.add.image(0, 0, HFX.vinylSheen).setDisplaySize(12, 12).setBlendMode(Phaser.BlendModes.SCREEN).setAlpha(0.5);
    // Blend -1 on the container lets each child keep its own blend.
    const record = own(scene.add.container(R.x, R.y, [vinyl, sheen]).setDepth(INSTR).setVisible(false));
    const spin = new Track(calm ? 0.4 : 0, calm ? [] : [[215, 300, 0.75, QUAD_O], [955, 150, 1.2, QUAD_O], [1110, 150, 1.8, QUAD_O], [1350, 300, 0, QUAD_O]]);
    const lean = new Track(0, calm ? [] : [[0, 220, 3 * sx, SINE_O], [1195, 155, 4 * sx, SINE_I], [1350, 250, 0, SINE_IO]]);
    const BOBS = [300, 595, 955, 1110, 1555, 1675];

    const FRONT_T = [300, 680, 955];
    const FRONT_PEAK = [0.45, 0.55, 0.75];
    const FRONT_H0 = route.column ? [5, 5, 6] : [6, 6, 7];
    const FRONT_H1 = route.column ? [8, 8, 9] : [12, 12, 14];
    const FRONT_LIFE = calm ? 420 : 395;
    const fronts = [0, 1, 2].map(() => image(HFX.crescent, R.x, R.y, 3, 6, CREAM, AIR, 'screen').setOrigin(0.75, 0.5).setVisible(false));
    const frontAngle = Phaser.Math.RadToDeg(Math.atan2(dirY, dirX));

    for (let j = 0; j < 3; j++) {
      at(FRONT_T[j], () => fronts[j].setTexture(j === 0 ? HFX.crescentWorn : HFX.crescent).setAngle(frontAngle).setAlpha(0).setVisible(true));
    }
    at(FRONT_T[0] + 395, tick);
    at(FRONT_T[1] + 395, tick);
    at(40, () => record.setVisible(true));
    at(215, () => {
      const rimX = route.column ? 0 : 5.2 * recordSize * Math.sign(route.x1 - route.x0 || sx);
      const rimY = route.column ? 2.2 * recordSize * Math.sign(route.y1 - route.y0 || 1) : -0.3;
      if (calm) shot(HFX.glint, R.x + rimX, R.y + rimY, { size: [5, 5], alpha: 0.6, duration: 300, color: CREAM, depth: AIR, blend: 'add', rise: 150 });
      else shot(HFX.glint, R.x + rimX, R.y + rimY, { size: [5, 5], alpha: 0.8, duration: 120, color: CREAM, depth: AIR, blend: 'add' });
    });
    at(calm ? 1700 : 1650, () => record.setVisible(false));

    // Payoff: twin crescents burst from his chest, ( hero ), behind him. The far one always.
    const farR = adx < 6 ? 17 : clamp(0.7 * adx, 11, 17);
    // Ends 11.5 short of Quincy: half a crescent (4.5) plus his body (6) plus a margin.
    const nearR = calm ? 10 : horizontal ? Math.min(farR, Math.max(6.5, adx - 11.5)) : farR;
    const keepNear = missesNpc([pX - nearR * sx - 4.5, pY - 3 - 14 - 6.5, pX - nearR * sx + 4.5, pY - 14 + 6.5]);
    const payR = [calm ? 10 : farR, nearR];
    const paySide = [sx, -sx];
    at(1435, () => {
      for (let j = 0; j < 2; j++) {
        fronts[j].setTexture(HFX.crescent).setTint(0xffc695).setDepth(ARCS).setAngle(paySide[j] > 0 ? 0 : 180)
          .setAlpha(0).setVisible(j === 0 || keepNear);
      }
      fronts[2].setVisible(false);
    });
    at(calm ? 1935 : 1955, () => {
      fronts[0].setVisible(false);
      fronts[1].setVisible(false);
    });

    return {
      angle(t) {
        if (calm) return 0;
        // The last breath is a nod after everything else has settled.
        if (t >= 1900) return -2.5 * sx * pulse(t, 2030, 1, 100, 150);
        let a = lean.at(t);
        for (let i = 0; i < BOBS.length; i++) a -= 2.5 * sx * pulse(t, BOBS[i], 1, 80, 80);
        return a;
      },
      frame(t, dt) {
        if (record.visible) {
          onNpc(recordX, recordY, R);
          const appear = calm ? 1 : BACK_O(progress(t, 40, 200));
          const fadeIn = calm ? SINE_IO(progress(t, 40, 200)) : clamp01(appear);
          const tuck = calm ? 1 : 1 - QUAD_I(progress(t, 1500, 150));
          const fadeOut = calm ? 1 - SINE_IO(progress(t, 1500, 200)) : tuck;
          const scale = Math.max(0.001, appear * tuck * recordSize);
          const rise = calm ? 0 : 2 * (1 - QUAD_O(progress(t, 40, 200)));
          record.setPosition(R.x, R.y + rise).setScale(scale, 0.42 * scale).setAngle(-6 * sx + npc.angle).setAlpha(fadeIn * fadeOut);
          vinyl.angle += (360 * spin.at(t) * dt) / 1000;
        }
        if (t < 1435) {
          for (let j = 0; j < 3; j++) {
            const front = fronts[j];
            if (!front.visible) continue;
            const age = t - FRONT_T[j];
            if (age >= FRONT_LIFE) {
              front.setVisible(false);
              continue;
            }
            const tau = age / 395;
            let d: number;
            let h: number;
            let alpha: number;
            if (calm) {
              d = close ? 2 : 4 + travel * 0.5;
              h = 0.5 * (FRONT_H0[j] + FRONT_H1[j]);
              alpha = age < 120 ? age / 120 : age < 270 ? 1 : 1 - (age - 270) / 150;
            } else {
              d = close ? 2 : 4 + travel * tau;
              h = close ? FRONT_H0[j] * lerp(1, 1.4, tau) : lerp(FRONT_H0[j], FRONT_H1[j], tau);
              alpha = tau < 0.15 ? tau / 0.15 : tau > 0.7 ? (1 - tau) / 0.3 : 1;
            }
            front.setPosition(route.x0 + dirX * d, route.y0 + dirY * d).setDisplaySize(0.5 * h, h)
              .setAlpha(FRONT_PEAK[j] * clamp01(alpha)).setTint(lerpColor(CREAM, 0xff9a5a, calm ? 0.5 : tau));
          }
        } else if (t < 1955) {
          const k = progress(t, 1435, 520);
          const age = t - 1435;
          const r = calm ? 0 : CUBIC_O(k);
          const h = calm ? 15 : lerp(12, 18, r);
          const alpha = calm ? 0.5 * (age < 250 ? SINE_IO(age / 250) : 1 - SINE_IO(clamp01((age - 250) / 250)))
            : 0.6 * (age < 40 ? age / 40 : 1 - QUAD_I(clamp01((age - 40) / 480)));
          const y = heroY() - 14;
          for (let j = 0; j < 2; j++) {
            if (!fronts[j].visible) continue;
            const rr = calm ? payR[j] : lerp(6, payR[j], r);
            fronts[j].setPosition(pX + paySide[j] * rr, y).setDisplaySize(0.5 * h, h).setAlpha(alpha);
          }
        }
      },
    };
  }

  /** Kian plucks one string of light from his hand to the hero; his notes ride along it. */
  function kianOpening(): Opening {
    const candidates = routes(4 * sx, -12, 7 * s, -13, 7 * s);
    const fitting = candidates.find(r => pathClear(r.x0, r.y0, r.x1, r.y1, 0.5));
    let route = fitting ?? candidates[0];
    if (!fitting) {
      // Shorten the front route to where it would first touch a face.
      const first = candidates[0];
      let k = 0;
      while (k < 1 && clearOfFaces(lerp(first.x0, first.x1, k + 0.02), lerp(first.y0, first.y1, k + 0.02), 0.5, false)) k += 0.02;
      route = { ...first, x1: lerp(first.x0, first.x1, k), y1: lerp(first.y0, first.y1, k) };
    }
    const handX = route.x0 - nX;
    const handY = route.y0 - nY;
    const Ex = route.x1;
    const Ey = route.y1;
    const L0 = routeLength(route);
    const hasString = L0 >= 2;
    const vx0 = (Ex - route.x0) / (L0 || 1);
    const vy0 = (Ey - route.y0) / (L0 || 1);
    // Notes ride above the string by default (outside it on the column), else on the other side, else not at all.
    let nUx = route.column ? s : -vy0;
    let nUy = route.column ? 0 : vx0;
    if (!route.column && nUy > 0) {
      nUx = -nUx;
      nUy = -nUy;
    }
    const notePath = (t: number, side: number, out: Point, hx: number, hy: number, vx: number, vy: number, L: number) => {
      const d = lerp(3, 0.7 * L, SINE_IO(t));
      const bump = 3.5 + 1.2 * Math.sin(Math.PI * t);
      out.x = hx + vx * d + nUx * side * bump;
      out.y = hy + vy * d + nUy * side * bump;
      return out;
    };
    const probe = { x: 0, y: 0 };
    const sideFits = (side: number) => {
      for (let k = 1; k <= 10; k++) {
        notePath(k / 10, side, probe, route.x0, route.y0, vx0, vy0, L0);
        if (!clearOfFaces(probe.x, probe.y, 2.5, false)) return false;
      }
      return true;
    };
    const noteSide = !hasString ? 0 : sideFits(1) ? 1 : sideFits(-1) ? -1 : 0;

    const H = { x: route.x0, y: route.y0 };
    const P = { x: 0, y: 0 };
    const line = image(HFX.line, H.x, H.y, 1, 2, WARM, AIR, 'screen').setOrigin(0, 0.5).setVisible(false);
    const lens = image(HFX.lens1, H.x, H.y, 1, 1, GOLD, AIR - EPS, 'screen').setOrigin(0, 0.5).setVisible(false);
    const hand = image(FX.glow, H.x, H.y, 3.5, 3.5, WARM, AIR, 'screen').setVisible(false);
    const notes = [HFX.note1, HFX.note2, HFX.note1].map((key, j) =>
      image(key, H.x, H.y, 5.8, 7, j === 1 ? 0xffe2a0 : GOLD, NOTES, 'normal').setVisible(false));
    const PLUCK_T = [215, 300, 595, 955, 1110];
    const PLUCK_A = [1.2, 2.2, 1.6, 2.4, 2.6];
    const KICK_T = [215, 300, 955, 1110, 1555, 1675];
    const NOTE_T = [300, 595, 955];
    const NOTE_LIFE = [480, 480, 360];

    at(40, () => {
      hand.setVisible(true);
      if (hasString) {
        line.setVisible(true);
        lens.setVisible(true);
      }
    });
    at(1350, () => {
      line.setVisible(false);
      lens.setVisible(false);
      hand.setVisible(false);
    });
    if (noteSide !== 0) {
      for (let j = 0; j < 3; j++) at(NOTE_T[j], () => notes[j].setVisible(true));
    }
    at(300, tick);
    at(955, tick);
    // Reduced motion keeps pulses at least 295 ms apart.
    if (!calm) at(1110, tick);

    // Payoff: two painted notes bloom off his shoulders; one far note when the near side is crowded.
    const nearOff = calm ? 10 : horizontal ? Math.min(11, Math.max(7, adx - 11)) : 11;
    const keepNear = missesNpc(around(pX - nearOff * sx, pY - (calm ? 24 : 26.5), 2.9, calm ? 3.5 : 5));
    // [frame index, side, end x offset]
    const payNote = keepNear ? [0, 1] : [1];
    const paySide = keepNear ? [sx, -sx] : [sx];
    const payEnd = keepNear ? [calm ? 10 : 11, nearOff] : [calm ? 10 : 11];
    at(1435, () => {
      for (let j = 0; j < 3; j++) notes[j].setVisible(false);
      for (let j = 0; j < payNote.length; j++) {
        notes[payNote[j]].setTint(payNote[j] === 1 ? 0xffe2a0 : GOLD).setAlpha(0).setVisible(true);
      }
    });
    at(2100, () => {
      notes[0].setVisible(false);
      notes[1].setVisible(false);
    });
    const lastFrom = { x: 0, y: 0 };
    if (!calm) {
      at(2030, () => {
        onNpc(handX, handY, lastFrom);
        notes[2].setTint(GOLD).setAngle(0).setAlpha(0).setVisible(true);
      });
      at(2730, () => notes[2].setVisible(false));
    }

    return {
      angle(t) {
        if (calm || t >= 1900) return 0;
        let a = 2.5 * Math.sin((2 * Math.PI * t) / 600) * (1 - progress(t, 1350, 200));
        for (let i = 0; i < KICK_T.length; i++) if (t >= KICK_T[i]) a += 4 * sx * Math.exp(-(t - KICK_T[i]) / 90);
        return a * (1 - progress(t, 1750, 150));
      },
      frame(t) {
        if (t >= 40 && t < 1350) {
          onNpc(handX, handY, H);
          const vx = Ex - H.x;
          const vy = Ey - H.y;
          const L = Math.hypot(vx, vy) || 1;
          let last = -1;
          for (let i = 0; i < PLUCK_T.length; i++) if (t >= PLUCK_T[i]) last = i;
          const since = last < 0 ? 1e6 : t - PLUCK_T[last];
          const tremolo = !calm && t >= 1195 && t < 1265;
          const fade = calm ? SINE_IO(progress(t, 40, 200)) * (1 - SINE_IO(progress(t, 1195, 155))) : 1;
          const grow = calm ? 1 : EXPO_O(progress(t, 40, 180));
          const slide = calm ? 0 : EXPO_I(progress(t, 1265, 85));
          const x0 = H.x + vx * slide;
          const y0 = H.y + vy * slide;
          const len = Math.max(0.01, L * (grow - slide));
          let pluckGlow = 0;
          if (calm) {
            pluckGlow = pulse(t, 300, 0.2, 150, 300) + pulse(t, 595, 0.2, 150, 300) + pulse(t, 955, 0.2, 150, 300);
          } else if (last >= 0) {
            pluckGlow = Math.exp(-since / 150);
          }
          hand.setPosition(x0, y0).setAlpha((calm ? 0.6 : tremolo ? 0.9 : 0.6 + 0.3 * pluckGlow) * fade);
          if (hasString) {
            const angle = Math.atan2(vy, vx);
            line.setPosition(x0, y0).setRotation(angle).setDisplaySize(len, 2).setAlpha((tremolo ? 0.95 : 0.85) * fade);
            const amp = calm ? 0.5 : tremolo ? 1.8 : last < 0 ? 0 : PLUCK_A[last] * Math.exp(-since / 260);
            const lensAlpha = calm ? 0.4 + pluckGlow : tremolo ? 0.75 : (0.35 + 0.45 * Math.min(1, amp / 2.4)) * smoothstep(0.2, 0.4, amp);
            const lensKey = !calm && last === 3 && !tremolo ? HFX.lens2 : HFX.lens1;
            if (lens.texture.key !== lensKey) lens.setTexture(lensKey);
            lens.setPosition(x0, y0).setRotation(angle).setDisplaySize(len, (2 * amp + 0.3) / 0.8).setAlpha(lensAlpha * fade);
          }
          if (noteSide !== 0) {
            for (let j = 0; j < 3; j++) {
              const note = notes[j];
              if (!note.visible) continue;
              const age = t - NOTE_T[j];
              const life = NOTE_LIFE[j];
              if (age >= life) {
                note.setVisible(false);
                continue;
              }
              const tau = age / life;
              if (calm) {
                const a = age < 150 ? SINE_IO(age / 150) : age > life - 150 ? SINE_IO((life - age) / 150) : 1;
                note.setPosition(H.x + 0.5 * vx + nUx * noteSide * 3.5, H.y + 0.5 * vy + nUy * noteSide * 3.5)
                  .setDisplaySize(5.8, 7).setAngle(0).setAlpha(a);
              } else {
                notePath(tau, noteSide, P, H.x, H.y, vx / L, vy / L, L);
                const out = tau > 0.75 ? (tau - 0.75) / 0.25 : 0;
                const scale = lerp(0.5, 1, BACK_O(Math.min(1, age / 160))) * lerp(1, 0.8, out);
                note.setPosition(P.x, P.y).setDisplaySize(5.8 * scale, 7 * scale).setAngle(lerp(-8, 8, tau))
                  .setAlpha(Math.min(1, age / 80) * (1 - out));
              }
            }
          }
        }
        if (t >= 1435 && t < 2100) {
          const age = t - 1435;
          const k = calm ? 0 : SINE_O(progress(t, 1435, 700));
          const alpha = calm
            ? SINE_IO(clamp01(age / 150)) * (1 - SINE_IO(progress(t, 1900, 200)))
            : 0.95 * Math.min(1, age / 80) * (1 - SINE_I(progress(t, 1850, 250)));
          const scale = calm ? 1 : lerp(0.6, 1, BACK_O(Math.min(1, age / 160)));
          for (let j = 0; j < payNote.length; j++) {
            const note = notes[payNote[j]];
            const side = paySide[j];
            const x = calm ? pX + side * 10 : pX + side * lerp(7, payEnd[j], k);
            const y = calm ? pY - 24 : heroY() - lerp(18, 25, k);
            note.setPosition(x, y).setDisplaySize(5.8 * scale, 7 * scale).setAngle(calm ? 0 : -side * lerp(10, 4, k)).setAlpha(alpha);
          }
        }
        if (!calm && t >= 2030 && t < 2730) {
          const k = progress(t, 2030, 700);
          notes[2].setPosition(lastFrom.x, lastFrom.y - 9 * SINE_O(k)).setDisplaySize(4.97, 6)
            .setAlpha(0.7 * Math.min(1, (t - 2030) / 80) * (1 - SINE_O(k)));
        }
      },
    };
  }

  // ── Cues shared by every healer ─────────────────────────────────────────
  at(1350, () => {
    player.faceToward(pX, pY + 10);
    opts.syncHeroShadow();
    copy.setTint(0).setVisible(true);
  });
  at(1435, () => {
    hpApplied = true;
    opts.onRestoreHp();
    label.setVisible(true);
  });
  if (!calm) at(1675, () => glint(pX + 1.5, heroY() - 27.5, 6, 0.85, WARM, TICK, 180, 0, 0.8));
  at(WEARY_END, releaseWeary);
  const chimes = calm ? [0, 2, 4] : [0, 1, 2, 3, 4];
  const CHIME_CALM_T = [1765, 2030, 2360];
  for (let n = 0; n < chimes.length; n++) {
    const i = chimes[n];
    at(calm ? CHIME_CALM_T[n] : CHIME_T[i], () => {
      glint(pX + chimeX[i], pY + CHIME_Y[i], CHIME_SIZE[i], 0.9, lerpColor(Le, WARM, i / 4), AIR, 230, 30, 0.85);
    });
  }
  at(1600, () => ember.setVisible(false));
  at(1880, () => label.setVisible(false));
  at(1890, () => {
    restoreShadow();
    opts.onNotice();
  });
  at(2200, () => copy.setVisible(false));
  at(2350, () => {
    player.faceToward(nX, nY);
    opts.syncHeroShadow();
    bloom.setVisible(false);
  });
  at(HAND_BACK, handBack);
  at(DIALOG, () => {
    done = true;
    opts.onDone();
  });
  cues.sort((a, b) => a[0] - b[0]);

  // ── Hero colour: a ColorMatrix pre-FX where available, else a tint ──────
  // With disablePreFX (iOS) sprites still have a preFX component but there is no
  // FX pipeline: adding an effect would leave the hero without any pipeline.
  const fxPipeline = 'pipelines' in scene.renderer ? scene.renderer.pipelines.FX_PIPELINE : undefined;
  let colorMatrix: Phaser.FX.ColorMatrix | undefined;
  let wearyOn = true;
  if (fxPipeline && player.preFX) {
    colorMatrix = player.preFX.addColorMatrix();
    colorMatrix.saturate(-0.6);
    colorMatrix.brightness(0.88, true);
    colorMatrix.alpha = 0;
  }

  /** Back to the plain sprite: off the FX pipeline (not just an empty list), or the tint cleared. */
  function releaseWeary() {
    if (!wearyOn) return;
    wearyOn = false;
    if (colorMatrix) {
      colorMatrix = undefined;
      player.preFX?.disable(true);
    } else {
      player.clearTint();
    }
  }

  function restoreShadow() {
    if (!shadow || !shadowState) return;
    shadow.setPosition(shadowState.x, shadowState.y).setDisplaySize(shadowState.w, shadowState.h).setAlpha(shadowState.a);
  }

  /** Everything bound to the hero, the healer or the camera goes back to exactly how it was. */
  function handBack() {
    if (handedBack) return;
    handedBack = true;
    currentLift = 0;
    releaseWeary();
    player.setScale(s0x, s0y).setY(pY).setDepth(hD);
    player.unfreeze();
    restoreShadow();
    opts.syncHeroShadow();
    npc.setAngle(0);
    cam.setZoom(zoom0);
    cam.startFollow(player, true, 1, 1);
    drop(vignette);
    drop(dusk);
    copy.setVisible(false);
    bloom.setVisible(false);
    pool.setVisible(false);
  }

  // ── Per-frame update ────────────────────────────────────────────────────
  function frame(t: number, dt: number) {
    while (cueIndex < cues.length && cues[cueIndex][0] <= t) cues[cueIndex++][1]();
    if (tornDown) return;

    if (!handedBack) {
      currentLift = liftTrack.at(t);
      player.setScale(s0x * scaleXTrack.at(t), s0y * scaleYTrack.at(t)).setY(pY + currentLift);
      if (wearyOn) {
        const mix = wearyTrack.at(t);
        if (colorMatrix) colorMatrix.alpha = mix;
        else player.setTint(lerpColor(0xffffff, 0xb4b9c4, mix));
      }
      if (!calm && shadow && shadowState && t < 1890) {
        const f = clamp01(-currentLift / 3);
        shadow.setDisplaySize(lerp(shadowState.w, (shadowState.w * 13) / 16, f), lerp(shadowState.h, (shadowState.h * 4.6) / 5.6, f))
          .setAlpha(lerp(shadowState.a, 0.32, f));
      }
      npc.setAngle(opening.angle(t));
      cam.setZoom(zoom0 * zoomTrack.at(t));
      const grow = vignetteGrow.at(t);
      vignette.setAlpha(vignetteAlpha.at(t)).setDisplaySize(vignetteW * grow, vignetteH * grow);
      dusk.setAlpha(duskAlpha.at(t));
      const w = poolWidth.at(t);
      pool.setDisplaySize(w, 0.35 * w).setAlpha(poolAlpha.at(t));
    }

    opening.frame(t, dt);

    if (ember.visible && t >= 1350) {
      const size = emberSize.at(t);
      ember.setPosition(pX, heroY() - 14).setDisplaySize(size, size).setAlpha(emberAlpha.at(t));
    }
    if (bloom.visible && t >= 1435) {
      const w = bloomWidth.at(t);
      bloom.setPosition(pX, heroY() - 13).setDisplaySize(w, calm ? 40 : 1.1 * w).setAlpha(bloomAlpha.at(t));
    }
    if (copy.visible) {
      if (copy.texture.key !== player.texture.key || copy.frame.name !== player.frame.name) copy.setTexture(player.texture.key, player.frame.name);
      copy.setPosition(player.x, player.y).setScale(player.scaleX, player.scaleY).setFlipX(player.flipX);
      const g = gainTrack.at(t);
      const h = climbTrack.at(t);
      const e = evenTrack.at(t);
      const col = lerpColor(Lc, WARM, e);
      const top = scaleColor(col, g * lerp(0.8 * h, 0.7, e));
      const bottom = scaleColor(col, g * lerp(1 - 0.6 * h, 0.7, e));
      copy.setTint(top, top, bottom, bottom);
    }
    if (label.visible) {
      label.setScale(labelScale.at(t)).setY(pY - 39 + labelLift.at(t)).setAlpha(labelAlpha.at(t));
    }

    for (let i = shots.length - 1; i >= 0; i--) {
      const sh = shots[i];
      const age = t - sh.t0;
      const k = clamp01(age / sh.duration);
      const size = age < sh.grow ? lerp(sh.size0, sh.size1, sh.ease(age / sh.grow))
        : lerp(sh.size1, sh.size1 * sh.settle, clamp01((age - sh.grow) / Math.max(1, sh.duration - sh.grow)));
      let alpha = sh.peak;
      if (age < sh.rise) alpha *= age / sh.rise;
      else alpha *= 1 - sh.fadeEase(clamp01((age - sh.rise - sh.hold) / Math.max(1, sh.duration - sh.rise - sh.hold)));
      if (sh.gather) alpha *= 1 - QUAD_I(progress(t, 1195, 155));
      sh.image.setDisplaySize(size, size * sh.aspect).setAlpha(alpha);
      if (sh.spin) sh.image.setAngle(sh.angle + sh.spin * QUAD_O(k));
      if (k >= 1 || (sh.gather && t >= 1350)) {
        drop(sh.image);
        shots.splice(i, 1);
      }
    }
  }

  // ── Teardown ────────────────────────────────────────────────────────────
  function teardown() {
    if (tornDown) return;
    // The sound already promised the heal.
    if (!hpApplied) {
      hpApplied = true;
      opts.onRestoreHp();
    }
    // On scene shutdown the display list has already destroyed hero and NPC.
    if (player.scene) handBack();
    else {
      handedBack = true;
      wearyOn = false;
      colorMatrix = undefined;
    }
    tornDown = true;
    master.stop();
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, teardown);
    [...owned].forEach(obj => obj.destroy());
    owned.clear();
    shots.length = 0;
  }

  // ── Start ───────────────────────────────────────────────────────────────
  player.freeze();
  cam.stopFollow();
  opts.onSound();
  const master = scene.tweens.addCounter({
    from: 0,
    to: LENGTH,
    duration: LENGTH,
    delay: HEAL_AV_OFFSET_MS,
    onUpdate: tween => {
      const t = tween.getValue() ?? 0;
      clock = t;
      const dt = Math.max(0, t - lastClock);
      lastClock = t;
      frame(t, dt);
    },
    onComplete: () => teardown(),
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, teardown);
  frame(0, 0);

  return {
    get busy() { return !done && !tornDown; },
    destroy: teardown,
  };
}
