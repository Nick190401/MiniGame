import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { ENEMY_DEFINITIONS, BOSS_DEFINITION } from '../entities/Enemy';
import type { EnemyData } from '../../types/game.types';
import { Boss } from '../entities/Boss';
import { MapBuilder } from '../utils/MapBuilder';
import { EventBus, EVENTS } from '../EventBus';
import { useGameStore } from '../../store/gameStore';

const TILE = 16;

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private boss?: Boss;
  private fragments: Phaser.GameObjects.Sprite[] = [];
  private lostTrackItem?: Phaser.GameObjects.Sprite;
  private lostTrackEffects: Phaser.GameObjects.GameObject[] = [];
  private runeGraphics: Phaser.GameObjects.GameObject[] = [];

  // NPCs
  private npcSprite?: Phaser.GameObjects.Sprite;   // Elder Muse — Echo Village
  private npc2Sprite?: Phaser.GameObjects.Sprite;  // Junction Guard — Neon Junction
  private npc3Sprite?: Phaser.GameObjects.Sprite;  // Wandering Musician — Neon Junction

  private npcInteractLabel?: Phaser.GameObjects.Container;
  private npc2InteractLabel?: Phaser.GameObjects.Container;
  private npc3InteractLabel?: Phaser.GameObjects.Container;

  private npcFirstDialogDone  = false;
  private npc2FirstDialogDone = false;
  private npc3FirstDialogDone = false;

  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private gateOpen = false;

  // Dialog
  private dialogBox?: Phaser.GameObjects.Container;
  private dialogActive = false;
  private dialogQueue: string[] = [];
  private isTyping = false;
  private currentTypeTimer?: Phaser.Time.TimerEvent;
  private currentLine = '';

  // State
  private battleActive = false;
  private worldFrozen = false;

  // Zone rects (in world pixels)
  // Boss chamber — rows 69–77
  private bossZoneRect = new Phaser.Geom.Rectangle(0, 70 * TILE, 768, 8 * TILE);
  private bossEncounterStarted = false;

  // Gate zone — only the path columns directly against the gate (row 36)
  private gateZoneRect = new Phaser.Geom.Rectangle(18 * TILE, 36 * TILE, 6 * TILE, 1 * TILE);

  // Sign positions
  private signPos  = { x: 17 * TILE + 8, y:  9 * TILE + 8 };  // Echo Village
  private sign2Pos = { x: 17 * TILE + 8, y: 35 * TILE + 8 };  // Neon Junction

  // Input
  private interactKey!: Phaser.Input.Keyboard.Key;

  // Tall grass
  private tallGrassZones: Phaser.Geom.Rectangle[] = [];
  private grassStepTimer = 0;
  private postBattleCooldown = 0;
  private readonly GRASS_STEP_MS = 450;
  private readonly ENCOUNTER_CHANCE = 0.22;

  // "show only once" guard for dialogs keyed by string
  private shownOnce: Set<string> = new Set();

  constructor() {
    super({ key: 'WorldScene' });
  }

  create(): void {
    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');

    // Build map
    const mapResult = MapBuilder.build(this);
    this.walls = mapResult.walls;

    // Spawn player
    this.player = new Player(this, mapResult.spawnX, mapResult.spawnY);

    this.cameras.main.startFollow(this.player, true, 1, 1);
    this.cameras.main.setZoom(2);
    this.cameras.main.setRoundPixels(true);

    this.physics.add.collider(this.player, this.walls);

    // Sync sign positions from map
    this.signPos  = mapResult.signPos;
    this.sign2Pos = mapResult.sign2Pos;

    // Tall grass zones
    this.tallGrassZones = mapResult.tallGrassZones;

    // Rune graphics (destroyed after boss defeat)
    this.runeGraphics = mapResult.runeGraphics;

    // NPCs
    this.spawnNPC(mapResult.npcPos.x,  mapResult.npcPos.y,  'npc-professor', 'npcInteractLabel');
    this.spawnNPC2(mapResult.npc2Pos.x, mapResult.npc2Pos.y);
    this.spawnNPC3(mapResult.npc3Pos.x, mapResult.npc3Pos.y);

    // Sound fragments
    this.spawnFragments(mapResult);

    this.physics.add.overlap(
      this.player,
      this.fragments as unknown as Phaser.GameObjects.GameObject[],
      (_p, frag) => this.collectFragment(frag as Phaser.GameObjects.Sprite)
    );

    // Boss (hidden until player enters chamber)
    this.boss = new Boss(this, mapResult.bossPos.x, mapResult.bossPos.y);
    this.boss.setAlpha(0);

    EventBus.on(EVENTS.BATTLE_END, this.onBattleEnd, this);

    // Interact key
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // Dialog
    this.createDialogBox();
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    // Anchor dialog box to the bottom of the camera viewport every frame
    if (this.dialogBox && this.cameras.main) {
      const wv = this.cameras.main.worldView;
      this.dialogBox.setPosition(wv.x + 2, wv.y + wv.height - 52);
    }

    if (this.worldFrozen || this.battleActive) {
      (this.player?.body as Phaser.Physics.Arcade.Body | undefined)?.setVelocity(0, 0);
      return;
    }

    this.player.update(delta);

    // ── NPC proximity interactions ─────────────────────────────────────────
    this.checkNpcProximity();

    // ── Sign proximity (E to read) ─────────────────────────────────────────
    if (!this.dialogActive && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      const d1 = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.signPos.x, this.signPos.y);
      if (d1 < 28) {
        this.showDialogOnce('sign-village', [
          'SIGNAL PATH — north.',
          'Tall grass stretches across the road.',
          'Creatures stir within.',
          `Walk carefully, ${useGameStore.getState().playerName}.`,
        ]);
      }
      const d2 = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.sign2Pos.x, this.sign2Pos.y);
      if (d2 < 28) {
        this.showDialogOnce('sign-junction', [
          'WARNING.',
          'FREQUENCY GATE — south.',
          'Passage requires Level 2.',
          'Beyond: the Fading Path.',
          'Beyond that: silence.',
        ]);
      }
    }

    // ── Gate zone ─────────────────────────────────────────────────────────
    if (!this.gateOpen && this.gateZoneRect.contains(this.player.x, this.player.y)) {
      const store = useGameStore.getState();
      if (store.level >= 2) {
        this.openGate();
      } else {
        this.showDialogOnce('gate-lock', [
          `You are Level ${store.level}.`,
          'The Frequency Gate remains sealed.',
          'Reach Level 2 to pass.',
          'Train in the tall grass of Signal Path.',
        ]);
      }
    }

    // ── Boss zone ─────────────────────────────────────────────────────────
    if (!this.bossEncounterStarted && this.gateOpen &&
        this.bossZoneRect.contains(this.player.x, this.player.y)) {
      this.startBossEncounter();
    }

    // ── Lost track pickup ─────────────────────────────────────────────────
    if (this.lostTrackItem?.active) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.lostTrackItem.x, this.lostTrackItem.y
      );
      if (dist < 24) this.collectLostTrack();
    }

    // ── Tall grass encounters ─────────────────────────────────────────────
    if (this.postBattleCooldown > 0) this.postBattleCooldown -= delta;
    const inGrass = this.player.isMoving() &&
      this.tallGrassZones.some(z => z.contains(this.player.x, this.player.y));
    if (inGrass && this.postBattleCooldown <= 0) {
      this.grassStepTimer += delta;
      if (this.grassStepTimer >= this.GRASS_STEP_MS) {
        this.grassStepTimer = 0;
        if (Math.random() < this.ENCOUNTER_CHANCE) {
          const data = ENEMY_DEFINITIONS[Math.floor(Math.random() * ENEMY_DEFINITIONS.length)];
          this.startRandomEncounter(data);
        }
      }
    } else if (!inGrass) {
      this.grassStepTimer = 0;
    }
  }

  // ── NPC helpers ───────────────────────────────────────────────────────────

  private checkNpcProximity(): void {
    const px = this.player.x;
    const py = this.player.y;

    // NPC 1 — Elder Muse
    const d1 = this.npcSprite
      ? Phaser.Math.Distance.Between(px, py, this.npcSprite.x, this.npcSprite.y)
      : 999;
    const near1 = d1 < 30;
    this.npcInteractLabel?.setVisible(near1 && !this.dialogActive);
    if (near1 && !this.dialogActive && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.triggerNpc1();
    }

    // NPC 2 — Junction Guard
    const d2 = this.npc2Sprite
      ? Phaser.Math.Distance.Between(px, py, this.npc2Sprite.x, this.npc2Sprite.y)
      : 999;
    const near2 = d2 < 30;
    this.npc2InteractLabel?.setVisible(near2 && !this.dialogActive);
    if (near2 && !this.dialogActive && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.triggerNpc2();
    }

    // NPC 3 — Wandering Musician
    const d3 = this.npc3Sprite
      ? Phaser.Math.Distance.Between(px, py, this.npc3Sprite.x, this.npc3Sprite.y)
      : 999;
    const near3 = d3 < 30;
    this.npc3InteractLabel?.setVisible(near3 && !this.dialogActive);
    if (near3 && !this.dialogActive && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.triggerNpc3();
    }
  }

  // ── Spawning ──────────────────────────────────────────────────────────────

  private createInteractLabel(x: number, y: number): Phaser.GameObjects.Container {
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0018, 0.92);
    bg.fillRoundedRect(-16, -8, 32, 16, 3);
    bg.lineStyle(1.5, 0xffd700, 1);
    bg.strokeRoundedRect(-16, -8, 32, 16, 3);

    const txt = this.add.text(0, 0, 'E', {
      fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffd700',
    }).setOrigin(0.5);

    const container = this.add.container(x, y - 20, [bg, txt]);
    container.setDepth(10).setVisible(false);

    this.tweens.add({ targets: container, y: y - 23, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    return container;
  }

  private spawnNPC(x: number, y: number, textureKey: string, _labelField: string): void {
    this.npcSprite = this.add.sprite(x, y, textureKey).setDepth(4);
    this.tweens.add({ targets: this.npcSprite, y: y - 3, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.npcInteractLabel = this.createInteractLabel(x, y);
  }

  private spawnNPC2(x: number, y: number): void {
    this.npc2Sprite = this.add.sprite(x, y, 'npc-guard').setDepth(4);
    this.tweens.add({ targets: this.npc2Sprite, y: y - 2, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.npc2InteractLabel = this.createInteractLabel(x, y);
  }

  private spawnNPC3(x: number, y: number): void {
    this.npc3Sprite = this.add.sprite(x, y, 'npc-musician').setDepth(4);
    this.tweens.add({ targets: this.npc3Sprite, y: y - 3, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.npc3InteractLabel = this.createInteractLabel(x, y);
  }

  private spawnFragments(mapResult: ReturnType<typeof MapBuilder.build>): void {
    const positions = [mapResult.fragment1Pos, mapResult.fragment2Pos, mapResult.fragment3Pos];
    positions.forEach((pos) => {
      const frag = this.physics.add.sprite(pos.x, pos.y, 'item-fragment').setDepth(4);
      this.tweens.add({ targets: frag, y: pos.y - 5, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: frag, alpha: 0.6, duration: 700, yoyo: true, repeat: -1 });
      this.fragments.push(frag);
    });
  }

  // ── NPC dialog triggers ───────────────────────────────────────────────────

  private triggerNpc1(): void {
    if (!this.npcFirstDialogDone) {
      this.npcFirstDialogDone = true;
      const pName = useGameStore.getState().playerName;
      this.showDialog([
        'Elder Muse:',
        `"Welcome, young ${pName}."`,
        '"This is Echo Village."',
        '"Long ago, music filled every road."',
        '"Then The Gatekeeper came."',
        '"It sealed the Lost Track in silence."',
        '"Head north through Signal Path."',
        '"Grow strong in the tall grass."',
        '"Then find Neon Junction."',
        '"The road forward lies beyond."',
      ]);
    } else {
      const store = useGameStore.getState();
      if (store.hp < store.maxHp) {
        this.showDialog(
          [
            'Elder Muse:',
            `"You look weary, ${useGameStore.getState().playerName}."`,
            '"Close your eyes. Listen..."',
          ],
          () => {
            this.playHealingMusic(this.npcSprite!, store.maxHp, [
              'Elder Muse:',
              '"The old melodies still carry power."',
              '"You should feel better now."',
            ]);
          }
        );
      } else {
        this.showDialog([
          'Elder Muse:',
          `"You look well, ${useGameStore.getState().playerName}."`,
          '"The road ahead awaits."',
        ]);
      }
    }
  }

  private triggerNpc2(): void {
    if (!this.npc2FirstDialogDone) {
      this.npc2FirstDialogDone = true;
      this.showDialog([
        'Junction Guard:',
        '"You made it through Signal Path."',
        `"Few reach this far, ${useGameStore.getState().playerName}."`,
        '"The Frequency Gate lies south."',
        '"It demands Level 2 strength."',
        '"Beware what lies beyond."',
        '"The Fading Path leads to Void Cave."',
        '"And in that cave..."',
        '"The Gatekeeper waits in The Core."',
      ]);
    } else {
      const store = useGameStore.getState();
      if (store.hp < store.maxHp) {
        this.showDialog(
          [
            'Junction Guard:',
            '"You look rough, kid."',
            '"Hold on... I have an old recording."',
            '"Listen."',
          ],
          () => {
            this.playHealingMusic(this.npc2Sprite!, store.maxHp, [
              'Junction Guard:',
              '"A guard\'s remedy."',
              '"Don\'t tell anyone."',
            ]);
          }
        );
      } else {
        this.showDialog([
          'Junction Guard:',
          '"The gate opens for the worthy."',
          `"Stay determined, ${useGameStore.getState().playerName}."`,
        ]);
      }
    }
  }

  private triggerNpc3(): void {
    if (!this.npc3FirstDialogDone) {
      this.npc3FirstDialogDone = true;
      this.showDialog([
        'Wandering Musician:',
        '"I used to play every evening."',
        '"Then the silence spread."',
        '"I heard the Lost Track once."',
        '"Just a fragment."',
        '"But it was the most beautiful thing."',
        '"Please... bring it back."',
      ]);
    } else {
      const store = useGameStore.getState();
      if (store.hp < store.maxHp) {
        this.showDialog(
          [
            'Wandering Musician:',
            '"You look beaten up, friend."',
            '"Let me play you something..."',
          ],
          () => {
            this.playHealingMusic(this.npc3Sprite!, store.maxHp, [
              'Wandering Musician:',
              '"Music heals all wounds."',
              '"It always has."',
            ]);
          }
        );
      } else {
        this.showDialog([
          'Wandering Musician:',
          '"The road to The Core is long."',
          '"But I believe in you."',
        ]);
      }
    }
  }

  // ── Interactions ──────────────────────────────────────────────────────────

  private collectFragment(sprite: Phaser.GameObjects.Sprite): void {
    const idx = this.fragments.indexOf(sprite);
    if (idx !== -1) this.fragments.splice(idx, 1);

    const pickup = this.add.text(sprite.x, sprite.y - 10, '+10 XP', {
      fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#4080ff',
      stroke: '#000000', strokeThickness: 3,
    }).setDepth(10).setOrigin(0.5);
    this.tweens.add({ targets: pickup, y: sprite.y - 30, alpha: 0, duration: 800, onComplete: () => pickup.destroy() });

    sprite.destroy();

    const store = useGameStore.getState();
    const prevLevel = store.level;
    store.addXp(10);
    EventBus.emit(EVENTS.XP_GAINED, 10);
    if (store.level > prevLevel) {
      EventBus.emit(EVENTS.LEVEL_UP, store.level);
      this.showLevelUpEffect(store.level);
    }
  }

  private startRandomEncounter(data: EnemyData): void {
    if (this.battleActive || this.dialogActive) return;
    this.battleActive = true;
    this.grassStepTimer = 0;
    this.player.freeze();
    this.cameras.main.flash(200, 255, 255, 255);
    this.time.delayedCall(250, () => {
      this.scene.launch('BattleScene', { enemyData: data, isBoss: false });
      this.scene.pause();
    });
  }

  private startBossEncounter(): void {
    if (this.bossEncounterStarted || this.battleActive) return;
    this.bossEncounterStarted = true;
    this.battleActive = true;
    this.player.freeze();

    this.cameras.main.shake(400, 0.008);
    this.boss?.setAlpha(1);

    this.showDialog(
      [
        'The air goes completely still.',
        'All sound dies.',
        'A shape rises from the darkness...',
        'THE GATEKEEPER:',
        '"No sound passes through The Core."',
        '"Your journey ends here."',
      ],
      () => {
        this.cameras.main.flash(500, 100, 0, 180);
        this.time.delayedCall(400, () => {
          this.scene.launch('BattleScene', { enemyData: BOSS_DEFINITION, isBoss: true });
          this.scene.pause();
        });
      }
    );
  }

  private onBattleEnd = (result: { outcome: 'win' | 'lose'; isBoss: boolean }) => {
    this.battleActive = false;
    this.scene.resume();

    if (result.outcome === 'lose') {
      this.handlePlayerDeath();
      return;
    }

    if (result.isBoss) {
      this.handleBossDefeated();
    } else {
      this.postBattleCooldown = 3000;
      this.player.unfreeze();
    }
  };

  private handleBossDefeated(): void {
    useGameStore.getState().defeatBoss();
    EventBus.emit(EVENTS.BOSS_DEFEATED);
    this.cameras.main.flash(700, 255, 200, 0);
    // Destroy the boss sprite
    if (this.boss) {
      this.boss.destroy();
      this.boss = undefined;
    }
    // Fade out and destroy rune graphics
    for (const obj of this.runeGraphics) {
      this.tweens.add({ targets: obj, alpha: 0, duration: 800, onComplete: () => obj.destroy() });
    }
    this.runeGraphics = [];
    this.time.delayedCall(800, () => {
      this.showDialog(
        [
          'The Gatekeeper shatters into fragments of light.',
          'A wave of sound rushes through The Core.',
          'Music... returning.',
          'Something glows at the center of the room...',
          'The Lost Track.',
          'You found it.',
          'Approach it.',
        ],
        () => {
          this.spawnLostTrack();
          this.player.unfreeze();
        }
      );
    });
  }

  private spawnLostTrack(): void {
    const cx = 24 * TILE;
    const cy = 74 * TILE;

    // ── Vertical light beam ──
    const beam = this.add.graphics().setDepth(3);
    beam.fillStyle(0x00ffff, 0.06);
    beam.fillRect(cx - 6, cy - 80, 12, 90);
    beam.fillStyle(0x00ffff, 0.12);
    beam.fillRect(cx - 3, cy - 80, 6, 90);
    beam.fillStyle(0xffffff, 0.08);
    beam.fillRect(cx - 1, cy - 80, 2, 90);
    this.tweens.add({ targets: beam, alpha: 0.3, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.lostTrackEffects.push(beam);

    // ── Layered ground glow ──
    const groundGlow = this.add.graphics().setDepth(3);
    groundGlow.fillStyle(0x8800ff, 0.08);
    groundGlow.fillCircle(cx, cy, 36);
    groundGlow.fillStyle(0x00ffff, 0.12);
    groundGlow.fillCircle(cx, cy, 24);
    groundGlow.fillStyle(0x00ffff, 0.18);
    groundGlow.fillCircle(cx, cy, 14);
    groundGlow.fillStyle(0xffffff, 0.1);
    groundGlow.fillCircle(cx, cy, 6);
    this.tweens.add({ targets: groundGlow, alpha: 0.4, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.lostTrackEffects.push(groundGlow);

    // ── Expanding pulse rings ──
    for (let i = 0; i < 3; i++) {
      const pulse = this.add.graphics().setDepth(4);
      pulse.lineStyle(1, 0x00ffff, 0.5);
      pulse.strokeCircle(0, 0, 10);
      pulse.setPosition(cx, cy);
      pulse.setScale(0.5);
      pulse.setAlpha(0.6);
      this.tweens.add({
        targets: pulse,
        scaleX: 3.5, scaleY: 3.5,
        alpha: 0,
        duration: 2400,
        repeat: -1,
        delay: i * 800,
        onRepeat: () => { pulse.setScale(0.5); pulse.setAlpha(0.6); },
      });
      this.lostTrackEffects.push(pulse);
    }

    // ── Music note particles ──
    const notes = ['♪', '♫', '♩', '♬', '♪', '♫'];
    for (let i = 0; i < notes.length; i++) {
      const note = this.add.text(cx, cy, notes[i], {
        fontFamily: 'serif',
        fontSize: '10px',
        color: ['#00ffff', '#cc88ff', '#ffdd44', '#88ffcc', '#ff88cc', '#aaccff'][i],
      }).setOrigin(0.5).setDepth(6).setAlpha(0);

      const startAngle = (Math.PI * 2 / notes.length) * i;
      const radius = 12 + (i % 3) * 5;

      this.tweens.add({
        targets: note,
        alpha: 0.9,
        duration: 300,
        delay: i * 350,
        onComplete: () => {
          // Spiral upward
          this.tweens.addCounter({
            from: 0, to: 1,
            duration: 3000 + i * 300,
            repeat: -1,
            onUpdate: (tween) => {
              const t = tween.getValue();
              const a = startAngle + t * Math.PI * 2;
              const r = radius + t * 8;
              note.setPosition(cx + Math.cos(a) * r, cy - t * 40);
              note.setAlpha(0.9 - t * 0.8);
              note.setScale(1 - t * 0.3);
            },
            onRepeat: () => { note.setAlpha(0.9); note.setScale(1); },
          });
        },
      });
      this.lostTrackEffects.push(note);
    }

    // ── Orbiting sparkles ──
    const orbCount = 8;
    for (let i = 0; i < orbCount; i++) {
      const sparkle = this.add.graphics().setDepth(6);
      const color = [0x00ffff, 0xcc44ff, 0xffdd00, 0x44ff88, 0xff88cc, 0x88ccff, 0xffffff, 0xcc88ff][i];
      sparkle.fillStyle(color, 0.9);
      sparkle.fillCircle(0, 0, 1.2);
      sparkle.fillStyle(0xffffff, 0.8);
      sparkle.fillCircle(0, 0, 0.5);

      const angle = (Math.PI * 2 / orbCount) * i;
      const radius = 16 + (i % 3) * 5;
      sparkle.setPosition(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);

      this.tweens.addCounter({
        from: 0, to: Math.PI * 2,
        duration: 2500 + i * 300,
        repeat: -1,
        onUpdate: (tween) => {
          const a = angle + tween.getValue();
          const vertOff = Math.sin(tween.getValue() * 2) * 3;
          sparkle.setPosition(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius + vertOff);
        },
      });
      this.tweens.add({ targets: sparkle, alpha: 0.15, duration: 300 + i * 80, yoyo: true, repeat: -1 });
      this.lostTrackEffects.push(sparkle);
    }

    // ── Rising light motes ──
    for (let i = 0; i < 6; i++) {
      const mote = this.add.graphics().setDepth(5);
      const moteColor = [0x00ffff, 0xcc88ff, 0xffcc44, 0x88ffcc, 0xff88cc, 0xaaddff][i];
      mote.fillStyle(moteColor, 0.7);
      mote.fillCircle(0, 0, 0.8);
      mote.fillStyle(0xffffff, 0.5);
      mote.fillCircle(0, 0, 0.3);
      const startX = cx + (Math.random() - 0.5) * 36;
      mote.setPosition(startX, cy + 8);

      this.tweens.add({
        targets: mote,
        y: cy - 45 - Math.random() * 20,
        x: startX + (Math.random() - 0.5) * 20,
        alpha: 0,
        duration: 2200 + Math.random() * 1200,
        repeat: -1,
        delay: i * 400,
        onRepeat: () => {
          const nx = cx + (Math.random() - 0.5) * 36;
          mote.setPosition(nx, cy + 8);
          mote.setAlpha(0.7);
        },
      });
      this.lostTrackEffects.push(mote);
    }

    // ── The Lost Track item itself ──
    this.lostTrackItem = this.add.sprite(cx, cy, 'item-lost-track').setDepth(7).setScale(0).setAlpha(0);
    this.tweens.add({ targets: this.lostTrackItem, alpha: 1, scaleX: 1.8, scaleY: 1.8, duration: 1000, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.lostTrackItem, y: cy - 10, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private collectLostTrack(): void {
    if (!this.lostTrackItem) return;
    const item = this.lostTrackItem;
    const cx = item.x;
    const cy = item.y;
    this.lostTrackItem = undefined;
    this.player.freeze();

    // ── Dramatic camera effects ──
    this.cameras.main.flash(1200, 0, 255, 255);
    this.cameras.main.shake(600, 0.008);

    // ── Burst of music notes flying outward ──
    const burstNotes = ['♪', '♫', '♩', '♬', '♪', '♫', '♩', '♬', '♪', '♫'];
    for (let i = 0; i < burstNotes.length; i++) {
      const angle = (Math.PI * 2 / burstNotes.length) * i;
      const note = this.add.text(cx, cy, burstNotes[i], {
        fontFamily: 'serif',
        fontSize: '12px',
        color: ['#00ffff', '#cc88ff', '#ffdd44', '#88ffcc', '#ff88cc'][i % 5],
      }).setOrigin(0.5).setDepth(10).setAlpha(1);

      this.tweens.add({
        targets: note,
        x: cx + Math.cos(angle) * 60,
        y: cy + Math.sin(angle) * 60 - 20,
        alpha: 0,
        scaleX: 2,
        scaleY: 2,
        duration: 800,
        ease: 'Power2',
        delay: i * 40,
        onComplete: () => note.destroy(),
      });
    }

    // ── Expanding white flash ring ──
    const flashRing = this.add.graphics().setDepth(9);
    flashRing.lineStyle(3, 0xffffff, 0.9);
    flashRing.strokeCircle(0, 0, 10);
    flashRing.setPosition(cx, cy);
    this.tweens.add({
      targets: flashRing,
      scaleX: 8, scaleY: 8,
      alpha: 0,
      duration: 700,
      ease: 'Power2',
      onComplete: () => flashRing.destroy(),
    });

    // ── Item scales up and fades ──
    this.tweens.add({
      targets: item,
      scaleX: 5, scaleY: 5,
      alpha: 0,
      duration: 700,
      ease: 'Power2',
      onComplete: () => item.destroy(),
    });

    // ── Fade out and destroy all ambient effects ──
    for (const fx of this.lostTrackEffects) {
      this.tweens.add({ targets: fx, alpha: 0, duration: 600, onComplete: () => fx.destroy() });
    }
    this.lostTrackEffects = [];

    this.time.delayedCall(500, () => {
      this.showDialog(
        [
          '...',
          'You feel it vibrate in your hands.',
          'The Lost Track.',
          'Every note that was stolen.',
          'Every silence that was forced.',
          'It is yours now.',
          'Play it loud.',
        ],
        () => {
          useGameStore.getState().unlockBonusSong();
          EventBus.emit(EVENTS.BONUS_SONG_UNLOCKED);
        }
      );
    });
  }

  private openGate(): void {
    this.gateOpen = true;
    useGameStore.getState().openGate();
    this.walls.getChildren().forEach((child) => {
      const img = child as Phaser.GameObjects.Image;
      if (img.texture?.key === 'tile-gate') {
        this.tweens.add({ targets: img, alpha: 0, duration: 400, onComplete: () => this.walls.remove(img, true, true) });
      }
    });
    EventBus.emit(EVENTS.GATE_OPEN);
    this.showDialog([
      'The Frequency Gate trembles.',
      'A low hum fills the air.',
      'Then — silence.',
      'The path to the Fading Path is open.',
    ]);
  }

  private handlePlayerDeath(): void {
    this.player.freeze();
    this.cameras.main.fade(1000, 0, 0, 0);
    this.time.delayedCall(1200, () => {
      useGameStore.getState().restoreHp(15);
      this.cameras.main.resetFX();
      this.player.unfreeze();
      this.battleActive = false;
    });
  }

  // ── Dialog system ─────────────────────────────────────────────────────────

  private showDialogOnce(key: string, lines: string[], onComplete?: () => void): void {
    if (this.shownOnce.has(key)) return;
    this.shownOnce.add(key);
    this.showDialog(lines, onComplete);
  }

  private createDialogBox(): void {
    const CAM_ZOOM = 2;
    const viewW = this.scale.width  / CAM_ZOOM;  // 320
    const boxW  = viewW - 4;                      // 316
    const boxH  = 48;

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0018, 0.95);
    bg.fillRoundedRect(0, 0, boxW, boxH, 2);
    bg.lineStyle(2, 0xffd700);
    bg.strokeRoundedRect(0, 0, boxW, boxH, 2);

    const text = this.add.text(8, 7, '', {
      fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#f0f0f0',
      wordWrap: { width: boxW - 20 },
      lineSpacing: 4,
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 0, fill: true },
    });

    const arrow = this.add.text(boxW - 14, boxH - 14, '▼', {
      fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffd700',
    });
    this.tweens.add({ targets: arrow, alpha: 0, duration: 500, yoyo: true, repeat: -1 });

    this.dialogBox = this.add.container(2, 0, [bg, text, arrow]);
    this.dialogBox.setDepth(200);
    this.dialogBox.setVisible(false);
    this.dialogBox.setData('text', text);
    this.dialogBox.setData('callback', null);

    const onAdvance = () => {
      if (!this.dialogActive) return;
      if (this.isTyping) {
        this.currentTypeTimer?.remove();
        this.currentTypeTimer = undefined;
        this.isTyping = false;
        (this.dialogBox!.getData('text') as Phaser.GameObjects.Text).setText(this.currentLine);
      } else {
        this.advanceDialog();
      }
    };

    this.input.on('pointerdown', onAdvance);
    const advanceKeys = ['SPACE','ENTER','Z','E','W','S','A','D','UP','DOWN','LEFT','RIGHT'];
    advanceKeys.forEach(k => this.input.keyboard?.on(`keydown-${k}`, onAdvance));
  }

  showDialog(lines: string[], onComplete?: () => void): void {
    if (!this.dialogBox || this.dialogActive) return;
    this.dialogActive = true;
    this.dialogQueue = [...lines];
    this.dialogBox.setData('callback', onComplete ?? null);
    this.dialogBox.setVisible(true);
    this.worldFrozen = true;
    this.advanceDialog();
  }

  private advanceDialog(): void {
    if (!this.dialogBox || this.isTyping) return;

    if (this.dialogQueue.length === 0) {
      this.dialogBox.setVisible(false);
      this.dialogActive = false;
      this.worldFrozen = false;
      EventBus.emit(EVENTS.DIALOG_CLEAR);
      const cb = this.dialogBox.getData('callback') as (() => void) | null;
      if (cb) { this.dialogBox.setData('callback', null); cb(); }
      return;
    }

    const line = this.dialogQueue.shift()!;
    this.currentLine = line;
    const textObj = this.dialogBox.getData('text') as Phaser.GameObjects.Text;
    textObj.setText('');
    this.isTyping = true;
    let charIndex = 0;
    this.currentTypeTimer = this.time.addEvent({
      delay: 28, repeat: line.length - 1,
      callback: () => {
        charIndex++;
        textObj.setText(line.slice(0, charIndex));
        if (charIndex >= line.length) { this.isTyping = false; this.currentTypeTimer = undefined; }
      },
    });
    EventBus.emit(EVENTS.DIALOG, line);
  }

  // ── Visual effects ────────────────────────────────────────────────────────

  private showLevelUpEffect(level: number): void {
    const { x, y } = this.player;
    const text = this.add.text(x, y - 20, `LEVEL ${level}!`, {
      fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#ffd700',
      stroke: '#000000', strokeThickness: 3,
    }).setDepth(20).setOrigin(0.5);
    this.tweens.add({ targets: text, y: y - 50, alpha: 0, duration: 1500, ease: 'Power2', onComplete: () => text.destroy() });
    this.cameras.main.flash(300, 255, 215, 0, false);
  }

  /**
   * Music-themed healing sequence:
   * 1. Keep world frozen (dialog just ended)
   * 2. Floating music notes rise from NPC
   * 3. Healing particles swirl around player
   * 4. HP restored with green flash
   * 5. Follow-up dialog
   */
  private playHealingMusic(
    npcSprite: Phaser.GameObjects.Sprite,
    healAmount: number,
    followUpLines: string[],
  ): void {
    // Keep world frozen through the sequence
    this.worldFrozen = true;

    const nX = npcSprite.x;
    const nY = npcSprite.y;
    const pX = this.player.x;
    const pY = this.player.y;
    const notes = ['♪', '♫', '♩', '♬', '♪', '♫'];

    // Phase 1: Music notes float up from NPC (staggered)
    notes.forEach((note, i) => {
      this.time.delayedCall(i * 220, () => {
        const offsetX = (Math.random() - 0.5) * 20;
        const noteText = this.add.text(nX + offsetX, nY - 8, note, {
          fontFamily: '"Press Start 2P"',
          fontSize: `${7 + Math.floor(Math.random() * 4)}px`,
          color: ['#ff88cc', '#88ffcc', '#88ccff', '#ffcc88', '#cc88ff', '#88ff88'][i],
        }).setDepth(20).setOrigin(0.5).setAlpha(0);

        // Fade in, float upward with gentle sway
        this.tweens.add({
          targets: noteText,
          alpha: 1,
          duration: 200,
        });
        this.tweens.add({
          targets: noteText,
          y: nY - 40 - Math.random() * 20,
          x: nX + offsetX + (Math.random() - 0.5) * 16,
          duration: 1000,
          ease: 'Sine.easeOut',
        });
        this.tweens.add({
          targets: noteText,
          alpha: 0,
          delay: 700,
          duration: 400,
          onComplete: () => noteText.destroy(),
        });
      });
    });

    // Phase 2: After 600ms, healing particles travel from NPC to player
    this.time.delayedCall(600, () => {
      for (let i = 0; i < 8; i++) {
        this.time.delayedCall(i * 80, () => {
          const particle = this.add.graphics().setDepth(19);
          const size = 2 + Math.random() * 2;
          const color = [0x40ff80, 0x80ffaa, 0xaaffcc, 0x40cc60][i % 4];
          particle.fillStyle(color, 0.9);
          particle.fillCircle(0, 0, size);
          particle.setPosition(nX, nY - 6);

          // Arc from NPC to player
          const midX = (nX + pX) / 2 + (Math.random() - 0.5) * 30;
          const midY = Math.min(nY, pY) - 20 - Math.random() * 15;

          this.tweens.addCounter({
            from: 0, to: 1,
            duration: 500 + Math.random() * 200,
            ease: 'Sine.easeInOut',
            onUpdate: (tween) => {
              const t = tween.getValue();
              // Quadratic bezier
              const x = (1-t)*(1-t)*nX + 2*(1-t)*t*midX + t*t*pX;
              const y = (1-t)*(1-t)*(nY-6) + 2*(1-t)*t*midY + t*t*pY;
              particle.setPosition(x, y);
            },
            onComplete: () => {
              particle.destroy();
            },
          });
        });
      }
    });

    // Phase 3: At 1400ms, heal flash + restore HP
    this.time.delayedCall(1400, () => {
      // Green glow ring around player
      const glow = this.add.graphics().setDepth(20);
      const glowState = { r: 4, alpha: 0.9 };
      this.time.addEvent({
        delay: 16, repeat: 20,
        callback: () => {
          glowState.r += 1.5;
          glowState.alpha = Math.max(0, 0.9 - glowState.r / 40);
          glow.clear();
          glow.lineStyle(2, 0x40ff80, glowState.alpha);
          glow.strokeCircle(pX, pY, glowState.r);
          glow.lineStyle(1, 0xaaffcc, glowState.alpha * 0.5);
          glow.strokeCircle(pX, pY, glowState.r * 0.6);
        },
      });
      this.time.delayedCall(350, () => glow.destroy());

      // Restore HP
      useGameStore.getState().restoreHp(healAmount);
      this.cameras.main.flash(250, 120, 255, 140, false);

      // HP RESTORED text
      const hpText = this.add.text(pX, pY - 18, 'HP RESTORED', {
        fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#40ff80',
        stroke: '#000000', strokeThickness: 3,
      }).setDepth(21).setOrigin(0.5).setScale(0.5);

      this.tweens.add({
        targets: hpText,
        scaleX: 1, scaleY: 1,
        duration: 200,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: hpText,
            y: pY - 40, alpha: 0,
            duration: 900, ease: 'Power2',
            onComplete: () => hpText.destroy(),
          });
        },
      });
    });

    // Phase 4: At 2000ms, show follow-up dialog
    this.time.delayedCall(2000, () => {
      this.showDialog(followUpLines);
    });
  }

  shutdown(): void {
    EventBus.off(EVENTS.BATTLE_END, this.onBattleEnd, this);
  }
}
