import Phaser from 'phaser';
import { FX } from '../art/fx';

export interface LightSource {
  x: number;
  y: number;
  radius: number;
  /** 0..1, how much darkness this light removes at its centre. */
  intensity: number;
  flicker?: number;
}

const DARKNESS = 0x04070a;
// One texel per world unit: soft light falloff hides the low density.
// Sized once for the widest framing any camera move uses (intro flights zoom
// out to ~1.2x logical on a 640-wide board or a 1180-tall portrait board),
// because a resized DynamicTexture keeps drawing into its original viewport.
const MAP_WIDTH = 560;
const MAP_HEIGHT = 1000;

/**
 * Darkness for the underground: a render texture following the camera,
 * filled with shadow each frame, with soft holes erased around every nearby
 * light. Coloured glows live in the world and show through the holes.
 */
export class WorldLighting {
  private readonly rt: Phaser.GameObjects.RenderTexture;
  private readonly brush: Phaser.GameObjects.Image;
  private readonly lights: LightSource[] = [];
  private darkness = 0;
  private targetDarkness = 0;
  private readonly playerLight: LightSource = { x: 0, y: 0, radius: 78, intensity: 0.92 };

  constructor(private readonly scene: Phaser.Scene, depth = 40) {
    this.rt = scene.add.renderTexture(0, 0, MAP_WIDTH, MAP_HEIGHT)
      .setOrigin(0, 0).setDepth(depth).setVisible(false);
    this.brush = scene.make.image({ key: FX.glowHard, add: false }).setOrigin(0.5);
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, this.render, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.render, this);
      this.brush.destroy();
    });
  }

  addLights(lights: LightSource[]): void {
    this.lights.push(...lights);
  }

  /** Smoothly blends toward the given darkness (0 = daylight, 1 = pitch black). */
  setTargetDarkness(value: number): void {
    this.targetDarkness = Phaser.Math.Clamp(value, 0, 1);
  }

  setPlayer(x: number, y: number): void {
    this.playerLight.x = x;
    this.playerLight.y = y - 8;
  }

  private render(): void {
    this.darkness += (this.targetDarkness - this.darkness) * 0.06;
    if (this.darkness < 0.01) {
      this.rt.setVisible(false);
      return;
    }
    const view = this.scene.cameras.main.worldView;
    // Centre the map on the view so any overflow is shared by both sides.
    const ox = view.centerX - MAP_WIDTH / 2;
    const oy = view.centerY - MAP_HEIGHT / 2;
    this.rt.setPosition(ox, oy).setVisible(true);
    this.rt.clear();
    this.rt.fill(DARKNESS, this.darkness);

    const time = this.scene.time.now;
    const erase = (light: LightSource) => {
      if (light.x + light.radius < view.x || light.x - light.radius > view.right) return;
      if (light.y + light.radius < view.y || light.y - light.radius > view.bottom) return;
      const flicker = light.flicker
        ? 1 + Math.sin(time * 0.013 + light.x) * light.flicker * 0.5 + Math.sin(time * 0.031 + light.y) * light.flicker * 0.5
        : 1;
      const size = light.radius * 2 * flicker;
      this.brush.setDisplaySize(size, size).setAlpha(light.intensity);
      this.rt.erase(this.brush, light.x - ox, light.y - oy);
    };
    erase(this.playerLight);
    this.lights.forEach(erase);
  }
}
