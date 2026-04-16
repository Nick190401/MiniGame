import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy, ENEMY_DEFINITIONS, BOSS_DEFINITION } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { MapBuilder } from '../utils/MapBuilder';
import { EventBus, EVENTS } from '../EventBus';
import { useGameStore } from '../../store/gameStore';

const TILE = 16;

type DialogEntry = { text: string; next?: DialogEntry };

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private enemies: Enemy[] = [];
  private boss?: Boss;
  private fragments: Phaser.GameObjects.Sprite[] = [];
  private lostTrackItem?: Phaser.GameObjects.Sprite;
  private npcSprite?: Phaser.GameObjects.Sprite;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private gateTile?: Phaser.GameObjects.Image;
  private gateOpen = false;

  // Dialog
  private dialogBox?: Phaser.GameObjects.Container;
  private dialogActive = false;
  private dialogQueue: string[] = [];

  // State
  private battleActive = false;
  private worldFrozen = false;

  // Boss area trigger
  private bossZoneRect = new Phaser.Geom.Rectangle(2 * TILE, 20 * TILE, 14 * TILE, 12 * TILE);
  private bossEncounterStarted = false;

  // Gate zone
  private gateZoneRect = new Phaser.Geom.Rectangle(7 * TILE, 19 * TILE, 4 * TILE, 3 * TILE);

  // Intro NPC zone
  private npcZoneRect = new Phaser.Geom.Rectangle(2 * TILE, 1 * TILE, 5 * TILE, 4 * TILE);
  private npcDialogShown = false;

  constructor() {
    super({ key: 'WorldScene' });
  }

  create(): void {
    // Launch UI overlay scene in parallel
    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }

    // Build map
    const mapResult = MapBuilder.build(this);
    this.walls = mapResult.walls;

    // Spawn player
    this.player = new Player(this, mapResult.spawnX, mapResult.spawnY);

    // Camera follows player
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(2);

    // Physics collider: player ↔ walls
    this.physics.add.collider(this.player, this.walls);

    // Spawn NPC
    this.spawnNPC(mapResult.npcPos.x, mapResult.npcPos.y);

    // Spawn enemies
    this.spawnEnemies(mapResult);

    // Spawn sound fragments
    this.spawnFragments(mapResult);

    // Overlap: player ↔ fragments
    this.physics.add.overlap(
      this.player,
      this.fragments as unknown as Phaser.GameObjects.GameObject[],
      (_player, fragment) => {
        this.collectFragment(fragment as Phaser.GameObjects.Sprite);
      }
    );

    // Listen for battle end
    EventBus.on(EVENTS.BATTLE_END, this.onBattleEnd, this);

    // Spawn boss (initially invisible until player enters arena)
    this.boss = new Boss(this, mapResult.bossPos.x, mapResult.bossPos.y);
    this.boss.setAlpha(0);

    // Dialog box
    this.createDialogBox();

    // Intro dialog after brief delay
    this.time.delayedCall(800, () => {
      this.showDialog([
        'Welcome to Echo Fields.',
        'Somewhere beyond the Void Gate...',
        '...lies the Lost Track.',
        'Defeat what stands in your way.',
        'Find it.',
      ]);
    });
  }

  update(_time: number, delta: number): void {
    if (this.worldFrozen || this.battleActive) return;

    this.player.update(delta);

    // NPC interaction zone
    if (!this.npcDialogShown) {
      const px = this.player.x;
      const py = this.player.y;
      if (this.npcZoneRect.contains(px, py)) {
        this.npcDialogShown = true;
        this.time.delayedCall(200, () => {
          this.showDialog([
            'Stranger...',
            'The Gatekeeper guards the silence.',
            'Grow stronger.',
            'Reach Level 3.',
            'Then the gate will yield.',
          ]);
        });
      }
    }

    // Gate zone check
    if (!this.gateOpen) {
      const px = this.player.x;
      const py = this.player.y;
      if (this.gateZoneRect.contains(px, py)) {
        const store = useGameStore.getState();
        if (store.level >= 3) {
          this.openGate();
        } else {
          this.showDialogOnce('gate-lock', [
            `Level ${store.level} — gate locked.`,
            'You need Level 3.',
            'Defeat more enemies.',
          ]);
        }
      }
    }

    // Boss zone check
    if (!this.bossEncounterStarted && this.gateOpen) {
      const px = this.player.x;
      const py = this.player.y;
      if (this.bossZoneRect.contains(px, py)) {
        this.startBossEncounter();
      }
    }

    // Lost track pickup
    if (this.lostTrackItem && this.lostTrackItem.active) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.lostTrackItem.x, this.lostTrackItem.y
      );
      if (dist < 24) {
        this.collectLostTrack();
      }
    }

    // Update boss aura position (if visible)
    if (this.boss && this.boss.active && this.boss.alpha > 0) {
      // handled inside Boss tween
    }

    // Enemy hover detection (for battle trigger)
    for (const enemy of this.enemies) {
      if (enemy.active && !enemy.defeated && !this.battleActive) {
        const dist = Phaser.Math.Distance.Between(
          this.player.x, this.player.y,
          enemy.x, enemy.y
        );
        if (dist < 20) {
          this.startEnemyBattle(enemy);
          break;
        }
      }
    }
  }

  // ── Spawning ──────────────────────────────────────────────────────────────

  private spawnNPC(x: number, y: number): void {
    this.npcSprite = this.add.sprite(x, y, 'npc-guide').setDepth(4).setScale(1);
    this.tweens.add({
      targets: this.npcSprite,
      y: y - 3,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Exclamation mark
    const excl = this.add.text(x, y - 16, '!', {
      fontFamily: '"Press Start 2P"',
      fontSize: '8px',
      color: '#ffd700',
    }).setOrigin(0.5).setDepth(6);

    this.tweens.add({
      targets: excl,
      alpha: 0,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });
  }

  private spawnEnemies(mapResult: ReturnType<typeof MapBuilder.build>): void {
    const positions = [
      mapResult.enemy1Pos,
      mapResult.enemy2Pos,
      mapResult.enemy3Pos,
    ];

    ENEMY_DEFINITIONS.forEach((data, i) => {
      const pos = positions[i];
      // Scale positions to match camera zoom-adjusted world
      const enemy = new Enemy(this, pos.x, pos.y, data);
      this.enemies.push(enemy);
    });
  }

  private spawnFragments(mapResult: ReturnType<typeof MapBuilder.build>): void {
    const positions = [
      mapResult.fragment1Pos,
      mapResult.fragment2Pos,
      mapResult.fragment3Pos,
    ];

    positions.forEach((pos) => {
      const frag = this.physics.add.sprite(pos.x, pos.y, 'item-fragment');
      frag.setDepth(4);
      frag.setScale(1);

      // Bob animation
      this.tweens.add({
        targets: frag,
        y: pos.y - 5,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Glow pulse (tint)
      this.tweens.add({
        targets: frag,
        alpha: 0.6,
        duration: 700,
        yoyo: true,
        repeat: -1,
      });

      this.fragments.push(frag);
    });
  }

  // ── Interactions ──────────────────────────────────────────────────────────

  private collectFragment(sprite: Phaser.GameObjects.Sprite): void {
    const idx = this.fragments.indexOf(sprite);
    if (idx !== -1) this.fragments.splice(idx, 1);

    // Pickup effect
    const pickup = this.add.text(sprite.x, sprite.y - 10, '+10 XP', {
      fontFamily: '"Press Start 2P"',
      fontSize: '6px',
      color: '#4080ff',
    }).setDepth(10).setOrigin(0.5);

    this.tweens.add({
      targets: pickup,
      y: sprite.y - 30,
      alpha: 0,
      duration: 800,
      onComplete: () => pickup.destroy(),
    });

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

  private startEnemyBattle(enemy: Enemy): void {
    if (this.battleActive || this.dialogActive) return;
    this.battleActive = true;

    this.player.freeze();

    // Brief flash before battle
    this.cameras.main.flash(200, 255, 255, 255);

    this.time.delayedCall(250, () => {
      this.scene.launch('BattleScene', {
        enemyData: enemy.enemyData,
        enemyRef: enemy,
        isBoss: false,
      });
      this.scene.pause();
    });
  }

  private startBossEncounter(): void {
    if (this.bossEncounterStarted || this.battleActive) return;
    this.bossEncounterStarted = true;
    this.battleActive = true;

    this.player.freeze();

    // Dramatic entrance
    this.cameras.main.shake(300, 0.008);

    this.showDialog(
      [
        'You feel it...',
        'The silence is heavy here.',
        'THE GATEKEEPER awakens.',
      ],
      () => {
        this.cameras.main.flash(400, 100, 0, 200);
        this.time.delayedCall(500, () => {
          this.scene.launch('BattleScene', {
            enemyData: BOSS_DEFINITION,
            isBoss: true,
          });
          this.scene.pause();
        });
      }
    );
  }

  private onBattleEnd = (result: { outcome: 'win' | 'lose'; enemyId: string; isBoss: boolean }) => {
    this.battleActive = false;
    this.scene.resume();

    if (result.outcome === 'lose') {
      this.handlePlayerDeath();
      return;
    }

    if (result.isBoss) {
      this.handleBossDefeated();
    } else {
      // Remove the defeated enemy from the world
      const defeated = this.enemies.find(e => e.enemyData.id === result.enemyId);
      if (defeated && !defeated.defeated) {
        defeated.defeat();
      }
      this.player.unfreeze();
    }
  };

  private handleBossDefeated(): void {
    useGameStore.getState().defeatBoss();
    EventBus.emit(EVENTS.BOSS_DEFEATED);

    this.cameras.main.flash(600, 255, 200, 0);

    this.time.delayedCall(800, () => {
      this.showDialog(
        [
          'The silence... shatters.',
          'A signal emerges from the void.',
          'Something glows in the darkness.',
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
    const bossPos = { x: 9 * TILE, y: 24 * TILE };
    this.lostTrackItem = this.add.sprite(bossPos.x, bossPos.y, 'item-lost-track');
    this.lostTrackItem.setDepth(5);
    this.lostTrackItem.setScale(1.2);

    // Dramatic appear
    this.lostTrackItem.setAlpha(0);
    this.tweens.add({
      targets: this.lostTrackItem,
      alpha: 1,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 600,
      ease: 'Back.easeOut',
    });

    // Float + spin tween
    this.tweens.add({
      targets: this.lostTrackItem,
      y: bossPos.y - 10,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Glow effect (pulsing bright)
    this.tweens.add({
      targets: this.lostTrackItem,
      alpha: 0.7,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Particle-like light circles
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 / 8) * i;
      const r = 30;
      const dot = this.add.graphics();
      dot.fillStyle(0x00ffff, 0.8);
      dot.fillCircle(0, 0, 3);
      dot.setPosition(
        bossPos.x + Math.cos(angle) * r,
        bossPos.y + Math.sin(angle) * r
      );
      dot.setDepth(4);
      this.tweens.add({
        targets: dot,
        x: bossPos.x + Math.cos(angle + Math.PI * 2) * r,
        y: bossPos.y + Math.sin(angle + Math.PI * 2) * r,
        duration: 3000,
        repeat: -1,
        ease: 'Linear',
      });
    }
  }

  private collectLostTrack(): void {
    if (!this.lostTrackItem) return;
    const item = this.lostTrackItem;
    this.lostTrackItem = undefined;

    this.player.freeze();

    // Collection effect
    this.cameras.main.flash(800, 0, 255, 255);
    this.cameras.main.shake(400, 0.006);

    this.tweens.add({
      targets: item,
      scaleX: 4,
      scaleY: 4,
      alpha: 0,
      duration: 600,
      ease: 'Power2',
      onComplete: () => item.destroy(),
    });

    this.time.delayedCall(400, () => {
      this.showDialog(
        [
          '...',
          'You feel it pulse in your hands.',
          'The Lost Track.',
          'It was here all along.',
          'Waiting in the silence.',
          'It\'s yours now.',
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

    // Find and remove gate tiles
    this.walls.getChildren().forEach((child) => {
      const img = child as Phaser.GameObjects.Image;
      if (img.texture?.key === 'tile-gate') {
        // Flash and remove
        this.tweens.add({
          targets: img,
          alpha: 0,
          duration: 400,
          onComplete: () => {
            this.walls.remove(img, true, true);
          },
        });
      }
    });

    EventBus.emit(EVENTS.GATE_OPEN);
    this.showDialog(['The gate opens...', 'Beyond lies the Void.']);
  }

  private handlePlayerDeath(): void {
    this.player.freeze();
    this.cameras.main.fade(1000, 0, 0, 0);
    this.time.delayedCall(1200, () => {
      // Restore some HP and respawn
      useGameStore.getState().restoreHp(15);
      this.cameras.main.resetFX();
      this.player.unfreeze();
      this.battleActive = false;
    });
  }

  // ── Dialog system ─────────────────────────────────────────────────────────

  private shownOnce: Set<string> = new Set();

  private showDialogOnce(key: string, lines: string[]): void {
    if (this.shownOnce.has(key)) return;
    this.shownOnce.add(key);
    this.showDialog(lines);
  }

  private createDialogBox(): void {
    const { width, height } = this.scale;
    const camW = width;
    const camH = height;

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0018, 0.92);
    bg.fillRect(0, 0, camW - 8, 60);
    bg.lineStyle(2, 0xffd700);
    bg.strokeRect(0, 0, camW - 8, 60);

    const text = this.add.text(10, 10, '', {
      fontFamily: '"Press Start 2P"',
      fontSize: '7px',
      color: '#f0f0f0',
      wordWrap: { width: camW - 30 },
    });

    const arrow = this.add.text(camW - 20, 46, '▼', {
      fontFamily: '"Press Start 2P"',
      fontSize: '7px',
      color: '#ffd700',
    });

    this.tweens.add({
      targets: arrow,
      alpha: 0,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    this.dialogBox = this.add.container(4, camH - 70, [bg, text, arrow]);
    this.dialogBox.setScrollFactor(0);
    this.dialogBox.setDepth(100);
    this.dialogBox.setVisible(false);
    this.dialogBox.setData('text', text);
    this.dialogBox.setData('queue', []);
    this.dialogBox.setData('callback', null);

    // Tap to advance
    this.input.on('pointerdown', () => {
      if (this.dialogActive) {
        this.advanceDialog();
      }
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.dialogActive) this.advanceDialog();
    });
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.dialogActive) this.advanceDialog();
    });
    this.input.keyboard?.on('keydown-Z', () => {
      if (this.dialogActive) this.advanceDialog();
    });
  }

  showDialog(lines: string[], onComplete?: () => void): void {
    if (!this.dialogBox) return;
    if (this.dialogActive) {
      // Queue it
      return;
    }

    this.dialogActive = true;
    this.dialogQueue = [...lines];
    this.dialogBox.setData('callback', onComplete ?? null);
    this.dialogBox.setVisible(true);
    this.worldFrozen = true;

    this.advanceDialog();
  }

  private advanceDialog(): void {
    if (!this.dialogBox) return;

    if (this.dialogQueue.length === 0) {
      this.dialogBox.setVisible(false);
      this.dialogActive = false;
      this.worldFrozen = false;
      EventBus.emit(EVENTS.DIALOG_CLEAR);

      const cb = this.dialogBox.getData('callback') as (() => void) | null;
      if (cb) {
        this.dialogBox.setData('callback', null);
        cb();
      }
      return;
    }

    const line = this.dialogQueue.shift()!;
    const textObj = this.dialogBox.getData('text') as Phaser.GameObjects.Text;

    // Typewriter effect
    let charIndex = 0;
    textObj.setText('');
    const fullText = line;

    const typeTimer = this.time.addEvent({
      delay: 30,
      repeat: fullText.length - 1,
      callback: () => {
        charIndex++;
        textObj.setText(fullText.slice(0, charIndex));
      },
    });

    // Allow skipping typewriter
    const skipHandler = () => {
      typeTimer.remove();
      textObj.setText(fullText);
      this.input.off('pointerdown', skipHandler);
    };
    this.input.once('pointerdown', skipHandler);

    EventBus.emit(EVENTS.DIALOG, line);
  }

  // ── Effects ───────────────────────────────────────────────────────────────

  private showLevelUpEffect(level: number): void {
    const { x, y } = this.player;

    const text = this.add.text(x, y - 20, `LEVEL ${level}!`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '8px',
      color: '#ffd700',
    }).setDepth(20).setOrigin(0.5);

    this.tweens.add({
      targets: text,
      y: y - 50,
      alpha: 0,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });

    // Brief gold flash
    this.cameras.main.flash(300, 255, 215, 0, false);
  }

  shutdown(): void {
    EventBus.off(EVENTS.BATTLE_END, this.onBattleEnd, this);
  }
}
