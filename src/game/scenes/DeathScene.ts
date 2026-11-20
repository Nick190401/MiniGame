import Phaser from 'phaser';
import { logicalSize, useLogicalCamera } from '../render/RenderScale';
import { useGameStore } from '../../store/gameStore';
import { EventBus, EVENTS } from '../EventBus';
import { BFX, BFX_DENSITY } from '../art/battleFx';
import { BattleFx, ease, lerp, lerpColor } from '../battle/BattleFx';
import { BOSS_DEFINITION, ENEMY_DEFINITIONS } from '../entities/Enemy';

const STATIC_KEY = 'death-static';
/** How the hero's ghost is tinted while the channel is dead. */
const GHOST_TINT = 0x3c3532;

/**
 * The defeat screen: a dead channel. Static, broken receiver rings, a flat
 * heartbeat line and the hero's fading ghost sit behind the DOM overlay's
 * text and button (components/DeathOverlay.tsx). Respawning brings the
 * heartbeat and the colour back and the picture powers on in Echo Village
 * with full HP.
 */
export class DeathScene extends Phaser.Scene {
  private canRespawn = false;
  private respawning = false;
  private defeatedBy = '';
  private isBoss = false;
  private fx?: BattleFx;
  private ghost?: Phaser.GameObjects.Sprite;
  private ghostSplit: Phaser.GameObjects.Sprite[] = [];
  private staticLayer?: Phaser.GameObjects.TileSprite;
  private line?: Phaser.GameObjects.Graphics;
  private lineReach = 0;
  private pulses: Array<{ start: number; size: number; speed: number }> = [];
  private nextBlip = 0;
  private reducedMotion = false;
  private layout = { width: 0, height: 0, ghostX: 0, ghostY: 0, ghostH: 0, lineY: 0, textEdge: 0 };

  constructor() {
    super({ key: 'DeathScene' });
  }

  init(data: { enemyId?: string; isBoss?: boolean } = {}): void {
    this.isBoss = !!data.isBoss;
    const enemy = this.isBoss ? BOSS_DEFINITION : ENEMY_DEFINITIONS.find(entry => entry.id === data.enemyId);
    this.defeatedBy = enemy?.name ?? '';
    this.canRespawn = false;
    this.respawning = false;
    this.ghostSplit = [];
    this.pulses = [];
    this.lineReach = 0;
  }

  create(): void {
    useLogicalCamera(this);
    const { width: W, height: H } = logicalSize(this);
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.fx = new BattleFx(this, { arenaHeight: H, reducedMotion: this.reducedMotion });

    EventBus.emit(EVENTS.PLAYER_DIED);
    this.emitState(false, false);
    EventBus.on(EVENTS.DEATH_UI_ACTION, this.onDeathUiAction);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(EVENTS.DEATH_UI_ACTION, this.onDeathUiAction);
      this.fx?.dispose();
      this.fx = undefined;
    });

    // Landscape: text on the left, the ghost on the right. Portrait: the text
    // sits on top and the ghost stands below it.
    const portrait = H > W * 1.05;
    const ghostH = portrait ? Math.min(H * 0.42, W * 1.05) : Math.min(H * 0.82, W * 0.6);
    const ghostX = portrait ? W * 0.5 : W * 0.75;
    const ghostY = portrait ? H * 1.02 : H * 0.96;
    // In landscape the line fades out before it reaches the words on the left;
    // in portrait it runs below them, across the ghost's waist.
    this.layout = {
      width: W, height: H, ghostX, ghostY, ghostH,
      lineY: ghostY - ghostH * (portrait ? 0.46 : 0.56),
      textEdge: portrait ? 0 : W * 0.5,
    };
    const centre = { x: ghostX, y: ghostY - ghostH * 0.5 };

    // Opaque from the first frame: the paused world never shows through.
    this.add.rectangle(0, 0, W, H, 0x070404, 1).setOrigin(0).setDepth(0);
    const haze = this.add.image(centre.x, centre.y, BFX.glow).setTint(0x3a0b08).setDepth(1).setAlpha(0)
      .setDisplaySize(Math.max(W, H) * 1.3, Math.max(W, H) * 1.3);
    this.tweens.add({ targets: haze, alpha: 0.85, duration: 700, delay: 150 });
    this.tweens.add({ targets: haze, scaleX: haze.scaleX * 1.08, scaleY: haze.scaleY * 1.08, duration: 3400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.buildRings(centre.x, centre.y, ghostH);
    this.buildGhost(ghostX, ghostY, ghostH);
    this.buildStatic(W, H);

    this.line = this.add.graphics().setDepth(6);
    this.tweens.addCounter({ from: 0, to: 1, duration: 520, delay: 450, ease: 'Sine.easeInOut', onUpdate: tween => { this.lineReach = tween.getValue() ?? 0; } });
    this.nextBlip = this.time.now + 1600;

    this.add.image(W / 2, H / 2, BFX.vignette).setTint(0x000000).setDepth(9).setAlpha(0.9)
      .setDisplaySize(Math.max(W, H) * 1.45, Math.max(W, H) * 1.45);

    // Input is briefly gated against keys still held from the fight.
    this.time.delayedCall(1000, () => {
      this.canRespawn = true;
      this.emitState(true, false);
    });
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-SPACE', () => this.respawn());
      this.input.keyboard.on('keydown-ENTER', () => this.respawn());
    }
    if (!this.reducedMotion) {
      this.time.addEvent({ delay: 1700, loop: true, callback: () => this.glitchBurst() });
    }
  }

  private emitState(ready: boolean, reconnecting: boolean): void {
    EventBus.emit(EVENTS.DEATH_UI_STATE, { ready, reconnecting, defeatedBy: this.defeatedBy, isBoss: this.isBoss });
  }

  /** Broken receiver rings turning slowly behind the ghost. */
  private buildRings(x: number, y: number, size: number): void {
    const rings = this.add.graphics().setPosition(x, y).setDepth(2).setAlpha(0).setScale(0.9);
    const r = size * 0.42;
    const arc = (radius: number, from: number, to: number, width: number, color: number, alpha: number) => {
      rings.lineStyle(width, color, alpha);
      rings.beginPath();
      rings.arc(0, 0, radius, from, to);
      rings.strokePath();
    };
    arc(r * 1.3, -2.9, -0.38, 1, 0x6ea8d8, 0.26);
    arc(r * 1.3, 0.08, 2.35, 1, 0x6ea8d8, 0.26);
    arc(r, -2.3, -0.12, 1.5, 0xe8b465, 0.55);
    arc(r, 0.35, 1.85, 1.5, 0xe8b465, 0.55);
    arc(r * 0.66, -2.8, -1.2, 2, 0xff7a2b, 0.32);
    arc(r * 0.66, -0.82, 1.95, 2, 0xff7a2b, 0.32);
    for (let index = 0; index < 4; index++) {
      const angle = (index / 4) * Math.PI * 2 + Math.PI / 4;
      rings.lineStyle(2, 0xe8b465, 0.45);
      rings.lineBetween(Math.cos(angle) * r * 1.22, Math.sin(angle) * r * 1.22, Math.cos(angle) * r * 1.4, Math.sin(angle) * r * 1.4);
    }
    rings.setName('death-rings');
    this.tweens.add({ targets: rings, alpha: 1, scaleX: 1, scaleY: 1, duration: 700, delay: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: rings, angle: -360, duration: 36000, repeat: -1 });
  }

  /** The hero as a dim ghost, split in red and cyan, shedding their signal upward. */
  private buildGhost(x: number, y: number, height: number): void {
    const ghost = this.add.sprite(x, y, 'player-battle').setOrigin(0.5, 1).setDepth(4).setTint(GHOST_TINT).setAlpha(0);
    ghost.setScale(height / ghost.height);
    this.ghost = ghost;
    this.ghostSplit = [0xff2a3a, 0x2ad8ff].map((color, index) => this.add.sprite(x + (index ? 3 : -3), y, 'player-battle')
      .setOrigin(0.5, 1).setScale(ghost.scaleX).setDepth(3.9).setTintFill(color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));

    // Flickers on like a bad picture, then breathes.
    const steps = [0.45, 0.1, 0.65, 0.25, 0.72];
    steps.forEach((alpha, index) => this.time.delayedCall(300 + index * 70, () => ghost.setAlpha(alpha)));
    this.time.delayedCall(300 + steps.length * 70, () => {
      this.ghostSplit.forEach(copy => copy.setAlpha(0.16));
      ghost.setAlpha(0.72);
      this.tweens.add({ targets: ghost, alpha: 0.52, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });

    // Signal fragments drift up off the figure.
    const width = ghost.displayWidth * 0.5;
    const motes = this.add.particles(0, 0, BFX.dot, {
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(x - width / 2, y - height * 0.85, width, height * 0.8) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      frequency: this.reducedMotion ? 160 : 55,
      lifespan: { min: 1400, max: 2400 },
      speedY: { min: -38, max: -14 },
      speedX: { min: -6, max: 6 },
      // About 4 px across: the dot texture is 8 logical px at its density.
      scale: { start: 0.5 / BFX_DENSITY, end: 0 },
      alpha: { start: 0.7, end: 0 },
      color: [0xbfe3f2, 0x6ea8d8, 0x3a2420],
      blendMode: Phaser.BlendModes.ADD,
    });
    motes.setDepth(5);
  }

  /** Animated television static over everything, plus fine scanlines. */
  private buildStatic(W: number, H: number): void {
    if (!this.textures.exists(STATIC_KEY)) {
      const texture = this.textures.createCanvas(STATIC_KEY, 192, 144);
      if (texture) {
        const ctx = texture.getContext();
        const image = ctx.createImageData(192, 144);
        for (let i = 0; i < image.data.length; i += 4) {
          const v = Math.random() * 255;
          image.data[i] = v; image.data[i + 1] = v; image.data[i + 2] = v; image.data[i + 3] = 255;
        }
        ctx.putImageData(image, 0, 0);
        texture.refresh();
      }
    }
    // Starts as a burst of static that settles into a faint grain.
    this.staticLayer = this.add.tileSprite(0, 0, W, H, STATIC_KEY).setOrigin(0).setDepth(7)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.32).setTileScale(1.5, 1.5);
    this.tweens.add({ targets: this.staticLayer, alpha: 0.06, duration: 800, ease: 'Quad.easeOut' });

    const scanlines = this.add.graphics().setDepth(8);
    scanlines.lineStyle(1, 0x000000, 0.18);
    for (let y = 1; y < H; y += 3) scanlines.lineBetween(0, y, W, y);
  }

  private glitchBurst(): void {
    if (this.respawning || !this.ghost || !this.fx) return;
    const { width: W, height: H } = this.layout;
    this.fx.glitch(this.ghost, { slices: 3, amount: 10, life: 70 });
    for (let i = 0; i < 3; i++) {
      const bar = this.add.image(W / 2, Math.random() * H, BFX.scan, i % 3)
        .setDisplaySize(W * (0.3 + Math.random() * 0.7), 2 + Math.random() * 4)
        .setTint(i % 2 ? 0x6ea8d8 : 0xe8b465).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setDepth(8.5);
      this.time.delayedCall(70, () => bar.destroy());
    }
  }

  update(time: number, delta: number): void {
    this.fx?.update(time, delta);
    if (this.staticLayer && (!this.reducedMotion || Math.floor(time / 100) % 2 === 0)) {
      this.staticLayer.setTilePosition(Math.random() * 192, Math.random() * 144);
    }
    if (!this.respawning && time > this.nextBlip) {
      // A faint blip now and then: the channel is down, not gone.
      this.pulses.push({ start: time, size: 5, speed: 0.55 });
      this.nextBlip = time + 2600;
    }
    this.drawLine(time);
  }

  /** The heartbeat line: flat, with pulses running along it from the left. */
  private drawLine(time: number): void {
    const line = this.line;
    if (!line) return;
    const { width: W, lineY, textEdge } = this.layout;
    const reach = W * this.lineReach;
    this.pulses = this.pulses.filter(pulse => (time - pulse.start) * pulse.speed < W + 60);
    const offset = (x: number) => {
      let y = 0;
      for (const pulse of this.pulses) {
        const d = (x - (time - pulse.start) * pulse.speed) / 4;
        if (d >= 0 && d < 2) y -= pulse.size * (d / 2);
        else if (d >= 2 && d < 4) y += -pulse.size + pulse.size * 1.45 * ((d - 2) / 2);
        else if (d >= 4 && d < 6) y += pulse.size * 0.45 * (1 - (d - 4) / 2);
      }
      return y;
    };
    line.clear();
    if (reach < 1) return;
    const fadeFrom = textEdge * 0.7;
    const visibility = (x: number) => (textEdge <= 0 ? 1 : Phaser.Math.Clamp((x - fadeFrom) / (textEdge - fadeFrom), 0, 1));
    let previous = new Phaser.Math.Vector2(0, lineY + offset(0));
    for (let x = 3; x <= reach; x += 3) {
      const point = new Phaser.Math.Vector2(x, lineY + offset(x));
      const v = visibility(x);
      if (v > 0) {
        line.lineStyle(7, 0xff5a4a, 0.16 * v);
        line.lineBetween(previous.x, previous.y, point.x, point.y);
        line.lineStyle(1.6, 0xff7a6a, 0.9 * v);
        line.lineBetween(previous.x, previous.y, point.x, point.y);
      }
      previous = point;
    }
  }

  private respawn(): void {
    if (!this.canRespawn || this.respawning || !this.fx) return;
    this.respawning = true;
    this.canRespawn = false;
    this.emitState(false, true);
    const fx = this.fx;
    const { width: W, height: H, ghostX, ghostY, ghostH } = this.layout;
    const centre = { x: ghostX, y: ghostY - ghostH * 0.5 };

    // Two strong heartbeats bring the signal back.
    [0, 330].forEach((beat, index) => this.time.delayedCall(beat, () => {
      this.pulses.push({ start: this.time.now, size: 26 - index * 4, speed: 1.6 });
      fx.ring(centre.x, centre.y, { color: index ? 0x6ea8d8 : 0xff7a2b, from: 30, to: ghostH * 1.1, life: 520, soft: true, alpha: 0.8 });
      fx.shake(0.2);
    }));
    // The ghost gets its colour back and the split closes.
    const ghost = this.ghost;
    if (ghost) {
      this.tweens.killTweensOf(ghost);
      const back = ease('Sine.easeInOut');
      fx.animate(700, t => {
        ghost.setTint(lerpColor(GHOST_TINT, 0xffffff, back(t))).setAlpha(lerp(ghost.alpha, 1, t));
        this.ghostSplit.forEach((copy, index) => copy.setX(ghost.x + (index ? 1 : -1) * 3 * (1 - t)).setAlpha(0.16 * (1 - t)));
      });
    }
    this.time.delayedCall(560, () => this.staticLayer && this.tweens.add({ targets: this.staticLayer, alpha: 0.3, duration: 180, yoyo: true }));

    // Power on: a bright line opens into white, the world appears through it.
    this.time.delayedCall(760, () => {
      const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 1).setDepth(20).setScale(1, 0.006);
      this.tweens.add({
        targets: flash, scaleY: 1, duration: 170, ease: 'Expo.easeIn',
        onComplete: () => {
          // Hand over to the world underneath, then let the white go.
          this.children.list.filter(child => child !== flash).forEach(child => (child as unknown as { setVisible?: (v: boolean) => void }).setVisible?.(false));
          const store = useGameStore.getState();
          const healedAmount = store.maxHp - store.hp;
          store.restoreHp(store.maxHp);
          EventBus.emit(EVENTS.HEAL, { amount: healedAmount, source: 'respawn' });
          EventBus.emit(EVENTS.RESPAWN);
          this.tweens.add({ targets: flash, alpha: 0, duration: 480, ease: 'Quad.easeOut', onComplete: () => this.scene.stop('DeathScene') });
        },
      });
    });
  }

  private onDeathUiAction = (): void => {
    this.respawn();
  };
}
