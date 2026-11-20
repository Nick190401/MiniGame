import Phaser from 'phaser';
import type { Npc } from '../../entities/Npc';
import type { Player } from '../../entities/Player';
import type { StagedSpot } from './kit';

/**
 * Where the healer stands for the heal: beside the hero on his ground line,
 * far enough that both bodies and faces are apart and the hero is alone in the
 * middle of the light. The hero never moves. Undefined when neither side has
 * free ground: the heal then plays where the pair stands.
 */
export interface Staging extends StagedSpot {
  /** How long the healer walks there; 0 when already in place. */
  walkMs: number;
}

/** Feet to feet in units, the widest that fits first. */
const GAPS = [26, 23, 20];
const VIEW_MARGIN = 20;
/** Nearer than this in x, the healer stands above or below the hero rather than on a side. */
const STACKED = 6;

export function planStaging(scene: Phaser.Scene, npc: Npc, player: Player): Staging | undefined {
  const body = npc.body as Phaser.Physics.Arcade.Body;
  const view = scene.cameras.main.worldView;
  const world = scene.physics.world.bounds;
  const offX = body.x - npc.x;
  const offY = body.y - npc.y;
  /** The healer's footprint at this spot touches no wall, water, prop or other character. */
  const free = (x: number, y: number) => {
    const left = x + offX;
    const top = y + offY;
    if (left < world.x || top < world.y || left + body.width > world.right || top + body.height > world.bottom) return false;
    return scene.physics.overlapRect(left, top, body.width, body.height, true, true).every(other => other === body || other === player.body);
  };
  const reachable = (x: number, y: number) => {
    if (x < view.x + VIEW_MARGIN || x > view.right - VIEW_MARGIN) return false;
    for (let step = 1; step <= 3; step++) {
      if (!free(npc.x + ((x - npc.x) * step) / 3, npc.y + ((y - npc.y) * step) / 3)) return false;
    }
    return true;
  };

  const offset = npc.x - player.x;
  // The side the healer is on already; straight above or below, the side with more of the view first.
  const sides = Math.abs(offset) >= STACKED ? [Math.sign(offset)]
    : player.x - view.x >= view.right - player.x ? [-1, 1] : [1, -1];
  for (const gap of GAPS) {
    for (const side of sides) {
      const x = player.x + side * gap;
      const y = player.y;
      if (!reachable(x, y)) continue;
      const facing = side > 0 ? 'left' : 'right';
      const distance = Math.hypot(x - npc.x, y - npc.y);
      if (distance < 1.5) return { x: npc.x, y: npc.y, facing, walkMs: 0 };
      // A brisk step for a short way, a few strides for a long one.
      return { x, y, facing, walkMs: Phaser.Math.Clamp(distance * 18, 180, 420) };
    }
  }
  return undefined;
}
