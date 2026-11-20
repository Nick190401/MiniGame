import { BFX } from '../art/battleFx';
import { DEPTH, ease, lerp, type Bolt, type Point } from './BattleFx';
import type { Combatant } from './Combatant';
import { degrees, mixPoint, releaseAura, sideways, unit, type MoveContext, type MoveScript } from './moves';
import { scaleOf } from './playerMoves';

/**
 * The opponents' attacks, each with its own form: a noise storm, a frequency
 * spear, a lightning cage, a shard volley, a travelling distortion, a shadow
 * tendril, a muting implosion, a flatline, a rolling dark wave, a falling
 * void and closing gates.
 *
 * The recordings are cut so their hit sits a fixed time after the cue starts
 * (scripts/prepare_enemy_attack_audio.py); every attack schedules `cue()`
 * that long before its own impact frame.
 */

const WHITE = 0xffffff;

/** Milliseconds from cue start to the hit in each attack's recording. */
const CUE_IMPACT_MS: Record<string, number> = {
  'White Noise': 320,
  'Frequency Jab': 320,
  'Frequency Lock': 320,
  'Signal Burst': 520,
  'Distortion': 520,
  // Not re-cut: the plain recording peaks at 350 ms.
  'Void Touch': 350,
  'Mute': 580,
  'Dead Air': 580,
  'Silence Wave': 580,
  'Void Crush': 580,
  'Gate Slam': 140,
};

/** Telegraph colour per attack; also the tint of the hit. */
const ATTACK_COLOR: Record<string, number> = {
  'White Noise': 0xdfe8ee,
  'Frequency Jab': 0x8fd8ff,
  'Frequency Lock': 0x7af2e0,
  'Signal Burst': 0xffb347,
  'Distortion': 0xff5a3c,
  'Void Touch': 0x9b5cff,
  'Mute': 0x8d4ac7,
  'Dead Air': 0xc9b8ff,
  'Silence Wave': 0x8d4ac7,
  'Void Crush': 0xb04aff,
  'Gate Slam': 0xff3d57,
};

/**
 * Telegraph before every enemy attack: the opponent rears up in a hostile
 * rim light while the arena edges darken red.
 */
export function foeTelegraph(ctx: MoveContext, then: () => void): void {
  const { fx, attacker: foe, color } = ctx;
  const k = scaleOf(ctx.target);
  ctx.aura = fx.aura(foe.sprite, color);
  fx.auraTo(ctx.aura, 1, 200);
  foe.pose({ dx: -5, dy: -3, sx: 1.04, sy: 1.04 }, 280, 'Sine.easeOut');
  fx.converge(foe.center.x, foe.center.y, { count: 14, radius: 90 * k, colors: [WHITE, color], life: [200, 280], streak: true, size: 12 * k });
  fx.dim(0.18, 260);
  fx.spotlight(foe.center.x, foe.center.y, 0.36, 260, 0x2a0303);
  fx.at(300, then);
}

function settle(ctx: MoveContext, ms: number): void {
  const middle = mixPoint(ctx.attacker.center, ctx.target.center, 0.5);
  ctx.attacker.pose({}, ms, 'Sine.easeInOut');
  ctx.fx.dim(0, ms);
  ctx.fx.spotlight(middle.x, middle.y, 0, ms, 0x2a0303);
  releaseAura(ctx, ms * 0.8);
}

/** Schedules the cue so the recording's hit lands on the visual `impact` (ms). */
function cueFor(ctx: MoveContext, name: string, impact: number): void {
  const lead = CUE_IMPACT_MS[name] ?? 160;
  ctx.fx.at(Math.max(0, impact - lead), () => ctx.cue());
}

/** A random point inside a fighter's silhouette, roughly. */
function onBody(fighter: Combatant, spread = 0.36): Point {
  return fighter.at((Math.random() * 2 - 1) * spread, 0.2 + Math.random() * 0.65);
}

/** The part every impact shares: a flash, a ring and sparks in the blow's colours. */
function burst(ctx: MoveContext, at: Point, colors: number[], size: number, sparks: number): void {
  const { fx, power } = ctx;
  const k = scaleOf(ctx.target);
  fx.flash(at.x, at.y, colors[1] ?? colors[0], size * 0.6 * k, 160);
  fx.ring(at.x, at.y, { color: colors[1] ?? colors[0], from: 14 * k, to: size * k * power, life: 300, alpha: 0.9 });
  fx.sparks(at.x, at.y, { count: Math.round(sparks * power), colors, speed: [180, 460], life: [280, 520], gravity: 500, length: 14 * k, thickness: 2 * k });
}

/** Attack end: lights back up and hands the turn back. */
function finish(ctx: MoveContext, impact: number, settleMs = 300, tail = 260): void {
  ctx.fx.at(impact + 40, () => settle(ctx, settleMs));
  ctx.fx.at(impact + tail, () => ctx.done());
}

// ── Static Noise ──────────────────────────────────────────────────────────

/** White Noise: the body breaks into static and a cone of noise swallows the hero. */
const whiteNoise: MoveScript = ctx => {
  const { fx, attacker: foe, target: hero, power, color } = ctx;
  const k = scaleOf(hero);
  const impact = 320;
  cueFor(ctx, 'White Noise', impact);
  const mouth = foe.at(0.12, 0.5);
  const target = hero.at(0.05, 0.55);
  const dir = unit(mouth, target);
  const heading = degrees(dir);

  foe.tremble(1.4, impact);
  for (let beat = 0; beat < impact; beat += 60) fx.at(beat, () => fx.glitch(foe.sprite, { slices: 3, amount: 6 * k, life: 50 }));
  fx.motes(mouth.x, mouth.y, {
    texture: BFX.speck, count: 26, colors: [WHITE, 0xb8c4cc], speed: [30, 90], life: [200, 320], size: [3 * k, 1.5 * k],
    spread: { x: foe.width * 0.4, y: foe.height * 0.35 },
  });
  fx.at(110, () => {
    fx.glow(mouth.x, mouth.y, { color, size: 70 * k, life: 260, alpha: 0.6 });
    for (let wave = 0; wave < 4; wave++) {
      fx.at(wave * 45, () => fx.motes(mouth.x, mouth.y, {
        texture: BFX.speck, count: Math.round(34 * power), colors: [WHITE, 0xc8d4dc, 0x8a96a0], speed: [520, 860],
        angle: [heading - 9 - wave * 2, heading + 9 + wave * 2], life: [200, 300], size: [3.6 * k, 2 * k],
      }));
    }
  });

  fx.at(impact, () => {
    ctx.hit(1, { weight: 'heavy', color, dir, at: target });
    fx.motes(target.x, target.y, {
      texture: BFX.speck, count: 50, colors: [WHITE, 0xaab4bc], speed: [20, 160], life: [160, 360], size: [3.4 * k, 1.2 * k],
      spread: { x: hero.width * 0.45, y: hero.height * 0.4 },
    });
    for (let i = 0; i < 4; i++) fx.at(i * 45, () => fx.glitch(hero.sprite, { slices: 3, amount: 9 * k, life: 45 }));
    for (let i = 0; i < 3; i++) {
      fx.at(i * 50, () => {
        const y = target.y + (Math.random() - 0.5) * hero.height * 0.8;
        const bar = fx.image(BFX.scan, target.x, y, { frame: i % 3, alpha: 0.5, w: hero.width * 2.2, h: 5 * k });
        fx.at(60, () => bar.destroy());
      });
    }
    fx.ring(target.x, target.y, { color: WHITE, from: 20 * k, to: 130 * k, life: 260, alpha: 0.6 });
  });
  finish(ctx, impact);
};

/** Frequency Jab: a tight sine-wave spear stabs straight out, then goes taut and dies. */
const frequencyJab: MoveScript = ctx => {
  const { fx, attacker: foe, target: hero, color } = ctx;
  const k = scaleOf(hero);
  const impact = 320;
  cueFor(ctx, 'Frequency Jab', impact);
  const tip = foe.at(0.35, 0.52);
  const target = hero.at(0.08, 0.6);
  const dir = unit(tip, target);
  const heading = degrees(dir);
  const length = Math.hypot(target.x - tip.x, target.y - tip.y);

  const wave = (reach: number, phase: number, amplitude: number): Point[] => {
    const points: Point[] = [];
    const span = length * reach;
    for (let i = 0; i <= 48; i++) {
      const s = (span * i) / 48;
      const taper = Math.sin(Math.PI * Math.min(1, s / Math.max(1, span)));
      points.push(sideways({ x: tip.x + dir.x * s, y: tip.y + dir.y * s }, dir, Math.sin(s / (5 * k) + phase) * amplitude * taper));
    }
    return points;
  };

  // Draw back while a frequency coil winds up at the front.
  foe.pose({ dx: -10, sx: 0.96, sy: 1.04 }, 200, 'Sine.easeOut');
  fx.converge(tip.x, tip.y, { count: 14, radius: 60 * k, colors: [WHITE, color], life: [160, 220], streak: true, size: 10 * k });
  for (const tilt of [0, 60, 120]) {
    const coil = fx.image(BFX.ring, tip.x, tip.y, { color, alpha: 0, w: 34 * k, h: 34 * k * 0.4, angle: heading + 90 + tilt });
    fx.animate(240, t => coil.setDisplaySize(34 * k * (1 - 0.5 * t), 34 * k * 0.4 * (1 - 0.5 * t)).setAngle(heading + 90 + tilt + 300 * t).setAlpha(0.85 * Math.sin(Math.PI * t)), () => coil.destroy());
  }

  const spear = fx.strand([
    { width: 26 * k, color: 0x14365a, alpha: 0.35, blend: 'normal' },
    { width: 20 * k, color, alpha: 0.45 },
    { width: 5 * k, color, alpha: 1 },
    { width: 2 * k, color: WHITE, alpha: 1 },
  ]);
  const spearTip = fx.image(BFX.star, tip.x, tip.y, { color: WHITE, alpha: 0, w: 30 * k });
  fx.at(230, () => {
    foe.pose({ dx: 14, sx: 1.06, sy: 0.95 }, 70, 'Expo.easeOut');
    const thrust = ease('Expo.easeIn');
    fx.animate(impact - 230, t => {
      const reach = thrust(t);
      spear.setPoints(wave(Math.max(0.02, reach), t * 6, 7 * k));
      spearTip.setPosition(tip.x + dir.x * length * reach, tip.y + dir.y * length * reach).setAlpha(1).setAngle(t * 90);
    });
  });

  fx.at(impact, () => {
    spearTip.destroy();
    ctx.hit(1, { weight: 'heavy', color, dir, at: target });
    fx.streakFlare(target.x, target.y, { color, width: 220 * k, height: 10 * k, life: 220, angle: heading });
    fx.sparks(target.x, target.y, { count: 22, colors: [WHITE, color, 0x1d4f8a], speed: [300, 620], angle: [heading - 22, heading + 22], life: [220, 420], length: 18 * k });
    fx.ring(target.x, target.y, { color, from: 10 * k, to: 110 * k, life: 260 });
    fx.glow(target.x, target.y, { color, size: 90 * k, life: 220 });
    // The spear goes taut, then fades.
    fx.animate(180, t => spear.setPoints(wave(1, 2 + t * 10, 7 * k * (1 - t))).setAlpha(1 - t), () => spear.destroy());
  });
  finish(ctx, impact);
};

// ── Gatekeeper: lightning ─────────────────────────────────────────────────

/** Frequency Lock: lock-on rings close on the hero, then three bolts cage them. */
const frequencyLock: MoveScript = ctx => {
  const { fx, attacker: foe, target: hero, power, color } = ctx;
  const k = scaleOf(hero);
  const impact = 320;
  cueFor(ctx, 'Frequency Lock', impact);
  const target = hero.at(0.05, 0.56);
  const sources = [foe.at(0, 0.55), foe.at(-0.38, 0.22), foe.at(0.4, 0.3)];

  foe.tremble(1.4, impact);
  const arcs: Bolt[] = sources.map(source => fx.bolt(source, onBody(foe), { color, width: 1.6 * k, glow: 8 * k, jag: 0.3 }));
  for (let beat = 0; beat < impact; beat += 50) {
    fx.at(beat, () => arcs.forEach((arc, i) => arc.regenerate(sources[i], onBody(foe)).setAlpha(0.5 + Math.random() * 0.5)));
  }
  for (let i = 0; i < 3; i++) {
    fx.at(i * 70, () => fx.ring(target.x, target.y, { color: 0xff5a6a, from: 130 * k, to: 40 * k, life: 260, alpha: 0.9, ease: 'Cubic.easeIn', fadeIn: 0.3 }));
  }
  fx.at(210, () => {
    const lock = fx.image(BFX.star, target.x, target.y, { color: 0xff5a6a, w: 60 * k, alpha: 0.9 });
    fx.animate(110, t => lock.setAngle(45 * t).setDisplaySize(60 * k * (1 - 0.4 * t), 60 * k * (1 - 0.4 * t)), () => lock.destroy());
  });

  fx.at(impact, () => {
    arcs.forEach(arc => arc.destroy());
    const bolts = sources.map(source => fx.bolt(source, target, { color, width: 3.6 * k, glow: 18 * k, jag: 0.15, branches: 2 }));
    fx.at(55, () => bolts.forEach(bolt => bolt.regenerate().setAlpha(0.75)));
    fx.at(110, () => bolts.forEach(bolt => bolt.regenerate().setAlpha(0.5)));
    fx.at(150, () => bolts.forEach(bolt => fx.fadeStrand(bolt, 90, 0.5)));
    ctx.hit(1, { weight: 'heavy', color, dir: unit(sources[0], target), at: target });
    burst(ctx, target, [WHITE, color, 0x0f5c55], 140, 22);
    fx.screenFlash(color, 0.12, 150);
    hero.tremble(2.4, 240);
    // The cage: rings orbit the hero while the charge crawls over them.
    for (const tilt of [-25, 25]) {
      const cage = fx.image(BFX.ring, target.x, target.y, { color, alpha: 0.9, w: 90 * k * power, h: 90 * k * 0.35 * power, angle: tilt });
      fx.animate(300, t => cage.setAngle(tilt + (tilt > 0 ? 160 : -160) * t).setAlpha(0.9 * (1 - t)), () => cage.destroy());
    }
    const crawl = [0, 1].map(() => fx.bolt(onBody(hero, 0.3), onBody(hero, 0.3), { color, width: 1.4 * k, glow: 7 * k, jag: 0.3 }));
    for (let beat = 50; beat < 240; beat += 50) {
      fx.at(beat, () => crawl.forEach(arc => arc.regenerate(onBody(hero, 0.3), onBody(hero, 0.3)).setAlpha(0.8 - beat / 400)));
    }
    fx.at(240, () => crawl.forEach(arc => arc.destroy()));
  });
  finish(ctx, impact, 320, 280);
};

// ── Broken Signal ─────────────────────────────────────────────────────────

/** The radio's speakers pump on a beat: rings from both cones. */
function speakerBeats(ctx: MoveContext, beats: number[], color: number): void {
  const { fx, attacker: foe } = ctx;
  const k = scaleOf(ctx.target);
  beats.forEach(beat => fx.at(beat, () => {
    foe.pose({ sx: 1.07, sy: 1.05 }, 50, 'Quad.easeOut');
    fx.at(50, () => foe.pose({ sx: 1.02, sy: 1.02 }, 70, 'Sine.easeOut'));
    for (const side of [-1, 1]) {
      const cone = foe.at(side * 0.3, 0.56);
      fx.ring(cone.x, cone.y, { color, from: 10 * k, to: 74 * k, life: 260, soft: true, alpha: 0.85 });
      fx.glow(cone.x, cone.y, { color, size: 40 * k, life: 160, alpha: 0.7 });
      const antenna = foe.at(side * 0.2, 0.96);
      fx.sparks(antenna.x, antenna.y, { count: 4, colors: [WHITE, 0xffdd44, color], speed: [60, 160], angle: [-140, -40], life: [160, 280], gravity: 300, length: 8 * k });
    }
    fx.shake(0.06);
  }));
}

/** Signal Burst: the dial fires a fanned volley of glowing shards that pepper the hero. */
const signalBurst: MoveScript = ctx => {
  const { fx, attacker: foe, target: hero, power, color } = ctx;
  const k = scaleOf(hero);
  const impact = 520;
  cueFor(ctx, 'Signal Burst', impact);
  const dial = foe.at(0, 0.38);
  const target = hero.at(0.05, 0.55);
  const dir = unit(dial, target);
  speakerBeats(ctx, [0, 130, 260, 390], color);
  const dialGlow = fx.image(BFX.glow, dial.x, dial.y, { color, alpha: 0, w: 50 * k });
  fx.animate(380, t => dialGlow.setDisplaySize((50 + 70 * t) * k, (50 + 70 * t) * k).setAlpha(0.9 * t), () => dialGlow.destroy());

  const shards = Math.round(7 * power);
  for (let i = 0; i < shards; i++) {
    const launch = 300 + i * 24;
    const flight = impact - 20 - launch - (shards - 1 - i) * 6;
    fx.at(launch, () => {
      const spread = (i / Math.max(1, shards - 1) - 0.5) * 2;
      const control = sideways(mixPoint(dial, target, 0.45), dir, spread * 70 * k);
      const land = sideways(target, dir, spread * 12 * k);
      const shard = fx.image(BFX.shard, dial.x, dial.y, { color: i % 2 ? WHITE : color, w: 7 * k, h: 16 * k });
      const halo = fx.image(BFX.glow, dial.x, dial.y, { color, alpha: 0.7, w: 22 * k });
      const curve = ease('Quad.easeIn');
      let last = dial;
      fx.animate(flight, t => {
        const p = curve(t);
        const a = mixPoint(dial, control, p);
        const b = mixPoint(control, land, p);
        const at = mixPoint(a, b, p);
        shard.setPosition(at.x, at.y).setRotation(Math.atan2(at.y - last.y, at.x - last.x) + Math.PI / 2);
        halo.setPosition(at.x, at.y);
        last = at;
      }, () => {
        shard.destroy();
        halo.destroy();
        fx.sparks(land.x, land.y, { count: 5, colors: [WHITE, color], speed: [120, 260], life: [160, 280], gravity: 300, length: 9 * k });
        fx.glow(land.x, land.y, { color, size: 34 * k, life: 140 });
      });
    });
  }

  fx.at(impact, () => {
    ctx.hit(1, { weight: 'heavy', color, dir, at: target });
    burst(ctx, target, [WHITE, 0xffcf6a, color, 0x8b1a1a], 150, 24);
    fx.debris(target.x, target.y, { texture: BFX.shard, count: 12, color, size: [5 * k, 10 * k], speed: [180, 380], angle: [0, 360], life: [400, 650], gravity: 700, blend: 'add' });
  });
  fx.at(impact + 160, () => {
    fx.ring(target.x, target.y, { color, from: 20 * k, to: 90 * k, life: 220, alpha: 0.6 });
    fx.shake(0.15);
  });
  finish(ctx, impact, 300, 300);
};

/** Distortion: a band of torn signal sweeps across the arena and corrupts the hero. */
const distortion: MoveScript = ctx => {
  const { fx, attacker: foe, target: hero, color } = ctx;
  const k = scaleOf(hero);
  const impact = 520;
  cueFor(ctx, 'Distortion', impact);
  const target = hero.at(0.05, 0.55);
  const dir = unit(foe.center, target);
  speakerBeats(ctx, [0, 130, 260], color);
  for (let beat = 0; beat < impact; beat += 90) fx.at(beat, () => fx.rgbSplit(foe.sprite, (4 + Math.random() * 3) * k, 120, 0.4));
  fx.at(180, () => fx.glitch(foe.sprite, { slices: 4, amount: 10 * k, life: 70 }));

  // The distortion front: torn scanlines filling a band that travels to the hero.
  const band: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < 9; i++) {
    band.push(fx.image(BFX.scan, foe.center.x, 0, { frame: i % 3, color: i % 3 ? color : WHITE, alpha: 0, w: 90 * k, h: (3 + Math.random() * 6) * k }));
  }
  const travel = ease('Cubic.easeIn');
  fx.at(220, () => fx.animate(impact - 220, t => {
    const x = lerp(foe.center.x, target.x, travel(t));
    band.forEach((bar, i) => {
      if (Math.random() < 0.35) bar.setY(Math.random() * fx.arenaHeight * 0.92);
      bar.setX(x + (Math.random() - 0.5) * 30 * k).setAlpha((0.3 + 0.4 * Math.random()) * Math.min(1, t * 4)).setDisplaySize((60 + 70 * Math.random()) * k, bar.displayHeight);
      if (i === 0) bar.setY(target.y + (Math.random() - 0.5) * hero.height * 0.6);
    });
  }, () => band.forEach(bar => bar.destroy())));

  fx.at(impact, () => {
    ctx.hit(1, { weight: 'heavy', color, dir, at: target });
    fx.rgbSplit(hero.sprite, 10 * k, 280, 0.5);
    [0, 45, 90].forEach(delay => fx.at(delay, () => fx.glitch(hero.sprite, { slices: 6, amount: 14 * k, life: 45 })));
    burst(ctx, target, [WHITE, 0xffcf6a, color, 0x8b1a1a], 130, 14);
    // The whole arena tears for a moment.
    for (let i = 0; i < 4; i++) {
      const bar = fx.image(BFX.scan, fx.width / 2, Math.random() * fx.arenaHeight * 0.9, { frame: i % 3, alpha: 0.25, w: fx.width, h: (5 + Math.random() * 9) * k });
      fx.at(70, () => bar.destroy());
    }
  });
  fx.at(impact + 160, () => {
    fx.glitch(hero.sprite, { slices: 3, amount: 6 * k, life: 50 });
    fx.ring(target.x, target.y, { color, from: 20 * k, to: 90 * k, life: 220, alpha: 0.6 });
    fx.shake(0.15);
  });
  finish(ctx, impact, 300, 300);
};

// ── Silence ───────────────────────────────────────────────────────────────

/** A sphere of silence: black core, purple rim, a tilted teal halo. */
function voidOrb(ctx: MoveContext, at: Point) {
  const { fx } = ctx;
  const parts = {
    core: fx.image(BFX.glow, at.x, at.y, { color: 0x000000, blend: 'normal', alpha: 0, w: 1 }),
    rim: fx.image(BFX.ringSoft, at.x, at.y, { color: 0x8d4ac7, alpha: 0, w: 1 }),
    halo: fx.image(BFX.ring, at.x, at.y, { color: 0x6ec8d8, alpha: 0, w: 1, angle: -18 }),
  };
  return {
    set(p: Point, size: number, alpha = 1, stretch = 1, time = 0) {
      parts.core.setPosition(p.x, p.y).setDisplaySize(size * 1.2, size * 1.2 * stretch).setAlpha(0.95 * alpha);
      parts.rim.setPosition(p.x, p.y).setDisplaySize(size, size * stretch).setAlpha(0.9 * alpha);
      parts.halo.setPosition(p.x, p.y).setDisplaySize(size * 1.6, size * 0.55).setAngle(-18 + time * 0.25).setAlpha(0.7 * alpha);
    },
    destroy() { Object.values(parts).forEach(part => part.destroy()); },
  };
}

/** Light sucked into a point: dark motes plus a few bright ones. */
function absorb(ctx: MoveContext, at: Point, radius: number, ms: number): void {
  const k = scaleOf(ctx.target);
  ctx.fx.converge(at.x, at.y, { count: 2, radius: radius * k, colors: [0x1a0826, 0x3a1450], life: [220, 300], size: 7 * k, blend: 'normal', duration: ms, frequency: 22 });
  ctx.fx.converge(at.x, at.y, { count: 1, radius: radius * k, colors: [WHITE, 0x8d4ac7], life: [200, 280], streak: true, size: 10 * k, duration: ms, frequency: 40 });
}

/** Void Touch: a shadow tendril reaches across, swaying, and lays a hand on the hero. */
const voidTouch: MoveScript = ctx => {
  const { fx, attacker: foe, target: hero, color } = ctx;
  const k = scaleOf(hero);
  const impact = 580;
  cueFor(ctx, 'Void Touch', impact);
  const root = foe.at(0.25, 0.45);
  const target = hero.at(0.08, 0.6);
  const dir = unit(root, target);
  fx.desaturate(0.55, 420);
  absorb(ctx, root, 80, 300);

  const tendril = fx.strand([
    { width: 22 * k, color: 0x000000, alpha: 0.5, blend: 'normal' },
    { width: 10 * k, color: 0x14061f, alpha: 0.95, blend: 'normal' },
    { width: 3 * k, color, alpha: 0.9 },
  ], DEPTH.front - 0.5);
  const tip = fx.image(BFX.glow, root.x, root.y, { color, alpha: 0, w: 30 * k });
  const path = (reach: number, sway: number): Point[] => {
    const points: Point[] = [];
    for (let i = 0; i <= 30; i++) {
      const s = (i / 30) * reach;
      points.push(sideways(mixPoint(root, target, s), dir, Math.sin(s * Math.PI * 1.5 + sway) * 26 * k * Math.sin(Math.PI * s) * (1.2 - reach * 0.6)));
    }
    return points;
  };
  const grow = ease('Cubic.easeInOut');
  fx.at(150, () => fx.animate(impact - 150, t => {
    const reach = Math.max(0.03, grow(t));
    const points = path(reach, t * 5);
    tendril.setPoints(points);
    const end = points[points.length - 1];
    tip.setPosition(end.x, end.y).setAlpha(0.9).setDisplaySize(30 * k, 30 * k);
  }));

  fx.at(impact, () => {
    ctx.hit(1, { weight: 'heavy', color, dir, at: target });
    fx.glow(target.x, target.y, { color: 0x000000, size: 160 * k, life: 320, alpha: 0.7, blend: 'normal' });
    fx.ring(target.x, target.y, { color: 0x2a0f3a, from: 20 * k, to: 180 * k, life: 360, soft: true, blend: 'normal', alpha: 0.7 });
    fx.ring(target.x, target.y, { color, from: 16 * k, to: 140 * k, life: 300, alpha: 0.8 });
    fx.sparks(target.x, target.y, { count: 14, colors: [WHITE, color, 0x3a1450], speed: [120, 300], life: [300, 480], gravity: 200, length: 12 * k });
    tip.destroy();
    const retract = ease('Cubic.easeIn');
    fx.animate(260, t => tendril.setPoints(path(Math.max(0.02, 1 - retract(t)), 3 + t * 4)).setAlpha(1 - t * 0.5), () => tendril.destroy());
  });
  fx.at(impact + 60, () => fx.desaturate(0, 320));
  finish(ctx, impact, 300, 320);
};

/** Mute: the hero's sound rings glow, a void flies in and crushes them to nothing. */
const mute: MoveScript = ctx => {
  const { fx, attacker: foe, target: hero, color } = ctx;
  const k = scaleOf(hero);
  const impact = 580;
  cueFor(ctx, 'Mute', impact);
  const source = foe.at(0, 0.5);
  const target = hero.at(0, 0.55);

  // The hero's own sound, visible for a moment.
  const rings = [70, 100, 130].map((size, i) => ({ size: size * k, image: fx.image(BFX.ring, target.x, target.y, { color: i === 1 ? WHITE : 0x8fd8ff, alpha: 0, w: size * k }) }));
  fx.animate(impact, t => rings.forEach((ring, i) => {
    const pulse = 1 + 0.05 * Math.sin(t * 22 + i);
    ring.image.setDisplaySize(ring.size * pulse, ring.size * pulse).setAlpha(0.55 * Math.min(1, t * 3));
  }));

  const orb = voidOrb(ctx, source);
  absorb(ctx, source, 90, 380);
  fx.animate(390, t => orb.set(source, (12 + 50 * t) * k, Math.min(1, t * 2), 1, t * 390));
  fx.dim(0.32, 300);
  const fly = ease('Cubic.easeIn');
  fx.at(390, () => fx.animate(impact - 390, t => orb.set(mixPoint(source, target, fly(t)), 62 * k, 1, 1, 390 + t * 190)));

  fx.at(impact, () => {
    orb.destroy();
    ctx.hit(1, { weight: 'heavy', color, dir: unit(source, target), at: target });
    fx.desaturate(0.85, 60);
    fx.dim(0.5, 60);
    // The sound is cut: the rings collapse into the hero.
    const collapse = ease('Expo.easeIn');
    fx.animate(130, t => rings.forEach(ring => ring.image.setDisplaySize(ring.size * (1 - collapse(t)), ring.size * (1 - collapse(t))).setAlpha(0.8)),
      () => rings.forEach(ring => ring.image.destroy()));
    fx.glow(target.x, target.y, { color: 0x000000, size: 200 * k, life: 380, alpha: 0.75, blend: 'normal' });
    for (let i = 0; i < 3; i++) fx.at(i * 30, () => fx.ring(target.x, target.y, { color: i % 2 ? 0x6ec8d8 : color, from: 140 * k, to: 10 * k, life: 180, soft: true, ease: 'Cubic.easeIn' }));
  });
  // A beat of silence, then the world comes back.
  fx.at(impact + 170, () => {
    fx.ring(target.x, target.y, { color: 0x6ec8d8, from: 20 * k, to: 200 * k, life: 360, alpha: 0.7 });
    fx.motes(target.x, target.y, { count: 18, colors: [color, 0x6ec8d8], speed: [80, 200], life: [300, 500], size: [5 * k, 1] });
    fx.desaturate(0, 320);
  });
  finish(ctx, impact, 340, 360);
};

/** Dead Air: a heartbeat line runs from the opponent through the hero and flatlines. */
const deadAir: MoveScript = ctx => {
  const { fx, attacker: foe, target: hero, color } = ctx;
  const k = scaleOf(hero);
  const impact = 580;
  cueFor(ctx, 'Dead Air', impact);
  const start = foe.at(0.3, 0.5);
  const target = hero.at(0, 0.55);
  const y = target.y;
  fx.desaturate(0.5, 400);

  const line = fx.strand([
    { width: 12 * k, color, alpha: 0.35 },
    { width: 2.6 * k, color, alpha: 0.95 },
    { width: 1.1 * k, color: WHITE, alpha: 1 },
  ]);
  const heartbeat = (x: number, phase: number) => {
    const p = ((x / (70 * k) + phase) % 1 + 1) % 1;
    if (p > 0.42 && p < 0.47) return -22;
    if (p > 0.47 && p < 0.52) return 14;
    if (p > 0.6 && p < 0.64) return -7;
    return 0;
  };
  const trace = (head: number, phase: number, amplitude: number): Point[] => {
    const points: Point[] = [{ x: start.x, y: start.y }];
    const left = Math.min(start.x, head);
    for (let x = start.x - 4; x >= left; x -= 4) {
      const settleIn = Math.min(1, (start.x - x) / (40 * k));
      points.push({ x, y: lerp(start.y, y, settleIn) + heartbeat(x, phase) * k * amplitude * settleIn });
    }
    return points;
  };
  const run = ease('Sine.easeIn');
  fx.at(60, () => fx.animate(impact - 60, t => {
    const head = lerp(start.x, -10, run(t));
    line.setPoints(trace(head, t * 3, 1 - t * 0.85));
  }));

  fx.at(impact, () => {
    ctx.hit(1, { weight: 'heavy', color, dir: { x: -1, y: 0 }, at: target });
    // Flatline: one hard white line across the arena.
    const flat = fx.strand([
      { width: 16 * k, color, alpha: 0.5 },
      { width: 3 * k, color: WHITE, alpha: 1 },
    ]);
    flat.setPoints([{ x: start.x, y: start.y }, { x: start.x - 40 * k, y }, { x: -10, y }]);
    line.destroy();
    fx.animate(360, t => flat.setAlpha(1 - t * t), () => flat.destroy());
    fx.glow(target.x, target.y, { color: 0x000000, size: 170 * k, life: 320, alpha: 0.6, blend: 'normal' });
    fx.ring(target.x, target.y, { color, from: 16 * k, to: 150 * k, life: 320, alpha: 0.8 });
  });
  fx.at(impact + 80, () => fx.desaturate(0, 320));
  finish(ctx, impact, 320, 360);
};

// ── Gatekeeper: silence and force ─────────────────────────────────────────

/** Silence Wave: the Gatekeeper slams the ground and a dark wave rolls over the hero. */
const silenceWave: MoveScript = ctx => {
  const { fx, attacker: boss, target: hero, power, color } = ctx;
  const k = scaleOf(hero);
  const impact = 580;
  cueFor(ctx, 'Silence Wave', impact);
  const from = { x: boss.feet.x - boss.width * 0.35, y: boss.feet.y };
  const to = { x: hero.feet.x + hero.width * 0.1, y: hero.feet.y };
  fx.desaturate(0.4, 400);

  boss.pose({ dy: -8, sx: 1.03, sy: 1.06 }, 200, 'Sine.easeOut');
  fx.at(200, () => {
    boss.pose({ dy: 4, sx: 1.06, sy: 0.95 }, 60, 'Expo.easeIn');
    fx.ring(from.x, from.y, { color, from: 30 * k, to: 220 * k, life: 360, soft: true, squash: 0.32, depth: DEPTH.behind });
    fx.shake(0.3);
  });

  const angle = degrees(unit(from, to));
  // A thick dark body with a lit crest, several fronts deep.
  const fronts = [
    fx.image(BFX.wave, from.x, from.y, { color: 0x0b0410, blend: 'normal', alpha: 0, depth: DEPTH.front - 0.7 }),
    fx.image(BFX.wave, from.x, from.y, { color: 0x1d0b2a, blend: 'normal', alpha: 0, depth: DEPTH.front - 0.65 }),
    fx.image(BFX.wave, from.x, from.y, { color: 0x120818, blend: 'normal', alpha: 0, depth: DEPTH.front - 0.6 }),
    fx.image(BFX.wave, from.x, from.y, { color, alpha: 0, depth: DEPTH.front - 0.5 }),
  ];
  const roll = ease('Sine.easeIn');
  let lastDust = 0;
  fx.at(220, () => fx.animate(impact - 220, t => {
    const p = roll(t);
    const base = mixPoint(from, to, p);
    const height = lerp(70, 230, p) * k * power;
    fronts.forEach((front, i) => front.setPosition(base.x + i * 7 * k, base.y - height * 0.32)
      .setDisplaySize(height * (0.7 - i * 0.08), height * (1 - i * 0.04)).setAngle(angle).setAlpha(i === fronts.length - 1 ? 0.9 : 0.85));
    if (t * (impact - 220) - lastDust > 50) {
      lastDust = t * (impact - 220);
      fx.puffs(base.x, base.y - 4, { count: 3, color: 0x2a1a30, alpha: 0.55, size: [16 * k, 40 * k], speed: [20, 70], angle: [-150, -30], life: [400, 650], gravity: -20 });
    }
  }, () => fronts.forEach(front => {
    const a = front.alpha;
    fx.animate(220, t => front.setAlpha(a * (1 - t)).setX(front.x - 30 * k * t), () => front.destroy());
  })));

  fx.at(impact, () => {
    const at = hero.center;
    ctx.hit(1, { weight: 'heavy', color, dir: { x: -0.95, y: 0.3 }, at });
    fx.puffs(at.x, hero.feet.y - 10, { count: 12, color: 0x1e1024, alpha: 0.6, size: [24 * k, 70 * k], speed: [60, 170], angle: [-170, -10], life: [600, 950], gravity: -15 });
    fx.ring(hero.feet.x, hero.feet.y, { color, from: 30 * k, to: 300 * k, life: 420, soft: true, squash: 0.32, depth: DEPTH.behind });
    fx.sparks(at.x, at.y, { count: 16, colors: [WHITE, color, 0x3a1450], speed: [150, 380], angle: [-200, -100], life: [300, 520], gravity: 300, length: 14 * k });
    fx.desaturate(0.7, 80);
  });
  fx.at(impact + 120, () => fx.desaturate(0, 340));
  finish(ctx, impact, 340, 340);
};

/** Void Crush: a void forms over the hero's head and drops onto them. */
const voidCrush: MoveScript = ctx => {
  const { fx, attacker: boss, target: hero, power, color } = ctx;
  const k = scaleOf(hero);
  const impact = 580;
  cueFor(ctx, 'Void Crush', impact);
  const above = { x: hero.feet.x, y: hero.feet.y - hero.height * 1.45 };
  const landing = hero.at(0, 0.62);
  boss.pose({ dy: -8, sx: 1.02, sy: 1.06 }, 300, 'Sine.easeOut');
  fx.desaturate(0.5, 450);
  fx.dim(0.42, 300);
  fx.spotlight(above.x, above.y, 0.4, 300, 0x12001a);

  const orb = voidOrb(ctx, above);
  absorb(ctx, above, 110, 440);
  const growCurve = ease('Cubic.easeOut');
  fx.animate(480, t => orb.set(above, (10 + 70 * growCurve(t)) * k * power, Math.min(1, t * 2), 1, t * 480));
  const drop = ease('Expo.easeIn');
  fx.at(480, () => fx.animate(impact - 480, t => orb.set(mixPoint(above, landing, drop(t)), 80 * k * power, 1, 1 + 0.35 * t, 480 + t * 100)));

  fx.at(impact, () => {
    orb.destroy();
    ctx.hit(1, { weight: 'massive', color, dir: { x: 0, y: 1 }, at: landing });
    for (let i = 0; i < 3; i++) fx.at(i * 25, () => fx.ring(landing.x, landing.y, { color: i % 2 ? 0x6ec8d8 : color, from: 160 * k, to: 12 * k, life: 170, soft: true, ease: 'Cubic.easeIn' }));
    fx.at(90, () => {
      fx.ring(hero.feet.x, hero.feet.y, { color, from: 40 * k, to: 340 * k, life: 440, soft: true, squash: 0.3, depth: DEPTH.behind });
      fx.ring(hero.feet.x, hero.feet.y, { color: WHITE, from: 30 * k, to: 240 * k, life: 320, squash: 0.3, alpha: 0.7, depth: DEPTH.behind });
      fx.puffs(hero.feet.x, hero.feet.y - 4, { count: 14, color: 0x2a1a30, alpha: 0.6, size: [20 * k, 64 * k], speed: [70, 190], angle: [-200, 20], life: [650, 1000], gravity: -18, spread: { x: 14 * k, y: 3 } });
      fx.debris(hero.feet.x, hero.feet.y - 4, { count: 10, color: 0x4a4050, size: [5 * k, 10 * k], speed: [150, 300], angle: [-160, -20], life: [600, 850], gravity: 950 });
      fx.motes(landing.x, landing.y, { count: 20, colors: [color, 0x6ec8d8], speed: [100, 260], life: [300, 520], size: [5 * k, 1] });
    });
  });
  fx.at(impact + 120, () => fx.desaturate(0, 360));
  finish(ctx, impact, 360, 380);
};

/** Gate Slam: the Gatekeeper lunges as two slabs of light slam shut on the hero. */
const gateSlam: MoveScript = ctx => {
  const { fx, attacker: boss, target: hero, power, color } = ctx;
  const k = scaleOf(hero);
  const impact = 140;
  cueFor(ctx, 'Gate Slam', impact);
  const centre = hero.at(0, 0.5);
  const lunge = mixPoint(boss.feet, hero.feet, 0.35);

  boss.moveFeetTo(lunge, 1.14, impact, 'Expo.easeIn');
  for (let i = 0; i < 3; i++) fx.at(i * 35, () => fx.afterimage(boss.sprite, { color, alpha: 0.32 - i * 0.07, life: 200 }));
  fx.speedLines({
    region: { x: centre.x - 40 * k, y: centre.y - hero.height * 0.8, w: boss.feet.x - centre.x, h: hero.height * 1.2 },
    angle: 0, color: WHITE, alpha: 0.35, length: [60 * k, 120 * k], thickness: 2 * k, speed: [1200, 1600], life: 120, duration: 120, frequency: 12,
  });

  const slabHeight = hero.height * 1.35;
  const slabs = [-1, 1].map(side => ({
    side,
    layers: [
      fx.image(BFX.beam, centre.x, centre.y, { color, alpha: 0.6, origin: [0.5, 0.5], angle: 90, w: slabHeight, h: 46 * k }),
      fx.image(BFX.beam, centre.x, centre.y, { color: WHITE, alpha: 0.95, origin: [0.5, 0.5], angle: 90, w: slabHeight * 0.96, h: 12 * k, depth: DEPTH.front + 0.1 }),
    ],
  }));
  const close = ease('Expo.easeIn');
  fx.animate(impact, t => slabs.forEach(slab => slab.layers.forEach(layer => layer.setX(centre.x + slab.side * lerp(150, 10, close(t)) * k))));

  fx.at(impact, () => {
    ctx.hit(1, { weight: 'massive', color, dir: { x: -0.9, y: 0.4 }, at: centre });
    slabs.forEach(slab => slab.layers.forEach(layer => layer.destroy()));
    fx.flash(centre.x, centre.y, color, 120 * k, 180);
    fx.streakFlare(centre.x, centre.y, { color: WHITE, width: slabHeight, height: 18 * k, life: 220, angle: 90 });
    fx.debris(centre.x, centre.y, { texture: BFX.shard, count: Math.round(20 * power), color, size: [6 * k, 13 * k], speed: [200, 460], angle: [0, 360], life: [450, 750], gravity: 700, blend: 'add' });
    fx.ring(hero.feet.x, hero.feet.y, { color, from: 40 * k, to: 340 * k, life: 440, soft: true, squash: 0.3, depth: DEPTH.behind });
    fx.puffs(hero.feet.x, hero.feet.y - 4, { count: 14, color: 0x6b5643, alpha: 0.55, size: [20 * k, 60 * k], speed: [70, 190], angle: [-200, 20], life: [650, 1000], gravity: -18, spread: { x: 14 * k, y: 3 } });
    fx.debris(hero.feet.x, hero.feet.y - 4, { count: 10, color: 0x5d4a3c, size: [5 * k, 10 * k], speed: [150, 320], angle: [-160, -20], life: [600, 850], gravity: 950 });
    fx.screenFlash(0xff6a6a, 0.16, 180);
  });
  // Hold the lunge through the hit-stop, then pull back.
  fx.at(impact + 90, () => boss.pose({}, 300, 'Sine.easeOut'));
  finish(ctx, impact, 300, 420);
};

const ATTACKS: Record<string, MoveScript> = {
  'White Noise': whiteNoise,
  'Frequency Jab': frequencyJab,
  'Frequency Lock': frequencyLock,
  'Signal Burst': signalBurst,
  'Distortion': distortion,
  'Void Touch': voidTouch,
  'Mute': mute,
  'Dead Air': deadAir,
  'Silence Wave': silenceWave,
  'Void Crush': voidCrush,
  'Gate Slam': gateSlam,
};

/** The attack's choreography and the colour of its telegraph. An unknown attack lunges like Gate Slam. */
export function enemyMove(_enemyId: string, attackName: string, isBoss: boolean): { script: MoveScript; color: number } {
  return {
    script: ATTACKS[attackName] ?? gateSlam,
    color: ATTACK_COLOR[attackName] ?? (isBoss ? 0xff3d57 : 0xe8b465),
  };
}
