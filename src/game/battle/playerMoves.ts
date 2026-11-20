import { BFX } from '../art/battleFx';
import { DEPTH, ease, lerp, type Point } from './BattleFx';
import type { Combatant } from './Combatant';
import { degrees, mixPoint, releaseAura, sideways, unit, type MoveContext, type MoveScript } from './moves';

/**
 * The hero's four moves. Each has its own shape language: Bass Drop works
 * the ground, Echo Wave throws sound fronts that bounce back, Hook Impact is
 * a blade combo up close, Reverb Strike a beam whose hit keeps reverberating.
 *
 * Timelines are written in sound time: `cue()` starts the move's recording
 * and the beats sit on its measured onsets (noted above each move).
 */

const WHITE = 0xffffff;

/** Effects are authored for the landscape arena; this keeps them in proportion elsewhere. */
export const scaleOf = (fighter: Combatant) => Math.max(0.75, Math.min(1.4, fighter.height / 133));

/** The leading fist of the battle stance art. */
const fist = (hero: Combatant) => hero.at(0.25, 0.64);

/** A point that follows a fighter's feet, for trails. */
const feetOf = (fighter: Combatant, lift = 0) => ({
  get x() { return fighter.feetNow.x; },
  get y() { return fighter.feetNow.y - lift; },
});

/**
 * Anticipation before the regular moves: the hero sets their stance, energy
 * is drawn into the leading fist, a rim of light comes up and the arena dims
 * around the fighters.
 */
export function heroWindup(ctx: MoveContext, then: () => void): void {
  const { fx, attacker: hero, target: foe, color } = ctx;
  const k = scaleOf(hero);
  const hand = fist(hero);
  hero.pose({ dx: -6, sx: 0.97, sy: 1.03 }, 260, 'Sine.easeOut');
  fx.converge(hand.x, hand.y, { count: 16, radius: 95 * k, colors: [WHITE, color], life: [190, 270], streak: true, size: 12 * k });
  fx.glow(hand.x, hand.y, { color, size: 36 * k, life: 300, grow: 1.6, alpha: 0.7 });
  ctx.aura = fx.aura(hero.sprite, color);
  fx.auraTo(ctx.aura, 1, 220);
  const middle = mixPoint(hero.center, foe.center, 0.5);
  fx.dim(0.2, 260);
  fx.spotlight(middle.x, middle.y, 0.32, 260);
  fx.at(280, then);
}

/** The ultimate's wind-up: the world goes dark and a cut-in banner sweeps across. */
export function heroCutIn(ctx: MoveContext, then: () => void): void {
  const { fx, attacker: hero, color } = ctx;
  hero.pose({ dx: -6, sx: 0.97, sy: 1.03 }, 300, 'Sine.easeOut');
  ctx.aura = fx.aura(hero.sprite, color);
  fx.auraTo(ctx.aura, 1.2, 220);
  fx.dim(0.55, 180);
  fx.spotlight(hero.center.x, hero.center.y, 0.55, 200);
  fx.at(40, () => fx.cutIn({ texture: 'player-battle-stance', color, hold: 320, crop: [0, 0.5] }, then));
}

/** Lights back up after a move. */
function relight(ctx: MoveContext, ms: number): void {
  const middle = mixPoint(ctx.attacker.center, ctx.target.center, 0.5);
  ctx.fx.dim(0, ms);
  ctx.fx.spotlight(middle.x, middle.y, 0, ms);
  releaseAura(ctx, ms * 0.8);
}

/** A glowing fissure torn along the ground; its dark scar outlasts the glow. */
function fissure(ctx: MoveContext, from: Point, to: Point, ms: number, hot: number): void {
  const { fx, color } = ctx;
  const k = scaleOf(ctx.attacker);
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const angle = degrees(unit(from, to));
  const scar = fx.image(BFX.crack, from.x, from.y, { color: 0x1c0f07, blend: 'normal', alpha: 0.75, origin: [0, 0.5], w: length, h: 16 * k, angle, depth: DEPTH.behind - 0.02 });
  const glow = [
    fx.image(BFX.crack, from.x, from.y, { color, origin: [0, 0.5], w: length, h: 30 * k, angle, depth: DEPTH.behind }),
    fx.image(BFX.crack, from.x, from.y, { color: hot, origin: [0, 0.5], w: length, h: 12 * k, angle, depth: DEPTH.behind + 0.01 }),
  ];
  const head = { x: from.x, y: from.y };
  const embers = fx.trail(head, { colors: [WHITE, hot, color], size: [5 * k, 1], life: [260, 460], frequency: 9, speed: [40, 140], gravity: -160, spread: 4 });
  const reveal = ease('Quad.easeIn');
  fx.animate(ms, t => {
    const p = reveal(t);
    [scar, ...glow].forEach(layer => layer.setCrop(0, 0, layer.frame.width * p, layer.frame.height));
    head.x = from.x + (to.x - from.x) * p;
    head.y = from.y + (to.y - from.y) * p;
  }, () => {
    fx.endTrail(embers, 460);
    fx.animate(360, t => glow.forEach(layer => layer.setAlpha(1 - t)), () => glow.forEach(layer => layer.destroy()));
    fx.animate(1100, t => scar.setAlpha(0.75 * (1 - t * t)), () => scar.destroy());
  });
}

/**
 * Bass Drop — onsets: blip 15 ms, the drop 700 ms, rise 775 ms, peak 835 ms,
 * pulses 930 / 995 ms. The hero crouches on the blip, hangs at the top of a
 * leap through the silence, slams the ground on the drop, and the fissure
 * erupts under the opponent as a bass column on the peak.
 */
const bassDrop: MoveScript = ctx => {
  const { fx, attacker: hero, target: foe, color } = ctx;
  const k = scaleOf(hero);
  const feet = hero.feet;
  const ground = foe.feet;
  const leap = hero.height * 0.38;
  const hot = 0xffd9a8;
  const deep = 0x8a2a08;
  const dust = 0x7d6552;

  ctx.cue();

  // Crouch: the sub-bass drags the ground in toward the feet.
  hero.pose({ sx: 1.08, sy: 0.86 }, 110, 'Quad.easeOut');
  for (let i = 0; i < 3; i++) {
    fx.at(i * 55, () => fx.ring(feet.x, feet.y, {
      color, from: 170 * k, to: 30 * k, life: 260, soft: true, squash: 0.3, alpha: 0.85, ease: 'Cubic.easeIn', fadeIn: 0.45, depth: DEPTH.behind,
    }));
  }
  fx.converge(feet.x, feet.y - 6 * k, { count: 18, radius: 105 * k, squash: 0.45, colors: [WHITE, color], life: [170, 250], streak: true, size: 13 * k });
  const footGlow = fx.image(BFX.glow, feet.x, feet.y, { color, alpha: 0, w: 120 * k, h: 36 * k, depth: DEPTH.behind });
  fx.animate(140, t => footGlow.setAlpha(0.9 * t));

  // Leap.
  const shadow = fx.image(BFX.glow, feet.x, feet.y + 2, { color: 0x000000, blend: 'normal', alpha: 0, w: hero.width * 1.3, h: 18 * k, depth: DEPTH.behind });
  fx.at(140, () => {
    hero.pose({ sx: 0.93, sy: 1.1, dy: -leap * 0.9 }, 280, 'Cubic.easeOut');
    for (const side of [-1, 1]) {
      fx.puffs(feet.x + side * 10 * k, feet.y - 3, {
        count: 6, color: dust, alpha: 0.55, size: [16 * k, 46 * k], speed: [50, 130],
        angle: side < 0 ? [170, 200] : [-20, 10], life: [520, 820], gravity: -18, depth: DEPTH.front - 2,
      });
    }
    fx.ring(feet.x, feet.y, { color: WHITE, from: 30 * k, to: 150 * k, life: 300, squash: 0.28, alpha: 0.6 });
    fx.animate(280, t => {
      shadow.setAlpha(0.38 * (1 - 0.45 * t)).setDisplaySize(hero.width * 1.3 * (1 - 0.4 * t), 18 * k * (1 - 0.4 * t));
      footGlow.setAlpha(0.9 * (1 - t));
    }, () => footGlow.destroy());
    const embers = fx.trail(feetOf(hero, 4 * k), { colors: [hot, color, deep], size: [5 * k, 1], life: [300, 480], frequency: 20, speed: [10, 40], gravity: 70 });
    fx.at(520, () => fx.endTrail(embers, 480));
    fx.dim(0.36, 300);
    fx.push(hero.center.x, hero.center.y - leap, 0.022, 420);
  });

  // Hang at the top through the silence before the drop; the cone under the
  // hero throbs and the arena rumbles.
  fx.at(420, () => {
    hero.pose({ dy: -leap }, 245, 'Sine.easeInOut');
    fx.rumble(0.24, 250);
    fx.converge(hero.center.x, hero.center.y, { count: 2, radius: 120 * k, colors: [WHITE, color], life: [150, 220], streak: true, size: 14 * k, duration: 230, frequency: 24 });
  });
  for (const beat of [450, 580]) {
    fx.at(beat, () => {
      const under = hero.feetNow;
      fx.ring(under.x, under.y + 4, { color, from: 24 * k, to: 130 * k, life: 300, squash: 0.32, alpha: 0.9, soft: true });
      fx.glow(under.x, under.y + 4, { color, size: 80 * k, squash: 0.35, life: 260, alpha: 0.85 });
    });
  }

  // Slam.
  fx.at(665, () => {
    hero.pose({ sx: 0.9, sy: 1.14 }, 45, 'Expo.easeIn');
    fx.push(feet.x, feet.y, 0, 160);
    fx.afterimage(hero.sprite, { color, alpha: 0.3, life: 120 });
    fx.speedLines({
      region: { x: feet.x - hero.width * 0.7, y: feet.y - hero.height * 1.7, w: hero.width * 1.4, h: hero.height * 0.9 },
      angle: 90, color: WHITE, alpha: 0.55, length: [40 * k, 90 * k], thickness: 2 * k, speed: [1300, 1700], life: 90, duration: 50, frequency: 8,
    });
  });

  // The drop: contact, and the ground tears open toward the opponent.
  fx.at(710, () => {
    hero.pose({ sx: 1.18, sy: 0.8 }, 0);
    fx.at(70, () => hero.pose({}, 280, 'Back.easeOut'));
    shadow.setAlpha(0.42).setDisplaySize(hero.width * 1.5, 20 * k);
    fx.animate(420, t => shadow.setAlpha(0.42 * (1 - t)), () => shadow.destroy());

    // The flash sits behind the hero so the figure stays readable in it.
    fx.flash(feet.x, feet.y - 4 * k, color, 80 * k, 140, DEPTH.behind);
    fx.glow(feet.x, feet.y - 2, { color: WHITE, size: 46 * k, squash: 0.4, life: 120, fade: 'Quad.easeOut' });
    fx.ring(feet.x, feet.y, { color, from: 40 * k, to: 360 * k, life: 420, soft: true, squash: 0.3, alpha: 0.9, depth: DEPTH.behind });
    fx.at(50, () => fx.ring(feet.x, feet.y, { color: WHITE, from: 30 * k, to: 250 * k, life: 320, squash: 0.3, alpha: 0.75, depth: DEPTH.behind }));
    for (const side of [-1, 1]) {
      fx.puffs(feet.x + side * 16 * k, feet.y - 4, {
        count: 8, color: dust, alpha: 0.6, size: [20 * k, 64 * k], speed: [70, 190],
        angle: side < 0 ? [165, 200] : [-20, 15], life: [700, 1150], gravity: -22, spread: { x: 10 * k, y: 3 }, depth: DEPTH.front - 2,
      });
    }
    fx.debris(feet.x, feet.y - 4, { count: 12, color: 0x6b5643, size: [5 * k, 11 * k], speed: [170, 340], angle: [-160, -20], life: [650, 900], gravity: 950 });
    fx.sparks(feet.x, feet.y - 6, { count: 12, colors: [WHITE, hot, color, deep], speed: [200, 420], angle: [-150, -30], life: [420, 700], gravity: 800, length: 16 * k, thickness: 2.2 * k });
    fx.shake(0.5);
    fx.punch(feet.x, feet.y, 0.03);
    fx.kick(0, 4);
    fissure(ctx, feet, ground, 95, hot);
  });

  // The bass column erupts under the opponent on the peak, behind its body so
  // the silhouette stands out against the light.
  fx.at(805, () => {
    const base = { x: ground.x, y: ground.y + 2 };
    const pillar = fx.strand([
      { width: 132 * k, color, alpha: 0.42 },
      { width: 54 * k, color, alpha: 0.9 },
      { width: 18 * k, color: WHITE, alpha: 1 },
    ], DEPTH.behind + 0.05);
    const rise = ease('Expo.easeOut');
    const fall = ease('Sine.easeIn');
    const surge = (elapsed: number, at: number, amount: number) => (elapsed < at ? 0 : amount * Math.exp(-(elapsed - at) / 45));
    fx.animate(560, t => {
      const e = t * 560;
      const reach = rise(Math.min(1, e / 80));
      const width = (0.25 + 0.75 * reach) * (1 + surge(e, 125, 0.35) + surge(e, 190, 0.25)) * (1 + 0.06 * Math.sin(e / 18));
      const fade = e > 255 ? 1 - fall((e - 255) / 305) : 1;
      pillar.setPoints([base, { x: base.x, y: base.y + (-40 - base.y) * reach }]).setWidth(width * fade).setAlpha(fade);
    }, () => pillar.destroy());

    fx.flash(base.x, base.y - 6 * k, color, 90 * k, 170);
    fx.streakFlare(base.x, base.y - 4, { color, width: 340 * k, height: 16 * k, life: 380 });
    fx.ring(base.x, base.y, { color, from: 30 * k, to: 320 * k, life: 440, soft: true, squash: 0.35, depth: DEPTH.behind });
    fx.at(40, () => fx.ring(base.x, base.y, { color: WHITE, from: 20 * k, to: 230 * k, life: 320, squash: 0.35, alpha: 0.85, depth: DEPTH.behind }));
    fx.sparks(base.x, base.y - 6, { count: 28, colors: [WHITE, hot, color, deep], speed: [380, 720], angle: [-118, -62], life: [600, 950], gravity: 900, length: 22 * k, thickness: 2.6 * k, spread: 8 });

    // The equaliser punches up around the column.
    for (let i = -5; i <= 5; i++) {
      if (i === 0) continue;
      const height = (26 + (5 - Math.abs(i)) * 11) * k * (0.8 + Math.random() * 0.4);
      const bar = fx.image(BFX.beam, base.x + i * 11 * k, base.y, {
        color: i % 2 === 0 ? WHITE : color, origin: [0, 0.5], angle: -90, w: 1, h: 7 * k, depth: DEPTH.behind + 0.04, alpha: 0.9,
      });
      fx.at(Math.abs(i) * 12, () => fx.animate(400, t => {
        const up = t < 0.3 ? ease('Back.easeOut')(t / 0.3) : 1 - ease('Quad.easeIn')((t - 0.3) / 0.7);
        bar.setDisplaySize(Math.max(1, height * up), 7 * k).setAlpha(0.9 * (t < 0.3 ? 1 : 1 - ((t - 0.3) / 0.7) * 0.6));
      }, () => bar.destroy()));
    }
  });

  fx.at(815, () => {
    ctx.hit(1, { weight: 'heavy', color, dir: { x: 0.25, y: -0.97 }, lift: 16 * k, at: foe.center });
    fx.screenFlash(WHITE, 0.12, 170);
    fx.motes(foe.center.x, foe.center.y, {
      texture: BFX.note, count: 3, colors: [WHITE, color], speed: [50, 120], angle: [-125, -55], life: [800, 1100], size: [16 * k, 24 * k], gravity: -40,
    });
  });

  [930, 995].forEach((beat, i) => fx.at(beat, () => {
    fx.ring(ground.x, ground.y, { color, from: 40 * k, to: (210 - i * 40) * k, life: 280, squash: 0.35, soft: true, alpha: 0.7, depth: DEPTH.behind });
    fx.shake(0.22 - i * 0.06);
  }));

  fx.at(1060, () => fx.motes(ground.x, ground.y - 20 * k, {
    count: 16, colors: [hot, color, deep], speed: [20, 70], angle: [-110, -70], life: [700, 1100], size: [5 * k, 1], gravity: -50, spread: { x: 20 * k, y: 30 * k },
  }));
  fx.at(1100, () => relight(ctx, 380));
  fx.at(1250, () => ctx.done());
};

/** A stack of sound fronts flying from `from` to `to` along a bowed path. */
function soundFront(
  ctx: MoveContext,
  o: { from: Point; to: Point; count: number; spacing: number; size: [number, number]; bow: number; ms: number; ease: string; colors: number[]; alpha?: number; reverse?: boolean; under?: number },
  arrived: (fronts: Phaser.GameObjects.Image[]) => void,
): void {
  const { fx } = ctx;
  const k = scaleOf(ctx.attacker);
  const dir = unit(o.from, o.to);
  const angle = degrees(dir) + (o.reverse ? 180 : 0);
  const aspect = 48 / 128;
  const fronts = Array.from({ length: o.count }, (_, i) => fx.image(BFX.wave, o.from.x, o.from.y, {
    color: o.colors[Math.min(i, o.colors.length - 1)], alpha: (o.alpha ?? 1) * (1 - i * 0.12), angle,
    w: o.size[0] * aspect, h: o.size[0], depth: DEPTH.front + 0.1 - i * 0.01,
  }));
  // A darker copy under the lead front keeps its colour on a bright arena.
  const under = fx.image(BFX.wave, o.from.x, o.from.y, {
    color: o.under ?? 0x1d4166, blend: 'normal', alpha: 0.45 * (o.alpha ?? 1), angle,
    w: o.size[0] * aspect * 1.3, h: o.size[0] * 1.04, depth: DEPTH.front - 0.1,
  });
  const curve = ease(o.ease);
  let lastRing = 0;
  fx.animate(o.ms, t => {
    const p = curve(t);
    const size = lerp(o.size[0], o.size[1], p);
    fronts.forEach((front, i) => {
      const lag = Math.max(0, p - (i * o.spacing) / Math.max(1, Math.hypot(o.to.x - o.from.x, o.to.y - o.from.y)));
      const centre = sideways(mixPoint(o.from, o.to, lag), dir, Math.sin(Math.PI * lag) * o.bow);
      front.setPosition(centre.x, centre.y).setDisplaySize(size * aspect, size * (1 - i * 0.06));
      if (i === 0) under.setPosition(centre.x - dir.x * 3 * k, centre.y - dir.y * 3 * k).setDisplaySize(size * aspect * 1.3, size * 1.04);
    });
    if (t * o.ms - lastRing > 38) {
      lastRing = t * o.ms;
      const head = fronts[0];
      fx.ring(head.x, head.y, { color: o.colors[1] ?? o.colors[0], from: 8 * k, to: 34 * k, life: 240, alpha: 0.3 });
    }
  }, () => {
    under.destroy();
    arrived(fronts);
  });
}

/** The fronts flatten against what they hit and vanish. */
function splash(ctx: MoveContext, fronts: Phaser.GameObjects.Image[]): void {
  fronts.forEach(front => {
    const w = front.displayWidth;
    const h = front.displayHeight;
    const a = front.alpha;
    ctx.fx.animate(140, t => front.setDisplaySize(w * (1 - 0.7 * t), h * (1 + 0.25 * t)).setAlpha(a * (1 - t)), () => front.destroy());
  });
}

/**
 * Echo Wave — onsets (from the cue, which starts on the first hit): 0 ms,
 * 245 ms, 865 ms, 1105 ms. A stack of sound fronts hits, reflects back to the
 * hero, is caught and thrown again amplified: the echo is the second hit,
 * and its own echo rings out after it.
 */
const echoWave: MoveScript = ctx => {
  const { fx, attacker: hero, target: foe, color } = ctx;
  const k = scaleOf(hero);
  const pale = 0xcfe6f7;
  const deep = 0x23507a;
  const firstHit = 440;
  const secondHit = firstHit + 865;
  const dir = unit(hero.center, foe.center);
  /** The first wave was lethal: no echo comes back and the second wave never forms. */
  let endedEarly = false;

  hero.pose({ dx: -8, sx: 0.97, sy: 1.03 }, 140, 'Sine.easeOut');
  fx.converge(fist(hero).x, fist(hero).y, { count: 14, radius: 70 * k, colors: [WHITE, color], life: [120, 150], streak: true, size: 11 * k });

  const release = (strength: number) => {
    const hand = fist(hero);
    hero.pose({ dx: 12 + 4 * strength, sx: 1.05 + 0.02 * strength, sy: 0.96 - 0.02 * strength }, 65, 'Expo.easeOut');
    fx.at(65, () => hero.pose({}, 240, 'Sine.easeInOut'));
    fx.glow(hand.x, hand.y, { color, size: (70 + 40 * strength) * k, life: 220, alpha: 0.9 });
    fx.ring(hand.x, hand.y, { color: WHITE, from: 10 * k, to: (70 + 40 * strength) * k, life: 220, alpha: 0.8 });
    const heading = degrees(dir);
    fx.sparks(hand.x, hand.y, { count: 8 + 6 * strength, colors: [WHITE, color], speed: [200, 420], angle: [heading - 25, heading + 25], life: [180, 300], length: 14 * k });
    if (strength > 0) { fx.kick(-3, 0); fx.shake(0.2); }
  };

  fx.at(140, () => {
    release(0);
    soundFront(ctx, {
      from: fist(hero), to: foe.center, count: 3, spacing: 9 * k, size: [70 * k, 110 * k], bow: -18 * k, ms: firstHit - 140,
      ease: 'Sine.easeIn', colors: [pale, color, color],
    }, fronts => {
      ctx.cue();
      splash(ctx, fronts);
      ctx.hit(0.5, { weight: 'medium', color, dir });
      fx.ring(foe.center.x, foe.center.y, { color, from: 20 * k, to: 170 * k, life: 360, soft: true });
      fx.ring(foe.center.x, foe.center.y, { color: WHITE, from: 16 * k, to: 120 * k, life: 260, alpha: 0.85 });
      fx.glow(foe.center.x, foe.center.y, { color, size: 120 * k, life: 260, alpha: 0.8 });
      const heading = degrees(dir);
      fx.sparks(foe.center.x, foe.center.y, { count: 18, colors: [WHITE, pale, color, deep], speed: [220, 420], angle: [heading - 70, heading + 70], life: [380, 600], gravity: 300, length: 15 * k });
      [12, 22].forEach((push, i) => fx.afterimage(foe.sprite, { color, alpha: 0.32 - i * 0.1, life: 300 + i * 80, dx: dir.x * push * k, dy: dir.y * push * k }));

      if (ctx.targetDown()) {
        endedEarly = true;
        // The cue's second wave starts 865 ms after the first hit: fade it out before then.
        fx.at(700, () => ctx.cutSound(140));
        fx.at(380, () => relight(ctx, 340));
        fx.at(460, () => ctx.done());
        return;
      }

      // The front bounces off and travels back: the echo.
      soundFront(ctx, {
        from: foe.center, to: fist(hero), count: 2, spacing: 8 * k, size: [90 * k, 70 * k], bow: 14 * k, ms: 380,
        ease: 'Sine.easeInOut', colors: [pale, color], alpha: 0.55, reverse: true,
      }, back => {
        // Caught and wound up again, bigger.
        back.forEach(front => front.destroy());
        const hand = fist(hero);
        fx.ring(hand.x, hand.y, { color, from: 70 * k, to: 10 * k, life: 170, alpha: 0.9, ease: 'Cubic.easeIn', fadeIn: 0.3 });
        fx.glow(hand.x, hand.y, { color: pale, size: 90 * k, life: 260, alpha: 0.9 });
        if (ctx.aura) fx.auraTo(ctx.aura, 1.6, 120);
        hero.pose({ dx: -10, sx: 0.96, sy: 1.04 }, 220, 'Sine.easeOut');
        fx.converge(hand.x, hand.y, { count: 20, radius: 90 * k, colors: [WHITE, color], life: [200, 260], streak: true, size: 12 * k });
        fx.shake(0.12);
        for (const tilt of [-30, 30]) {
          const orbit = fx.image(BFX.ring, hand.x, hand.y, { color, alpha: 0, w: 46 * k, h: 46 * k * 0.4, angle: tilt });
          fx.animate(260, t => orbit.setAngle(tilt + 220 * t).setAlpha(0.8 * Math.sin(Math.PI * t)), () => orbit.destroy());
        }
      });
    });
  });

  fx.at(secondHit - 225, () => {
    if (endedEarly) return;
    release(1);
    if (ctx.aura) fx.auraTo(ctx.aura, 1, 200);
    soundFront(ctx, {
      from: fist(hero), to: foe.center, count: 5, spacing: 11 * k, size: [110 * k, 170 * k], bow: 12 * k, ms: 225,
      ease: 'Quad.easeIn', colors: [pale, color, color, deep, deep],
    }, fronts => {
      splash(ctx, fronts);
      ctx.hit(1, { weight: 'heavy', color, dir });
      fx.flash(foe.center.x, foe.center.y, color, 70 * k, 160);
      fx.ring(foe.center.x, foe.center.y, { color, from: 20 * k, to: 250 * k, life: 440, soft: true });
      fx.ring(foe.center.x, foe.center.y, { color: WHITE, from: 15 * k, to: 180 * k, life: 320, alpha: 0.85 });
      fx.streakFlare(foe.center.x, foe.center.y, { color: pale, width: 360 * k, life: 260 });
      fx.sparks(foe.center.x, foe.center.y, { count: 30, colors: [WHITE, pale, color, deep], speed: [260, 560], life: [420, 700], gravity: 350, length: 18 * k });
      fx.motes(foe.center.x, foe.center.y, { texture: BFX.note, frames: [0, 1], count: 2, colors: [WHITE, color], speed: [60, 110], angle: [-130, -50], life: [700, 900], size: [16 * k, 22 * k], gravity: -40 });
      [0, 70, 145].forEach((delay, i) => fx.at(delay, () => fx.afterimage(foe.sprite, {
        color, alpha: 0.34 - i * 0.08, life: 320, dx: dir.x * (14 + 12 * i) * k, dy: dir.y * (14 + 12 * i) * k,
      })));
    });
  });

  // The echo of the second hit.
  fx.at(firstHit + 1105, () => {
    if (endedEarly) return;
    fx.ring(foe.center.x, foe.center.y, { color, from: 40 * k, to: 210 * k, life: 420, soft: true, alpha: 0.4 });
    fx.afterimage(foe.sprite, { color, alpha: 0.18, life: 380, dx: dir.x * 45 * k, dy: dir.y * 45 * k });
    fx.shake(0.12);
  });
  fx.at(firstHit + 1160, () => { if (!endedEarly) relight(ctx, 340); });
  fx.at(firstHit + 1240, () => ctx.done());
};

/** A blade trail swept across `at`: revealed along the swing, then fading. */
function slash(ctx: MoveContext, at: Point, o: { angle: number; size: number; flipY?: boolean; life?: number; hot?: number }): void {
  const { fx, color } = ctx;
  const life = o.life ?? 150;
  const layers = [
    fx.image(BFX.slash, at.x, at.y, { color, w: o.size, h: o.size * 0.5, angle: o.angle }),
    fx.image(BFX.slash, at.x, at.y, { color: o.hot ?? WHITE, w: o.size * 0.92, h: o.size * 0.42, angle: o.angle, alpha: 0.9, depth: DEPTH.front + 0.1 }),
  ];
  layers.forEach(layer => layer.setFlipY(!!o.flipY));
  const reveal = ease('Expo.easeOut');
  fx.animate(45, t => layers.forEach(layer => layer.setCrop(0, 0, layer.frame.width * reveal(t), layer.frame.height)), () => {
    fx.animate(life, t => layers.forEach((layer, i) => layer.setAngle(o.angle + (o.flipY ? -10 : 10) * t).setAlpha((i ? 0.9 : 1) * (1 - t * t))), () => layers.forEach(layer => layer.destroy()));
  });
}

/**
 * Hook Impact — onsets (from the cue): 75 ms, 245 ms, 375 ms (the hook),
 * 450 ms, 505 ms. A dash closes the distance, two blade strokes cross the
 * opponent and a rising hook throws it, then the hero flips back.
 */
const hookImpact: MoveScript = ctx => {
  const { fx, attacker: hero, target: foe, color } = ctx;
  const k = scaleOf(hero);
  const hot = 0xfff1c9;
  const deep = 0x8a5a14;
  const depthScale = 0.84;
  const strike = { x: foe.feet.x - foe.width * 0.55 - hero.width * 0.2, y: foe.feet.y + 8 * k };
  const cueAt = 130;
  const at = (onset: number) => cueAt + onset;

  hero.pose({ dx: -10, sx: 1.05, sy: 0.92 }, 110, 'Quad.easeOut');

  // Dash.
  fx.at(110, () => {
    const start = hero.feetNow;
    hero.moveFeetTo(strike, depthScale, 95, 'Cubic.easeIn', 0.92);
    // Laid along the dash, not stacked at its start.
    [35, 55, 70, 82].forEach((delay, i) => fx.at(delay, () => fx.afterimage(hero.sprite, { color: i % 2 ? WHITE : color, alpha: 0.3 - i * 0.04, life: 160 })));
    fx.speedLines({
      region: { x: 0, y: Math.min(start.y, strike.y) - hero.height * 0.9, w: fx.width, h: Math.abs(start.y - strike.y) + hero.height * 0.9 },
      angle: 180, color: WHITE, alpha: 0.4, length: [60 * k, 140 * k], thickness: 2 * k, speed: [1400, 1900], life: 140, duration: 160, frequency: 10,
    });
    fx.puffs(start.x - 12 * k, start.y - 3, { count: 6, color: 0x7d6552, alpha: 0.5, size: [14 * k, 40 * k], speed: [40, 120], angle: [170, 200], life: [420, 700], gravity: -16 });
    fx.dim(0.32, 200);
  });
  fx.at(cueAt, () => ctx.cue());

  const centre = () => foe.center;
  const strikeSparks = (heading: number, count: number) => {
    const c = centre();
    fx.sparks(c.x, c.y, { count, colors: [WHITE, hot, color, deep], speed: [200, 420], angle: [heading - 25, heading + 25], life: [260, 420], gravity: 250, length: 14 * k });
    fx.sparks(c.x, c.y, { count: Math.round(count / 2), colors: [WHITE, color], speed: [150, 300], angle: [heading + 155, heading + 205], life: [200, 320], length: 10 * k });
  };

  // First stroke, from high to low.
  fx.at(at(75), () => {
    hero.moveFeetTo(strike, depthScale, 60, 'Quad.easeOut');
    slash(ctx, centre(), { angle: 30, size: foe.height * 1.25 });
    strikeSparks(30, 12);
    ctx.hit(0.12, { weight: 'light', color, dir: { x: 0.87, y: 0.5 } });
  });
  fx.at(at(160), () => hero.moveFeetTo({ x: strike.x + 6 * k, y: strike.y }, depthScale, 60, 'Sine.easeOut'));

  // Second stroke, back up across it.
  fx.at(at(245), () => {
    slash(ctx, centre(), { angle: -25, size: foe.height * 1.35, flipY: true });
    strikeSparks(-25, 12);
    ctx.hit(0.12, { weight: 'light', color, dir: { x: 0.87, y: -0.5 } });
  });
  fx.at(at(310), () => hero.pose({ ...poseAt(hero, strike, depthScale), sy: depthScale * 0.9 }, 60, 'Quad.easeOut'));

  // The hook: a rising blow that throws the opponent.
  fx.at(at(375), () => {
    hero.pose({ ...poseAt(hero, { x: strike.x + 10 * k, y: strike.y - 14 * k }, depthScale), sy: depthScale * 1.12 }, 50, 'Expo.easeOut');
    const c = centre();
    slash(ctx, c, { angle: -62, size: foe.height * 1.9, life: 220, hot });
    fx.star(c.x, c.y, { color: hot, size: 80 * k, life: 240 });
    fx.streakFlare(c.x, c.y, { color, width: 420 * k, life: 300 });
    fx.flash(c.x, c.y, color, 70 * k, 150);
    fx.ring(c.x, c.y, { color: WHITE, from: 20 * k, to: 190 * k, life: 280, alpha: 0.8 });
    fx.ring(c.x, c.y, { color, from: 30 * k, to: 240 * k, life: 380, soft: true, alpha: 0.75 });
    fx.sparks(c.x, c.y, { count: 34, colors: [WHITE, hot, color, deep], speed: [300, 650], angle: [-110, 10], life: [500, 800], gravity: 600, length: 20 * k, thickness: 2.4 * k });
    fx.motes(c.x, c.y, { texture: BFX.note, frames: [4], count: 2, colors: [WHITE, color], speed: [60, 110], angle: [-120, -60], life: [700, 900], size: [18 * k, 24 * k], gravity: -40 });
    ctx.hit(1, { weight: 'heavy', color, dir: { x: 0.6, y: -0.8 }, lift: 12 * k });
  });
  fx.at(at(450), () => {
    const c = centre();
    fx.ring(c.x, c.y, { color, from: 30 * k, to: 180 * k, life: 300, alpha: 0.7 });
    fx.sparks(c.x, c.y, { count: 10, colors: [WHITE, color], speed: [150, 320], life: [260, 420], gravity: 400, length: 12 * k });
  });
  fx.at(at(505), () => {
    for (let i = 0; i < 3; i++) {
      const c = foe.at((Math.random() - 0.5) * 0.9, 0.3 + Math.random() * 0.6);
      fx.at(i * 40, () => fx.star(c.x, c.y, { color: i % 2 ? color : WHITE, size: 34 * k, life: 220 }));
    }
  });

  // Flip back home along an arc.
  fx.at(at(470), () => {
    const from = hero.feetNow;
    const home = hero.feet;
    const curve = ease('Sine.easeInOut');
    fx.animate(280, t => {
      const p = curve(t);
      const feet = { x: lerp(from.x, home.x, p), y: lerp(from.y, home.y, p) - Math.sin(Math.PI * t) * 42 * k };
      hero.pose(poseAt(hero, feet, lerp(depthScale, 1, p)), 0);
    });
    for (let i = 0; i < 3; i++) fx.at(40 + i * 60, () => fx.afterimage(hero.sprite, { color, alpha: 0.3, life: 180 }));
  });
  fx.at(at(760), () => relight(ctx, 320));
  fx.at(at(820), () => ctx.done());
};

/** The pose that puts the feet at `feet` (world) at uniform `scale`. */
function poseAt(fighter: Combatant, feet: Point, scale: number) {
  return { dx: (feet.x - fighter.feet.x) * fighter.facing, dy: feet.y - fighter.feet.y, sx: scale, sy: scale };
}

/**
 * Reverb Strike — onsets: a swell at 90, 170, 220, 305, 415 ms, the strike at
 * 475 ms, then a long reverb tail. A resonance field spins up around the hero
 * on the swell, a beam carries the strike, and the hit keeps reflecting:
 * three decaying echoes land the rest of the damage.
 */
const reverbStrike: MoveScript = ctx => {
  const { fx, attacker: hero, target: foe, color } = ctx;
  const k = scaleOf(hero);
  const hot = 0xffb39a;
  const deep = 0x5a0c08;
  const dir = unit(hero.center, foe.center);
  const strikeAt = 475;

  ctx.cue();
  fx.dim(0.62, 260);
  fx.spotlight(hero.center.x, hero.center.y, 0.6, 300);
  fx.push(hero.center.x, hero.center.y, 0.035, 450);
  hero.pose({ dy: -8 * k }, 400, 'Sine.easeInOut');
  hero.tremble(1.2, 430);

  // Resonance field: tilted rings spinning up around the hero.
  const field = [
    { squash: 0.32, tilt: -20, spin: 160, size: 170 },
    { squash: 0.45, tilt: 12, spin: -130, size: 140 },
    { squash: 0.6, tilt: 35, spin: 110, size: 110 },
  ].map((ring, i) => ({ ...ring, image: fx.image(BFX.ring, hero.center.x, hero.center.y, { color: i === 1 ? WHITE : color, alpha: 0, depth: DEPTH.front - 0.5 }) }));
  const grow = ease('Cubic.easeOut');
  fx.animate(strikeAt + 120, t => {
    const e = t * (strikeAt + 120);
    const build = grow(Math.min(1, e / strikeAt));
    const out = e > strikeAt ? (e - strikeAt) / 120 : 0;
    const c = hero.center;
    field.forEach(ring => {
      const size = ring.size * k * (0.5 + 0.5 * build) * (1 + out * 0.8);
      ring.image.setPosition(c.x, c.y).setDisplaySize(size, size * ring.squash).setAngle(ring.tilt + ring.spin * (e / 1000) * (1 + build))
        .setAlpha(0.75 * build * (1 - out));
    });
  }, () => field.forEach(ring => ring.image.destroy()));
  fx.converge(fist(hero).x, fist(hero).y, { count: 2, radius: 130 * k, colors: [WHITE, color], life: [170, 240], streak: true, size: 15 * k, duration: 430, frequency: 22 });

  // The swell: each onset pulls a ring in and steps the light up.
  [90, 170, 220, 305, 415].forEach((beat, i) => fx.at(beat, () => {
    const c = hero.center;
    fx.ring(c.x, c.y, { color, from: 170 * k, to: 30 * k, life: 190, soft: true, alpha: 0.85, ease: 'Cubic.easeIn', fadeIn: 0.35, depth: DEPTH.front - 0.4 });
    if (ctx.aura) fx.auraTo(ctx.aura, 1.2 + 0.15 * i, 60);
    fx.shake(0.06 + 0.02 * i);
  }));

  fx.at(400, () => hero.pose({ dx: -8, dy: -8 * k, sx: 0.97, sy: 1.03 }, 40, 'Quad.easeOut'));

  // The beam.
  fx.at(440, () => {
    hero.pose({ dx: 14, dy: -8 * k, sx: 1.06, sy: 0.95 }, 40, 'Expo.easeOut');
    const from = fist(hero);
    const to = foe.center;
    const beam = fx.strand([
      { width: 92 * k, color: deep, alpha: 0.35, blend: 'normal' },
      { width: 72 * k, color, alpha: 0.45 },
      { width: 30 * k, color: 0xff5a3c, alpha: 0.9 },
      { width: 10 * k, color: WHITE, alpha: 1 },
    ], DEPTH.front - 0.2);
    const extend = ease('Quad.easeIn');
    const collapse = ease('Expo.easeIn');
    // Out in 35 ms, held through the hit-stop, collapsing from 590 ms.
    fx.animate(310, t => {
      const e = t * 310;
      const reach = extend(Math.min(1, e / 35));
      const width = (e < 150 ? 1 : 1 - collapse(Math.min(1, (e - 150) / 160))) * (1 + 0.12 * Math.sin(e / 14));
      beam.setPoints([from, mixPoint(from, to, reach)]).setWidth(Math.max(0.01, width)).setAlpha(width > 0.05 ? 1 : width * 20);
    }, () => beam.destroy());
    fx.flash(from.x, from.y, color, 90 * k, 200);
    fx.star(from.x, from.y, { color: WHITE, size: 80 * k, life: 220 });
    const head = fx.image(BFX.core, from.x, from.y, { color: 0xffd0c0, w: 46 * k });
    fx.animate(60, t => {
      const p = mixPoint(from, to, extend(Math.min(1, (t * 60) / 35)));
      head.setPosition(p.x, p.y).setAlpha(1 - Math.max(0, t - 0.6) / 0.4);
    }, () => head.destroy());
    // Sound waves running down the beam.
    for (let beat = 0; beat < 150; beat += 38) {
      fx.at(beat, () => {
        const ring = fx.image(BFX.ring, from.x, from.y, { color: WHITE, alpha: 0.8, w: 40 * k, h: 40 * k * 0.3, angle: degrees(dir) + 90 });
        fx.animate(120, t => {
          const p = mixPoint(from, to, t);
          ring.setPosition(p.x, p.y).setDisplaySize(40 * k * (1 + t), 40 * k * 0.3 * (1 + t)).setAlpha(0.8 * (1 - t));
        }, () => ring.destroy());
      });
    }
  });

  // The strike.
  fx.at(strikeAt, () => {
    const c = foe.center;
    fx.impactFrame(50);
    fx.at(50, () => fx.screenFlash(WHITE, 0.35, 220));
    ctx.hit(0.7, { weight: 'massive', color, dir });
    fx.glow(c.x, c.y, { color: deep, size: 300 * k, life: 520, alpha: 0.5, blend: 'normal', depth: DEPTH.front - 0.3 });
    fx.flash(c.x, c.y, color, 150 * k, 200);
    fx.ring(c.x, c.y, { color, from: 30 * k, to: 380 * k, life: 520, soft: true });
    fx.ring(c.x, c.y, { color: WHITE, from: 20 * k, to: 290 * k, life: 380, alpha: 0.9 });
    fx.ring(foe.feet.x, foe.feet.y, { color, from: 40 * k, to: 420 * k, life: 560, soft: true, squash: 0.32, depth: DEPTH.behind });
    fx.streakFlare(c.x, c.y, { color: hot, width: 640 * k, height: 18 * k, life: 380 });
    fx.star(c.x, c.y, { color: WHITE, size: 120 * k, life: 280 });
    fx.sparks(c.x, c.y, { count: 44, colors: [WHITE, hot, color, deep], speed: [300, 800], life: [500, 900], gravity: 500, length: 22 * k, thickness: 2.6 * k });
    fx.debris(c.x, c.y, { texture: BFX.shard, count: 16, color: hot, size: [6 * k, 12 * k], speed: [200, 480], angle: [0, 360], life: [500, 800], gravity: 420, blend: 'add' });
    fx.motes(c.x, c.y, { count: 24, colors: [hot, color, deep], speed: [30, 110], life: [900, 1300], size: [5 * k, 1], gravity: -60, spread: { x: 24 * k, y: 24 * k } });
    fx.puffs(c.x, c.y, { count: 10, color: 0x3a1010, alpha: 0.5, size: [30 * k, 90 * k], speed: [40, 120], life: [900, 1300], gravity: -20, spread: { x: 10 * k, y: 10 * k } });
  });
  fx.at(strikeAt + 125, () => hero.pose({ dy: -8 * k }, 260, 'Sine.easeOut'));
  fx.at(strikeAt + 330, () => hero.pose({}, 220, 'Quad.easeIn'));

  // The reverb: the hit reflects back three times, fading each time.
  [760, 1020, 1280].forEach((beat, i) => fx.at(beat, () => {
    const decay = [0.6, 0.4, 0.25][i];
    const c = foe.center;
    fx.ring(c.x, c.y, { color, from: 30 * k, to: (300 * decay + 80) * k, life: 500, soft: true, alpha: decay + 0.2 });
    fx.ring(hero.center.x, hero.center.y, { color, from: 20 * k, to: (200 * decay + 60) * k, life: 460, alpha: decay * 0.6 });
    fx.afterimage(foe.sprite, { color, alpha: 0.42 * decay + 0.1, life: 420, dx: dir.x * 10 * (i + 1) * k, dy: dir.y * 10 * (i + 1) * k });
    fx.sparks(c.x, c.y, { count: Math.round(12 * decay), colors: [WHITE, color], speed: [150, 320], life: [300, 500], gravity: 300, length: 12 * k });
    ctx.hit(i === 2 ? 1 : 0.1, { weight: 'light', color, dir });
  }));
  fx.at(1300, () => {
    fx.push(hero.center.x, hero.center.y, 0, 500);
    relight(ctx, 500);
  });
  fx.at(1650, () => ctx.done());
};

export const PLAYER_MOVES: Record<string, { script: MoveScript; ultimate?: boolean }> = {
  'bass-drop': { script: bassDrop },
  'echo-wave': { script: echoWave },
  'hook-impact': { script: hookImpact },
  'reverb-strike': { script: reverbStrike, ultimate: true },
};
