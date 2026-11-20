import { FX } from '../../art/fx';
import { HFX } from '../../art/healFx';
import { HFX_QUINCY, QUINCY_ARC } from '../../art/healFxQuincy';
import {
  BACK_O, CREAM, CUBIC_O, EPS, EXPO_I, EXPO_O, ONSETS, QUAD_I, QUAD_O, SINE_I, SINE_IO, SINE_O, Track,
  clamp01, lerp, lerpColor, progress, pulse,
  type Ease, type HealKit, type Opening, type Point, type ShotOptions,
} from './kit';

type ArcKind = keyof typeof QUINCY_ARC;
type ArcOptions = Pick<ShotOptions, 'alpha' | 'duration' | 'color' | 'rise' | 'hold' | 'spin' | 'ease' | 'fadeEase' | 'gather'>;

const LINEAR: Ease = v => v;
const DEG = 180 / Math.PI;
const TAU = Math.PI * 2;

/**
 * Quincy spins a record, and the record is light only. A glint at his hand sets a platter of light turning
 * over his head, a needle spark tracking inward, and the onsets send amber crescent fronts down across the
 * hero. On the gather's last onset the platter swoops behind the hero and winds tight; on the peak it bursts,
 * three thick crescents fly off it still turning and the rim flings sparks along its spin. Then it re-forms
 * as a halo behind the hero that slows to a stop like a turntable switched off, and a last groove leaves upward.
 *
 * Depth: the platter and everything it sheds is drawn behind both characters (BACK). What is drawn in front
 * (the glint at his hand, sparks at AIR) is checked clear of both faces first.
 */
export function quincyOpening(kit: HealKit): Opening {
  const {
    calm, lite, nX, nY, adx, sx, s, horizontal, facing, heroK, npcK, view, pal, Lp, T, BACK, AIR,
    onNpc, onHero, headN, clearOfFaces, image, shot, tick, at, particle, level, rnd,
  } = kit;
  const k = npcK;

  // ── His hand, where the needle drops: measured on his standing frames (27-unit sprite, from his feet) ──
  const HAND = { right: [0.7, -10.4], left: [-0.7, -10.4], up: [4.9 * s, -10.1], down: [4.8 * s, -9.9] } as const;
  const R: Point = { x: 0, y: 0 };
  const hand = () => onNpc(HAND[facing][0] * k, HAND[facing][1] * k, R);
  hand();
  const lean = new Track(0, calm ? [] : [[0, 500, 1.5 * sx, SINE_IO], [1435, 500, 0, SINE_IO]]);

  // ── The platter of light ────────────────────────────────────────────────
  // Side by side it stands over his head, a little toward the hero: its rim stays clear above his face at every
  // radius. Stacked, or with too little room under the view's top edge (the zoom push takes 10 more), it stands
  // beside him at chest height, away from the hero.
  const room = (headN[1] - view.top - 23) / 2;
  const overhead = horizontal && room >= 16;
  const rScale = overhead ? Math.min(1, room / 32) : 1;
  const D: Point = { x: R.x, y: R.y };
  const F: Point = { x: 0, y: 0 };
  const Ch: Point = { x: 0, y: 0 };
  const chest = () => onHero(0, -14, Ch);
  const GLIDE = calm ? 1000 : 1195;
  const GLIDE_MS = calm ? 435 : 155;
  /** Its seat for radius r, then (from GLIDE) across to behind the hero's chest. */
  const platterAt = (t: number, r: number, out: Point) => {
    chest();
    const g = SINE_IO(progress(t, GLIDE, GLIDE_MS));
    const float = calm ? 0 : 0.8 * Math.sin((t - 215) / 260) * (1 - g);
    const x = overhead ? nX + 4 * sx * k : nX - s * (r + 6 * k + 2);
    const y = overhead ? headN[1] - 3 - r : nY - 16 * k;
    out.x = lerp(x, Ch.x, g);
    out.y = lerp(y + float, Ch.y, g);
    return out;
  };
  // A warm body of light under the grooves, so the platter reads as a disc on any ground.
  const aura = image(FX.glow, D.x, D.y, 1, 1, pal.deep, BACK - EPS, 'screen').setVisible(false);
  const disc = image(HFX_QUINCY.disc, D.x, D.y, 1, 1, pal.glow, BACK, 'add').setVisible(false);
  const gloss = image(HFX_QUINCY.sheen, D.x, D.y, 1, 1, CREAM, BACK + EPS, 'screen').setVisible(false);
  const rim = image(HFX.halo, D.x, D.y, 1, 1, pal.spark, BACK + 2 * EPS, 'add').setVisible(false);
  // The groove lit behind the needle; flipped so its tail runs clockwise, the way the platter turns.
  const trail = image(HFX.swirl, D.x, D.y, 1, 1, pal.spark, BACK + 3 * EPS, 'add').setFlipY(true).setVisible(false);
  const needle = image(HFX.spark, D.x, D.y, 1, 1, pal.core, BACK + 4 * EPS, 'add').setVisible(false);
  const ARC_DEPTH = BACK + 5 * EPS;
  const SPARK_BACK = BACK + 6 * EPS;
  // Upper rim on the far side from the hero.
  const NEEDLE_ANGLE = s > 0 ? -150 : -30;
  const PULSES = [300, 595, 680, 955, 1110];

  const platterR = new Track(4, calm
    ? [[215, 900, 26, SINE_O], [GLIDE, GLIDE_MS, 18, SINE_IO]]
    : [[215, 280, 15, BACK_O], [300, 220, 18, BACK_O], [595, 220, 21.5, BACK_O], [680, 220, 25, BACK_O], [955, 240, 29, BACK_O],
      [1110, 200, 32, BACK_O], [1195, 155, 21, SINE_IO], [1350, 85, 11, EXPO_I]]);
  const platterA = new Track(0, calm
    ? [[215, 450, 0.45, SINE_IO], [GLIDE, GLIDE_MS, 0.6, SINE_IO]]
    : [[215, 140, 0.75, QUAD_O], [1195, 155, 0.85, SINE_IO], [1350, 85, 1, QUAD_I]]);
  // After the burst it re-forms as a halo behind the hero and runs down. Side by side its rim stays short of his own face.
  const REFORM = calm ? 1700 : 1555;
  const haloMax = horizontal ? Math.min(24, Math.max(19, adx - 4.5 * k - 1.5)) : 24;
  const haloR = new Track(calm ? 15 : 9, calm ? [[1700, 600, Math.min(21, haloMax), SINE_O]] : [[1555, 380, haloMax, CUBIC_O]]);
  const haloA = new Track(0, calm
    ? [[1700, 450, 0.3, SINE_IO], [2600, 800, 0, SINE_IO]]
    : [[1555, 300, 0.55, SINE_O], [1700, 150, 0.4, SINE_O], [2350, 950, 0, SINE_I]]);
  // Turns per second; it slows to a stop like a turntable switched off.
  const spinRate = new Track(calm ? 0.3 : 0, calm
    ? [[1700, 1700, 0, LINEAR]]
    : [[215, 250, 0.45, QUAD_O], [955, 150, 0.8, QUAD_O], [1110, 150, 1.2, QUAD_O], [1195, 240, 2.4, QUAD_I], [1435, 120, 1, QUAD_O], [1700, 1600, 0, LINEAR]]);
  let platterAngle = 0;

  const arc = (kind: ArcKind, x: number, y: number, r0: number, r1: number, angle: number, o: ArcOptions) => {
    const p = QUINCY_ARC[kind];
    return shot(p.key, x, y, {
      ...o, size: [p.w * r0, p.w * r1], height: [p.h * r0, p.h * r1], origin: [-p.x0 / p.w, 0.5], angle, depth: ARC_DEPTH, blend: 'add',
    });
  };

  /** A crescent front from the platter across the hero and on past him; with `arrive`, a tick on his chest as it reaches him. */
  const front = (kind: ArcKind, turn: number, alpha: number, color: number, reach: number, arrive: boolean) => {
    const t = kit.clock;
    const r = platterR.at(t) * rScale;
    platterAt(t, r, F);
    const dist = Math.hypot(Ch.x - F.x, Ch.y - F.y);
    const r0 = 0.6 * r;
    const r1 = Math.max(r0 + 10, dist + reach);
    let aim = Math.atan2(Ch.y - F.y, Ch.x - F.x) + turn / DEG;
    // Kept off his own face, which the front would sweep behind: a crescent is turned until its near tip clears it,
    // a thin arc that would still cross it is left out.
    const hx = (headN[0] + headN[2]) / 2 - F.x;
    const hy = (headN[1] + headN[3]) / 2 - F.y;
    const hd = Math.hypot(hx, hy);
    if (hd > 4 && hd < r1 + 7 * k) {
      const to = Math.atan2(hy, hx) - aim;
      const off = Math.atan2(Math.sin(to), Math.cos(to));
      const need = QUINCY_ARC[kind].half + Math.atan2(7 * k, hd) + 0.05 - Math.abs(off);
      if (need > 0) {
        if (kind === 'short') return;
        aim -= (off < 0 ? -1 : 1) * Math.min(need, 0.5);
      }
    }
    const duration = calm ? 700 : 460;
    arc(kind, F.x, F.y, r0, r1, aim * DEG, calm
      ? { alpha, duration, color, rise: 220, ease: SINE_O, fadeEase: SINE_IO }
      : { alpha, duration, color, rise: 50, ease: CUBIC_O, fadeEase: QUAD_I, gather: true });
    if (!arrive) return;
    const g = clamp01((dist - 5 * heroK - r0) / (r1 - r0));
    // The ease inverted: the share of the life at which the crest reaches his back.
    const when = calm ? (Math.asin(g) * 2) / Math.PI : 1 - Math.cbrt(1 - g);
    at(t + when * duration, tick);
  };

  /** The flight of a spark or mote, sampled over its life: true when it never comes near either face. */
  const flightClear = (x: number, y: number, vx: number, vy: number, drag: number, ay: number, life: number) => {
    if (!clearOfFaces(x, y, 1.5, true)) return false;
    const h = life / 1000 / 10;
    for (let i = 0; i < 10; i++) {
      vy += ay * h;
      const d = Math.exp(-drag * h);
      vx *= d;
      vy *= d;
      x += vx * h;
      y += vy * h;
      if (!clearOfFaces(x, y, 1.5, true)) return false;
    }
    return true;
  };

  /** Sparks flung off the rim along its turn (clockwise on screen), a little outward, falling as they slow. */
  const fling = (n: number, speed: number, rs: number) => {
    chest();
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.6 * rnd()) / n) * TAU;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const x = Ch.x + c * rs;
      const y = Ch.y + sn * rs;
      const v = speed * (0.7 + 0.6 * rnd());
      const vx = (-sn + 0.3 * c) * v;
      const vy = (c + 0.3 * sn) * v;
      const life = 520 + 380 * rnd();
      const star = i % 3 === 0;
      particle(star ? HFX.spark : HFX.streak, {
        x, y, vx, vy, drag: 2.4, ay: 70, life,
        size: star ? [5.5, 1.4] : [2, 0.7], aspect: star ? 1 : 5.3, alpha: 1, rise: 0.04,
        color: lerpColor(pal.core, pal.spark, rnd()), depth: flightClear(x, y, vx, vy, 2.4, 70, life) ? AIR : SPARK_BACK, blend: 'add',
        align: !star, spin: star ? 120 : 0, twinkle: star ? 0.35 : 0,
      });
    }
  };

  // ── Gather ──────────────────────────────────────────────────────────────
  at(215, () => {
    // The needle drops: a glint at his hand, in front only when it is clear of both faces.
    hand();
    const depth = clearOfFaces(R.x, R.y, 4.5 * k, false) ? AIR : BACK + 7 * EPS;
    if (calm) shot(HFX.glint, R.x, R.y, { size: [6 * k, 6 * k], alpha: 0.6, duration: 300, color: CREAM, depth, blend: 'add', rise: 150 });
    else shot(HFX.glint, R.x, R.y, { size: [4 * k, 9 * k], alpha: 0.9, duration: 220, color: CREAM, depth, blend: 'add', spin: 25 });
  });
  if (calm) {
    at(300, () => front('front', 0, 0.45, Lp, 22, true));
    at(680, () => front('front', 0, 0.45, Lp, 22, true));
  } else {
    at(300, () => front('front', 0, 0.8, Lp, 30, true));
    at(595, () => {
      front('short', -22, 0.55, pal.spark, 12, false);
      front('short', 22, 0.55, pal.spark, 12, false);
    });
    at(680, () => front('front', 0, 0.9, Lp, 34, true));
    at(955, () => {
      front('front', 0, 1, Lp, 36, true);
      front('short', -26, 0.6, pal.spark, 14, false);
      front('short', 26, 0.6, pal.spark, 14, false);
    });
    at(1110, () => front('front', 0, 1, Lp, 36, true));
    at(1140, () => front('long', 0, 0.7, pal.spark, 24, false));
  }

  // ── Release: the platter bursts and three thick crescents fly off it, still turning ──
  // All of it has faded by about 1800, so the plateau shows one shape: the platter, re-formed.
  at(T.peak, () => {
    chest();
    const r = platterR.at(T.peak) * rScale;
    if (calm) {
      shot(HFX_QUINCY.disc, Ch.x, Ch.y, {
        size: [2 * r, 84], alpha: 0.55, duration: 1000, rise: 250, color: pal.glow, depth: BACK, blend: 'add',
        angle: platterAngle, spin: 60, ease: SINE_O, fadeEase: SINE_IO,
      });
      shot(HFX.halo, Ch.x, Ch.y, {
        size: [(1.86 * r) / 0.78, 60 / 0.78], alpha: 0.45, duration: 800, rise: 250, color: pal.spark, depth: BACK + 2 * EPS, blend: 'add',
        ease: SINE_O, fadeEase: SINE_IO,
      });
      for (let i = 0; i < 3; i++) {
        arc('front', Ch.x, Ch.y, r, 52 + 6 * i, platterAngle + 120 * i, {
          alpha: 0.4, duration: 1100, color: Lp, rise: 320, spin: 30, ease: SINE_O, fadeEase: SINE_IO,
        });
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + 0.4;
        const x = Ch.x + Math.cos(a) * 14;
        const y = Ch.y + Math.sin(a) * 14;
        const vx = Math.cos(a) * 3;
        const vy = -9 - 5 * rnd();
        particle(HFX.mote, {
          x, y, vx, vy, life: 1500, size: [2.6, 1.6], alpha: 0.6, rise: 0.3, color: pal.spark, blend: 'add',
          depth: flightClear(x, y, vx, vy, 0, 0, 1500) ? AIR : SPARK_BACK, fadeEase: SINE_IO, sizeEase: SINE_O,
        });
      }
      return;
    }
    // The wound-up platter hands over to its own burst at the same size and angle.
    shot(HFX_QUINCY.disc, Ch.x, Ch.y, {
      size: [2 * r, 120], alpha: 0.75, duration: 520, color: pal.glow, depth: BACK, blend: 'add',
      angle: platterAngle, spin: 240, ease: EXPO_O, fadeEase: QUAD_O,
    });
    shot(HFX.halo, Ch.x, Ch.y, {
      size: [(1.86 * r) / 0.78, 70 / 0.78], alpha: 1, duration: 340, color: pal.spark, depth: BACK + 2 * EPS, blend: 'add', ease: EXPO_O,
    });
    for (let i = 0; i < 3; i++) {
      arc('front', Ch.x, Ch.y, 10, 88 + 8 * i, platterAngle + 120 * i, {
        alpha: 0.9, duration: 360, color: Lp, rise: 30, spin: 110, ease: EXPO_O, fadeEase: QUAD_I,
      });
    }
    fling(lite ? 16 : 40, 190, r);
  });
  if (!calm) {
    // The plateau's two onsets: a smaller shedding, then sparks only.
    at(ONSETS.plateau[0], () => {
      chest();
      for (let i = 0; i < 2; i++) {
        arc('front', Ch.x, Ch.y, 12, 58, platterAngle + 180 * i + 60, {
          alpha: 0.6, duration: 240, color: Lp, rise: 30, spin: 70, ease: EXPO_O, fadeEase: QUAD_I,
        });
      }
      fling(lite ? 6 : 12, 120, 12);
    });
    at(ONSETS.plateau[1], () => fling(lite ? 4 : 8, 90, 12));
  }

  // ── Afterglow: the slowing halo beats on the chimes; on the last one its last groove leaves upward ──
  const LAST = calm ? 2440 : ONSETS.chimes[5];
  at(LAST, () => {
    chest();
    const r = haloR.at(LAST);
    arc('long', Ch.x, Ch.y, 0.95 * r, calm ? 60 : 95, -90, calm
      ? { alpha: 0.5, duration: 1200, color: Lp, rise: 300, ease: SINE_O, fadeEase: SINE_IO }
      : { alpha: 0.7, duration: 950, color: Lp, rise: 60, ease: CUBIC_O, fadeEase: SINE_IO });
  });

  return {
    angle(t) {
      // His body stays calm: one slow lean toward the hero, back after the release. No motion on the onsets.
      return calm ? 0 : lean.at(t);
    },
    frame(t, dt) {
      platterAngle += (360 * spinRate.at(t) * dt) / 1000;
      let r = 0;
      let a = 0;
      let tracking = 0;
      if (t >= 215 && t < T.peak) {
        r = platterR.at(t) * rScale;
        a = platterA.at(t);
        if (calm) a *= 0.85 + 0.15 * level(t);
        else {
          a *= 0.62 + 0.45 * level(t);
          for (let i = 0; i < PULSES.length; i++) {
            a += pulse(t, PULSES[i], 0.22, 40, 220);
            r += pulse(t, PULSES[i], 1.1, 40, 200);
          }
        }
        platterAt(t, r, D);
        tracking = calm ? 1 : 1 - progress(t, 1260, 90);
      } else if (calm && t < T.peak + 300) {
        chest();
        D.x = Ch.x;
        D.y = Ch.y;
        r = platterR.at(t) * rScale;
        a = platterA.at(t) * (1 - SINE_IO(progress(t, T.peak, 300)));
        tracking = 1 - progress(t, T.peak, 200);
      } else if (t >= REFORM) {
        chest();
        D.x = Ch.x;
        D.y = Ch.y;
        r = haloR.at(t);
        a = haloA.at(t);
        if (!calm) {
          a += pulse(t, ONSETS.plateau[1], 0.2, 40, 200);
          for (let i = 0; i < ONSETS.chimes.length; i++) {
            a += pulse(t, ONSETS.chimes[i], 0.16, 40, 200);
            r += pulse(t, ONSETS.chimes[i], 1.2, 40, 220);
          }
        }
      }
      const on = a > 0.004;
      aura.setVisible(on);
      disc.setVisible(on);
      gloss.setVisible(on);
      rim.setVisible(on);
      if (on) {
        const rimSize = (1.86 * r) / 0.78;
        aura.setPosition(D.x, D.y).setDisplaySize(2.3 * r, 2.3 * r).setAlpha(clamp01(0.35 * a));
        disc.setPosition(D.x, D.y).setDisplaySize(2 * r, 2 * r).setAngle(platterAngle).setAlpha(clamp01(a));
        gloss.setPosition(D.x, D.y).setDisplaySize(2 * r, 2 * r).setAlpha(clamp01(0.45 * a));
        rim.setPosition(D.x, D.y).setDisplaySize(rimSize, rimSize).setAlpha(clamp01((t < T.peak ? 0.6 : 0.4) * a));
      }

      // The needle stays put while the platter turns under it, tracking in toward the label.
      const lit = on && tracking > 0;
      needle.setVisible(lit);
      trail.setVisible(lit);
      if (lit) {
        const rs = r * lerp(0.74, 0.38, progress(t, 215, 1135));
        const phi = NEEDLE_ANGLE / DEG;
        let size = calm ? 6 : 6 + 5 * level(t);
        if (!calm) for (let i = 0; i < PULSES.length; i++) size += pulse(t, PULSES[i], 4, 30, 180);
        needle.setPosition(D.x + Math.cos(phi) * rs, D.y + Math.sin(phi) * rs).setDisplaySize(size, size)
          .setAlpha(clamp01(1.4 * a) * tracking);
        const ts = (2 * rs) / 0.72;
        trail.setPosition(D.x, D.y).setDisplaySize(ts, ts).setAngle(NEEDLE_ANGLE)
          .setAlpha(clamp01(0.75 * a * (calm ? 1 : 0.5 + 0.5 * level(t))) * tracking);
      }
    },
  };
}
