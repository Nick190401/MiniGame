import Phaser from 'phaser';
import { useGameStore } from '../../store/gameStore';
import { EventBus, EVENTS } from '../EventBus';
import { PLAYER_TEXTURES } from '../assets/PlayerTextures';

/**
 * Full-screen broadcast-failure sequence shown over the paused world.
 * The world remains recoverable: reconnecting restores HP and returns the
 * player to the Echo Village checkpoint.
 */
export class DeathScene extends Phaser.Scene {
  private canRespawn = false;
  private respawning = false;
  private reconnectLabel?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'DeathScene' });
  }

  create(): void {
    this.canRespawn = false;
    this.respawning = false;
    EventBus.emit(EVENTS.PLAYER_DIED);
    EventBus.emit(EVENTS.DEATH_UI_STATE, { ready: false, reconnecting: false });
    EventBus.on(EVENTS.DEATH_UI_ACTION, this.onDeathUiAction);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(EVENTS.DEATH_UI_ACTION, this.onDeathUiAction);
    });

    const W = this.scale.width;
    const H = this.scale.height;
    const store = useGameStore.getState();
    const playerName = (store.playerName || 'Sound Keeper').toUpperCase();

    const text = (
      x: number,
      y: number,
      value: string,
      style: Phaser.Types.GameObjects.Text.TextStyle,
    ) => {
      const label = this.add.text(x, y, value, style).setResolution(2);
      label.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      return label;
    };

    // Near-black broadcast layer: the paused world is only faintly perceptible.
    const backdrop = this.add.graphics().setName('death-backdrop');
    backdrop.fillStyle(0x060403, 0.965);
    backdrop.fillRect(0, 0, W, H);
    backdrop.fillGradientStyle(0x2d0d0b, 0x060403, 0x060403, 0x281a15, 0.44, 0, 0, 0.22);
    backdrop.fillRect(0, 0, W, H);
    backdrop.lineStyle(1, 0x695449, 0.075);
    for (let x = 20; x < W; x += 32) backdrop.lineBetween(x, 0, x, H);
    for (let y = 16; y < H; y += 32) backdrop.lineBetween(0, y, W, y);
    backdrop.lineStyle(1, 0xe8b465, 0.12);
    backdrop.lineBetween(22, 82, W - 22, 82);
    backdrop.lineBetween(22, H - 42, W - 22, H - 42);
    backdrop.setAlpha(0);
    this.tweens.add({ targets: backdrop, alpha: 1, duration: 380, ease: 'Quad.easeOut' });

    const scanlines = this.add.graphics().setName('death-scanlines').setAlpha(0);
    scanlines.lineStyle(1, 0xff7a2b, 0.028);
    for (let y = 1; y < H; y += 5) scanlines.lineBetween(0, y, W, y);
    this.tweens.add({ targets: scanlines, alpha: 1, duration: 720 });

    // Sparse dead pixels create signal noise without obscuring the layout.
    const noise = this.add.graphics().setName('death-noise').setAlpha(0);
    for (let index = 0; index < 58; index++) {
      const color = index % 11 === 0 ? 0xe8b465 : index % 7 === 0 ? 0x6ea8d8 : 0x82776f;
      noise.fillStyle(color, index % 11 === 0 ? 0.32 : 0.16);
      noise.fillRect(Phaser.Math.Between(18, W - 18), Phaser.Math.Between(18, H - 18), index % 9 === 0 ? 3 : 1, 1);
    }
    this.tweens.add({ targets: noise, alpha: 1, duration: 500, delay: 180 });

    // Header preserves the game's archive/control-room visual language.
    const header = this.add.container(0, -8).setName('death-header').setAlpha(0);
    const brand = this.add.graphics();
    brand.fillStyle(0xe8b465, 1);
    brand.fillRect(24, 23, 32, 32);
    brand.fillStyle(0x110906, 1);
    brand.fillRect(48, 23, 8, 8);
    header.add(brand);
    header.add(text(40, 39, 'SQ', {
      fontFamily: 'Syne', fontStyle: 'bold', fontSize: '11px', color: '#110906',
    }).setOrigin(0.5));
    header.add(text(69, 25, 'SOUND QUEST', {
      fontFamily: 'Syne', fontStyle: 'bold', fontSize: '11px', color: '#f8ece2', letterSpacing: 2,
    }));
    header.add(text(69, 43, 'SYSTEM // BROADCAST FAILURE', {
      fontFamily: 'DM Mono', fontSize: '6px', color: '#82776f', letterSpacing: 1,
    }));

    const status = this.add.graphics();
    status.fillStyle(0xe8b465, 0.08);
    status.fillRoundedRect(W - 145, 27, 119, 24, 3);
    status.lineStyle(1, 0xe8b465, 0.5);
    status.strokeRoundedRect(W - 145, 27, 119, 24, 3);
    status.fillStyle(0xe8b465, 1);
    status.fillCircle(W - 129, 39, 3);
    header.add(status);
    header.add(text(W - 117, 34, 'LINK LOST', {
      fontFamily: 'DM Mono', fontSize: '7px', color: '#ff8a66', letterSpacing: 1,
    }));
    this.tweens.add({ targets: header, y: 0, alpha: 1, duration: 420, delay: 120, ease: 'Cubic.easeOut' });

    // Editorial title block: fast, legible and recognisable at game resolution.
    const accentRule = this.add.rectangle(35, 128, 3, 146, 0xe8b465, 1)
      .setOrigin(0, 0)
      .setScale(1, 0)
      .setName('death-accent-rule');
    this.tweens.add({ targets: accentRule, scaleY: 1, duration: 480, delay: 220, ease: 'Cubic.easeOut' });

    const eyebrow = text(52, 113, 'TRANSMISSION 00 // TERMINATED', {
      fontFamily: 'DM Mono', fontSize: '7px', color: '#afa7a2', letterSpacing: 2,
    }).setAlpha(0);
    const signalTitle = text(48, 132, 'SIGNAL', {
      fontFamily: 'Syne', fontStyle: 'bold', fontSize: '49px', color: '#f8ece2', letterSpacing: -2,
    }).setAlpha(0);
    const lostTitle = text(48, 177, 'LOST', {
      fontFamily: 'Syne', fontStyle: 'bold', fontSize: '67px', color: '#e8b465', letterSpacing: -3,
    }).setAlpha(0);
    [
      { target: eyebrow, x: 52, delay: 260 },
      { target: signalTitle, x: 48, delay: 340 },
      { target: lostTitle, x: 48, delay: 440 },
    ].forEach(({ target, x, delay }) => {
      target.setX(x - 16);
      this.tweens.add({ targets: target, x, alpha: 1, duration: 440, delay, ease: 'Cubic.easeOut' });
    });

    const description = text(52, 258,
      'Your channel dropped below recoverable levels.\nThe sonic archive retained your progress.', {
        fontFamily: 'DM Mono', fontSize: '8px', color: '#a9a09a', lineSpacing: 6,
      }).setAlpha(0);
    this.tweens.add({ targets: description, alpha: 1, y: 254, duration: 460, delay: 620, ease: 'Quad.easeOut' });

    // Useful context replaces the old generic death sentence.
    const archivePanel = this.add.graphics().setAlpha(0);
    archivePanel.fillStyle(0x110906, 0.9);
    archivePanel.fillRoundedRect(52, 311, 267, 62, 4);
    archivePanel.lineStyle(1, 0x493a33, 0.85);
    archivePanel.strokeRoundedRect(52, 311, 267, 62, 4);
    archivePanel.fillStyle(0xe8b465, 0.8);
    archivePanel.fillRect(52, 311, 3, 62);
    this.tweens.add({ targets: archivePanel, alpha: 1, duration: 380, delay: 760 });

    const metaLabels = [
      text(68, 323, 'CALLSIGN', { fontFamily: 'DM Mono', fontSize: '5px', color: '#756b64', letterSpacing: 1 }),
      text(202, 323, 'LEVEL', { fontFamily: 'DM Mono', fontSize: '5px', color: '#756b64', letterSpacing: 1 }),
      text(68, 352, 'RECOVERY POINT', { fontFamily: 'DM Mono', fontSize: '5px', color: '#756b64', letterSpacing: 1 }),
      text(68, 333, playerName, { fontFamily: 'Syne', fontStyle: 'bold', fontSize: '9px', color: '#f8ece2' }),
      text(202, 333, String(store.level).padStart(2, '0'), { fontFamily: 'Syne', fontStyle: 'bold', fontSize: '10px', color: '#ff7a2b' }),
      text(168, 349, 'ECHO VILLAGE // FULL HP', { fontFamily: 'DM Mono', fontSize: '6px', color: '#6ea8d8', letterSpacing: 1 }),
    ];
    metaLabels.forEach((label, index) => {
      label.setAlpha(0);
      this.tweens.add({ targets: label, alpha: 1, duration: 300, delay: 800 + index * 35 });
    });

    // Broken record / receiver visual on the right.
    const receiver = this.add.container(468, 231).setName('death-receiver').setAlpha(0).setScale(0.9);
    const receiverGlow = this.add.graphics();
    receiverGlow.fillStyle(0xe8b465, 0.035);
    receiverGlow.fillCircle(0, 0, 132);
    receiverGlow.fillStyle(0x6ea8d8, 0.025);
    receiverGlow.fillCircle(0, 0, 96);
    receiver.add(receiverGlow);

    const rings = this.add.graphics().setName('death-broken-rings');
    rings.lineStyle(1, 0x6ea8d8, 0.3);
    rings.beginPath(); rings.arc(0, 0, 112, -2.9, -0.38); rings.strokePath();
    rings.beginPath(); rings.arc(0, 0, 112, 0.08, 2.35); rings.strokePath();
    rings.lineStyle(1, 0xe8b465, 0.72);
    rings.beginPath(); rings.arc(0, 0, 84, -2.3, -0.12); rings.strokePath();
    rings.beginPath(); rings.arc(0, 0, 84, 0.35, 1.85); rings.strokePath();
    rings.lineStyle(2, 0xff7a2b, 0.3);
    rings.beginPath(); rings.arc(0, 0, 55, -2.8, -1.2); rings.strokePath();
    rings.beginPath(); rings.arc(0, 0, 55, -0.82, 1.95); rings.strokePath();
    rings.lineStyle(1, 0x635a53, 0.28);
    rings.lineBetween(-132, 0, 132, 0);
    rings.lineBetween(0, -132, 0, 132);
    for (let index = 0; index < 28; index++) {
      const angle = (index / 28) * Math.PI * 2;
      const inner = index % 4 === 0 ? 119 : 124;
      rings.lineStyle(index % 4 === 0 ? 2 : 1, index % 4 === 0 ? 0xe8b465 : 0x5b4940, index % 4 === 0 ? 0.68 : 0.34);
      rings.lineBetween(Math.cos(angle) * inner, Math.sin(angle) * inner, Math.cos(angle) * 131, Math.sin(angle) * 131);
    }
    receiver.add(rings);
    this.tweens.add({ targets: rings, angle: -360, duration: 24000, repeat: -1, ease: 'Linear' });

    const platform = this.add.graphics();
    platform.fillStyle(0x000000, 0.55);
    platform.fillEllipse(0, 62, 82, 17);
    platform.lineStyle(1, 0xe8b465, 0.38);
    platform.strokeEllipse(0, 62, 70, 12);
    receiver.add(platform);

    const playerGhost = this.add.sprite(0, 61, PLAYER_TEXTURES.down[0])
      .setOrigin(169 / 313, 291 / 313)
      .setScale(0.34)
      .setTint(0x8c8179)
      .setAlpha(0.48);
    playerGhost.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    receiver.add(playerGhost);
    this.tweens.add({ targets: playerGhost, alpha: 0.18, duration: 680, yoyo: true, repeat: -1, ease: 'Stepped' });

    const waveform = this.add.graphics().setName('death-flatline');
    receiver.add(waveform);
    const drawWaveform = (amplitude: number) => {
      waveform.clear();
      let previous: Phaser.Math.Vector2 | undefined;
      for (let x = -104; x <= 104; x += 4) {
        const envelope = Math.max(0.16, 1 - Math.abs(x) / 130);
        const dropout = x > 18 && x < 42;
        const y = Math.sin(x * 0.31) * amplitude * envelope + Math.sin(x * 0.67) * amplitude * 0.24;
        if (!dropout && previous) {
          waveform.lineStyle(1, Math.abs(x) < 18 ? 0xff7a2b : 0x6ea8d8, dropout ? 0 : 0.72);
          waveform.lineBetween(previous.x, previous.y, x, y);
        }
        previous = dropout ? undefined : new Phaser.Math.Vector2(x, y);
      }
      waveform.fillStyle(0xe8b465, 0.9);
      waveform.fillRect(24, -2, 4, 4);
      waveform.fillRect(34, -1, 2, 2);
    };
    drawWaveform(18);
    this.time.delayedCall(420, () => this.tweens.addCounter({
      from: 18,
      to: 1.5,
      duration: 880,
      ease: 'Cubic.easeIn',
      onUpdate: tween => drawWaveform(tween.getValue() ?? 1.5),
    }));

    const receiverLabel = text(0, 94, 'NO CARRIER // 00.0 HZ', {
      fontFamily: 'DM Mono', fontSize: '6px', color: '#ff8a66', letterSpacing: 1,
    }).setOrigin(0.5);
    receiver.add(receiverLabel);
    this.tweens.add({ targets: receiverLabel, alpha: 0.35, duration: 420, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: receiver, alpha: 1, scaleX: 1, scaleY: 1, duration: 620, delay: 280, ease: 'Back.easeOut' });

    // A single scanning fault line gives the screen motion after the reveal.
    const scanner = this.add.rectangle(W / 2, -3, W, 2, 0xe8b465, 0.18).setName('death-scan-fault');
    this.tweens.add({
      targets: scanner,
      y: H + 3,
      alpha: { from: 0.26, to: 0 },
      duration: 1900,
      delay: 520,
      repeat: -1,
      repeatDelay: 900,
      ease: 'Linear',
    });

    // Recovery action appears quickly, but input is briefly gated against key carry-over.
    const button = this.add.container(52, 401).setName('death-reconnect').setAlpha(0).setY(413);
    const buttonBg = this.add.graphics();
    const drawButton = (hovered: boolean) => {
      buttonBg.clear();
      buttonBg.fillStyle(hovered ? 0xff7a2b : 0x160c09, 0.98);
      buttonBg.fillRoundedRect(0, 0, 267, 39, 4);
      buttonBg.lineStyle(hovered ? 2 : 1, hovered ? 0xff7a2b : 0x6ea8d8, hovered ? 1 : 0.75);
      buttonBg.strokeRoundedRect(0, 0, 267, 39, 4);
      buttonBg.fillStyle(hovered ? 0x110906 : 0x6ea8d8, 1);
      buttonBg.fillRect(0, 0, 4, 39);
    };
    drawButton(false);
    this.reconnectLabel = text(17, 12, 'RECONNECT SIGNAL', {
      fontFamily: 'Syne', fontStyle: 'bold', fontSize: '11px', color: '#f8ece2', letterSpacing: 1,
    });
    const keyBg = this.add.graphics();
    keyBg.fillStyle(0x0a0605, 0.9);
    keyBg.fillRoundedRect(207, 10, 48, 19, 3);
    keyBg.lineStyle(1, 0x82776f, 0.45);
    keyBg.strokeRoundedRect(207, 10, 48, 19, 3);
    const keyText = text(231, 16, 'ENTER', {
      fontFamily: 'DM Mono', fontSize: '6px', color: '#b6aea9', letterSpacing: 1,
    }).setOrigin(0.5, 0);
    const hitZone = this.add.zone(133.5, 19.5, 267, 39).setInteractive({ useHandCursor: true });
    button.add([buttonBg, this.reconnectLabel, keyBg, keyText, hitZone]);

    hitZone.on('pointerover', () => {
      if (!this.canRespawn) return;
      drawButton(true);
      this.reconnectLabel?.setColor('#110906');
    });
    hitZone.on('pointerout', () => {
      drawButton(false);
      this.reconnectLabel?.setColor('#f8ece2');
    });
    hitZone.on('pointerdown', () => this.respawn());
    this.tweens.add({ targets: button, y: 401, alpha: 1, duration: 420, delay: 720, ease: 'Cubic.easeOut' });

    const footer = text(W - 24, H - 29, 'SPACE / ENTER / TAP  //  ARCHIVE SAFE', {
      fontFamily: 'DM Mono', fontSize: '6px', color: '#756b64', letterSpacing: 1,
    }).setOrigin(1, 0.5).setAlpha(0);
    this.tweens.add({ targets: footer, alpha: 0.72, duration: 420, delay: 900 });

    this.time.delayedCall(850, () => {
      this.canRespawn = true;
      EventBus.emit(EVENTS.DEATH_UI_STATE, { ready: true, reconnecting: false });
    });
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-SPACE', () => this.respawn());
      this.input.keyboard.on('keydown-ENTER', () => this.respawn());
    }

    this.time.addEvent({
      delay: 1180,
      loop: true,
      callback: () => this.playGlitchBurst(W, signalTitle, lostTitle, receiver),
    });
  }

  private playGlitchBurst(
    width: number,
    signalTitle: Phaser.GameObjects.Text,
    lostTitle: Phaser.GameObjects.Text,
    receiver: Phaser.GameObjects.Container,
  ): void {
    const glitch = this.add.graphics().setName('death-glitch-burst').setDepth(30);
    for (let index = 0; index < 5; index++) {
      const y = Phaser.Math.Between(92, 378);
      const x = Phaser.Math.Between(24, width - 150);
      glitch.fillStyle(index % 2 === 0 ? 0xe8b465 : 0x6ea8d8, 0.12 + index * 0.025);
      glitch.fillRect(x, y, Phaser.Math.Between(28, 132), index % 3 === 0 ? 2 : 1);
    }
    const direction = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
    signalTitle.setX(48 + direction * 2);
    lostTitle.setX(48 - direction * 3);
    receiver.setX(468 + direction * 2);
    this.time.delayedCall(70, () => {
      signalTitle.setX(48);
      lostTitle.setX(48);
      receiver.setX(468);
      glitch.destroy();
    });
  }

  private respawn(): void {
    if (!this.canRespawn || this.respawning) return;
    this.respawning = true;
    this.canRespawn = false;
    EventBus.emit(EVENTS.DEATH_UI_STATE, { ready: false, reconnecting: true });
    this.reconnectLabel?.setText('RECONNECTING...').setColor('#ff7a2b');

    const W = this.scale.width;
    const H = this.scale.height;
    const reconnectWave = this.add.graphics()
      .setName('death-reconnect-wave')
      .setDepth(60)
      .setPosition(W / 2, H / 2)
      .setScale(0, 1);
    reconnectWave.fillStyle(0x6ea8d8, 0.18);
    reconnectWave.fillRect(-W / 2, -14, W, 28);
    reconnectWave.fillStyle(0xff7a2b, 0.9);
    reconnectWave.fillRect(-W / 2, -1, W, 2);
    this.tweens.add({ targets: reconnectWave, scaleX: 1, duration: 180, ease: 'Cubic.easeOut' });

    this.cameras.main.flash(130, 73, 223, 191, false);
    this.time.delayedCall(150, () => this.cameras.main.fadeOut(420, 5, 9, 8));
    this.time.delayedCall(500, () => {
      const store = useGameStore.getState();
      const healedAmount = store.maxHp - store.hp;
      store.restoreHp(store.maxHp);
      EventBus.emit(EVENTS.HEAL, { amount: healedAmount, source: 'respawn' });
      EventBus.emit(EVENTS.RESPAWN);
      this.scene.stop('DeathScene');
    });
  }

  private onDeathUiAction = (): void => {
    this.respawn();
  };
}
