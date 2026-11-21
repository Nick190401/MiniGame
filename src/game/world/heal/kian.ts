import { FX } from '../../art/fx';
import { HFX } from '../../art/healFx';
import { HFX_KIAN, KIAN_WAVE } from '../../art/healFxKian';
import {
  BACK_O, EPS, EXPO_I, EXPO_O, FALL_MS, GOLD, ONSETS, QUAD_I, QUAD_O, SINE_I, SINE_IO, SINE_O, boxDistance, lerp, progress, pulse,
  type Box, type HealKit, type Opening, type Point,
} from './kit';

type Img = ReturnType<HealKit['image']>;

/** Where a string is tied into the sigil. */
interface Peg { x: number; y: number; glow: Img; landed: number; release?: Str }

/** A string of light from its peg (a) to its end (b): a taut core and the long exposure of its ringing. */
interface Str {
  core: Img;
  wave: Img;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** The widest swing that keeps its ringing in its own lane, off both faces and off the HP label. */
  cap: number;
  /** Plucked into being; taken down by a chime. */
  born: number;
  gone: number;
  /** The last pluck: when, and how wide. */
  pt: number;
  pa: number;
  phase: number;
  /** Notes can ride it without touching a face. */
  carries: boolean;
  /** Its mirrored pair, counted from the outermost. */
  pair: number;
  peg: Peg;
  /** A standing string ends in a pin of light, so its upper end reads. */
  pin?: Img;
  dropped: boolean;
}

const GROUND_Y = 0.36;
/** Pegs sit just inside the sigil's outer ring. */
const RING = 62;
const RAD = Math.PI / 180;
/** Pegs from the outermost in, seven units apart, and how high each pair stands: the harp rises toward the hero. */
const SLOTS = [62, 55, 48, 41];
const TOPS = [46, 60, 74, 88];
/** How far each pair leans out of the upright in the fan of the release (degrees): evenly, the outermost the most. */
const FAN = [36, 27, 18, 9];
/** A string is taut: its ringing is a shiver, never a loop. Widest swing standing, and in the fan. */
const SHIVER = 1.5;
const FAN_SWING = 3.2;

/**
 * Kian Vero plays a harp of light that stands around the hero. Nothing leaves his hand but the glint of each pluck:
 * over the build-up the plucks string the harp pair by pair, mirrored left and right of the hero, from pegs on the
 * sigil's outer ring: upright, taut and evenly apart, each pair taller than the last, every pluck a shiver and a
 * note riding down to the peg. On the lock the strings drain into their pegs; on the peak the pegs fire them out as
 * a fan that opens over the whole frame, the middle strings first, and from then on each pluck runs outward along
 * its string as a wave with a note behind it. On the chimes the strings are plucked once more and zip away.
 */
export function kianOpening(kit: HealKit): Opening {
  const {
    calm, lite, pX, pY, sx, s, npcK, labelY, view, pal, facing, T, AIR, NOTES, RIPPLE,
    headN, headH, bodyN, bodyH, onNpc, image, drop, shot, glint, at, particle, level, rnd,
  } = kit;
  const STRING = AIR + 2 * EPS;
  const PEG = RIPPLE + 2 * EPS;
  const DEG = 180 / Math.PI;
  const NOTE_KEYS = [HFX.noteEighth, HFX.noteQuarter, HFX.notePair, HFX.noteSixteenth];

  // ── His hand, measured on his standing frames (27-unit sprite, from his feet): at his hip side-on, else at his side ──
  const HAND = { right: [0.6, -11], left: [-0.6, -11], up: [3.7 * s, -10.7], down: [3.6 * s, -10.1] } as const;
  const handX = HAND[facing][0] * npcK;
  const handY = HAND[facing][1] * npcK;
  const H: Point = { x: 0, y: 0 };
  onNpc(handX, handY, H);

  // ── Placement: strings keep off both faces, both bodies and the HP label ──
  const label: Box = [pX - 19, labelY - 13, pX + 19, labelY + 2];
  const near = (x: number, y: number, b: Box, pad: number) => boxDistance(x, y, b) <= pad;
  const faceDist = (x: number, y: number) => Math.min(boxDistance(x, y, headN), boxDistance(x, y, headH), boxDistance(x, y, label));
  const clear = (ax: number, ay: number, bx: number, by: number, pad: number) => {
    const steps = Math.max(10, Math.ceil(Math.hypot(bx - ax, by - ay) / 1.5));
    for (let i = 0; i <= steps; i++) {
      const x = lerp(ax, bx, i / steps);
      const y = lerp(ay, by, i / steps);
      if (faceDist(x, y) <= pad || near(x, y, bodyH, 1) || near(x, y, bodyN, 1)) return false;
    }
    return true;
  };
  /** The widest swing on a to b whose envelope stays 1.2 off every face. */
  const capOf = (ax: number, ay: number, bx: number, by: number, most: number) => {
    let cap = most;
    for (let i = 1; i < 40; i++) {
      const e = Math.sin((Math.PI * i) / 40);
      if (e > 0.08) cap = Math.min(cap, (faceDist(lerp(ax, bx, i / 40), lerp(ay, by, i / 40)) - 1.2) / e);
    }
    return Math.max(0, cap);
  };

  // ── The harp: mirrored pairs of pegs on the sigil's ring (world sized). Standing, the strings are upright; in the
  // release each leans out by its pair's angle, so the fan opens evenly and no two strings ever cross ──
  const topY = view.top - 30;
  // Standing heights are for a hero in the middle of the view; nearer its top edge the harp is lower.
  const headroom = Math.max(0.5, Math.min(1, (pY - view.top - 22) / 88));
  const pegs: Peg[] = [];
  const standing: Str[] = [];
  const rising: Str[] = [];
  const makeStr = (peg: Peg, bx: number, by: number, most: number, pair: number): Str => {
    const { x: ax, y: ay } = peg;
    let carries = Math.hypot(bx - ax, by - ay) >= 12;
    for (let i = 2; carries && i <= 18; i++) if (faceDist(lerp(ax, bx, i / 20), lerp(ay, by, i / 20)) < 4.5) carries = false;
    return {
      // Gold, not white: the shared column and rays are near white, the strings must read as his.
      core: image(HFX_KIAN.string, ax, ay, 1, 1, pal.spark, STRING, 'add').setVisible(false),
      wave: image(HFX_KIAN.wave, ax, ay, 1, 1, pal.glow, STRING - EPS, 'add').setVisible(false),
      ax, ay, bx, by, cap: capOf(ax, ay, bx, by, most), born: Infinity, gone: Infinity, pt: -1e6, pa: 0, phase: rnd() * 6.28,
      carries, pair, peg, dropped: false,
    };
  };
  let pairs = 0;
  SLOTS.forEach((x0, i) => {
    const y0 = GROUND_Y * Math.sqrt(RING * RING - x0 * x0);
    const lean = Math.tan(FAN[i] * RAD);
    // The back arc of the ring first; the front arc where something stands in the way there. A pair is strung only whole.
    for (const arc of [-1, 1]) {
      const y = pY + arc * y0;
      const standY = pY - TOPS[i] * headroom;
      const fanX = (side: number) => pX + side * (x0 + lean * (y - topY));
      const fits = (side: number) => {
        const x = pX + side * x0;
        return !near(x, y, bodyN, 2) && !near(x, y, bodyH, 2) && clear(x, y, x, standY, 3) && clear(x, y, fanX(side), topY, 3);
      };
      if (fits(-1) && fits(1)) {
        for (const side of [-1, 1]) {
          const x = pX + side * x0;
          const peg: Peg = { x, y, glow: image(FX.glow, x, y, 7, 2.6, pal.glow, PEG, 'add').setVisible(false), landed: Infinity };
          pegs.push(peg);
          const st = makeStr(peg, x, standY, SHIVER, pairs);
          st.pin = image(FX.glow, st.bx, st.by, 3, 3, pal.core, STRING + EPS, 'add').setVisible(false);
          standing.push(st);
          peg.release = makeStr(peg, fanX(side), topY, FAN_SWING, pairs);
          rising.push(peg.release);
        }
        pairs++;
        break;
      }
      if (y0 < 0.01) break;
    }
  });
  // The fan opens from the middle: the innermost pair first.
  for (const st of rising) st.born = 1435 + (calm ? 0 : 14 * (pairs - 1 - st.pair));

  // ── Helpers ─────────────────────────────────────────────────────────────
  const swingAt = (t: number) => 0.9 + 1.2 * level(t);
  const ringOf = (st: Str, t: number, tau: number) => {
    const d = t - st.pt;
    return d < 0 ? 0 : st.pa * Math.min(1, d / 35) * Math.exp(-d / tau);
  };
  const retire = (st: Str) => {
    drop(st.core);
    drop(st.wave);
    drop(st.pin);
    st.dropped = true;
  };
  const draw = (st: Str, x0: number, y0: number, x1: number, y1: number, thick: number, alpha: number, swing: number, waveAlpha: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 0.4 || alpha <= 0.004) {
      st.core.setVisible(false);
      st.wave.setVisible(false);
      return;
    }
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const rot = Math.atan2(y1 - y0, x1 - x0);
    st.core.setVisible(true).setPosition(mx, my).setRotation(rot).setDisplaySize(len, thick).setAlpha(alpha);
    if (swing < 0.2 || waveAlpha <= 0.004) {
      st.wave.setVisible(false);
      return;
    }
    st.wave.setVisible(true).setPosition(mx, my).setRotation(rot)
      .setDisplaySize((len * KIAN_WAVE.w) / (KIAN_WAVE.x1 - KIAN_WAVE.x0), (swing * KIAN_WAVE.h) / KIAN_WAVE.swing).setAlpha(waveAlpha);
  };
  /** The soft sheen a pluck throws along a string. */
  const flare = (st: Str, alpha: number, life: number, delay: number) => {
    const len = Math.hypot(st.bx - st.ax, st.by - st.ay);
    if (len < 4) return;
    const h = Math.max(3, Math.min(9, 1.6 * st.cap + 3));
    shot(HFX.flare, (st.ax + st.bx) / 2, (st.ay + st.by) / 2, {
      size: [0.8 * len, 1.04 * len], height: [0.6 * h, h], angle: Math.atan2(st.by - st.ay, st.bx - st.ax) * DEG,
      alpha, duration: life, rise: calm ? 200 : 30, delay, color: pal.deep, depth: STRING - 2 * EPS, blend: 'add', ease: EXPO_O, fadeEase: SINE_IO,
    });
  };
  /** A pluck runs outward along a string as a wave: a bead of light, and the string's bulge travelling behind it. */
  const run = (st: Str, alpha: number, ms: number, delay: number) => {
    const dx = st.bx - st.ax;
    const dy = st.by - st.ay;
    const len = Math.hypot(dx, dy);
    if (len < 30) return;
    shot(HFX.spark, st.ax, st.ay, {
      size: [10, 6], move: [dx, dy], duration: ms, hold: 0.55 * ms, alpha, color: pal.core, depth: STRING + 3 * EPS, blend: 'add', ease: QUAD_O, delay,
    });
    shot(HFX_KIAN.wave, st.ax + 0.05 * dx, st.ay + 0.05 * dy, {
      size: [0.14 * len, 0.22 * len], height: [8, 4], move: [0.82 * dx, 0.82 * dy], angle: Math.atan2(dy, dx) * DEG, duration: ms, rise: 30,
      hold: 0.4 * ms, alpha: 0.9 * alpha, color: pal.glow, depth: STRING + EPS, blend: 'add', ease: QUAD_O, delay,
    });
  };
  /** A peg's ring on the ground. */
  const ping = (p: Peg, size: number, alpha: number) => shot(HFX.halo, p.x, p.y, {
    size: [0.4 * size, size], aspect: GROUND_Y, alpha, duration: calm ? 600 : 420, color: pal.glow, depth: PEG + EPS, blend: 'add',
    rise: calm ? 200 : 30, ease: EXPO_O, fadeEase: calm ? SINE_IO : QUAD_I,
  });
  let noteN = 0;
  /** A note riding a string from share `from` to share `to` of its length, growing to `size`. */
  const ride = (st: Str, from: number, to: number, life: number, delay: number, size = 6.5) => {
    if (!st.carries) return;
    const { ax, ay, bx, by } = st;
    const n = noteN++;
    particle(NOTE_KEYS[n % 4], {
      x: lerp(ax, bx, from), y: lerp(ay, by, from), life, delay, size: calm ? [5.5, 5.5] : [0.55 * size, size], alpha: 1, rise: calm ? 0.25 : 0.12,
      color: n % 2 ? GOLD : pal.spark, depth: NOTES, blend: 'normal', angle: (rnd() - 0.5) * 16,
      sizeEase: calm ? SINE_IO : BACK_O, fadeEase: calm ? SINE_IO : QUAD_I,
      path: (q, out) => {
        const f = lerp(from, to, calm ? SINE_IO(q) : QUAD_O(q));
        out.x = lerp(ax, bx, f);
        out.y = lerp(ay, by, f);
      },
    });
  };
  /** A single note drifting up from the ground, if its way up keeps off the faces. */
  const drift = (x: number, y: number, life: number, height: number) => {
    for (let q = 1; q <= 10; q++) if (faceDist(x, y - 4 - (height * q) / 10) < 6) return;
    const n = noteN++;
    const ph = rnd() * 6.28;
    particle(NOTE_KEYS[n % 4], {
      x, y, life, size: [5.5, 7], alpha: 0.95, rise: 0.25, color: n % 2 ? GOLD : pal.spark, depth: NOTES, blend: 'normal',
      sizeEase: SINE_O, fadeEase: SINE_IO,
      path: (q, out) => {
        out.x = x + 2.2 * Math.sin(ph + q * 4.4);
        out.y = y - 4 - height * SINE_O(q);
      },
    });
  };
  /** The pluck shows at his hand as a glint, and nowhere else on him. */
  const handFlash = () => {
    const size = Math.min(8 * npcK, 2 * (faceDist(H.x, H.y) - 0.6));
    if (size > 2) glint(H.x, H.y, size, 0.95, pal.core, STRING + 3 * EPS, 200, 0, 0.8);
  };

  // ── Gather: the harp is strung pair by pair on the onsets ───────────────
  /** A pluck; a string not yet there shoots up out of its peg first. */
  const pluck = (st: Str, t0: number, boost: number, note: boolean) => {
    const fresh = st.born === Infinity;
    const lag = fresh ? 70 : 0;
    if (fresh) {
      st.born = t0;
      st.peg.landed = t0;
      ping(st.peg, 20 + 10 * level(t0), 0.8);
    }
    st.pt = t0 + (fresh ? 60 : 0);
    st.pa = Math.min(st.cap, swingAt(t0) * boost);
    flare(st, 0.2 + 0.25 * level(t0), 360, lag);
    // A note rides it down to its peg, only while it can still land before the strings drain at the lock.
    const life = Math.min(440, 1380 - t0 - lag);
    if (note && life >= 200) ride(st, 0.94, 0.06, life, lag);
  };
  if (calm) {
    // One pair, one pair, then the rest: fades at least 300 ms apart, notes gliding slowly.
    const CALM_T = [215, 595, 955];
    CALM_T.forEach((t0, i) => at(t0, () => {
      handFlash();
      for (const st of standing) {
        if (i < 2 ? st.pair !== i : st.pair < 2) continue;
        st.born = t0;
        st.pt = t0;
        st.pa = Math.min(st.cap, 1);
        st.peg.landed = t0 + 300;
        const life = Math.min(900, 1300 - t0 - 150);
        if (life >= 400) ride(st, 0.9, 0.1, life, 150);
        const peg = st.peg;
        at(t0 + 300, () => ping(peg, 14, 0.45));
      }
    }));
  } else if (pairs) {
    // Outermost and shortest first: the harp grows taller toward the hero.
    for (let i = 0; i < 4; i++) {
      const t0 = ONSETS.gather[i];
      at(t0, () => {
        handFlash();
        for (const st of standing) if (st.pair === i % pairs) pluck(st, t0, 1, true);
      });
    }
    for (const t0 of [955, 1110]) {
      at(t0, () => {
        handFlash();
        for (const st of standing) pluck(st, t0, 1.1, st.pair % 2 === (t0 === 955 ? 0 : 1));
      });
    }
    // 1195: a glissando in from both sides, then tremolo into the lock.
    at(1195, handFlash);
    for (const st of standing) at(1195 + 18 * st.pair, () => pluck(st, 1195 + 18 * st.pair, 1, false));
  }

  // ── Release: the pegs fire their strings out as a fan ───────────────────
  at(1435, () => {
    if (rising.length) handFlash();
    for (const st of rising) {
      const lag = st.born - 1435;
      st.pt = st.born;
      st.pa = calm ? 0 : st.cap;
      if (!calm) {
        flare(st, 0.35, 640, lag);
        shot(HFX.spark, st.ax, st.ay, {
          size: [10, 6], move: [st.bx - st.ax, st.by - st.ay], duration: 200, grow: 130, hold: 130, alpha: 1,
          color: pal.core, depth: STRING + 3 * EPS, blend: 'add', ease: EXPO_O, delay: lag,
        });
        // Its note rides outward: out along the fan, away from the HP label.
        ride(st, 0.14, 0.62, 950, lag + 70, 9);
      } else {
        flare(st, 0.22, 900, 0);
      }
      ping(st.peg, calm ? 22 : 36, calm ? 0.5 : 0.95);
    }
  });
  if (calm) rising.slice(0, 6).forEach((st, j) => at(1500 + 160 * j, () => drift(st.ax, st.ay, 1400, 30)));
  if (!calm) {
    // The plateau's first onset: every string is plucked again and the pluck runs out along it, the middle ones first.
    at(ONSETS.plateau[0], () => {
      for (const st of rising) {
        const lag = 16 * (pairs - 1 - st.pair);
        st.pt = ONSETS.plateau[0] + lag;
        st.pa = st.cap;
        flare(st, 0.22, 380, lag);
        run(st, 0.95, 250, lag);
        if (!lite && st.pair % 2 === 0) ride(st, 0.1, 0.5, 800, lag + 60, 8);
      }
    });
    // Its second, with the light already stepping down: only the shiver.
    at(ONSETS.plateau[1], () => {
      for (const st of rising) {
        st.pt = ONSETS.plateau[1];
        st.pa = 0.7 * st.cap;
      }
    });
  }

  // ── Afterglow: each chime plucks a string once more and takes it down ───
  // Calm uses the shared calm chimes (spectacle.ts), more than 300 ms apart.
  const chimes = calm ? [1765, 2100, 2440] : ONSETS.chimes;
  // A pair goes together, the outermost first, so the harp stays mirrored while it thins.
  rising.forEach(st => {
    const c = chimes[Math.min(chimes.length - 1, Math.floor((st.pair * chimes.length) / Math.max(1, pairs)))];
    st.gone = c;
    at(c, () => {
      if (!calm) {
        st.pt = c;
        st.pa = 0.8 * st.cap;
      }
      ride(st, 0.12, 0.5, calm ? 1200 : 850, 0);
      ping(st.peg, calm ? 12 : 16, calm ? 0.4 : 0.6);
    });
  });
  const DRIFT = calm ? [2420, 2740, 3060] : [2420, 2580, 2740, 2900, 3060];
  DRIFT.forEach((t0, i) => at(t0, () => {
    const st = rising[i % Math.max(1, rising.length)];
    if (st) drift(st.ax, st.ay, 880, 24);
  }));

  return {
    angle(t) {
      // His body stays calm: one slow lean toward the hero, back after the release. No motion on the onsets.
      if (calm) return 0;
      return 1.5 * sx * SINE_IO(progress(t, 0, 500)) * (1 - SINE_IO(progress(t, 1435, 500)));
    },
    frame(t) {
      onNpc(handX, handY, H);
      const lv = level(t);

      for (const st of standing) {
        if (st.dropped) continue;
        if (t >= (calm ? 1400 : 1420)) {
          retire(st);
          continue;
        }
        if (t < st.born) continue;
        // Up out of its peg; at the lock back down into it.
        const up = calm ? 1 : EXPO_O(progress(t, st.born, 110)) * (1 - EXPO_I(progress(t, 1350, 70)));
        const fade = calm ? SINE_IO(progress(t, st.born, 300)) * (1 - SINE_IO(progress(t, 1195, 200))) : 1;
        const fl = calm ? pulse(t, st.born, 0.5, 200, 400) : Math.exp(-Math.max(0, t - st.pt) / 140);
        let swing = calm ? st.pa : ringOf(st, t, 220);
        // Tremolo into the lock.
        if (!calm && t >= 1265) swing = Math.max(swing, 0.7 * st.cap * (0.8 + 0.2 * Math.sin(t * 0.09 + st.phase)));
        const ty = lerp(st.ay, st.by, up);
        const alpha = (0.62 + 0.28 * lv + 0.1 * fl) * fade;
        draw(st, st.ax, st.ay, st.bx, ty, (3.6 + 1.8 * lv) * (1 + 0.45 * fl), alpha, swing, Math.min(1, swing / 1.2) * 0.8 * fade);
        if (st.pin) {
          const size = 3.2 + 1.6 * fl;
          st.pin.setVisible(up > 0.05 && alpha > 0.004).setPosition(st.bx, ty).setDisplaySize(size, size).setAlpha(Math.min(1, 1.2 * alpha) * up);
        }
      }

      for (const p of pegs) {
        let a = t >= p.landed ? (calm ? 0.35 : 0.4) + 0.3 * lv : 0;
        let w = 7;
        const r = p.release;
        if (r) {
          const charge = calm ? SINE_IO(progress(t, 1350, 300)) : QUAD_I(progress(t, 1350, 85));
          const after = progress(t, 1435, 320);
          a = Math.max(a, lerp(0.95 * charge, 0.5, after));
          w = 7 + 14 * charge * (1 - after);
          a *= 1 - SINE_IO(progress(t, r.gone, calm ? 600 : 500));
        }
        if (a > 0.005) p.glow.setVisible(true).setDisplaySize(w, 0.38 * w).setAlpha(a);
        else if (p.glow.visible) p.glow.setVisible(false);
      }

      // The release steps down with everything else, a little ahead of the sound's cut.
      const step = calm ? 1 : lerp(1, 0.6, QUAD_O(progress(t, T.fall, FALL_MS)));
      for (const st of rising) {
        if (st.dropped || t < st.born) continue;
        const out = calm ? 600 : 500;
        if (t >= st.gone + out) {
          retire(st);
          continue;
        }
        const grow = calm ? SINE_IO(progress(t, st.born, 450)) : EXPO_O(progress(t, st.born, 150));
        const zip = calm ? 0 : SINE_I(progress(t, st.gone + 40, out - 40));
        const fade = calm ? 1 - SINE_IO(progress(t, st.gone, out)) : 1 - QUAD_I(progress(t, st.gone + 40, out - 40));
        const fl = calm ? 0 : Math.exp(-Math.max(0, t - st.pt) / 160);
        let swing = calm ? Math.min(st.cap, 1.2) : Math.max(ringOf(st, t, 280), Math.min(st.cap, t < T.fall ? 0.6 + 1.2 * lv : 0.6));
        if (!calm) swing *= 0.86 + 0.14 * Math.cos(t * 0.075 + st.phase);
        const thick = calm ? 4.4 : lerp(5.4, 4, progress(t, T.fall, 260)) * (1 + 0.3 * fl);
        draw(st, lerp(st.ax, st.bx, zip), lerp(st.ay, st.by, zip), lerp(st.ax, st.bx, grow), lerp(st.ay, st.by, grow),
          thick, (calm ? 0.8 * grow : (0.85 + 0.15 * fl) * step) * fade, swing, Math.min(1, swing / 1.4) * (calm ? 0.5 : 0.75) * fade * step);
      }
    },
  };
}
