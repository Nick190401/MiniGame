import Phaser from 'phaser';
import { TextureFactory } from '../utils/TextureFactory';
import { WorldArtFactory } from '../utils/WorldArtFactory';
import { EventBus, EVENTS } from '../EventBus';
import { PLAYER_TEXTURE_ASSETS, PLAYER_TEXTURES } from '../assets/PlayerTextures';
import { NPC_TEXTURE_ASSETS } from '../assets/NpcTextures';
import { ALL_MUSIC_ASSETS, ALL_SFX_ASSETS } from '../audio/AudioLibrary';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    // Standalone frames avoid iOS WebKit decoding the 4x4 sheet at a
    // density-adjusted size and exposing four characters in one frame.
    PLAYER_TEXTURE_ASSETS.forEach(({ key, url }) => this.load.image(key, url));
    NPC_TEXTURE_ASSETS.forEach(({ key, url }) => this.load.image(key, url));
    this.load.image('player-battle', 'assets/player_model.PNG');
    this.load.image('npc-elder-muse-v3', 'assets/npc-elder-muse-v3.png');
    this.load.image('npc-junction-guard-v3', 'assets/npc-junction-guard-v3.png');
    this.load.image('npc-wandering-musician-v3', 'assets/npc-wandering-musician-v3.png');
    this.load.image('silence-battle', 'assets/silence_model.PNG');
    this.load.image('staticnoise-battle', 'assets/static-noice.PNG');
    this.load.image('brokensignal-battle', 'assets/brokensignal_model.PNG');
    this.load.image('boss-gatekeeper-battle-phase1', 'assets/boss-gatekeeper-phase1-v2.png');
    this.load.image('boss-gatekeeper-battle-phase2', 'assets/boss-gatekeeper-phase2-v2.png');
    this.load.image('boss-gatekeeper-battle-phase3', 'assets/boss-gatekeeper-phase3-v2.png');
    this.load.image('battle-bg-normal', 'assets/battle-bg-normal.png');
    this.load.image('battle-bg-boss', 'assets/battle-bg-boss.png');
    this.load.spritesheet(
      'town-rpg-atlas',
      'assets/tilesets/town_rpg_pack/town_rpg_pack/graphics/transparent-bg-tiles.png',
      { frameWidth: 16, frameHeight: 16 },
    );
    [
      ['town-grass-a', 'grass-tile.png'],
      ['town-grass-b', 'grass-tile-2.png'],
      ['town-grass-c', 'grass-tile-3.png'],
    ].forEach(([key, file]) => {
      this.load.spritesheet(
        key,
        `assets/tilesets/town_rpg_pack/town_rpg_pack/graphics/${file}`,
        { frameWidth: 16, frameHeight: 16 },
      );
    });

    // Music/SFX are optional: files may not exist yet (see AudioLibrary.ts).
    // A missing file just fails to load — it never blocks the other assets
    // or crashes the boot sequence, it only logs a quiet debug note below.
    [...ALL_MUSIC_ASSETS, ...ALL_SFX_ASSETS].forEach(({ key, url }) => this.load.audio(key, url));
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      if (file.type === 'audio') console.debug(`[audio] not found yet, skipping: ${file.src}`);
    });
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0a0605');
    EventBus.emit(EVENTS.LOADING_UI_STATE, {
      step: 0,
      total: 6,
      label: 'OPENING SONIC ARCHIVE',
      progress: 0,
    });

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

    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x110906, 1);
    backdrop.fillRect(0, 0, width, height);
    backdrop.fillStyle(0x180e0a, 1);
    backdrop.fillRect(20, 20, width - 40, height - 40);
    backdrop.lineStyle(1, 0x413027, 0.28);
    for (let x = 20; x <= width - 20; x += 32) backdrop.lineBetween(x, 20, x, height - 20);
    for (let y = 20; y <= height - 20; y += 32) backdrop.lineBetween(20, y, width - 20, y);
    backdrop.lineStyle(1, 0xff7a2b, 0.34);
    backdrop.strokeRect(20.5, 20.5, width - 41, height - 41);
    backdrop.fillStyle(0xff7a2b, 0.82);
    backdrop.fillRect(20, 20, 88, 2);
    backdrop.fillRect(width - 108, height - 22, 88, 2);

    const atmosphere = this.add.graphics();
    atmosphere.fillStyle(0x6ea8d8, 0.035);
    atmosphere.fillCircle(486, 218, 158);
    atmosphere.fillStyle(0xff7a2b, 0.025);
    atmosphere.fillCircle(486, 218, 112);

    const brand = this.add.graphics();
    brand.fillStyle(0xff7a2b, 1);
    brand.fillRect(38, 37, 31, 31);
    text(53.5, 52.5, 'SQ', {
      fontFamily: 'Syne', fontStyle: 'bold', fontSize: '11px', color: '#110906',
    }).setOrigin(0.5);
    text(82, 38, 'SOUND QUEST', {
      fontFamily: 'Syne', fontStyle: 'bold', fontSize: '12px', color: '#f6f4f3', letterSpacing: 2,
    });
    text(82, 56, 'WORLD LINK // BOOT SEQUENCE', {
      fontFamily: 'DM Mono', fontSize: '7px', color: '#82766e', letterSpacing: 1,
    });

    const online = this.add.graphics();
    online.fillStyle(0x6ea8d8, 0.13);
    online.fillRoundedRect(width - 169, 39, 131, 27, 4);
    online.lineStyle(1, 0x6ea8d8, 0.55);
    online.strokeRoundedRect(width - 169, 39, 131, 27, 4);
    online.fillStyle(0x6ea8d8, 1);
    online.fillCircle(width - 151, 52.5, 3);
    const onlineDot = this.add.circle(width - 151, 52.5, 5, 0x6ea8d8, 0.18);
    text(width - 140, 47, 'LINK ACTIVE', {
      fontFamily: 'DM Mono', fontSize: '8px', color: '#a1c8e4', letterSpacing: 1,
    });
    this.tweens.add({ targets: onlineDot, alpha: 0.75, scale: 1.4, duration: 760, yoyo: true, repeat: -1 });

    text(40, 122, 'ENTERING // THE SONIC ARCHIVE', {
      fontFamily: 'DM Mono', fontSize: '8px', color: '#9c928b', letterSpacing: 2,
    });
    text(36, 143, 'SIGNAL', {
      fontFamily: 'Syne', fontStyle: 'bold', fontSize: '53px', color: '#f6f4f3', letterSpacing: -2,
    });
    text(36, 192, 'LOCK', {
      fontFamily: 'Syne', fontStyle: 'bold', fontSize: '63px', color: '#ff7a2b', letterSpacing: -3,
    });
    text(41, 264, 'Calibrating your frequency\nfor the world beyond.', {
      fontFamily: 'DM Mono', fontSize: '10px', color: '#a9a19b', lineSpacing: 7,
    });

    const scanner = this.add.container(486, 218);
    const rings = this.add.graphics();
    rings.lineStyle(1, 0x6ea8d8, 0.34);
    rings.strokeCircle(0, 0, 122);
    rings.strokeCircle(0, 0, 91);
    rings.lineStyle(1, 0xff7a2b, 0.58);
    rings.strokeCircle(0, 0, 62);
    rings.lineStyle(1, 0x726962, 0.35);
    rings.lineBetween(-140, 0, 140, 0);
    rings.lineBetween(0, -140, 0, 140);
    for (let i = 0; i < 24; i++) {
      const angle = (Math.PI * 2 * i) / 24;
      const inner = i % 3 === 0 ? 128 : 133;
      const outer = 139;
      rings.lineStyle(i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 0xff7a2b : 0x685348, i % 3 === 0 ? 0.72 : 0.45);
      rings.lineBetween(
        Math.cos(angle) * inner,
        Math.sin(angle) * inner,
        Math.cos(angle) * outer,
        Math.sin(angle) * outer,
      );
    }
    scanner.add(rings);
    this.tweens.add({ targets: rings, angle: 360, duration: 18000, repeat: -1, ease: 'Linear' });

    const sweep = this.add.graphics();
    sweep.fillStyle(0x6ea8d8, 0.08);
    sweep.fillTriangle(0, 0, 125, -7, 125, 7);
    scanner.add(sweep);
    this.tweens.add({ targets: sweep, angle: 360, duration: 2200, repeat: -1, ease: 'Linear' });

    const waveform = this.add.graphics();
    waveform.lineStyle(1, 0xff7a2b, 0.6);
    const points: Phaser.Math.Vector2[] = [];
    for (let x = -122; x <= 122; x += 4) {
      const envelope = Math.max(0.15, 1 - Math.abs(x) / 150);
      points.push(new Phaser.Math.Vector2(
        x,
        Math.sin(x * 0.23) * 7 * envelope + Math.sin(x * 0.51) * 3,
      ));
    }
    waveform.strokePoints(points, false);
    scanner.add(waveform);
    this.tweens.add({ targets: waveform, alpha: 0.22, duration: 520, yoyo: true, repeat: -1 });

    const platform = this.add.graphics();
    platform.fillStyle(0x000000, 0.45);
    platform.fillEllipse(486, 335, 104, 24);
    platform.lineStyle(1, 0x6ea8d8, 0.5);
    platform.strokeEllipse(486, 335, 91, 18);

    const playerPreview = this.add.sprite(486, 337, PLAYER_TEXTURES.down[0])
      .setOrigin(169 / 313, 291 / 313)
      .setScale(0.48)
      .setAlpha(0);
    playerPreview.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.tweens.add({ targets: playerPreview, alpha: 1, y: 331, duration: 520, ease: 'Cubic.easeOut' });

    text(438, 349, 'PLAYER SIGNAL', {
      fontFamily: 'DM Mono', fontSize: '6px', color: '#83776f', letterSpacing: 1,
    });
    text(438, 360, 'IDENTITY SYNC', {
      fontFamily: 'Syne', fontStyle: 'bold', fontSize: '9px', color: '#ff7a2b', letterSpacing: 1,
    });

    const module = this.add.graphics();
    module.fillStyle(0x110906, 0.94);
    module.fillRoundedRect(38, 376, width - 76, 66, 6);
    module.lineStyle(1, 0x493a33, 0.9);
    module.strokeRoundedRect(38, 376, width - 76, 66, 6);

    const loadingText = text(52, 388, '00 // OPENING ARCHIVE', {
      fontFamily: 'DM Mono', fontSize: '8px', color: '#a9a099', letterSpacing: 1,
    });
    const progressText = text(width - 52, 384, '00%', {
      fontFamily: 'Syne', fontStyle: 'bold', fontSize: '17px', color: '#ff7a2b',
    }).setOrigin(1, 0);

    const segmentGap = 5;
    const segmentWidth = (width - 109 - segmentGap * 5) / 6;
    const segments = Array.from({ length: 6 }, (_, index) => {
      const segment = this.add.rectangle(
        52 + index * (segmentWidth + segmentGap),
        421,
        segmentWidth,
        5,
        0x352923,
        1,
      ).setOrigin(0, 0.5);
      const marker = text(segment.x, 428, String(index + 1).padStart(2, '0'), {
        fontFamily: 'DM Mono', fontSize: '5px', color: '#615953',
      });
      return { segment, marker };
    });

    const steps = [
      { label: 'MAPPING TERRAIN', fn: () => WorldArtFactory.createTileTextures(this) },
      {
        label: 'CALIBRATING PLAYER SIGNAL',
        fn: () => {
          TextureFactory.createPlayerTextures(this);
          WorldArtFactory.createCharacterTextures(this);
        },
      },
      { label: 'LOCATING DISTORTIONS', fn: () => WorldArtFactory.createEnemyTextures(this) },
      { label: 'UNLOCKING VOID GATE', fn: () => WorldArtFactory.createBossTextures(this) },
      { label: 'LOCATING LOST TRACK', fn: () => WorldArtFactory.createItemTextures(this) },
      { label: 'SYNCING INTERFACE', fn: () => TextureFactory.createUITextures(this) },
    ];

    let step = 0;
    const runNextStep = () => {
      if (step >= steps.length) {
        loadingText.setText('06 // SIGNAL LOCKED - WORLD READY').setColor('#ff7a2b');
        progressText.setText('100%');
        EventBus.emit(EVENTS.LOADING_UI_STATE, {
          step: steps.length,
          total: steps.length,
          label: 'SIGNAL LOCKED - WORLD READY',
          progress: 100,
          ready: true,
        });
        this.time.delayedCall(420, () => {
          this.cameras.main.fadeOut(260, 5, 9, 8);
          this.time.delayedCall(260, () => {
            this.scene.start('WorldScene');
            EventBus.emit(EVENTS.SCENE_READY, 'WorldScene');
          });
        });
        return;
      }

      const currentStep = steps[step];
      loadingText.setText(`${String(step + 1).padStart(2, '0')} // ${currentStep.label}`);
      currentStep.fn();
      step++;

      const progress = step / steps.length;
      progressText.setText(`${Math.round(progress * 100).toString().padStart(2, '0')}%`);
      EventBus.emit(EVENTS.LOADING_UI_STATE, {
        step,
        total: steps.length,
        label: currentStep.label,
        progress: Math.round(progress * 100),
      });
      const activeSegment = segments[step - 1];
      activeSegment.segment.setFillStyle(step === steps.length ? 0xff7a2b : 0x6ea8d8, 1);
      activeSegment.marker.setColor(step === steps.length ? '#ff7a2b' : '#76afd7');
      this.tweens.add({
        targets: activeSegment.segment,
        alpha: 0.48,
        duration: 90,
        yoyo: true,
        ease: 'Sine.easeInOut',
      });

      this.time.delayedCall(150, runNextStep);
    };

    this.time.delayedCall(260, runNextStep);
  }
}
