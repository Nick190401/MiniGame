import type { Aura, BattleFx, HitWeight, Point } from './BattleFx';
import type { Combatant } from './Combatant';

export interface Hit {
  weight: HitWeight;
  color: number;
  /** Unit vector the blow travels along; the target is pushed this way. */
  dir: Point;
  /** Throws the target up by this many px before it drops back. */
  lift?: number;
  /** Where the blow lands, for the camera; the target's centre by default. */
  at?: Point;
}

/** What a move's choreography is given to work with. */
export interface MoveContext {
  readonly fx: BattleFx;
  readonly attacker: Combatant;
  readonly target: Combatant;
  readonly color: number;
  /** 1 in ordinary fights; grows with the Gatekeeper's phase. */
  readonly power: number;
  /** Rim light the wind-up put on the attacker, for the move to release. */
  aura?: Aura;
  /** Starts the move's sound. Only the first call counts. */
  cue(): void;
  /**
   * Lands `share` of the move's damage now, with the target's reaction.
   * A share of 1 or more lands everything not yet dealt.
   */
  hit(share: number, hit: Hit): void;
  /** True once the target has no HP left, e.g. after a lethal first hit of a combo. */
  targetDown(): boolean;
  /** Fades the move's sound out over `ms`, for a combo that ends early. */
  cutSound(ms: number): void;
  /** Ends the move. Only the first call counts. */
  done(): void;
}

export type MoveScript = (ctx: MoveContext) => void;

export const unit = (from: Point, to: Point): Point => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
};

export const degrees = (v: Point) => (Math.atan2(v.y, v.x) * 180) / Math.PI;

export const mixPoint = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Offsets `p` sideways from the line along `dir` by `amount` (positive = left of travel). */
export const sideways = (p: Point, dir: Point, amount: number): Point => ({ x: p.x + dir.y * amount, y: p.y - dir.x * amount });

export function releaseAura(ctx: MoveContext, ms: number): void {
  if (!ctx.aura) return;
  ctx.fx.auraTo(ctx.aura, 0, ms, true);
  ctx.aura = undefined;
}
