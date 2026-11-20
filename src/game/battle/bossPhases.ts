import { BFX } from '../art/battleFx';
import { DEPTH, ease, type BattleFx, type Point } from './BattleFx';
import type { Combatant } from './Combatant';
import { degrees, mixPoint } from './moves';
import { scaleOf } from './playerMoves';

/**
 * The Gatekeeper changing form. Phase II ignites its cracks into molten
 * light; Phase III tears the arena apart, pulls everything into its core and
 * detonates. Both swap the art on their transformation frame.
 */

export interface PhaseShift {
  fx: BattleFx;
  boss: Combatant;
  hero: Combatant;
  /** Puts the new form's art in place. */
  transform(): void;
  done(): void;
}

const WHITE = 0xffffff;

const onBody = (fighter: Combatant, spread = 0.38): Point => fighter.at((Math.random() * 2 - 1) * spread, 0.12 + Math.random() * 0.78);

/** A point that follows the boss around its body, for embers shed from it. */
const aroundBody = (fighter: Combatant) => ({
  get x() { return fighter.center.x; },
  get y() { return fighter.center.y; },
});

/** A glowing tear in the ground from `from`, `length` long, along `angle` on the ground plane. */
function rupture(fx: BattleFx, from: Point, angle: number, length: number, color: number, k: number): void {
  const rad = (angle * Math.PI) / 180;
  const to = { x: from.x + Math.cos(rad) * length, y: from.y + Math.sin(rad) * length * 0.35 };
  const span = Math.hypot(to.x - from.x, to.y - from.y);
  const heading = degrees({ x: to.x - from.x, y: to.y - from.y });
  const scar = fx.image(BFX.crack, from.x, from.y, { color: 0x120206, blend: 'normal', alpha: 0.85, origin: [0, 0.5], w: span, h: 24 * k, angle: heading, depth: DEPTH.behind - 0.02 });
  const glow = fx.image(BFX.crack, from.x, from.y, { color, alpha: 0.75, origin: [0, 0.5], w: span, h: 16 * k, angle: heading, depth: DEPTH.behind });
  const reveal = ease('Expo.easeOut');
  fx.animate(160, t => [scar, glow].forEach(layer => layer.setCrop(0, 0, layer.frame.width * reveal(t), layer.frame.height)));
  fx.sparks(to.x, to.y, { count: 6, colors: [WHITE, color], speed: [80, 200], angle: [-150, -30], life: [260, 420], gravity: 500, length: 10 * k });
  fx.animate(2400, t => {
    glow.setAlpha(0.75 * Math.max(0, 1 - t * 1.8));
    scar.setAlpha(0.85 * (1 - t * t));
  }, () => { scar.destroy(); glow.destroy(); });
}

/** Phase I → II: the cracks ignite, heat builds until the molten form bursts out. */
export function enrage({ fx, boss, hero, transform, done }: PhaseShift): void {
  const k = scaleOf(hero);
  const ember = 0xff7a2b;
  const hot = 0xffc27a;
  const deep = 0x8a2a08;
  const core = () => boss.at(0, 0.56);
  const feet = boss.feet;
  const ignite = 1150;

  // The blow breaks its signal for a moment.
  boss.knock({ x: 1, y: 0 }, 10, 60, 0);
  fx.glitch(boss.sprite, { slices: 5, amount: 12 * k, life: 70 });
  fx.at(90, () => fx.glitch(boss.sprite, { slices: 4, amount: 9 * k, life: 60 }));
  fx.rgbSplit(boss.sprite, 8 * k, 260, 0.5);
  fx.shake(0.35);

  // Heat builds in the cracks.
  const aura = fx.aura(boss.sprite, ember);
  fx.auraTo(aura, 1.2, 800);
  fx.dim(0.45, 500);
  fx.spotlight(core().x, core().y, 0.5, 500, 0x2a0800);
  const arcs = [0, 1, 2].map(() => fx.bolt(onBody(boss), onBody(boss), { color: ember, width: 1.8 * k, glow: 9 * k, jag: 0.3 }));
  arcs.forEach(arc => arc.setAlpha(0));
  for (let beat = 150; beat < ignite; beat += 60) {
    fx.at(beat, () => arcs.forEach(arc => arc.regenerate(onBody(boss), onBody(boss)).setAlpha(0.35 + Math.random() * 0.65)));
  }
  const coreGlow = fx.image(BFX.glow, core().x, core().y, { color: ember, alpha: 0, w: 40 * k });
  fx.animate(ignite, t => {
    const c = core();
    const size = (40 + 170 * t * t) * k;
    coreGlow.setPosition(c.x, c.y).setDisplaySize(size, size).setAlpha(0.95 * Math.min(1, t * 1.4));
  });
  fx.at(150, () => {
    boss.tremble(2, ignite - 150);
    fx.rumble(0.24, ignite - 150);
    fx.converge(core().x, core().y, { count: 2, radius: 150 * k, colors: [WHITE, hot, ember], life: [220, 320], streak: true, size: 16 * k, duration: ignite - 200, frequency: 22 });
  });
  const embers = fx.trail(aroundBody(boss), { colors: [hot, ember, deep], size: [5 * k, 1], life: [600, 900], frequency: 26, speed: [20, 60], gravity: -90, spread: boss.width * 0.35 });
  fx.at(ignite, () => fx.endTrail(embers, 900));
  [300, 520, 740, 900].forEach(beat => fx.at(beat, () => fx.ring(feet.x, feet.y, {
    color: ember, from: 260 * k, to: 40 * k, life: 260, soft: true, squash: 0.32, alpha: 0.8, ease: 'Cubic.easeIn', fadeIn: 0.4, depth: DEPTH.behind,
  })));
  fx.at(950, () => boss.pose({ dy: -10, sx: 1.04, sy: 1.08 }, 200, 'Sine.easeOut'));

  // Ignition: the molten form bursts out.
  fx.at(ignite, () => {
    arcs.forEach(arc => arc.destroy());
    coreGlow.destroy();
    fx.auraTo(aura, 0, 1, true);
    transform();
    fx.hitFlash(boss.sprite, ember, 70, 420);
    boss.pose({ sx: 1.1, sy: 1.1 }, 0);
    fx.at(60, () => boss.pose({}, 420, 'Back.easeOut'));
    const c = core();
    fx.flash(c.x, c.y, ember, 150 * k, 220);
    fx.ring(c.x, c.y, { color: hot, from: 30 * k, to: 380 * k, life: 520, soft: true });
    fx.ring(c.x, c.y, { color: WHITE, from: 20 * k, to: 280 * k, life: 380, alpha: 0.85 });
    fx.ring(feet.x, feet.y, { color: ember, from: 40 * k, to: 460 * k, life: 620, soft: true, squash: 0.32, depth: DEPTH.behind });
    fx.streakFlare(c.x, c.y, { color: hot, width: 520 * k, height: 16 * k, life: 360 });
    fx.sparks(c.x, c.y, { count: 40, colors: [WHITE, hot, ember, deep], speed: [260, 680], life: [500, 900], gravity: 600, length: 20 * k, thickness: 2.6 * k });
    fx.motes(c.x, c.y, { count: 30, colors: [hot, ember, deep], speed: [40, 160], life: [800, 1300], size: [5 * k, 1], gravity: -70, spread: { x: boss.width * 0.3, y: boss.height * 0.3 } });
    fx.shake(0.65);
    fx.punch(c.x, c.y, 0.05);
    fx.kick(0, -5);
    fx.screenFlash(0xff9a50, 0.22, 260);
    hero.knock({ x: -1, y: 0 }, 8, 30, 0);
    const reborn = fx.aura(boss.sprite, ember);
    fx.auraTo(reborn, 1.1, 120);
    fx.at(500, () => fx.auraTo(reborn, 0, 600, true));
    // The arena stays heated from here on.
    fx.mood(0x5a1400, 0.32, 700);
  });
  fx.at(ignite + 380, () => {
    fx.dim(0, 500);
    fx.spotlight(core().x, core().y, 0, 500, 0x2a0800);
  });
  fx.at(ignite + 850, done);
}

/**
 * Phase II → III: the world stops, the Gatekeeper convulses while the ground
 * splits and its rubble lifts, everything is pulled into its core, and it
 * detonates into its final form.
 */
export function unleash({ fx, boss, hero, transform, done }: PhaseShift): void {
  const k = scaleOf(hero);
  const blood = 0xff2a3a;
  const hot = 0xff9a8a;
  const deep = 0x5a0008;
  const core = () => boss.at(0, 0.56);
  const feet = boss.feet;
  const collapse = 1100;
  const detonate = 1800;

  // The blow lands and the world stops for a beat.
  fx.impactFrame(60);
  fx.desaturate(0.6, 80);
  boss.knock({ x: 1, y: 0 }, 14, 120, 0);
  fx.shake(0.5);

  // Breakdown: it convulses, its signal tears, the ground splits open.
  const aura = fx.aura(boss.sprite, blood);
  fx.auraTo(aura, 1.3, 600);
  fx.dim(0.6, 600);
  fx.spotlight(core().x, core().y, 0.6, 600, 0x200004);
  fx.at(120, () => {
    boss.tremble(3, collapse - 120);
    fx.rumble(0.36, 600);
  });
  fx.at(700, () => fx.rumble(0.5, collapse - 700));
  for (let beat = 120; beat < collapse; beat += 60) fx.at(beat, () => fx.glitch(boss.sprite, { slices: 4, amount: 14 * k, life: 50 }));
  for (let beat = 120; beat < collapse; beat += 130) fx.at(beat, () => fx.rgbSplit(boss.sprite, 10 * k, 120, 0.5));
  const arcs = [0, 1, 2, 3].map(() => fx.bolt(onBody(boss), onBody(boss), { color: blood, width: 2 * k, glow: 10 * k, jag: 0.3 }));
  arcs.forEach(arc => arc.setAlpha(0));
  for (let beat = 120; beat < collapse; beat += 50) {
    fx.at(beat, () => arcs.forEach(arc => arc.regenerate(onBody(boss), onBody(boss)).setAlpha(0.5 + Math.random() * 0.5)));
  }
  // Bolts lash out into the ground.
  [[400, -0.45], [750, 0.5]].forEach(([beat, side]) => fx.at(beat, () => {
    const from = boss.at(side, 0.55);
    const ground = { x: feet.x + side * boss.width * 1.3, y: feet.y + 10 * k };
    const strike = fx.bolt(from, ground, { color: blood, width: 3.2 * k, glow: 16 * k, jag: 0.2, branches: 2 });
    fx.at(50, () => strike.regenerate().setAlpha(0.7));
    fx.at(90, () => fx.fadeStrand(strike, 80, 0.7));
    fx.flash(ground.x, ground.y, blood, 60 * k, 160);
    fx.ring(ground.x, ground.y, { color: blood, from: 20 * k, to: 160 * k, life: 320, soft: true, squash: 0.32, depth: DEPTH.behind });
    fx.debris(ground.x, ground.y, { count: 6, color: 0x3a2a30, size: [4 * k, 9 * k], speed: [120, 260], angle: [-150, -30], life: [500, 700], gravity: 900 });
    fx.shake(0.25);
  }));
  [-150, -115, -70, -30, 30, 75, 115, 150].forEach((angle, i) => fx.at(300 + i * 80, () => rupture(fx, feet, angle, (95 + Math.random() * 60) * k, blood, k)));
  // Gravity gives way: rubble lifts off the arena floor.
  fx.at(500, () => fx.debris(feet.x, feet.y, {
    count: 18, color: 0x3a2a30, size: [5 * k, 12 * k], speed: [10, 50], angle: [-110, -70], life: [1100, 1400], gravity: -55, spread: { x: 200 * k, y: 30 * k },
  }));

  // Collapse: everything is drawn into the core.
  const coreGlow = fx.image(BFX.glow, core().x, core().y, { color: blood, alpha: 0, w: 40 * k });
  fx.at(collapse, () => {
    arcs.forEach(arc => arc.destroy());
    fx.dim(0.82, 600);
    fx.push(core().x, core().y, 0.06, detonate - collapse);
    boss.pose({ sx: 0.9, sy: 0.9 }, detonate - collapse, 'Cubic.easeIn');
    fx.converge(core().x, core().y, { count: 3, radius: 230 * k, colors: [WHITE, hot, blood], life: [200, 300], streak: true, size: 20 * k, duration: 650, frequency: 14 });
    fx.converge(core().x, core().y, { count: 2, radius: 210 * k, colors: [0x0a0004, deep], life: [240, 320], size: 9 * k, blend: 'normal', duration: 650, frequency: 18 });
    for (let i = 0; i < 6; i++) {
      fx.at(i * 100, () => fx.ring(core().x, core().y, { color: i % 2 ? WHITE : blood, from: 330 * k, to: 30 * k, life: 220, soft: i % 2 === 0, alpha: 0.9, ease: 'Cubic.easeIn', fadeIn: 0.3 }));
    }
    fx.animate(detonate - collapse, t => {
      const c = core();
      const size = (50 + 150 * t * t) * k;
      coreGlow.setPosition(c.x, c.y).setDisplaySize(size, size).setAlpha(0.95 * Math.min(1, t * 2));
    });
  });
  // Two heartbeats before it breaks.
  [1330, 1580].forEach((beat, i) => fx.at(beat, () => {
    const c = core();
    fx.ring(c.x, c.y, { color: blood, from: 40 * k, to: (150 + 60 * i) * k, life: 260, soft: true, alpha: 0.85 });
    fx.shake(0.3 + 0.12 * i);
    fx.kick(0, 2 + i);
  }));

  // Detonation into the final form.
  fx.at(detonate, () => {
    coreGlow.destroy();
    fx.impactFrame(60);
    fx.at(60, () => fx.screenFlash(WHITE, 0.6, 450));
    fx.auraTo(aura, 0, 1, true);
    transform();
    fx.hitFlash(boss.sprite, blood, 90, 520);
    boss.pose({ sx: 1.18, sy: 1.18 }, 0);
    fx.at(80, () => boss.pose({}, 520, 'Back.easeOut'));
    fx.push(core().x, core().y, 0, 600);
    fx.desaturate(0, 700);
    const c = core();

    // A column of the Gatekeeper's energy erupts behind it.
    const base = { x: feet.x, y: feet.y };
    const pillar = fx.strand([
      { width: 240 * k, color: 0x0a0004, alpha: 0.5, blend: 'normal' },
      { width: 200 * k, color: blood, alpha: 0.5 },
      { width: 80 * k, color: hot, alpha: 0.9 },
      { width: 24 * k, color: WHITE, alpha: 1 },
    ], DEPTH.behind + 0.05);
    const rise = ease('Expo.easeOut');
    fx.animate(900, t => {
      const e = t * 900;
      const reach = rise(Math.min(1, e / 90));
      const fade = e > 300 ? 1 - ease('Sine.easeIn')((e - 300) / 600) : 1;
      pillar.setPoints([base, { x: base.x, y: base.y + (-40 - base.y) * reach }]).setWidth(Math.max(0.01, fade * (1 + 0.08 * Math.sin(e / 20)))).setAlpha(fade);
    }, () => pillar.destroy());

    [0, 90, 190].forEach((delay, i) => fx.at(delay, () => fx.ring(c.x, c.y, { color: i === 1 ? WHITE : blood, from: 30 * k, to: (560 - i * 80) * k, life: 640, soft: i !== 1, alpha: 0.95 - i * 0.15 })));
    [0, 120].forEach(delay => fx.at(delay, () => fx.ring(base.x, base.y, { color: blood, from: 50 * k, to: 640 * k, life: 720, soft: true, squash: 0.3, depth: DEPTH.behind })));
    fx.flash(c.x, c.y, blood, 180 * k, 260);
    fx.streakFlare(c.x, c.y, { color: hot, width: 700 * k, height: 22 * k, life: 460 });
    fx.star(c.x, c.y, { color: WHITE, size: 160 * k, life: 320 });
    fx.sparks(c.x, c.y, { count: 70, colors: [WHITE, hot, blood, deep], speed: [320, 900], life: [600, 1000], gravity: 500, length: 24 * k, thickness: 2.8 * k });
    fx.debris(c.x, c.y, { texture: BFX.shard, count: 30, color: hot, size: [6 * k, 14 * k], speed: [240, 560], angle: [0, 360], life: [600, 900], gravity: 450, blend: 'add' });
    fx.debris(c.x, c.y - 40 * k, { count: 16, color: 0x3a2a30, size: [5 * k, 12 * k], speed: [120, 320], angle: [-170, -10], life: [800, 1100], gravity: 900, spread: { x: 160 * k, y: 40 * k } });
    fx.puffs(c.x, c.y, { count: 20, color: 0x2a0408, alpha: 0.55, size: [40 * k, 130 * k], speed: [60, 200], life: [1000, 1500], gravity: -25, spread: { x: 30 * k, y: 30 * k } });
    fx.motes(c.x, c.y, { count: 40, colors: [hot, blood, deep], speed: [40, 180], life: [1000, 1600], size: [5 * k, 1], gravity: -60, spread: { x: boss.width * 0.4, y: boss.height * 0.4 } });
    fx.shake(1);
    fx.punch(c.x, c.y, 0.09);
    fx.kick(0, -8);
    hero.knock({ x: -1, y: 0.1 }, 16, 60, 0);

    const reborn = fx.aura(boss.sprite, blood);
    fx.auraTo(reborn, 1.4, 160);
    fx.at(900, () => fx.auraTo(reborn, 0, 900, true));
    fx.mood(0x5a0008, 0.42, 800);
  });

  // The new form roars; red lightning still runs over it.
  const embers = fx.trail(aroundBody(boss), { colors: [hot, blood, deep], size: [5 * k, 1], life: [700, 1000], frequency: 30, speed: [20, 70], gravity: -80, spread: boss.width * 0.4 });
  fx.at(detonate + 1300, () => fx.endTrail(embers, 1000));
  [200, 400, 600, 800].forEach(beat => fx.at(detonate + beat, () => {
    const arc = fx.bolt(onBody(boss), onBody(boss), { color: blood, width: 1.8 * k, glow: 9 * k, jag: 0.3 });
    fx.at(70, () => arc.destroy());
  }));
  fx.at(detonate + 500, () => {
    boss.pose({ dy: -12, sx: 1.03, sy: 1.07 }, 180, 'Sine.easeOut');
    const c = core();
    fx.ring(c.x, c.y, { color: blood, from: 40 * k, to: 300 * k, life: 420, soft: true, alpha: 0.8 });
    fx.ring(c.x, c.y, { color: WHITE, from: 30 * k, to: 220 * k, life: 320, alpha: 0.6 });
    fx.shake(0.4);
    fx.at(260, () => boss.pose({}, 420, 'Sine.easeInOut'));
  });
  fx.at(detonate + 1000, () => {
    fx.dim(0, 600);
    fx.spotlight(mixPoint(core(), hero.center, 0.5).x, core().y, 0, 600, 0x200004);
  });
  fx.at(detonate + 1600, done);
}
