import Phaser from 'phaser';
import { FX } from '../art/fx';
import { CHARACTER_HEIGHT } from '../art/characters';
import { tr, useLanguageStore } from '../../i18n';

export interface InteractLabelOptions {
  /** Height of what the bubble floats over, in world units. */
  lift?: number;
  /** An action word after the key, e.g. "Read". */
  verb?: string;
  /** Holds the bubble still instead of bobbing. */
  reducedMotion?: boolean;
}

/** The verb in the current language. Keyed "verb:<Verb>", so the door's "Enter" never renames the Enter key. */
function verbText(verb: string): string {
  const key = `verb:${verb}`;
  const text = tr(key);
  return text === key ? verb : text;
}

/**
 * A speech-bubble key cap over whatever can be used, naming the key that uses
 * it: E on a keyboard, the on-screen A button on a touch screen. Hidden until
 * the player is close enough.
 */
export function createInteractLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  { lift = CHARACTER_HEIGHT, verb, reducedMotion = false }: InteractLabelOptions = {},
): Phaser.GameObjects.Container {
  const touch = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const word = verb
    ? scene.add.text(0, -0.1, verbText(verb), {
      fontFamily: 'Sora', fontStyle: 'bold', fontSize: '6px', color: '#f8ece2',
    }).setOrigin(0, 0.5).setResolution(4)
    : undefined;
  const halo = scene.add.image(0, 0, FX.glow).setTint(0xff7a2b).setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD);
  const bg = scene.add.graphics();
  const glyph = scene.add.text(0, -0.1, touch ? 'A' : 'E', {
    fontFamily: 'Sora', fontStyle: 'bold', fontSize: '8px', color: '#ffa36b',
  }).setOrigin(0.5).setResolution(4);

  const layout = () => {
    // The key fills a 14-unit cap; an action word widens the bubble to its right.
    const width = word ? 14 + word.width + 4 : 14;
    const left = -width / 2;
    halo.setDisplaySize(width + 10, 18);
    bg.clear();
    bg.fillStyle(0x000000, 0.3);
    bg.fillRoundedRect(left, -5.4, width, 13, 3.6);
    bg.fillStyle(0x15100d, 0.94);
    bg.fillRoundedRect(left, -6.5, width, 13, 3.6);
    bg.fillTriangle(-2.6, 6.3, 2.6, 6.3, 0, 9.2);
    bg.lineStyle(0.7, 0xffffff, 0.3);
    bg.strokeRoundedRect(left, -6.5, width, 13, 3.6);
    glyph.setX(left + 7);
    word?.setX(left + 14);
  };
  layout();

  const marker = scene.add.container(0, -(lift + 9), word ? [halo, bg, glyph, word] : [halo, bg, glyph]);
  const container = scene.add.container(x, y, [marker]);
  container.setDepth(10).setVisible(false);

  if (word && verb) {
    // Door caps live as long as the world: a language change rewords and resizes them in place.
    const unsubscribe = useLanguageStore.subscribe((state, previous) => {
      if (state.language === previous.language || !word.active) return;
      word.setText(verbText(verb));
      layout();
    });
    container.once(Phaser.GameObjects.Events.DESTROY, unsubscribe);
  }

  if (!reducedMotion) {
    scene.tweens.add({ targets: marker, y: -(lift + 12), duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  return container;
}
