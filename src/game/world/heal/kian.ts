import { FX } from '../../art/fx';
import { HFX } from '../../art/healFx';
import { HFX_KIAN, KIAN_WAVE } from '../../art/healFxKian';
import {
  BACK_O, EPS, EXPO_I, EXPO_O, GOLD, ONSETS, QUAD_I, QUAD_O, SINE_I, SINE_IO, SINE_O, boxDistance, clamp01, lerp, progress, pulse,
  type Box, type HealKit, type Opening, type Point,
} from './kit';

type Img = ReturnType<HealKit['image']>;

/** Where a string is tied into the sigil. */
interface Peg { x: number; y: number; glow: Img; landed: number; release?: Str }

/** A string of light from its peg (a) up to its end (b): a taut core and the long exposure of its ringing. */
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
  /** How far its echoes may travel out to either side. */
  echo: number;
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

/**
 * Kian Vero plays a harp of light that stands around the hero. Nothing leaves his hand but the glint of each pluck:
 * over the build-up the plucks string the harp pair by pair, mirrored left and right of the hero, from pegs on the
 * sigil's outer ring, each pair taller than the last; every string rings with a visible standing wave and carries a
 * note down to its peg. On the lock the strings drain into their pegs; on the peak the pegs fire them up past the top
 * edge beside the column, and notes fountain from it. On the chimes the strings are plucked once more and zip up.
 */
export function kianOpening(kit: HealKit): Opening {
  const {
    calm, lite, pX, pY, sx, s, npcK, labelY, view, pal, facing, AIR, NOTES, RIPPLE,
    headN, headH, bodyN, bodyH, onNpc, image, drop, shot, glint, at, particle, level, rnd,
  } = kit;
  const STRING = AIR + 2 * EPS;
  const PEG = RIPPLE + 2 * EPS;
  const DEG = 180 / Math.PI;
  const NOTE_KEYS = [HFX.noteEighth, HFX.noteQuarter, HFX.notePair, HFX.noteSixteenth];
  const WAVES = [HFX_KIAN.wave1, HFX_KIAN.wave2, HFX_KIAN.wave3];

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
  /** The widest swing of harmonic h on a to b whose envelope stays 1.2 off every face. */
  const capOf = (ax: number, ay: number, bx: number, by: number, h: number) => {
    let cap = 11;
    for (let i = 1; i < 40; i++) {
      const e = Math.abs(Math.sin((h * Math.PI * i) / 40));
      if (e > 0.08) cap = Math.min(cap, (faceDist(lerp(ax, bx, i / 40), lerp(ay, by, i / 40)) - 1.2) / e);
    }
    return Math.max(0, Math.min(cap, 0.2 * Math.hypot(bx - ax, by - ay)));
  };

  // ── The harp: mirrored pairs of pegs on the sigil's ring (world sized), the strings leaning in a little as they rise ──
  // All of them aim at one point far above the hero, so they stay evenly apart instead of bunching into a cone.
  const farY = pY - 400;
  const topY = view.top - 30;
  // Standing heights are for a hero in the middle of the view; nearer its top edge the harp is lower.
  const headroom = Math.max(0.5, Math.min(1, (pY - view.top - 22) / 88));
  // Ten units apart: room for each string's ringing to show as its own shape.
  const SLOTS = [62, 52, 42];
  const TOPS = [54, 71, 88];
  const STAND_H = [1, 2, 3];
  const RISE_H = [2, 1, 3];
  const pegs: Peg[] = [];
  const standing: Str[] = [];
  const rising: Str[] = [];
  const makeStr = (peg: Peg, bx: number, by: number, h: number, pair: number): Str => {
    const { x: ax, y: ay } = peg;
    let carries = Math.hypot(bx - ax, by - ay) >= 12;
    for (let i = 2; carries && i <= 18; i++) if (faceDist(lerp(ax, bx, i / 20), lerp(ay, by, i / 20)) < 4.5) carries = false;
    // Echoes are the middle 60 % moved sideways as a whole, so they need room all along it, not only at the antinodes.
    let echo = 7;
    for (let i = 18; i <= 82; i += 4) echo = Math.min(echo, faceDist(lerp(ax, bx, i / 100), lerp(ay, by, i / 100)) - 2);
    return {
      // Gold, not white: the shared column and rays are near white, the strings must read as his.
      core: image(HFX_KIAN.string, ax, ay, 1, 1, pal.spark, STRING, 'add').setVisible(false),
      wave: image(WAVES[h - 1], ax, ay, 1, 1, pal.glow, STRING - EPS, 'add').setVisible(false),
      ax, ay, bx, by, cap: capOf(ax, ay, bx, by, h), born: Infinity, gone: Infinity, pt: -1e6, pa: 0, phase: rnd() * 6.28,
      carries, echo, pair, peg, dropped: false,
    };
  };
  let pairs = 0;
  SLOTS.forEach((x0, i) => {
    const y0 = GROUND_Y * Math.sqrt(RING * RING - x0 * x0);
    // The back arc of the ring first; the front arc where something stands in the way there. A pair is strung only whole.
    for (const arc of [-1, 1]) {
      const y = pY + arc * y0;
      const reach = (y - topY) / (y - farY);
      const stand = (y - (pY - TOPS[i] * headroom)) / (y - farY);
      const fits = (x: number) => !near(x, y, bodyN, 2) && !near(x, y, bodyH, 2) && clear(x, y, lerp(x, pX, reach), topY, 3);
      if (fits(pX - x0) && fits(pX + x0)) {
        for (const x of [pX - x0, pX + x0]) {
          const peg: Peg = { x, y, glow: image(FX.glow, x, y, 7, 2.6, pal.glow, PEG, 'add').setVisible(false), landed: Infinity };
          pegs.push(peg);
          const st = makeStr(peg, lerp(x, pX, stand), lerp(y, farY, stand), STAND_H[pairs % 3], pairs);
          st.pin = image(FX.glow, st.bx, st.by, 3, 3, pal.core, STRING + EPS, 'add').setVisible(false);
          standing.push(st);
          peg.release = makeStr(peg, lerp(x, pX, reach), topY, RISE_H[pairs % 3], pairs);
          rising.push(peg.release);
        }
        pairs++;
        break;
      }
      if (y0 < 0.01) break;
    }
  });
  /** Strings of one side stand a few units apart: each rings and echoes inside its own lane. */
  const lanes = (set: Str[]) => {
    for (const st of set) {
      const mx = (st.ax + st.bx) / 2;
      const my = (st.ay + st.by) / 2;
      let gap = Infinity;
      for (const o of set) {
        if (o === st || (o.ax - pX) * (st.ax - pX) < 0) continue;
        gap = Math.min(gap, Math.abs(lerp(o.ax, o.bx, clamp01((my - o.ay) / (o.by - o.ay))) - mx));
      }
      st.cap = Math.min(st.cap, 0.4 * gap);
      st.echo = Math.min(st.echo, 0.4 * gap);
    }
  };
  lanes(standing);
  lanes(rising);
  // Rising strings from the centre out, so the harp opens.
  rising.sort((a, b) => Math.abs(a.ax - pX) - Math.abs(b.ax - pX));
  rising.forEach((st, j) => {
    st.born = 1435 + (calm ? 0 : 14 * j);
  });

  // ── Helpers ─────────────────────────────────────────────────────────────
  const swingAt = (t: number) => 2.6 + 6 * level(t);
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
    const h = Math.max(3, Math.min(15, 1.6 * st.cap + 2));
    shot(HFX.flare, (st.ax + st.bx) / 2, (st.ay + st.by) / 2, {
      size: [0.8 * len, 1.04 * len], height: [0.6 * h, h], angle: Math.atan2(st.by - st.ay, st.bx - st.ax) * DEG,
      alpha, duration: life, rise: calm ? 200 : 30, delay, color: pal.deep, depth: STRING - 2 * EPS, blend: 'add', ease: EXPO_O, fadeEase: SINE_IO,
    });
  };
  /** Two afterimages of a plucked string that travel out to either side and fade. */
  const echo = (st: Str, alpha: number, delay: number) => {
    const len = Math.hypot(st.bx - st.ax, st.by - st.ay);
    if (calm || len < 10 || st.echo < 1.5) return;
    const nx = -(st.by - st.ay) / len;
    const ny = (st.bx - st.ax) / len;
    for (const side of [1, -1]) {
      shot(HFX_KIAN.string, (st.ax + st.bx) / 2, (st.ay + st.by) / 2, {
        size: [0.6 * len, 0.52 * len], height: [3.4, 2.4], angle: Math.atan2(st.by - st.ay, st.bx - st.ax) * DEG,
        move: [nx * st.echo * side, ny * st.echo * side], alpha, duration: 320, delay, color: pal.glow,
        depth: STRING - 3 * EPS, blend: 'add', ease: QUAD_O, fadeEase: QUAD_O,
      });
    }
  };
  /** A peg's ring on the ground. */
  const ping = (p: Peg, size: number, alpha: number) => shot(HFX.halo, p.x, p.y, {
    size: [0.4 * size, size], aspect: GROUND_Y, alpha, duration: calm ? 600 : 420, color: pal.glow, depth: PEG + EPS, blend: 'add',
    rise: calm ? 200 : 30, ease: EXPO_O, fadeEase: calm ? SINE_IO : QUAD_I,
  });
  let noteN = 0;
  /** A note riding a string from share `from` to share `to` of its length. */
  const ride = (st: Str, from: number, to: number, life: number, delay: number) => {
    if (!st.carries) return;
    const { ax, ay, bx, by } = st;
    const n = noteN++;
    particle(NOTE_KEYS[n % 4], {
      x: lerp(ax, bx, from), y: lerp(ay, by, from), life, delay, size: calm ? [5.5, 5.5] : [3.5, 6.5], alpha: 1, rise: calm ? 0.25 : 0.12,
      color: n % 2 ? GOLD : pal.spark, depth: NOTES, blend: 'normal', angle: (rnd() - 0.5) * 16,
      sizeEase: calm ? SINE_IO : BACK_O, fadeEase: calm ? SINE_IO : QUAD_I,
      path: (q, out) => {
        const f = lerp(from, to, SINE_IO(q));
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
  /** Notes thrown up out of the column, falling away to both sides; each ends before it would reach a face or the label. */
  const fountain = () => {
    const x0 = pX;
    const y0 = labelY - 15;
    const g = 190;
    for (let i = 0, count = lite ? 10 : 20; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      const vx = side * (22 + 88 * rnd());
      const vy = -(50 + 45 * rnd());
      const fx = x0 + side * 3 * rnd();
      const fy = y0 - 5 * rnd();
      let life = 1200 + 500 * rnd();
      for (let q = 1; q <= 24; q++) {
        const tau = (q * life) / 24000;
        const x = fx + vx * tau;
        const y = fy + vy * tau + 0.5 * g * tau * tau;
        if (faceDist(x, y) < 6.5 || near(x, y, bodyH, 3) || near(x, y, bodyN, 3)) {
          life = ((q - 1) * life) / 24 - 60;
          break;
        }
      }
      if (life < 350) continue;
      const L = life / 1000;
      particle(NOTE_KEYS[i % 4], {
        x: fx, y: fy, life, delay: i * 9, size: [6, 10], alpha: 1, rise: 0.06, color: i % 3 ? GOLD : pal.spark,
        depth: NOTES, blend: 'normal', angle: side * 10, spin: side * (30 + 50 * rnd()), sizeEase: BACK_O,
        path: (q, out) => {
          const tau = q * L;
          out.x = fx + vx * tau;
          out.y = fy + vy * tau + 0.5 * g * tau * tau;
        },
      });
    }
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
    echo(st, 0.5 + 0.4 * level(t0), lag + 20);
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
        st.pa = Math.min(st.cap, 1.4);
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

  // ── Release: the pegs fire their strings up beside the column ───────────
  at(1435, () => {
    if (rising.length) handFlash();
    for (const st of rising) {
      const lag = st.born - 1435;
      st.pt = st.born;
      st.pa = calm ? 0 : Math.min(st.cap, 9);
      if (!calm) {
        flare(st, 0.35, 640, lag);
        shot(HFX.spark, st.ax, st.ay, {
          size: [10, 6], move: [st.bx - st.ax, st.by - st.ay], duration: 200, grow: 130, hold: 130, alpha: 1,
          color: pal.core, depth: STRING + 3 * EPS, blend: 'add', ease: EXPO_O, delay: lag,
        });
      } else {
        flare(st, 0.22, 900, 0);
      }
      ping(st.peg, calm ? 22 : 36, calm ? 0.5 : 0.95);
    }
    if (!calm) fountain();
  });
  if (calm) rising.slice(0, 6).forEach((st, j) => at(1500 + 160 * j, () => drift(st.ax, st.ay, 1400, 30)));
  if (!calm) {
    for (const t0 of ONSETS.plateau) {
      at(t0, () => {
        for (const st of rising) {
          st.pt = t0;
          st.pa = Math.min(st.cap, 5.5);
          flare(st, 0.22, 380, 0);
          echo(st, 0.45, 0);
        }
      });
    }
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
        st.pa = Math.min(st.cap, 3.8);
      }
      ride(st, 0.12, 0.6, calm ? 1200 : 850, 0);
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
        let swing = calm ? st.pa : ringOf(st, t, 260);
        if (!calm) {
          if (t >= 1265) swing = Math.max(swing, Math.min(st.cap, 0.55 * swingAt(1265)) * (0.8 + 0.2 * Math.sin(t * 0.09 + st.phase)));
          swing *= 0.86 + 0.14 * Math.cos(t * 0.075 + st.phase);
        }
        const tx = lerp(st.ax, st.bx, up);
        const ty = lerp(st.ay, st.by, up);
        const alpha = (0.62 + 0.28 * lv + 0.1 * fl) * fade;
        draw(st, st.ax, st.ay, tx, ty, (3.6 + 1.8 * lv) * (1 + 0.45 * fl), alpha, swing, Math.min(1, swing / 1.4) * 0.85 * fade);
        if (st.pin) {
          const size = 3.2 + 1.6 * fl;
          st.pin.setVisible(up > 0.05 && alpha > 0.004).setPosition(tx, ty).setDisplaySize(size, size).setAlpha(Math.min(1, 1.2 * alpha) * up);
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

      for (const st of rising) {
        if (st.dropped || t < st.born) continue;
        const out = calm ? 600 : 500;
        if (t >= st.gone + out) {
          retire(st);
          continue;
        }
        const grow = calm ? SINE_IO(progress(t, st.born, 450)) : EXPO_O(progress(t, st.born, 130));
        const zip = calm ? 0 : SINE_I(progress(t, st.gone + 40, out - 40));
        const fade = calm ? 1 - SINE_IO(progress(t, st.gone, out)) : 1 - QUAD_I(progress(t, st.gone + 40, out - 40));
        const fl = calm ? 0 : Math.exp(-Math.max(0, t - st.pt) / 160);
        let swing = calm ? Math.min(st.cap, 1.6) : Math.max(ringOf(st, t, 300), Math.min(st.cap, t < 1700 ? 1 + 3.5 * lv : 0.9));
        if (!calm) swing *= 0.86 + 0.14 * Math.cos(t * 0.075 + st.phase);
        const thick = calm ? 4.4 : lerp(6.2, 4, progress(t, 1700, 260)) * (1 + 0.3 * fl);
        draw(st, lerp(st.ax, st.bx, zip), lerp(st.ay, st.by, zip), lerp(st.ax, st.bx, grow), lerp(st.ay, st.by, grow),
          thick, (calm ? 0.8 * grow : 0.85 + 0.15 * fl) * fade, swing, Math.min(1, swing / 1.4) * (calm ? 0.5 : 0.8) * fade);
      }
    },
  };
}
