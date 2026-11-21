import Phaser from 'phaser';
import { FX } from '../../art/fx';
import { EPS, QUAD_O, SINE_IO, SINE_O, Track, lerpColor, type HealDriver } from './kit';

/**
 * The hero's silhouette lit in the healer's colour for the whole heal, as Bass
 * Drop lights him in battle: copies of his sprite filled with one colour, set
 * just behind him and a little off to every side. It only reads the hero, so
 * it runs on past the hand-back and stays on him if he walks off. Plain tinted
 * sprites: the same on the path without the FX pipeline.
 */

const ADD = Phaser.BlendModes.ADD;
/** Unit offsets of the copies: the four sides, then the four corners. */
const AROUND: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];

export function createRim(kit: HealDriver): { frame(t: number): void } {
  const { scene, player, calm, pal, heroK, level, own, T } = kit;
  // Saturated and opaque, so it stays the healer's colour in front of the pillar's white core, where added light would vanish.
  const lineColor = lerpColor(pal.glow, pal.deep, 0.4);
  const copy = (color: number, blend: Phaser.BlendModes) => own(scene.add.image(player.x, player.y, player.texture.key, player.frame.name)
    .setOrigin(player.originX, player.originY).setTintFill(color).setBlendMode(blend).setAlpha(0));
  const line = AROUND.map(() => copy(lineColor, Phaser.BlendModes.NORMAL));
  const glow = AROUND.slice(0, 4).map(() => copy(pal.glow, ADD));
  // The pillar's core opens around him: a cocoon of the healer's colour between it and the hero.
  const cocoon = own(scene.add.image(player.x, player.y, FX.glow).setTint(lerpColor(pal.deep, pal.glow, 0.2)).setAlpha(0));
  const all = [...line, ...glow];

  const strength = new Track(0, calm
    ? [[0, 600, 0.75, SINE_IO], [T.peak, 300, 0.9, SINE_IO], [1900, 600, 0.75, SINE_IO], [3000, 900, 0, SINE_IO]]
    : [[0, 150, 0.8, SINE_O], [T.peak, 60, 1, QUAD_O], [T.drop, 300, 0.8, SINE_IO], [3300, 600, 0, SINE_IO]]);
  const cocoonAlpha = new Track(0, calm
    ? [[T.peak, 215, 0.5, SINE_O], [T.drop, 600, 0, SINE_IO]]
    : [[1350, 85, 0.4, SINE_IO], [T.peak, 50, 0.62, QUAD_O], [T.fall, 60, 0.4, QUAD_O], [1760, 500, 0, SINE_IO]]);
  const lineOff = 0.9 * heroK;
  const glowOff = 1.9 * heroK;

  function frame(t: number) {
    const level01 = strength.at(t);
    const on = level01 > 0.004 && player.visible;
    if (all[0].visible !== on) all.forEach(image => image.setVisible(on));
    const shell = cocoonAlpha.at(t);
    cocoon.setVisible(on && shell > 0.004);
    if (!on) return;
    if (all[0].texture.key !== player.texture.key || all[0].frame.name !== player.frame.name) {
      all.forEach(image => image.setTexture(player.texture.key, player.frame.name));
    }
    const a = level01 * (calm ? 1 : 0.86 + 0.14 * level(t));
    const depth = player.depth;
    for (let i = 0; i < line.length; i++) {
      line[i].setPosition(player.x + AROUND[i][0] * lineOff, player.y + AROUND[i][1] * lineOff)
        .setScale(player.scaleX, player.scaleY).setFlipX(player.flipX).setDepth(depth - EPS).setAlpha(0.9 * a);
    }
    for (let i = 0; i < glow.length; i++) {
      glow[i].setPosition(player.x + AROUND[i][0] * glowOff, player.y + AROUND[i][1] * glowOff)
        .setScale(player.scaleX, player.scaleY).setFlipX(player.flipX).setDepth(depth - 2 * EPS).setAlpha(0.42 * a);
    }
    if (cocoon.visible) {
      cocoon.setPosition(player.x, player.y - 15 * heroK).setDisplaySize(34 * heroK, 50 * heroK).setDepth(depth - 3 * EPS).setAlpha(shell);
    }
  }

  return { frame };
}
