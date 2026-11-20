import { DEPTH, ease, lerp, lerpColor, type BattleFx, type Point } from './BattleFx';
import type { Combatant } from './Combatant';
import { scaleOf } from './playerMoves';

const WHITE = 0xffffff;

/** A point that follows a fighter's body, for what rises off it. */
const aroundBody = (fighter: Combatant) => ({
  get x() { return fighter.center.x; },
  get y() { return fighter.center.y; },
});

/** Heartbeat trace: beats at fixed places across the arena, flat everywhere else. */
function heartbeat(x: number, beats: Array<{ at: number; size: number }>, k: number): number {
  for (const { at, size } of beats) {
    // A sharp spike up, an overshoot below the line, back to rest.
    const d = (x - at) / (2 * k);
    if (d >= 0 && d < 2) return -size * (d / 2);
    if (d >= 2 && d < 4) return -size + size * 1.45 * ((d - 2) / 2);
    if (d >= 4 && d < 6) return size * 0.45 * (1 - (d - 4) / 2);
  }
  return 0;
}

/**
 * The hero going down: the world drains of colour, the hero staggers, buckles
 * and falls while their signal breaks up and drifts away, a heartbeat line
 * fades to flat, and the picture switches off like an old screen. `done` runs
 * on the black frame, about 2.3 s in.
 */
export function heroDefeat(fx: BattleFx, hero: Combatant, done: () => void): void {
  const k = scaleOf(hero);
  const sprite = hero.sprite;
  const centre = hero.center;
  fx.desaturate(0.85, 700);
  fx.dim(0.5, 500);
  fx.spotlight(centre.x, centre.y, 0.65, 600);
  fx.push(centre.x, centre.y, 0.05, 1500);

  // Stagger, knees give way, fall.
  hero.pose({ dx: -10, sx: 0.97, sy: 1.03 }, 220, 'Sine.easeOut');
  fx.at(260, () => hero.pose({ dx: -10, sx: 1.04, sy: 0.86 }, 260, 'Quad.easeIn'));
  fx.at(600, () => {
    hero.pose({ dx: -12, sx: 1.06, sy: 0.78, dy: 8 * k }, 420, 'Cubic.easeIn');
    const angle = sprite.angle;
    const fall = ease('Cubic.easeIn');
    fx.animate(420, t => sprite.setAngle(angle - 9 * fall(t)));
  });
  fx.at(1020, () => {
    const feet = hero.feetNow;
    fx.puffs(feet.x, feet.y - 2, { count: 8, color: 0x4a4440, alpha: 0.45, size: [14 * k, 40 * k], speed: [30, 90], angle: [170, 370], life: [600, 900], gravity: -12 });
    fx.shake(0.22);
  });
  // The colour drains out of the figure.
  fx.animate(1300, t => sprite.setTint(lerpColor(WHITE, 0x6c6460, t)));

  // The signal breaks up and rises away.
  const motes = fx.trail(aroundBody(hero), {
    colors: [0xbfe3f2, 0x6ea8d8, 0x2a3440], size: [4 * k, 1], life: [900, 1300], frequency: 28, speed: [10, 40], gravity: -70, spread: hero.width * 0.35,
  });
  fx.at(1700, () => fx.endTrail(motes, 1300));
  [650, 950, 1250].forEach(beat => fx.at(beat, () => fx.glitch(sprite, { slices: 3, amount: 7 * k, life: 60 })));
  fx.at(700, () => fx.rgbSplit(sprite, 6 * k, 260, 0.35));

  // The heartbeat fades: three ever weaker beats, then a flat line.
  const W = fx.width;
  const y = hero.at(0, 0.62).y;
  const beats = [
    { at: W * 0.24, size: 24 * k },
    { at: W * 0.5, size: 13 * k },
    { at: W * 0.74, size: 5 * k },
  ];
  const line = fx.strand([
    { width: 10 * k, color: 0xff5a4a, alpha: 0.3 },
    { width: 2.2 * k, color: 0xff8a7a, alpha: 0.95 },
    { width: 1 * k, color: WHITE, alpha: 0.9 },
  ], DEPTH.top - 2);
  // Flat stretches are single segments; only the beats need fine points.
  const trace = (head: number): Point[] => {
    const points: Point[] = [{ x: 0, y }];
    for (const { at } of beats) {
      if (head <= at) break;
      points.push({ x: at, y });
      const end = Math.min(head, at + 12 * k);
      for (let x = at + 1.5; x <= end; x += 1.5) points.push({ x, y: y + heartbeat(x, beats, k) });
    }
    points.push({ x: Math.max(1, head), y: y + heartbeat(head, beats, k) });
    return points;
  };
  const sweep = ease('Sine.easeInOut');
  fx.at(200, () => fx.animate(1400, t => line.setPoints(trace(lerp(0, W, sweep(t)))), () => {
    // Flatlined: the line holds, a little brighter, until the picture dies.
    fx.animate(300, t => line.setAlpha(1 + 0.2 * Math.sin(t * Math.PI)));
  }));

  fx.at(1950, () => {
    fx.push(centre.x, centre.y, 0, 200);
    fx.powerOff(() => {
      line.destroy();
      done();
    });
  });
}
