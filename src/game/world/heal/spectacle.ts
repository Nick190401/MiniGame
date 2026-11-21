import Phaser from 'phaser';
import { FX } from '../../art/fx';
import { HFX } from '../../art/healFx';
import {
  BACK_O, CUBIC_O, EXPO_O, FALL_MS, ONSETS, QUAD_I, QUAD_O, SINE_I, SINE_IO, SINE_O, Track, around, boxDistance, clamp01, lerp, lerpColor,
  progress, pulse,
  type Box, type Ease, type HealDriver, type Key, type Point,
} from './kit';

/**
 * The light every healer shares, in three acts on the sound's loudness.
 * Gather (0-1350): the world dims to a stage, a sigil of written music turns up
 * under the hero layer by layer and light is drawn in across the ground.
 * Release (1435): a pillar from the ground to beyond the top edge, rays and a
 * burst; the shape that crosses the frame is each healer's own, not drawn here.
 * Afterglow (1700 to T.end): the pillar thins to a thread and rising streaks, the sigil
 * steps down on the chimes, notes spiral up. Nothing here touches hero, healer
 * or camera, so it runs on past the hand-back.
 */

export interface Spectacle {
  /** Registers the shared cues; call it after the healer's opening, whose cues of the same time run first. */
  cues(): void;
  frame(t: number, dt: number): void;
}

const SQUASH = 0.36;
const TAU = Math.PI * 2;
const ADD = Phaser.BlendModes.ADD;
const CUBIC_I: Ease = v => v * v * v;
const LATE: Ease = v => v ** 5;
const NOTE_KEYS = [HFX.noteEighth, HFX.notePair, HFX.noteQuarter, HFX.noteSixteenth, HFX.noteHalf];
/** The last moment anything may still be alight. */
const DARK = 3940;
/** The dimmer and the floor under the sigil are neutral: tinted, they lie on stone as a rust or olive stain. */
const SHADE = 0x07090d;
/** The HP label has faded by then (index.ts). */
const LABEL_GONE = 2500;

export function createSpectacle(kit: HealDriver): Spectacle {
  const {
    scene, calm, lite, pX, pY, nX, nY, C, heroK, npcK, view, pal, T, level, rnd, at, own, drop, image, shot, groundShot, glint,
    GROUND, RIPPLE, BACK, VIG, SKY, AIR, NOTES, clearOfFaces, headNi,
  } = kit;
  const spawn = kit.coreParticle;
  const few = lite ? 0.5 : 1;
  const footY = pY + 1;
  const hot = lerpColor(pal.core, 0xffffff, 0.5);
  const CHIMES: readonly number[] = calm ? [1765, 2100, 2440] : ONSETS.chimes;
  const chimeAt = (t: number) => {
    let v = 0;
    for (const tc of CHIMES) v = Math.max(v, pulse(t, tc, 1, calm ? 150 : 40, calm ? 320 : 220));
    return v;
  };

  // ── The stage: the world dims around the pair, parts for the pillar, then gives the light back ──
  const midX = (pX + nX) / 2;
  const midY = (C.y + nY - 13 * npcK) / 2;
  // The dimmer's border is solid: it has to stay outside the view wherever the pair stands in it.
  const stageW = Math.max(view.width * 1.45, 2 * (Math.max(midX - view.left, view.right - midX) + 16));
  const stageH = Math.max(view.height * 1.6, 2 * (Math.max(midY - view.top, view.bottom - midY) + 16));
  const stage = image(HFX.stage, midX, midY, stageW, stageH, SHADE, VIG, 'normal').setAlpha(0);
  const stageAlpha = new Track(0, calm
    ? [[0, 1200, 0.56, SINE_IO], [1435, 265, 0.42, SINE_IO], [1935, T.handBack - 1935, 0, SINE_IO]]
    // It gives way to the light over 220 ms: with everything else at the peak, the frame as a whole must not jump.
    : [[0, 700, 0.56, SINE_IO], [955, 395, 0.74, SINE_I], [1435, 220, 0.6, SINE_IO], [T.fall, 300, 0.4, SINE_O], [2000, T.handBack - 2000, 0, SINE_IO]]);
  const stageTall = new Track(1, calm ? [[1435, 265, 2, SINE_IO]] : [[1350, 85, 1.2, QUAD_I], [1435, 190, 2.6, CUBIC_O]]);
  const stageWide = new Track(1, [[T.fall, T.handBack - T.fall, 1.5, SINE_I]]);

  // ── Ground: a pool of light, the three sigil layers, comets winding in ──
  // Added light takes the colour of the ground under it: blue on grass, cream on a path. A dark floor under the
  // sigil keeps the light one hue wherever the pair stands. It goes while the sigil is still bright: under a
  // fading sigil it is a dark patch, and one that differs from grass to path.
  const floor = image(HFX.pool, pX, footY, 290, 290 * SQUASH, SHADE, GROUND - 0.001, 'normal').setAlpha(0);
  const floorAlpha = new Track(0, calm
    ? [[120, 600, 0.68, SINE_IO], [1900, 900, 0, SINE_IO]]
    : [[120, 400, 0.66, SINE_IO], [T.fall, 300, 0.45, SINE_IO], [1950, 500, 0, SINE_IO]]);
  // The underglow starts small and faint and grows with the crescendo: wide and dim, a warm colour is only brown.
  const pool = image(HFX.pool, pX, footY, 80, 80 * SQUASH, lerpColor(pal.deep, pal.glow, 0.4), GROUND, 'screen').setAlpha(0);
  const poolAlpha = new Track(0, calm
    ? [[215, 900, 0.2, SINE_IO], [1435, 215, 0.55, SINE_O], [T.fall, 300, 0.36, SINE_IO], [2000, 1400, 0, SINE_IO]]
    : [[215, 700, 0.16, SINE_IO], [955, 395, 0.5, SINE_I], [1435, 60, 0.75, QUAD_O], [T.fall, FALL_MS, 0.4, QUAD_O], [1760, 1650, 0, SINE_IO]]);
  const poolSize = new Track(80, calm ? [[955, 480, 120, SINE_IO], [1435, 265, 170, SINE_IO]] : [[955, 395, 140, SINE_I], [1435, 160, 210, EXPO_O], [T.fall, 600, 170, SINE_IO]]);

  const sigil = (key: string, size: number, t0: number, turn: number, out: number, outFor: number, z: number) => {
    const angle = 360 * rnd();
    // Drawn twice: plain in the healer's colour, which holds the hue on any ground, and added on top as light.
    const base = scene.add.image(0, 0, key).setDisplaySize(size, size).setTint(pal.glow).setAlpha(0.42).setAngle(angle);
    const art = scene.add.image(0, 0, key).setDisplaySize(size, size).setBlendMode(ADD).setAlpha(0.76).setAngle(angle);
    const box = own(scene.add.container(pX, footY, [base, art]).setDepth(GROUND + z).setAlpha(0));
    return { base, art, box, t0, turn, out, outFor };
  };
  const sigils = [
    sigil(HFX.sigilFifths, 56, ONSETS.gather[0], 2.1, 2450, 500, 0.003),
    sigil(HFX.sigilWave, 84, ONSETS.gather[2], -1.5, 2700, 600, 0.002),
    sigil(HFX.sigilStaff, 128, ONSETS.gather[4], 1, 2950, 750, 0.001),
  ];
  // After the drop the sigil settles one step lower on every chime.
  const steps: Key[] = CHIMES.map((tc, i) => [tc + (calm ? 150 : 50), calm ? 150 : 60, 0.66 * (1 - (i + 1) / (CHIMES.length + 2.5)), SINE_IO]);
  const charge = new Track(0.5, calm
    ? [[955, 480, 0.75, SINE_IO], [1435, 215, 0.9, SINE_O], ...steps]
    : [[955, 240, 0.68, SINE_IO], [1195, 155, 0.95, QUAD_I], [1435, 50, 1, QUAD_O], [T.fall, FALL_MS, 0.66, QUAD_O], ...steps]);
  const heat = new Track(0.15, [[955, 480, 0.75, SINE_I], [1435, calm ? 215 : 40, 1, QUAD_O], [T.fall, 300, 0.4, SINE_O], [2400, 800, 0.2, SINE_IO]]);
  /** Degrees per second of the outer layer. */
  const spin = new Track(calm ? 7 : 14, calm ? [] : [[595, 360, 26, SINE_IO], [1195, 240, 190, QUAD_I], [1435, 40, 300, QUAD_O], [1475, 520, 40, EXPO_O], [1995, 900, 12, SINE_O]]);
  const squeeze = new Track(1, calm ? [] : [[1195, 240, 0.9, QUAD_I], [1435, 170, 1.1, EXPO_O], [T.fall, 520, 1.03, SINE_IO]]);

  // Each comet twice, like the sigil: plain in the healer's colour under the added light.
  const swirlArt = calm ? [] : [0, 120, 240].flatMap(a => [
    scene.add.image(0, 0, HFX.swirl).setTint(pal.glow).setAlpha(0.75).setAngle(a),
    scene.add.image(0, 0, HFX.swirl).setTint(pal.core).setBlendMode(ADD).setAlpha(0.55).setAngle(a),
  ]);
  const swirlBox = own(scene.add.container(pX, footY, swirlArt).setScale(1, SQUASH).setDepth(GROUND + 0.004).setAlpha(0));
  // The gather does not fade before the hit: it falls in on the hero's feet and knots there, and the beam rises out of the knot.
  const swirlSize = new Track(176, [[595, 600, 124, SINE_IO], [1195, 215, 22, CUBIC_I]]);
  const swirlAlpha = new Track(0, [[595, 300, 0.7, SINE_IO], [1195, 155, 1, QUAD_I], [1410, 30, 0, QUAD_I]]);
  const swirlSpin = new Track(150, [[595, 600, 260, SINE_IO], [1195, 240, 760, QUAD_I]]);
  const knot = calm ? undefined : image(HFX.bloom, pX, footY, 84, 84 * 0.5, hot, RIPPLE, 'add').setAlpha(0);
  const knotSize = new Track(84, [[1195, 160, 38, QUAD_I], [1435, 90, 58, QUAD_O]]);
  const knotAlpha = new Track(0, [[1195, 160, 1, QUAD_I], [1435, 110, 0, SINE_IO]]);

  // ── Light behind the pair: ground rays, the burst, the aura, the pillar ──
  const fan = image(HFX.rayFan, pX, footY + 2, 150, 90, pal.glow, BACK, 'add').setOrigin(0.5, 0.955).setAlpha(0);
  const fanAlpha = new Track(0, calm
    ? [[1435, 215, 0.34, SINE_O], [T.fall, 300, 0.2, SINE_IO], [2000, 900, 0, SINE_IO]]
    : [[1110, 240, 0.34, SINE_I], [1435, 50, 0.6, QUAD_O], [1485, 215, 0.42, SINE_O], [T.fall, FALL_MS, 0.14, QUAD_O], [1760, 900, 0, SINE_IO]]);
  const fanWidth = new Track(calm ? 260 : 150, calm ? [] : [[1435, 200, 320, EXPO_O], [1635, 900, 290, SINE_IO]]);
  // The burst behind the pair, and long thin rays over the darkened world. Open in the middle: nothing lies on a face.
  const raysBack = image(HFX.raysOpen, C.x, C.y, 130, 130, pal.glow, BACK, 'add').setAlpha(0);
  // Over the darkened world it spans most of the frame, so it comes up slower than the burst behind the pair. Not on the iOS path.
  const raysFar = lite ? undefined : image(HFX.raysOpen, C.x, C.y, 130, 130, pal.core, SKY, 'add').setAlpha(0).setFlipX(true).setAngle(47);
  const raysAlpha = new Track(0, calm
    ? [[1435, 215, 0.4, SINE_O], [T.fall, 300, 0.24, SINE_IO], [2000, 700, 0, SINE_IO]]
    : [[1435, 40, 0.9, QUAD_O], [1520, 180, 0.6, SINE_O], [T.fall, FALL_MS, 0.14, QUAD_O], [1760, 520, 0, SINE_IO]]);
  const farAlpha = new Track(0, calm
    ? [[1435, 215, 0.17, SINE_O], [T.fall, 300, 0.1, SINE_IO], [2000, 700, 0, SINE_IO]]
    : [[1435, 100, 0.38, SINE_IO], [1535, 165, 0.25, SINE_O], [T.fall, FALL_MS, 0.06, QUAD_O], [1760, 520, 0, SINE_IO]]);
  const raysSize = new Track(calm ? 230 : 130, calm ? [] : [[1435, 150, 270, EXPO_O], [1585, 600, 300, SINE_O]]);
  const aura = image(HFX.bloom, C.x, C.y, 30, 30, pal.glow, BACK, 'screen').setAlpha(0);
  const auraAlpha = new Track(0, calm
    ? [[955, 480, 0.25, SINE_IO], [1435, 215, 0.5, SINE_O], [T.fall, 300, 0.3, SINE_IO], [2000, 800, 0, SINE_IO]]
    : [[955, 395, 0.5, SINE_I], [1435, 45, 0.7, QUAD_O], [1480, 220, 0.5, SINE_O], [T.fall, FALL_MS, 0.18, QUAD_O], [1760, 950, 0, SINE_IO]]);
  const auraSize = new Track(34, calm ? [[1435, 215, 120, SINE_O]] : [[955, 395, 46, SINE_I], [1435, 120, 140, EXPO_O], [1555, 145, 124, SINE_O], [T.fall, FALL_MS, 90, QUAD_O], [1760, 900, 80, SINE_IO]]);

  const colBase = footY + 2;
  // The texture's foot sits at 95.5 % of its height; the top ends well above the frame.
  const colH = (colBase - view.top + 40) / 0.955;
  const column = (width: number, color: number) => image(HFX.column, pX, colBase, width, colH, color, BACK, 'add').setOrigin(0.5, 0.955).setAlpha(0);
  // Three widths of one pillar: the healer's colour as its halo, the light, the white core.
  const colDeep = column(30, pal.deep);
  const colGlow = column(34, pal.glow);
  const colCore = column(18, hot);
  const deepWidth = new Track(calm ? 70 : 30, calm
    ? [[1435, 215, 110, SINE_O], [T.fall, 300, 80, SINE_IO], [2000, 800, 40, SINE_IO]]
    : [[1435, 70, 144, EXPO_O], [1505, 195, 126, SINE_O], [T.fall, FALL_MS, 54, QUAD_O], [1760, 700, 30, SINE_IO]]);
  const deepAlpha = new Track(0, calm
    ? [[1435, 215, 0.5, SINE_O], [T.fall, 300, 0.3, SINE_IO], [2000, 800, 0, SINE_IO]]
    : [[1435, 45, 0.8, QUAD_O], [T.fall, FALL_MS, 0.32, QUAD_O], [1760, 700, 0, SINE_IO]]);
  const glowWidth = new Track(calm ? 40 : 34, calm
    ? [[1435, 215, 72, SINE_O], [T.fall, 300, 52, SINE_IO], [2000, 800, 28, SINE_IO]]
    : [[1435, 70, 98, EXPO_O], [1505, 195, 84, SINE_O], [T.fall, FALL_MS, 36, QUAD_O], [1760, 800, 24, SINE_IO]]);
  const glowAlpha = new Track(0, calm
    ? [[1435, 215, 0.6, SINE_O], [T.fall, 300, 0.4, SINE_IO], [2000, 800, 0.2, SINE_IO], [2800, 500, 0, SINE_IO]]
    : [[1350, 60, 0.35, QUAD_O], [1435, 45, 0.95, QUAD_O], [T.fall, FALL_MS, 0.42, QUAD_O], [1760, 800, 0.16, SINE_IO], [2590, 600, 0, SINE_IO]]);
  // The core is lit first, as a thread that shoots up on the 1350 onset, and is the last light to go.
  // Never narrower than 14: below that the texture's core is a hairline.
  const coreWidth = new Track(18, calm
    ? [[1435, 215, 24, SINE_O], [T.fall, 300, 18, SINE_IO], [2000, 800, 14, SINE_IO]]
    : [[1435, 60, 36, EXPO_O], [1495, 205, 28, SINE_O], [T.fall, FALL_MS, 17, QUAD_O], [1760, 700, 14, SINE_IO]]);
  const coreAlpha = new Track(0, calm
    ? [[1435, 215, 0.75, SINE_O], [T.fall, 300, 0.5, SINE_IO], [2000, 800, 0.34, SINE_IO], [2800, 600, 0, SINE_IO]]
    : [[1350, 60, 0.6, QUAD_O], [1435, 40, 1, QUAD_O], [T.fall, FALL_MS, 0.6, QUAD_O], [1760, 700, 0.38, SINE_IO], [2490, 400, 0.26, SINE_IO], [2890, 460, 0, SINE_IO]]);
  const columnRise = new Track(calm ? 1 : 0.12, calm ? [] : [[1350, 85, 1, QUAD_O]]);

  // ── Particles ───────────────────────────────────────────────────────────
  /** In front of everything where a straight rise passes neither face, else behind the pair. */
  const riseDepth = (x: number) => (Math.abs(x - pX) > 7.5 * heroK && Math.abs(x - nX) > 7.5 * npcK ? AIR : BACK);
  const P: Point = { x: 0, y: 0 };

  /** Light drawn in across the ground from far outside the sigil, winding into its centre; all of it is in by 1400. */
  const inflow = (t: number) => {
    const life = Math.min(calm ? 1100 : 430 + 170 * rnd(), 1425 - t);
    if (life < (calm ? 500 : 130)) return;
    const a = rnd() * TAU;
    // The last ones before the hit have less time and start nearer.
    const R = calm ? 60 + 40 * rnd() : (105 + 70 * rnd()) * Math.min(1, life / 380);
    const swing = calm ? 0.25 : 0.7 + 0.5 * rnd();
    const ease = calm ? SINE_IO : QUAD_I;
    spawn(HFX.streak, {
      x: pX + Math.cos(a + swing) * R, y: footY + Math.sin(a + swing) * R * SQUASH,
      path: (k, out) => {
        const e = ease(k);
        const r = lerp(R, 5, e);
        const ang = a + swing * (1 - e);
        out.x = pX + Math.cos(ang) * r;
        out.y = footY + Math.sin(ang) * r * SQUASH;
      },
      life, size: [3, 4.2], aspect: calm ? 3 : 9, alpha: 0.9, rise: 0.35, color: pal.glow, depth: RIPPLE, blend: 'add', align: true,
    });
  };
  let inflowDue = 0;

  /** Sparks lifted off the sigil. */
  const lifted = (count: number, slow = calm) => {
    for (let i = 0; i < count; i++) {
      const life = Math.min(slow ? 1300 : 650 + 250 * rnd(), DARK - kit.clock);
      if (life < 400) return;
      const a = rnd() * TAU;
      const r = 14 + 44 * rnd();
      const x = pX + Math.cos(a) * r;
      spawn(rnd() < 0.6 ? HFX.spark : HFX.mote, {
        x, y: footY + Math.sin(a) * r * SQUASH, vx: (rnd() - 0.5) * 8, vy: slow ? -14 - 14 * rnd() : -20 - 40 * rnd(), ay: slow ? -6 : -50,
        life, size: [(slow ? 7 : 3) + (slow ? 5 : 4) * rnd(), slow ? 2.5 : 1.5], alpha: 0.95, rise: 0.2,
        color: slow ? pal.core : pal.spark, depth: riseDepth(x), blend: 'add', twinkle: slow ? 0.35 : 0.5, spin: 60,
      });
    }
  };

  /**
   * A note of light that lifts off the sigil's outer ring and winds up around the pillar. Its whole path stays
   * off both faces and, while the HP label is up, off the label.
   */
  let noteIndex = 0;
  const noteColor = lerpColor(pal.glow, 0xffffff, 0.5);
  const labelBox: Box = around(pX, kit.labelY - 6.5, 24, 11);
  const note = (delay = 0) => {
    const life = Math.min(calm ? 1500 : 1500 + 400 * rnd(), DARK - kit.clock - delay);
    if (life < 600) return;
    const labelUp = kit.clock + delay < LABEL_GONE;
    for (let tries = 0; tries < 8; tries++) {
      // Each one starts a golden angle on from the last, so they ring the pillar instead of bunching.
      const a0 = (noteIndex + tries) * 2.4 + 0.8 * rnd();
      const turn = calm ? 0.4 + 0.3 * rnd() : 1.1 + 0.9 * rnd();
      const r0 = 42 + 16 * rnd();
      const r1 = r0 + (calm ? 3 : 6 + 10 * rnd());
      const climb = calm ? 40 + 16 * rnd() : 66 + 34 * rnd();
      const path = (k: number, out: Point) => {
        const a = a0 + turn * k;
        const r = lerp(r0, r1, k);
        out.x = pX + Math.cos(a) * r;
        out.y = footY + Math.sin(a) * r * SQUASH - climb * SINE_O(k);
      };
      let clear = true;
      for (let s = 16; s >= 0 && clear; s--) {
        path(s / 16, P);
        clear = clearOfFaces(P.x, P.y, 6, false) && !(labelUp && boxDistance(P.x, P.y, labelBox) < 3);
      }
      if (!clear) continue;
      const size = 10 + 3 * rnd();
      const grow: Ease = k => QUAD_O(Math.min(1, k * 6));
      // Its glow first, so the glyph reads as light on any ground and not as a sticker.
      spawn(FX.glow, {
        x: P.x, y: P.y, path, life, delay, size: [6, 2.4 * size], sizeEase: grow, alpha: 0.34, rise: 0.06, color: pal.glow,
        depth: NOTES - 0.01, blend: 'add', fadeEase: LATE,
      });
      spawn(NOTE_KEYS[noteIndex++ % NOTE_KEYS.length], {
        x: P.x, y: P.y, path, life, delay, size: [3, size], sizeEase: grow, aspect: 14 / 12,
        alpha: 1, rise: 0.06, color: noteColor, depth: NOTES, blend: 'normal', angle: -10 + 20 * rnd(), spin: 24 * (rnd() - 0.5), fadeEase: LATE,
      });
      return;
    }
  };

  /** Streaks rising where the pillar stood. */
  const riser = (t: number) => {
    const spread = lerp(15, 5, progress(t, T.fall, 1400));
    const life = Math.min(calm ? 1100 : 520 + 260 * rnd(), DARK - t);
    if (life < 250) return;
    spawn(HFX.streak, {
      x: pX + (rnd() * 2 - 1) * spread, y: footY - 26 * rnd(), vy: calm ? -70 - 40 * rnd() : -150 - 130 * rnd(), ay: calm ? 0 : -90,
      life, size: [2.6, 1.4], aspect: 7, alpha: 0.85, rise: 0.2, color: pal.core, depth: BACK, blend: 'add',
    });
  };
  let riserDue = 0;
  let drifterDue = 0;

  const burst = () => {
    const n = Math.round(54 * few);
    for (let i = 0; i < n; i++) {
      const a = ((i + rnd()) / n) * TAU;
      const cos = Math.cos(a);
      const sin = Math.sin(a) * 0.8;
      // Not across the healer's face.
      let clear = true;
      for (let d = 8; d <= 48 && clear; d += 8) clear = boxDistance(C.x + cos * d, C.y + sin * d, headNi) > 2;
      if (!clear) continue;
      const speed = 70 + 210 * rnd() ** 1.4;
      // They start around his body, not on it: in its first frames the burst would hide him.
      spawn(i % 3 ? HFX.spark : HFX.mote, {
        x: C.x + cos * 11 * heroK, y: C.y + sin * 21 * heroK, vx: cos * speed, vy: sin * speed - 30, ay: -26, drag: 2.8, life: 520 + 620 * rnd(),
        size: [5 + 7 * rnd(), 1.5], alpha: 1, rise: 0.05, color: i % 2 ? pal.spark : pal.core, depth: AIR, blend: 'add', twinkle: 0.5, spin: 90,
      });
    }
    const m = Math.round(14 * few);
    for (let i = 0; i < m; i++) {
      const x = pX + (i % 2 ? -1 : 1) * (8 * heroK + 16 * rnd());
      spawn(HFX.streak, {
        x, y: footY - 30 * rnd(), vy: -260 - 240 * rnd(), life: 330 + 150 * rnd(), delay: 90 * rnd(), size: [3, 1.6], aspect: 9,
        alpha: 0.9, rise: 0.15, color: hot, depth: riseDepth(x), blend: 'add',
      });
    }
  };

  function cues() {
    if (!calm) {
      at(1440, () => drop(swirlBox));
      at(1560, () => drop(knot));
      // A ring closing from the sigil's rim onto his feet: the reverse of the front that follows it.
      at(ONSETS.gather[6], () => shot(HFX.halo, pX, footY, {
        size: [230, 34], aspect: SQUASH, alpha: 0.7, duration: 240, rise: 110, color: lerpColor(pal.glow, pal.core, 0.5), depth: RIPPLE, blend: 'add',
        ease: QUAD_I, fadeEase: LATE,
      }));
    }
    [595, 680, 955, 1110, 1195].forEach((tc, i) => at(tc, () => lifted(Math.round((calm ? 2 : 3 + i) * few))));

    at(T.peak, () => {
      if (calm) {
        // One slow ring on the ground and a soft swell, both up with the sound's peak; the healer adds a slow version of its own shape.
        groundShot(HFX.halo, pX, footY, {
          size: [60, 300], aspect: SQUASH, alpha: 0.4, duration: 900, rise: 215, color: lerpColor(pal.glow, pal.core, 0.4), depth: RIPPLE,
          ease: SINE_O, fadeEase: SINE_IO,
        }, pal.glow);
        shot(HFX.wave, pX, footY, {
          size: [60, 260], aspect: SQUASH, alpha: 0.14, duration: 900, rise: 215, color: pal.glow, depth: GROUND + 0.005, blend: 'add',
          ease: SINE_O, fadeEase: SINE_IO,
        });
        shot(HFX.pool, C.x, C.y, {
          size: [view.width * 1.5, view.width * 1.6], aspect: 0.8, alpha: 0.12, duration: 900, rise: 215, hold: 60, color: pal.glow, depth: SKY, blend: 'add',
          fadeEase: SINE_IO,
        });
        lifted(Math.round(12 * few));
        note(200);
        return;
      }
      // The one full-frame swell: it rises over 90 ms and stays far under the 0.35 limit.
      shot(HFX.pool, C.x, C.y, {
        size: [view.width * 1.5, view.width * 1.7], aspect: 0.8, alpha: 0.14, duration: 560, rise: 90, hold: 70, color: pal.glow, depth: SKY, blend: 'add',
        fadeEase: SINE_IO,
      });
      // Behind the pair: in front it would white the hero out.
      shot(HFX.bloom, C.x, C.y, { size: [30 * heroK, 100], alpha: 0.8, duration: 200, rise: 40, grow: 130, color: hot, depth: BACK, blend: 'add', ease: EXPO_O });
      shot(HFX.flare, C.x, C.y, {
        size: [110, 350], height: [9, 16], alpha: 0.9, duration: 340, rise: 30, hold: 70, grow: 150, color: hot, depth: BACK, blend: 'add', ease: EXPO_O,
      });
      // Only a haze under the front: as a filled disc it lay on the ground like a milky plate.
      shot(HFX.wave, pX, footY, {
        size: [70, 440], aspect: SQUASH, alpha: 0.14, duration: 820, rise: 70, color: pal.glow, depth: GROUND + 0.005, blend: 'add',
        ease: CUBIC_O, fadeEase: QUAD_I,
      });
      burst();
      note(40);
      note(120);
    });
    // What crosses the frame from here is the healer's own shape (krys.ts, quincy.ts, kian.ts): rings standing on
    // the ground, grooves turning in the air, a fan of strings. A shared front made the three peaks one picture.
    if (!calm) {
      for (const tc of ONSETS.plateau) at(tc, () => note());
    } else {
      at(1930, () => note());
      at(2270, () => note());
    }

    CHIMES.forEach((tc, i) => at(tc, () => {
      const fade = 1 - i / (CHIMES.length + 1);
      groundShot(HFX.halo, pX, footY, {
        size: [46, 120 + 16 * i], aspect: SQUASH, alpha: 0.8 * fade, duration: calm ? 760 : 480, rise: calm ? 220 : 50,
        color: lerpColor(pal.glow, pal.core, 0.4), depth: RIPPLE, ease: CUBIC_O, fadeEase: QUAD_I,
      }, pal.glow);
      // Not on the second of two chimes that follow each other within 65 ms: those notes would bunch.
      if (calm || i % 2 === 0 || i === 5) note();
      const side = (i % 2 ? -1 : 1) * (kit.horizontal ? kit.sx : 1);
      const gy = pY - (10 + 8 * i) * heroK;
      let gx = pX + side * (8 + 2 * i) * heroK;
      if (!clearOfFaces(gx, gy, 3, true)) gx = pX - side * (8 + 2 * i) * heroK;
      if (clearOfFaces(gx, gy, 3, true)) glint(gx, gy, 7, 0.9, lerpColor(pal.spark, pal.core, 0.5), AIR, 240, 30, 0.85);
    }));
    // The tail, as the hero is handed back: the last notes and slow sparks, alight until the sound has gone.
    at(T.handBack, () => {
      drop(stage);
      note();
      lifted(Math.round(8 * few), true);
    });
    at(2900, () => {
      note();
      lifted(Math.round(8 * few), true);
    });
    at(3150, () => note());
    at(3250, () => lifted(Math.round(10 * few), true));
    at(3400, () => lifted(Math.round(8 * few), true));
  }

  function frame(t: number, dt: number) {
    const lv = level(t);
    const chime = chimeAt(t);

    if (t < T.handBack) {
      const wide = stageWide.at(t);
      stage.setDisplaySize(stageW * wide, stageH * wide * stageTall.at(t)).setAlpha(stageAlpha.at(t));
    }

    floor.setAlpha(floorAlpha.at(t));
    const poolW = poolSize.at(t);
    pool.setDisplaySize(poolW, poolW * SQUASH).setAlpha(Math.min(1, poolAlpha.at(t) * (0.7 + 0.3 * lv + 0.2 * chime)));
    const turned = (spin.at(t) * dt) / 1000;
    const glowing = Math.min(1, charge.at(t) * (0.8 + 0.2 * lv) + 0.35 * chime);
    const tint = lerpColor(pal.glow, pal.core, clamp01(heat.at(t) + 0.4 * chime));
    const squeezed = squeeze.at(t);
    // In the afterglow the sigil leans from added light toward plain lines in the healer's colour: fading added
    // light shows the ground through it, and the circle would look split where grass meets a path.
    const plain = SINE_IO(progress(t, 2000, 500));
    for (const s of sigils) {
      if (t < s.t0) continue;
      const k = progress(t, s.t0, calm ? 520 : 340);
      const size = lerp(calm ? 0.9 : 0.45, 1, calm ? SINE_O(k) : BACK_O(k)) * squeezed;
      s.art.setTint(tint).setAlpha(lerp(0.76, 0.48, plain));
      s.art.angle += s.turn * turned;
      s.base.setAngle(s.art.angle).setAlpha(lerp(0.42, 0.8, plain));
      s.box.setScale(size, size * SQUASH).setAlpha(glowing * QUAD_O(k) * (1 - SINE_IO(progress(t, s.out, s.outFor))));
    }
    if (swirlBox.active && t >= 595) {
      const size = swirlSize.at(t);
      const by = (swirlSpin.at(t) * dt) / 1000;
      swirlBox.setAlpha(swirlAlpha.at(t));
      for (const art of swirlArt) {
        art.setDisplaySize(size, size);
        art.angle += by;
      }
    }

    if (knot?.active && t >= 1195) {
      const size = knotSize.at(t);
      knot.setDisplaySize(size, size * 0.5).setAlpha(knotAlpha.at(t));
    }

    if (t >= ONSETS.gather[0] && t < 1295) {
      // Thickest just before the hit.
      inflowDue += dt * (calm ? 0.014 : (0.02 + 0.1 * lv) * (t > 1100 ? 2 : 1)) * few;
      for (; inflowDue >= 1; inflowDue--) inflow(t);
    }

    if (t >= 955) {
      const breath = 0.8 + 0.2 * lv;
      const fanW = fanWidth.at(t) * (0.94 + 0.06 * lv);
      fan.setDisplaySize(fanW, fanW * 0.6).setAlpha(fanAlpha.at(t) * breath);
      const raysA = raysAlpha.at(t);
      const raysW = raysSize.at(t);
      raysBack.setDisplaySize(raysW, raysW).setAlpha(raysA).setAngle((calm ? 0.003 : 0.012) * (t - T.peak));
      raysFar?.setDisplaySize(raysW * 1.25, raysW * 1.25).setAlpha(farAlpha.at(t)).setAngle(47 - (calm ? 0.002 : 0.008) * (t - T.peak));
      const auraW = auraSize.at(t);
      aura.setDisplaySize(auraW, auraW).setAlpha(auraAlpha.at(t) * breath);
      const high = colH * columnRise.at(t);
      colDeep.setDisplaySize(deepWidth.at(t) * (0.9 + 0.1 * lv), high).setAlpha(deepAlpha.at(t));
      colGlow.setDisplaySize(glowWidth.at(t) * (0.9 + 0.1 * lv), high).setAlpha(glowAlpha.at(t));
      const coreA = coreAlpha.at(t);
      colCore.setDisplaySize(coreWidth.at(t) * (1 + 0.4 * chime), high).setAlpha(Math.min(1, coreA * (0.85 + 0.15 * lv) + (coreA > 0 ? 0.25 * chime : 0)));
    }

    if (t >= T.fall && t < 3300) {
      riserDue += dt * (t < 2500 ? 0.024 : 0.009) * few * (calm ? 0.5 : 1);
      for (; riserDue >= 1; riserDue--) riser(t);
      drifterDue += dt * (t < T.handBack ? 0.014 : 0.008) * few;
      for (; drifterDue >= 1; drifterDue--) lifted(1, true);
    }
  }

  return { cues, frame };
}
