import Phaser from 'phaser';
import { FX } from '../../art/fx';
import { HFX } from '../../art/healFx';
import {
  HFX_KRYS, KRYS_BAND_ASPECT, KRYS_MODE_CREST, KRYS_PLATES, KRYS_STAND_CREST, KRYS_WAVE_CREST, krysPlateNodes,
} from '../../art/healFxKrys';
import {
  CUBIC_O, EPS, EXPO_O, FALL_MS, QUAD_I, QUAD_O, SINE_IO, SINE_O, Track, clamp01, lerp, lerpColor, progress, pulse,
  type Ease, type HealKit, type Opening, type Point,
} from './kit';

type Img = Phaser.GameObjects.Image;

/** One ring of the standing wave on the column: it stays at its node and breathes against its neighbours. */
interface Node { img: Img; y: number; w: number; alpha: number; sign: number; t0: number; leave: number }
/** One ring of the standing wave on the ground: plain blue under the added light, at its node radius. */
interface Stand { base: Img; lit: Img; r: number; alpha: number; sign: number; t0: number }
/** Two opposite phases of a ring's fifth mode, cross-faded: the ring shivers in place instead of turning. */
interface Hum { a: Img; b: Img; t0: number; dur: number; r0: number; r1: number; peak: number; rise: number; hz: number; ease: Ease; fade: Ease; gather: boolean }
/** The lead crest of a ground wave, kept to find where it crosses the other side's. */
interface Wave { x: number; y: number; t0: number; dur: number; r0: number; r1: number; peak: number; rise: number; fade: Ease; hero: boolean; gather: boolean }
/** A grain of light on the plate; it settles on each figure's lines in turn (plate units). */
interface Grain {
  img: Img; ts: number; fl: number; p: Float32Array; phase: number; v0: number; tl: number; size: number;
  /** Its place in the ring at his feet, and the way it is thrown from there at the peak. */
  hx: number; hy: number; dx: number; dy: number; vr: number;
}

const GROUND_Y = 0.36;
/** The staff's hum on the ground, against the radii its cues give. */
const HUM_SCALE = 1.5;
/** The standing rings leave the sigil's rim (its radius) for nodes this far apart. */
const STAND_FROM = 62;
const STAND_FIRST = 82;
const STAND_STEP = 22;

/**
 * Professor Krys strikes her tuning-fork staff. The ground under her is a resonating plate: light gathers on
 * its nodal lines and re-forms into a richer figure on every strike, her wave trains cross his and light the
 * crossings, and the staff hums into the ground in its own mode. At the peak everything resonates: fine rings
 * snap out of the sigil's rim to evenly spaced nodes across the ground and stand there, the column carries the
 * same standing wave upward, neighbours breathing against each other, and one train of hers runs out across
 * them. Nothing of hers but the strike's glint is drawn at the height of a face.
 */
export function krysOpening(kit: HealKit): Opening {
  const {
    calm, lite, pX, pY, nX, nY, sx, heroK, npcK, forkOffset, labelY, pal, view, headHi, headNi, T,
    GROUND, RIPPLE, INSTR, AIR, onNpc, image, shot, groundShot, tick, at, level, rnd, drop,
  } = kit;
  const o = forkOffset.x < 0 ? -1 : 1;
  // Beyond the tines, which are level with her face: far enough out that the strike glint stays off it.
  const gx = o * Math.max(8 * npcK, Math.abs(forkOffset.x) + 1.2 * npcK);
  const gy = forkOffset.y + 0.9 * npcK;
  const G: Point = { x: 0, y: 0 };
  // Where the staff meets the ground: the plate's centre and the source of her waves; his start at his feet.
  const Bx = nX + forkOffset.x;
  const By = nY + 0.5 * npcK;
  const Hx = pX;
  const Hy = pY + 0.5 * heroK;
  const mid = lerpColor(pal.glow, pal.deep, 0.5);

  // ── Fork: catch-light and strikes ───────────────────────────────────────
  const shimmer = image(FX.glow, 0, 0, 3, 3, 0xcfe6ff, INSTR, 'screen').setAlpha(0);
  const shimmerSize = new Track((calm ? 5 : 3) * npcK, calm ? [] : [[215, 120, 5 * npcK, QUAD_O], [1350, 85, 7 * npcK, QUAD_O], [1435, 300, 5 * npcK, SINE_O]]);
  const shimmerBase = new Track(0, calm
    ? [[215, 200, 0.4, SINE_IO], [1195, 200, 0.15, SINE_IO], [1700, 200, 0, SINE_O]]
    : [[215, 120, 0.4, QUAD_O], [1195, 150, 0.15, QUAD_I], [1350, 85, 0.6, QUAD_O], [1435, 260, 0.2, SINE_O], [1700, 200, 0, SINE_O]]);
  // Her body stays calm: one slow lean toward the hero, back after the release. No motion on the onsets.
  const lean = new Track(0, calm ? [] : [[0, 500, 1.5 * sx, SINE_IO], [1435, 500, 0, SINE_IO]]);
  const strike = () => {
    onNpc(gx, gy, G);
    if (calm) shot(HFX.glint, G.x, G.y, { size: [4 * npcK, 4 * npcK], alpha: 0.6, duration: 300, color: 0xfff4dc, depth: AIR, blend: 'add', rise: 150 });
    else shot(HFX.glint, G.x, G.y, { size: [7 * npcK, 7 * npcK], alpha: 0.95, duration: 220, color: 0xfff4dc, depth: AIR, blend: 'add', spin: 20 });
  };

  // ── Hums: the staff's vibrating ring, on the ground around its foot: a ring at the tines would lie across her face ──
  const hums: Hum[] = [];
  const hum = (r0: number, r1: number, dur: number, alpha: number, hz: number, color: number,
    o2: { rise?: number; ease?: Ease; gather?: boolean } = {}) => {
    const a = image(HFX_KRYS.mode, Bx, By, 1, 1, color, RIPPLE + 2 * EPS, 'add').setAlpha(0);
    const b = image(HFX_KRYS.mode, Bx, By, 1, 1, color, RIPPLE + 2 * EPS, 'add').setAlpha(0).setFlipX(true);
    hums.push({
      a, b, t0: kit.clock, dur, r0, r1, peak: alpha, rise: o2.rise ?? (calm ? 0.35 * dur : 40), hz: calm ? 0 : hz,
      ease: o2.ease ?? CUBIC_O, fade: calm ? SINE_IO : QUAD_I, gather: o2.gather ?? false,
    });
  };

  // ── Wave trains on the ground ───────────────────────────────────────────
  const waves: Wave[] = [];
  const train = (hero: boolean, n: number, r0: number, r1: number, dur: number, alpha: number, gap: number, color: number, gather: boolean) => {
    const x = hero ? Hx : Bx;
    const y = hero ? Hy : By;
    const rise = calm ? 0.35 * dur : 0.12 * dur;
    // The opening's trains hold until the gather takes them; later ones start fading at once, with the sound.
    const fade = calm || !gather ? SINE_IO : QUAD_I;
    // Plain blue under the added light: added alone, a blue crest turns lavender where it runs over a path.
    for (let i = 0; i < n; i++) {
      groundShot(HFX_KRYS.wave, x, y, {
        size: [(2 * r0) / KRYS_WAVE_CREST, (2 * r1) / KRYS_WAVE_CREST], aspect: GROUND_Y, alpha: 0.85 * alpha * (1 - 0.3 * i), duration: dur,
        color: i ? mid : color, depth: RIPPLE, rise, ease: CUBIC_O, fadeEase: fade, gather, delay: i * gap,
        fall: !calm && kit.clock < T.fall ? 0.5 : 1,
      }, i ? pal.deep : mid);
    }
    waves.push({ x, y, t0: kit.clock, dur, r0, r1, peak: alpha, rise, fade, hero, gather });
  };
  const waveStrength = (w: Wave, t: number) => {
    const age = t - w.t0;
    if (age < 0 || age >= w.dur || (w.gather && t >= 1350)) return 0;
    let s = age < w.rise ? age / w.rise : 1 - w.fade(clamp01((age - w.rise) / (w.dur - w.rise)));
    if (w.gather) s *= 1 - QUAD_I(progress(t, 1195, 155));
    return w.peak * s;
  };
  // Where her crest and his cross, the two waves add up: a node of light rides each crossing.
  const nodeImgs: Img[] = [];
  for (let i = 0; i < 6; i++) nodeImgs.push(image(HFX.spark, 0, 0, 6, 6, pal.core, RIPPLE + 4 * EPS, 'add').setVisible(false));

  // ── The standing wave on the column: rings at fixed nodes, from above the HP label through the top edge ──
  // The lowest sits above the label and above both faces wherever it would reach across one.
  const nodes: Node[] = [];
  let nodeTop = Math.min(headHi[1], labelY - 14);
  if (headNi[0] < pX + 47 && headNi[2] > pX - 47) nodeTop = Math.min(nodeTop, headNi[1]);
  for (let i = 0; i < 5; i++) {
    const w = 46 + 12 * i;
    const y = nodeTop - 2 - 23 * KRYS_BAND_ASPECT - 15 * i;
    if (y + 0.5 * w * KRYS_BAND_ASPECT < view.top + 3) break;
    nodes.push({
      img: image(HFX_KRYS.band, pX, y, w, w * KRYS_BAND_ASPECT, i % 2 ? mid : pal.glow, AIR + 0.05, 'add').setVisible(false),
      y, w, alpha: 0.9 - 0.08 * i, sign: i % 2 ? -1 : 1, t0: 1435 + (calm ? 300 : 40) * i, leave: 0,
    });
  }
  // After the drop they let go from the top down, one per chime.
  const NODE_LEAVE = [1765, 1970, 2235, 2360];
  nodes.forEach((nd, i) => {
    nd.leave = calm ? 2440 : NODE_LEAVE[Math.min(NODE_LEAVE.length - 1, nodes.length - 1 - i)];
  });
  const NODE_OUT = calm ? 800 : 600;

  // ── The standing wave on the ground: fine rings at evenly spaced nodes around the sigil ──
  const stands: Stand[] = [];
  for (let i = 0, n = calm ? 3 : lite ? 4 : 6; i < n; i++) {
    stands.push({
      base: image(HFX_KRYS.stand, pX, pY + 1, 1, 1, mid, RIPPLE - EPS, 'normal').setVisible(false),
      lit: image(HFX_KRYS.stand, pX, pY + 1, 1, 1, lerpColor(pal.core, pal.glow, 0.4), RIPPLE, 'add').setVisible(false),
      r: STAND_FIRST + STAND_STEP * i, alpha: 1 - 0.12 * i, sign: i % 2 ? -1 : 1, t0: 1435 + (calm ? 110 : 8) * i,
    });
  }
  const STAND_END = calm ? 2750 : 2100;

  // ── The plate under her: three figures, simple to rich ──────────────────
  const plates = KRYS_PLATES.map(key => image(key, Bx, By, 1, 1, mid, GROUND + 2 * EPS, 'add').setAlpha(0));
  // It leads the build, then hands its grains to him and is gone before the lock, so the shared sigil stands alone.
  const plateEnv = new Track(0, calm
    ? [[300, 400, 0.5, SINE_IO], [955, 400, 0.6, SINE_IO], [1100, 450, 0, SINE_IO]]
    : [[300, 80, 0.6, QUAD_O], [595, 90, 0.65, QUAD_O], [955, 90, 0.8, QUAD_O], [1110, 200, 0, SINE_IO]]);
  const plateMix = new Track(0, calm ? [[955, 400, 1, SINE_IO]] : [[595, 100, 1, SINE_IO], [955, 100, 2, SINE_IO]]);
  const plateW = new Track(calm ? 92 : 84, calm
    ? [[300, 1200, 100, SINE_IO]]
    : [[300, 250, 90, SINE_O], [595, 120, 94, QUAD_O], [955, 120, 100, QUAD_O], [1110, 200, 92, SINE_IO]]);
  const platePulse = (t: number) => calm ? 0
    : pulse(t, 300, 0.35, 30, 250) + pulse(t, 595, 0.2, 30, 200) + pulse(t, 680, 0.25, 30, 200) + pulse(t, 955, 0.35, 30, 250)
      + pulse(t, 1110, 0.3, 30, 180);

  // ── Grains: pulled in from the dark onto the lines, re-formed on each strike, thrown up at the peak ──
  const count = calm ? (lite ? 12 : 22) : lite ? 18 : 36;
  const figures = calm ? [krysPlateNodes(0), krysPlateNodes(1)] : [krysPlateNodes(0), krysPlateNodes(1), krysPlateNodes(2)];
  const paths = figures.map(() => new Float32Array(count * 2));
  for (let j = 0; j < count; j++) {
    const src = figures[0];
    const q = (j % (src.length / 2)) * 2;
    paths[0][2 * j] = src[q];
    paths[0][2 * j + 1] = src[q + 1];
  }
  // Each later figure: the nearest free point to where the grain sits, as sand flows on a plate.
  for (let f = 1; f < figures.length; f++) {
    const src = figures[f];
    const taken = new Uint8Array(src.length / 2);
    for (let j = 0; j < count; j++) {
      let best = 0;
      let bestD = Infinity;
      for (let q = 0; q < taken.length; q++) {
        if (taken[q] && count <= taken.length) continue;
        const d = (src[2 * q] - paths[f - 1][2 * j]) ** 2 + (src[2 * q + 1] - paths[f - 1][2 * j + 1]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = q;
        }
      }
      taken[best] = 1;
      paths[f][2 * j] = src[2 * best];
      paths[f][2 * j + 1] = src[2 * best + 1];
    }
  }
  const grains: Grain[] = [];
  for (let j = 0; j < count; j++) {
    const p = new Float32Array(2 * (figures.length + 1));
    const ax = paths[0][2 * j];
    const ay = paths[0][2 * j + 1];
    const ang = Math.atan2(ay, ax) + (rnd() - 0.5) * 0.6;
    const far = 1.8 + 0.5 * rnd();
    p[0] = far * Math.cos(ang);
    p[1] = far * Math.sin(ang);
    for (let f = 0; f < figures.length; f++) {
      p[2 + 2 * f] = paths[f][2 * j];
      p[3 + 2 * f] = paths[f][2 * j + 1];
    }
    const spark = j % 4 === 0;
    const size = spark ? 3.6 : 2.6;
    const phi = (j / count) * Math.PI * 2 + 0.3;
    const rr = (10 + 4 * (j % 3)) * heroK;
    grains.push({
      hx: Hx + Math.cos(phi) * rr, hy: Hy + Math.sin(phi) * rr * GROUND_Y, dx: Math.cos(phi), dy: Math.sin(phi) * GROUND_Y, vr: 70 + 60 * rnd(),
      img: image(spark ? HFX.spark : HFX.mote, Bx, By, size, size, j % 3 === 0 ? pal.core : pal.spark, RIPPLE + 3 * EPS, 'add').setVisible(false),
      ts: calm ? 300 + 12 * j : 300 + 3 * j, fl: calm ? 500 : 250 + 70 * rnd(), p, phase: rnd() * 6.283, v0: 75 + 55 * rnd(),
      tl: 1435 + 4 * j, size,
    });
  }
  const MIGRATE = calm ? [955] : [595, 955];
  const migrateFor = calm ? 500 : 150;
  const G2: Point = { x: 0, y: 0 };
  const grainAt = (g: Grain, j: number, t: number, out: Point) => {
    const p = g.p;
    let x = p[2];
    let y = p[3];
    if (!calm && t < g.ts + g.fl) {
      const k = QUAD_O(clamp01((t - g.ts) / g.fl));
      x = lerp(p[0], p[2], k);
      y = lerp(p[1], p[3], k);
    } else {
      for (let f = 0; f < MIGRATE.length; f++) {
        const k = SINE_IO(clamp01((t - MIGRATE[f] - 2 * j) / migrateFor));
        if (k <= 0) break;
        x = lerp(p[2 + 2 * f], p[4 + 2 * f], k);
        y = lerp(p[3 + 2 * f], p[5 + 2 * f], k);
      }
    }
    out.x = x;
    out.y = y;
    return out;
  };

  // ── Cues ────────────────────────────────────────────────────────────────
  if (calm) {
    at(300, () => {
      strike();
      train(false, 1, 8, 70, 1200, 0.45, 0, mid, true);
    });
    at(955, () => {
      train(true, 1, 6, 50, 1200, 0.4, 0, mid, true);
      tick();
    });
    at(1435, () => train(false, 1, 8, 120, 1700, 0.5, 0, mid, false));
    at(1765, () => train(true, 1, 6, 100, 1600, 0.4, 0, mid, false));
    [1765, 2100, 2440].forEach((time, i) => at(time, () => hum(3, 12, 1100, 0.45 * 0.8 ** i, 0, pal.core)));
  } else {
    at(215, () => hum(2, 12, 380, 0.55, 10, pal.core));
    at(300, () => {
      strike();
      hum(3, 12, 450, 0.6, 9, pal.core, { gather: true });
      train(false, 3, 8, 86, 800, 0.75, 80, mid, true);
    });
    // He answers: his own train, which crosses hers.
    at(595, () => {
      train(true, 2, 4, 64, 700, 0.65, 80, mid, true);
      tick();
    });
    at(680, () => {
      hum(3, 11, 400, 0.55, 10, pal.core, { gather: true });
      train(false, 1, 6, 44, 500, 0.45, 0, mid, true);
    });
    // The lock: her strike and his ring start on the same frame.
    at(955, () => {
      strike();
      hum(3, 12, 450, 0.6, 9, pal.core, { gather: true });
      train(false, 3, 8, 96, 800, 0.8, 80, mid, true);
      train(true, 1, 4, 40, 600, 0.55, 0, mid, true);
      tick();
    });
    at(1110, () => {
      train(true, 2, 4, 70, 700, 0.65, 80, mid, true);
      hum(3, 11, 400, 0.55, 10, pal.core, { gather: true });
    });
    // The gather: the standing wave collapses onto him and onto the staff's foot.
    at(1195, () => {
      shot(HFX_KRYS.wave, Hx, Hy, { size: [200, 16], aspect: GROUND_Y, alpha: 0.7, duration: 155, color: mid, depth: RIPPLE, blend: 'add', rise: 70, ease: QUAD_I, fadeEase: QUAD_I });
      hum(16, 3, 155, 0.7, 12, pal.core, { rise: 90, ease: QUAD_I });
    });
    // The release: the ground's standing rings are drawn per frame; one train of hers runs out across them.
    at(1435, () => {
      strike();
      hum(3, 14, 500, 0.7, 9, pal.core);
      train(false, 2, 8, 150, 620, 0.7, 90, pal.core, false);
    });
    at(1555, () => hum(3, 13, 400, 0.6, 9, pal.core));
    // Afterglow: the staff hums on every chime, and three times a ring leaves it over the ground.
    [1765, 1830, 1970, 2030, 2235, 2360].forEach((time, i) => at(time, () => hum(3, 12, 900, 0.6 * 0.85 ** i, 6, pal.core)));
    [1765, 1970, 2235].forEach((time, i) => at(time, () => train(false, 1, 6, 36, 1100, 0.45 * 0.8 ** i, 0, mid, false)));
  }
  at(STAND_END, () => {
    for (const sd of stands) {
      drop(sd.base);
      drop(sd.lit);
    }
    stands.length = 0;
  });
  at(3400, () => {
    plates.forEach(drop);
    grains.forEach(g => drop(g.img));
    grains.length = 0;
  });

  return {
    angle: t => (t >= 1900 ? 0 : lean.at(t)),
    frame(t) {
      // Fork catch-light.
      if (t >= 215 && t < 1900) {
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
      } else if (shimmer.visible && t >= 1900) shimmer.setVisible(false);

      // Plate.
      if (plates[0].active && t >= 300) {
        let env = plateEnv.at(t) + platePulse(t);
        if (!calm && t < 1750) env *= 0.7 + 0.35 * level(t);
        const mix = plateMix.at(t);
        const w = plateW.at(t);
        for (let i = 0; i < plates.length; i++) {
          const weight = clamp01(1 - Math.abs(mix - i));
          plates[i].setDisplaySize(w, w * GROUND_Y).setAlpha(clamp01(env * weight)).setVisible(env * weight > 0.003);
        }

        // Grains.
        const half = w / 2;
        for (let j = 0; j < grains.length; j++) {
          const g = grains[j];
          if (t < g.ts) continue;
          grainAt(g, j, t, G2);
          // Pulled from the plate to the ring at his feet.
          const k = calm ? SINE_IO(clamp01((t - 1035 - 4 * j) / 400)) : QUAD_I(clamp01((t - 1195 - j) / 150));
          let x = lerp(Bx + G2.x * half, g.hx, k);
          let y = lerp(By + G2.y * half * GROUND_Y, g.hy, k);
          let a: number;
          let z = 0;
          if (calm) {
            a = 0.85 * SINE_IO(clamp01((t - g.ts) / g.fl)) * (1 - SINE_IO(progress(t, 1435, 900)));
            z = 4 * SINE_O(progress(t, 1435, 900));
          } else {
            a = 0.95 * QUAD_O(clamp01((t - g.ts) / g.fl)) * (0.75 + 0.25 * Math.sin(g.phase + t * 0.018));
            a += 0.5 * (pulse(t, 680, 1, 30, 200) + pulse(t, 1110, 1, 30, 200) + pulse(t, 1350, 1, 30, 85));
            if (t >= g.tl) {
              // Thrown off the ring at the peak: out across the ground and up, like sand off a ringing plate.
              const tau = (t - g.tl) / 1000;
              const out = (g.vr * (1 - Math.exp(-3 * tau))) / 3;
              x += g.dx * out;
              y += g.dy * out;
              z = Math.max(0, g.v0 * tau - 260 * tau * tau);
              a *= 1 - QUAD_I(progress(t, g.tl, 700));
            }
          }
          if (a <= 0.005) {
            if (g.img.visible) g.img.setVisible(false);
            continue;
          }
          const grow = 1 + 0.4 * clamp01(a - 0.9);
          g.img.setVisible(true).setPosition(x, y - z)
            .setDisplaySize(g.size * grow, g.size * grow).setAlpha(clamp01(a));
        }
      }

      // Nodes where her crests cross his.
      let used = 0;
      for (const k of waves) {
        if (k.hero) continue;
        const sk = waveStrength(k, t);
        if (sk <= 0.02) continue;
        const r1 = lerp(k.r0, k.r1, CUBIC_O(clamp01((t - k.t0) / k.dur)));
        for (const h of waves) {
          if (!h.hero || used >= nodeImgs.length) continue;
          const sh = waveStrength(h, t);
          if (sh <= 0.02) continue;
          const r2 = lerp(h.r0, h.r1, CUBIC_O(clamp01((t - h.t0) / h.dur)));
          const ex = h.x - k.x;
          const ey = (h.y - k.y) / GROUND_Y;
          const d = Math.hypot(ex, ey);
          if (d < 0.01 || d >= r1 + r2 || d <= Math.abs(r1 - r2)) continue;
          const along = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
          const off = Math.sqrt(Math.max(0, r1 * r1 - along * along));
          const alpha = clamp01(1.6 * Math.min(sk, sh));
          const size = (calm ? 5 : 6.5) * (0.85 + 0.15 * Math.sin(t * 0.04));
          for (let side = -1; side <= 1 && used < nodeImgs.length; side += 2) {
            const x = k.x + (along * ex - side * off * ey) / d;
            const y = k.y + ((along * ey + side * off * ex) / d) * GROUND_Y;
            nodeImgs[used++].setVisible(true).setPosition(x, y).setDisplaySize(size, size).setAlpha(alpha);
          }
        }
      }
      for (let i = used; i < nodeImgs.length; i++) if (nodeImgs[i].visible) nodeImgs[i].setVisible(false);
      for (let i = waves.length - 1; i >= 0; i--) if (t >= waves[i].t0 + waves[i].dur) waves.splice(i, 1);

      // The standing wave on the column.
      for (const nd of nodes) {
        if (t < nd.t0) continue;
        if (t >= nd.leave + NODE_OUT) {
          if (nd.img.visible) nd.img.setVisible(false);
          continue;
        }
        const k = progress(t, nd.t0, calm ? 400 : 180);
        const out = progress(t, nd.leave, NODE_OUT);
        let w = nd.w;
        let y = nd.y;
        let a: number;
        if (calm) {
          a = 0.5 * SINE_IO(k) * (1 - SINE_IO(out));
          y -= 12 * SINE_IO(out);
        } else {
          // Neighbours breathe in opposite phase; all of them swell on the plateau's onsets and halve on the drop.
          w *= 1 + 0.08 * nd.sign * Math.sin((t - 1435) * 0.035) + 0.15 * (pulse(t, 1555, 1, 40, 180) + pulse(t, 1675, 1, 40, 180));
          a = nd.alpha * QUAD_O(k) * (0.85 + 0.15 * level(t)) * lerp(1, 0.5, QUAD_O(progress(t, T.fall, FALL_MS))) * (1 - QUAD_I(out));
          y += 10 * (1 - CUBIC_O(k)) - 36 * QUAD_I(out);
        }
        nd.img.setVisible(true).setPosition(pX, y).setDisplaySize(w, w * KRYS_BAND_ASPECT).setAlpha(clamp01(a));
      }

      // The standing wave on the ground.
      for (const sd of stands) {
        if (t < sd.t0) continue;
        let r: number;
        let a: number;
        if (calm) {
          r = sd.r * lerp(0.94, 1, SINE_O(progress(t, sd.t0, 700)));
          a = 0.5 * sd.alpha * SINE_IO(progress(t, sd.t0, 400)) * (1 - SINE_IO(progress(t, 1900, 800)));
        } else {
          // Out of the sigil's rim to its node, brightest as it arrives; there it breathes against its neighbours,
          // swells on the plateau's onset, steps down with the release and lets go outward.
          const out = progress(t, T.fall + 50, 360);
          r = lerp(STAND_FROM, sd.r, EXPO_O(progress(t, sd.t0, 220))) * (1 + 0.012 * sd.sign * Math.sin((t - 1435) * 0.03)) + 16 * QUAD_I(out);
          a = sd.alpha * QUAD_O(progress(t, sd.t0, 60)) * lerp(1, 0.7, SINE_IO(progress(t, sd.t0 + 80, 150)))
            * (0.85 + 0.15 * level(t) + 0.3 * pulse(t, 1555, 1, 40, 150))
            * lerp(1, 0.35, QUAD_O(progress(t, T.fall, FALL_MS))) * (1 - QUAD_I(out));
        }
        const on = a > 0.004;
        const w = (2 * r) / KRYS_STAND_CREST;
        sd.base.setVisible(on).setDisplaySize(w, w * GROUND_Y).setAlpha(clamp01(0.8 * a));
        sd.lit.setVisible(on).setDisplaySize(w, w * GROUND_Y).setAlpha(clamp01(0.75 * a));
      }

      // Hums.
      for (let i = hums.length - 1; i >= 0; i--) {
        const h = hums[i];
        const age = t - h.t0;
        if (age < 0) continue;
        const k = age / h.dur;
        if (k >= 1 || (h.gather && t >= 1350)) {
          drop(h.a);
          drop(h.b);
          hums.splice(i, 1);
          continue;
        }
        let env = h.peak * (age < h.rise ? age / h.rise : 1 - h.fade(clamp01((age - h.rise) / Math.max(1, h.dur - h.rise))));
        if (h.gather) env *= 1 - QUAD_I(progress(t, 1195, 155));
        const c = h.hz > 0 ? 0.5 + 0.5 * Math.cos((2 * Math.PI * h.hz * age) / 1000) : 1;
        const w = (2 * HUM_SCALE * lerp(h.r0, h.r1, h.ease(k))) / KRYS_MODE_CREST;
        h.a.setDisplaySize(w, w * GROUND_Y).setAlpha(clamp01(env * c));
        h.b.setDisplaySize(w, w * GROUND_Y).setAlpha(clamp01(env * (1 - c)));
      }
    },
  };
}
