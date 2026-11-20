import Phaser from 'phaser';
import type { Point } from './BattleFx';

export interface Pose {
  /** Scale factors against the rest scale. */
  sx?: number;
  sy?: number;
  /** Displacement: `dx` toward the opponent, `dy` down. */
  dx?: number;
  dy?: number;
}

/**
 * One fighter on the battle stage: where it stands, how big its art is drawn
 * and the poses it can strike. `body` carries the displacement and `sprite`
 * the scale, so an idle motion on either keeps running underneath, and every
 * pose keeps the feet where they belong.
 */
export class Combatant {
  baseScaleX: number;
  baseScaleY: number;
  bodyHome: Point;
  /** From the sprite's centre down to the feet, at rest. */
  private feetOffset: number;
  private poseTweens: Phaser.Tweens.Tween[] = [];
  private reaction = 0;
  private trembleAmount = 0;
  private trembleUntil = 0;
  private trembling = false;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly sprite: Phaser.GameObjects.Sprite,
    readonly body: Phaser.GameObjects.Sprite | Phaser.GameObjects.Container,
    /** Where the feet meet the platform. */
    readonly feet: Point,
    /** Visible art size at rest, in logical px. */
    readonly height: number,
    readonly width: number,
    /** +1 faces right, -1 faces left. */
    readonly facing: 1 | -1,
    /** The sprite's resting position (it may still be sliding in). */
    public home: Point,
    private readonly applyJitter: (x: number, y: number) => void,
  ) {
    this.baseScaleX = sprite.scaleX;
    this.baseScaleY = sprite.scaleY;
    this.bodyHome = body === sprite ? { ...home } : { x: body.x, y: body.y };
    this.feetOffset = feet.y - home.y;
  }

  private get scaleY(): number {
    return this.sprite.scaleY / this.baseScaleY;
  }

  /** Where the feet are drawn right now. */
  get feetNow(): Point {
    return {
      x: this.feet.x + (this.body.x - this.bodyHome.x),
      y: this.feet.y + (this.body.y - this.bodyHome.y) - (1 - this.scaleY) * this.feetOffset,
    };
  }

  /**
   * A point on the figure as drawn now: `u` across its width (positive toward
   * the opponent, 0.5 the front edge), `v` up its height (0 feet, 1 top).
   */
  at(u: number, v: number): Point {
    const feet = this.feetNow;
    const sx = this.sprite.scaleX / this.baseScaleX;
    return { x: feet.x + u * this.width * sx * this.facing, y: feet.y - v * this.height * this.scaleY };
  }

  get center(): Point {
    return this.at(0, 0.5);
  }

  /**
   * Takes the sprite as it stands now as the new rest pose: after its art was
   * swapped and planted again, which changes its scale and centre.
   */
  rebase(): void {
    this.stopPose();
    this.reaction++;
    // A wrapper body goes back to its rest; the sprite's own planting stands.
    if (this.body !== this.sprite) this.body.setPosition(this.bodyHome.x, this.bodyHome.y);
    this.baseScaleX = this.sprite.scaleX;
    this.baseScaleY = this.sprite.scaleY;
    this.home = { x: this.sprite.x, y: this.sprite.y };
    if (this.body === this.sprite) this.bodyHome = { ...this.home };
    this.feetOffset = this.feet.y - this.home.y;
  }

  private stopPose(): void {
    this.poseTweens.forEach(tween => tween.stop());
    this.poseTweens = [];
  }

  /** Eases into a pose; `ms` 0 snaps. Feet stay planted unless `dy` lifts them. */
  pose(pose: Pose, ms: number, ease = 'Sine.easeOut'): void {
    this.stopPose();
    const sy = pose.sy ?? 1;
    const x = this.bodyHome.x + (pose.dx ?? 0) * this.facing;
    const y = this.bodyHome.y + (1 - sy) * this.feetOffset + (pose.dy ?? 0);
    const scaleX = this.baseScaleX * (pose.sx ?? 1);
    const scaleY = this.baseScaleY * sy;
    if (ms <= 0) {
      this.body.setPosition(x, y);
      this.sprite.setScale(scaleX, scaleY);
      return;
    }
    if (this.body === this.sprite) {
      this.poseTweens.push(this.scene.tweens.add({ targets: this.sprite, x, y, scaleX, scaleY, duration: ms, ease }));
    } else {
      this.poseTweens.push(this.scene.tweens.add({ targets: this.body, x, y, duration: ms, ease }));
      this.poseTweens.push(this.scene.tweens.add({ targets: this.sprite, scaleX, scaleY, duration: ms, ease }));
    }
  }

  /** Puts the feet at `point` (world), drawn at `scale`: dashes and leaps. */
  moveFeetTo(point: Point, scale: number, ms: number, ease = 'Sine.easeInOut', stretch = 1): void {
    this.pose({
      dx: (point.x - this.feet.x) * this.facing,
      dy: point.y - this.feet.y,
      sx: scale / stretch,
      sy: scale * stretch,
    }, ms, ease);
  }

  /**
   * Taking a blow: snaps into the hit pose, holds for the hit-stop, is thrown
   * along `dir` (and up by `lift`), then recovers. A newer blow takes over.
   */
  knock(dir: Point, push: number, hold: number, lift: number): void {
    const token = ++this.reaction;
    const forward = dir.x * push * this.facing;
    const down = dir.y * push;
    const squash = Math.abs(dir.y) > Math.abs(dir.x) ? { sx: 1.05, sy: 0.93 } : { sx: 0.95, sy: 1.04 };
    this.pose({ dx: forward * 0.45, dy: down * 0.45 - lift * 0.2, ...squash }, 0);
    this.after(hold, () => {
      if (token !== this.reaction) return;
      const out = 80 + lift * 3;
      this.pose({ dx: forward, dy: down - lift, sx: 0.98, sy: 1.02 }, out, 'Expo.easeOut');
      this.after(out, () => {
        if (token !== this.reaction) return;
        this.pose({}, lift > 0 ? 460 : 300, lift > 0 ? 'Bounce.easeOut' : 'Sine.easeInOut');
      });
    });
  }

  /** Shivers in place (charging, electrocuted) without touching its pose. */
  tremble(amount: number, ms: number): void {
    this.trembleAmount = amount;
    this.trembleUntil = this.scene.time.now + ms;
  }

  update(time: number): void {
    if (time < this.trembleUntil) {
      const a = this.trembleAmount;
      this.applyJitter((Math.random() * 2 - 1) * a, (Math.random() * 2 - 1) * a * 0.5);
      this.trembling = true;
    } else if (this.trembling) {
      this.applyJitter(0, 0);
      this.trembling = false;
    }
  }

  private after(ms: number, fn: () => void): void {
    if (ms <= 0) { fn(); return; }
    this.scene.tweens.addCounter({ from: 0, to: 1, duration: ms, onComplete: fn });
  }
}
