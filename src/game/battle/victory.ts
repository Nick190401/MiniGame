import { BFX } from '../art/battleFx';
import { DEPTH, ease, lerpColor, type BattleFx, type Point } from './BattleFx';
import type { Combatant } from './Combatant';
import { scaleOf } from './playerMoves';

const WHITE = 0xffffff;

/** A random point inside a fighter's silhouette, roughly. */
const onBody = (fighter: Combatant, spread = 0.4): Point => fighter.at((Math.random() * 2 - 1) * spread, 0.1 + Math.random() * 0.8);

/**
 * The opponent breaking up: its signal tears apart in glitches and fragments,
 * what is left collapses into a bright line, and the line bursts. The
 * Gatekeeper's takes longer and ends in a shockwave. `done` runs once the
 * figure is gone, about 1.1 s in (1.5 s for the boss).
 */
export function foeDefeat(fx: BattleFx, foe: Combatant, hero: Combatant, color: number, isBoss: boolean, done: () => void): void {
  const k = scaleOf(hero);
  const sprite = foe.sprite;
  const span = isBoss ? 1.35 : 1;
  const tear = Math.round(700 * span);

  // Breaking up: the figure shivers, tears and sheds fragments.
  sprite.setTintFill(WHITE);
  foe.tremble(2.5 * span, tear);
  for (let beat = 60; beat < tear; beat += 65) {
    fx.at(beat, () => {
      fx.glitch(sprite, { slices: isBoss ? 5 : 4, amount: 12 * k * span, life: 50 });
      if (beat % 130 < 65) fx.rgbSplit(sprite, 8 * k, 110, 0.45);
      const at = onBody(foe);
      fx.sparks(at.x, at.y, { count: 4, colors: [WHITE, color], speed: [60, 180], life: [260, 420], gravity: -80, length: 9 * k });
    });
  }
  const sheds = fx.trail({ get x() { return foe.center.x; }, get y() { return foe.center.y; } }, {
    colors: [WHITE, color, 0x2a2030], size: [5 * k, 1], life: [500, 900], frequency: 14, speed: [30, 110], gravity: -90, spread: foe.width * 0.4,
  });
  // After the white hit frame, the colour burns out to white as it goes.
  const burn = ease('Quad.easeIn');
  fx.at(70, () => fx.animate(tear - 70, t => sprite.setTint(lerpColor(WHITE, lerpColor(color, WHITE, 0.6), burn(t))).setAlpha(1 - 0.35 * t)));

  // Collapse into a line, then burst.
  fx.at(tear, () => {
    fx.endTrail(sheds, 900);
    sprite.setTintFill(WHITE);
    const scaleX = sprite.scaleX;
    const scaleY = sprite.scaleY;
    const squash = ease('Expo.easeIn');
    fx.animate(150, t => sprite.setScale(scaleX * (1 + 0.25 * squash(t)), scaleY * Math.max(0.02, 1 - squash(t))), () => {
      sprite.setVisible(false);
      const c = foe.center;
      fx.streakFlare(c.x, c.y, { color: WHITE, width: 260 * k * span, height: 12 * k, life: 320 });
      fx.flash(c.x, c.y, color, 90 * k * span, 200);
      fx.ring(c.x, c.y, { color, from: 20 * k, to: 220 * k * span, life: 440, soft: true });
      fx.ring(foe.feet.x, foe.feet.y, { color, from: 30 * k, to: 260 * k * span, life: 520, soft: true, squash: 0.32, depth: DEPTH.behind });
      fx.sparks(c.x, c.y, { count: isBoss ? 60 : 30, colors: [WHITE, color, 0x5a3a6a], speed: [200, 560], life: [500, 900], gravity: 400, length: 16 * k, thickness: 2.2 * k });
      fx.motes(c.x, c.y, { count: isBoss ? 40 : 20, colors: [WHITE, color], speed: [30, 120], life: [900, 1400], size: [5 * k, 1], gravity: -50, spread: { x: foe.width * 0.3, y: foe.height * 0.2 } });
      fx.shake(isBoss ? 0.7 : 0.4);
      fx.punch(c.x, c.y, isBoss ? 0.05 : 0.03);
      if (isBoss) {
        fx.screenFlash(WHITE, 0.4, 420);
        fx.ring(c.x, c.y, { color: WHITE, from: 30 * k, to: 520 * k, life: 700, alpha: 0.8 });
      }
      done();
    });
  });
}

/** Level up in battle: a column of gold light rises around the hero with notes. */
export function heroLevelUp(fx: BattleFx, hero: Combatant): void {
  const k = scaleOf(hero);
  const gold = 0xf2c35f;
  const feet = hero.feet;
  const aura = fx.aura(hero.sprite, gold);
  fx.auraTo(aura, 1.3, 200);
  fx.at(900, () => fx.auraTo(aura, 0, 600, true));
  const column = fx.strand([
    { width: hero.width * 1.4, color: gold, alpha: 0.28 },
    { width: hero.width * 0.5, color: 0xffe7a8, alpha: 0.5 },
  ], DEPTH.behind + 0.05);
  const rise = ease('Expo.easeOut');
  fx.animate(1100, t => {
    const reach = rise(Math.min(1, t * 3));
    const fade = t > 0.55 ? 1 - (t - 0.55) / 0.45 : 1;
    column.setPoints([{ x: feet.x, y: feet.y }, { x: feet.x, y: feet.y - hero.height * 1.6 * reach }]).setAlpha(fade);
  }, () => column.destroy());
  fx.ring(feet.x, feet.y, { color: gold, from: 20 * k, to: 200 * k, life: 520, soft: true, squash: 0.32, depth: DEPTH.behind });
  fx.converge(hero.center.x, hero.center.y, { count: 24, radius: 110 * k, colors: [WHITE, gold], life: [260, 360], streak: true, size: 12 * k });
  fx.at(260, () => {
    const c = hero.center;
    fx.flash(c.x, c.y, gold, 60 * k, 220);
    fx.motes(c.x, c.y, { texture: BFX.note, count: 5, colors: [WHITE, gold], speed: [50, 110], angle: [-130, -50], life: [900, 1300], size: [16 * k, 22 * k], gravity: -30 });
    fx.motes(c.x, c.y, { count: 26, colors: [WHITE, gold], speed: [30, 90], angle: [-110, -70], life: [800, 1200], size: [4 * k, 1], gravity: -60, spread: { x: hero.width * 0.4, y: hero.height * 0.3 } });
  });
}
