import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { ENEMY_DEFINITIONS, BOSS_DEFINITION } from '../entities/Enemy';
import type { EnemyData } from '../../types/game.types';
import { Boss } from '../entities/Boss';
import { BOSS_CORE_ROW, CAVE_START_ROW, CORE_START_ROW, MAP_COLS, MAP_ROWS, MapBuilder } from '../utils/MapBuilder';
import { EventBus, EVENTS, type DialogPayload } from '../EventBus';
import { useGameStore } from '../../store/gameStore';
import { consumeMobileAction } from '../input/MobileInput';

const TILE = 16;

interface NpcVisualConfig {
  texture: string;
  worldScale: number;
  portraitScale: number;
  originX: number;
  originY: number;
  accent: number;
}

const NPC_VISUALS: Record<'elder' | 'guard' | 'musician', NpcVisualConfig> = {
  elder: {
    texture: 'npc-elder-muse-v2', worldScale: 0.0297, portraitScale: 0.0463,
    originX: 618 / 1254, originY: 1152 / 1254, accent: 0x49dfbf,
  },
  guard: {
    texture: 'npc-junction-guard-v2', worldScale: 0.0343, portraitScale: 0.0536,
    originX: 627 / 1254, originY: 1084 / 1254, accent: 0xd7ff4a,
  },
  musician: {
    texture: 'npc-wandering-musician-v2', worldScale: 0.0321, portraitScale: 0.0502,
    originX: 622 / 1254, originY: 1114 / 1254, accent: 0xff6b3d,
  },
};

const DIALOG_SPEAKERS: Record<string, NpcVisualConfig> = {
  'Elder Muse': NPC_VISUALS.elder,
  'Junction Guard': NPC_VISUALS.guard,
  'Wandering Musician': NPC_VISUALS.musician,
};

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private boss?: Boss;
  private fragments: Phaser.GameObjects.Sprite[] = [];
  private lostTrackItem?: Phaser.GameObjects.Sprite;
  private lostTrackEffects: Phaser.GameObjects.GameObject[] = [];
  private runeGraphics: Phaser.GameObjects.GameObject[] = [];
  private caveSurfaceTiles: Phaser.GameObjects.Image[] = [];
  private caveCorruptionObjects: Phaser.GameObjects.GameObject[] = [];
  private purifiedCaveEffects: Phaser.GameObjects.GameObject[] = [];
  private cavePurified = false;
  private finaleOverlay?: Phaser.GameObjects.Container;

  // NPCs
  private npcSprite?: Phaser.GameObjects.Sprite;   // Elder Muse — Echo Village
  private npc2Sprite?: Phaser.GameObjects.Sprite;  // Junction Guard — Neon Junction
  private npc3Sprite?: Phaser.GameObjects.Sprite;  // Wandering Musician — Neon Junction
  private npcBlockers: Phaser.GameObjects.Zone[] = [];

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
  private activeDialogSpeaker?: string;

  // State
  private battleActive = false;
  private worldFrozen = false;

  // Pentagram center — boss triggers when player walks into the rune circle
  private readonly PENTAGRAM_X = 24 * TILE;
  private readonly PENTAGRAM_Y = BOSS_CORE_ROW * TILE;
  private readonly PENTAGRAM_TRIGGER_RADIUS = 4 * TILE; // ~64 px, just inside the outer ring
  private bossEncounterStarted = false;

  // Boss approach zone — final antechamber before the actual encounter.
  private bossApproachRect = new Phaser.Geom.Rectangle(0, 77 * TILE, MAP_COLS * TILE, 5 * TILE);
  private bossApproachStarted = false;
  private approachEffects: Phaser.GameObjects.GameObject[] = [];
  private _approachShakeTimer?: Phaser.Time.TimerEvent;

  // Gate zone — only the path columns directly against the gate (row 36)
  private gateZoneRect = new Phaser.Geom.Rectangle(18 * TILE, 36 * TILE, 6 * TILE, 1 * TILE);

  // Sign positions
  private signPos  = { x: 17 * TILE + 8, y:  9 * TILE + 8 };  // Echo Village
  private sign2Pos = { x: 17 * TILE + 8, y: 35 * TILE + 8 };  // Neon Junction

  // Input
  private interactKey!: Phaser.Input.Keyboard.Key;

  // Tall grass
  private tallGrassZones: Phaser.Geom.Rectangle[] = [];
  private tallGrassFrontTiles = new Map<string, Phaser.GameObjects.Image>();
  private wasInTallGrass = false;
  private grassVisualTimer = 0;
  private grassVisualStep = 0;
  private grassStepTimer = 0;
  private postBattleCooldown = 0;
  private readonly GRASS_STEP_MS = 450;
  private readonly ENCOUNTER_CHANCE = 0.22;

  // Spawn point for respawning after death
  private spawnX = 0;
  private spawnY = 0;

  // "show only once" guard for dialogs keyed by string
  private shownOnce: Set<string> = new Set();

  // Modern world presentation
  private playerShadow?: Phaser.GameObjects.Ellipse;
  private waterTiles: Phaser.GameObjects.Image[] = [];
  private zoneHud?: Phaser.GameObjects.Container;
  private zoneHudTitle?: Phaser.GameObjects.Text;
  private zoneHudMeta?: Phaser.GameObjects.Text;
  private zoneHudAccent?: Phaser.GameObjects.Graphics;
  private zoneWash?: Phaser.GameObjects.Graphics;
  private currentZoneIndex = -1;
  private footstepTimer = 0;

  constructor() {
    super({ key: 'WorldScene' });
  }

  create(): void {
    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');

    // Build map
    const mapResult = MapBuilder.build(this);
    this.walls = mapResult.walls;
    if (useGameStore.getState().gateOpen) {
      this.gateOpen = true;
      this.setGateOpenVisual(false);
    }

    // Spawn player
    this.spawnX = mapResult.spawnX;
    this.spawnY = mapResult.spawnY;
    this.player = new Player(this, this.spawnX, this.spawnY);

    this.createWorldAtmosphere();

    this.cameras.main.startFollow(this.player, true, 1, 1);
    this.cameras.main.setZoom(2);
    this.cameras.main.setRoundPixels(true);

    this.physics.add.collider(this.player, this.walls);

    // Sync sign positions from map
    this.signPos  = mapResult.signPos;
    this.sign2Pos = mapResult.sign2Pos;

    // Tall grass zones
    this.tallGrassZones = mapResult.tallGrassZones;
    this.tallGrassFrontTiles.clear();
    mapResult.tallGrassFrontTiles.forEach(tile => {
      this.tallGrassFrontTiles.set(`${tile.getData('row')}:${tile.getData('col')}`, tile);
    });

    // Rune graphics (destroyed after boss defeat)
    this.runeGraphics = mapResult.runeGraphics;
    this.caveSurfaceTiles = mapResult.caveSurfaceTiles;
    this.caveCorruptionObjects = mapResult.caveCorruptionObjects;

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
    if (!useGameStore.getState().bossDefeated) {
      this.boss = new Boss(this, mapResult.bossPos.x, mapResult.bossPos.y);
      this.boss.setAlpha(0);
    } else {
      this.bossEncounterStarted = true;
      this.applyPurifiedCaveInstant();
      if (!useGameStore.getState().bonusSongUnlocked) this.spawnLostTrack(false);
    }

    EventBus.on(EVENTS.BATTLE_END, this.onBattleEnd, this);
    EventBus.on(EVENTS.RESPAWN, this.onRespawn, this);
    EventBus.on(EVENTS.ZONE_UI_REQUEST, this.onZoneUiRequest, this);

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
      this.dialogBox.setPosition(wv.x + 4, wv.y + wv.height - 76);
    }

    const mobileAction = consumeMobileAction();
    if (mobileAction && this.dialogActive) {
      this.handleDialogAdvance();
      (this.player?.body as Phaser.Physics.Arcade.Body | undefined)?.setVelocity(0, 0);
      return;
    }

    if (this.worldFrozen || this.battleActive) {
      (this.player?.body as Phaser.Physics.Arcade.Body | undefined)?.setVelocity(0, 0);
      return;
    }

    this.player.update(delta);
    this.updateWorldPresentation(delta);

    // ── NPC proximity interactions ─────────────────────────────────────────
    const interactionRequested = mobileAction || Phaser.Input.Keyboard.JustDown(this.interactKey);
    this.checkNpcProximity(interactionRequested);

    // ── Sign proximity (E to read) ─────────────────────────────────────────
    if (!this.dialogActive && interactionRequested) {
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

    // ── Boss approach zone — pre-encounter tension ───────────────────────
    if (!this.bossApproachStarted && this.gateOpen &&
        this.bossApproachRect.contains(this.player.x, this.player.y)) {
      this.startBossApproach();
    }

    // ── Boss zone — triggers only when player steps into the rune circle ──
    if (!this.bossEncounterStarted && this.gateOpen) {
      const distToPentagram = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, this.PENTAGRAM_X, this.PENTAGRAM_Y
      );
      if (distToPentagram < this.PENTAGRAM_TRIGGER_RADIUS) {
        this.startBossEncounter();
      }
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
    const inGrass = this.player.isMoving() && this.isPlayerInTallGrass();
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

  private createWorldAtmosphere(): void {
    const viewW = this.scale.width;
    const viewH = this.scale.height;

    this.playerShadow = this.add.ellipse(this.player.x, this.player.y + 1.5, 14, 5, 0x07100c, 0.34);
    this.playerShadow.setDepth(4);

    this.waterTiles = this.children.getChildren().filter(
      child => child instanceof Phaser.GameObjects.Image && child.name === 'water-tile'
    ) as Phaser.GameObjects.Image[];

    let waterPhase = 0;
    this.time.addEvent({
      delay: 340,
      loop: true,
      callback: () => {
        waterPhase++;
        this.waterTiles.forEach((water, index) => {
          const shimmer = (index + waterPhase) % 4;
          water.setAlpha(shimmer === 0 ? 0.88 : shimmer === 1 ? 0.95 : 1);
        });
      },
    });

    // Slow luminous pollen gives the open world depth without hiding the pixel art.
    for (let index = 0; index < 34; index++) {
      const mote = this.add.graphics().setDepth(3);
      const color = index % 7 === 0 ? 0x49dfbf : index % 5 === 0 ? 0xff6b3d : 0xd7ff4a;
      mote.fillStyle(color, 0.26);
      mote.fillRect(0, 0, index % 9 === 0 ? 2 : 1, index % 9 === 0 ? 2 : 1);
      const startX = 2 * TILE + Math.random() * 44 * TILE;
      const startY = 2 * TILE + Math.random() * 49 * TILE;
      mote.setPosition(startX, startY);
      this.tweens.add({
        targets: mote,
        x: startX + Phaser.Math.Between(-24, 24),
        y: startY - Phaser.Math.Between(18, 46),
        alpha: { from: 0.08, to: 0.42 },
        duration: 3600 + Math.random() * 3400,
        delay: Math.random() * 2400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    const vignette = this.add.graphics().setDepth(44).setScrollFactor(0);
    vignette.fillGradientStyle(0x050908, 0x050908, 0x050908, 0x050908, 0.34, 0.34, 0, 0);
    vignette.fillRect(0, 0, viewW, 56);
    vignette.fillGradientStyle(0x050908, 0x050908, 0x050908, 0x050908, 0, 0, 0.3, 0.3);
    vignette.fillRect(0, viewH - 72, viewW, 72);
    vignette.fillGradientStyle(0x050908, 0x050908, 0x050908, 0x050908, 0.2, 0, 0.2, 0);
    vignette.fillRect(0, 0, 34, viewH);
    vignette.fillGradientStyle(0x050908, 0x050908, 0x050908, 0x050908, 0, 0.2, 0, 0.2);
    vignette.fillRect(viewW - 34, 0, 34, viewH);

    this.zoneWash = this.add.graphics().setDepth(43).setScrollFactor(0);

    const panel = this.add.graphics();
    panel.fillStyle(0x050908, 0.84);
    panel.fillRect(0, 0, 148, 39);
    panel.lineStyle(1, 0xd7ff4a, 0.2);
    panel.strokeRect(0, 0, 148, 39);
    this.zoneHudAccent = this.add.graphics();
    this.zoneHudTitle = this.add.text(12, 7, '', {
      fontFamily: 'Syne', fontStyle: 'bold', fontSize: '9px', color: '#eef5e9',
    });
    this.zoneHudMeta = this.add.text(12, 23, '', {
      fontFamily: 'DM Mono', fontSize: '5px', color: '#718078', letterSpacing: 1,
    });
    this.zoneHud = this.add.container(viewW - 166, 20, [panel, this.zoneHudAccent, this.zoneHudTitle, this.zoneHudMeta]);
    this.zoneHud.setDepth(46).setScrollFactor(0).setAlpha(0).setVisible(false);

    this.updateZonePresentation(true);
  }

  private updateWorldPresentation(delta: number): void {
    // Sort against every grass tuft's foot line. Only grass in front of the
    // player's feet can overlap the sprite; rows behind can no longer hide the head.
    this.player.setDepth(5 + this.player.y / 10000);

    if (this.playerShadow) {
      this.playerShadow.setPosition(this.player.x, this.player.y + 1.5);
      this.playerShadow.setScale(this.player.isMoving() ? 1.08 : 1);
      this.playerShadow.setAlpha(this.player.y >= 54 * TILE ? 0.48 : 0.34);
    }

    this.footstepTimer += delta;
    if (this.player.isMoving() && this.footstepTimer >= 150) {
      this.footstepTimer = 0;
      const dust = this.add.graphics().setDepth(4);
      const inCave = this.player.y >= 52 * TILE;
      dust.fillStyle(inCave ? 0x49dfbf : 0xd2bd80, inCave ? 0.35 : 0.32);
      dust.fillRect(-3, 0, 2, 1);
      dust.fillRect(2, 1, 1, 1);
      dust.setPosition(this.player.x, this.player.y + 1.5);
      this.tweens.add({
        targets: dust,
        x: dust.x + Phaser.Math.Between(-4, 4),
        y: dust.y + 3,
        alpha: 0,
        scaleX: 1.8,
        duration: 360,
        onComplete: () => dust.destroy(),
      });
    }

    this.updateTallGrassPresentation(delta);
    this.updateZonePresentation(false);
  }

  private updateTallGrassPresentation(delta: number): void {
    const isInGrass = this.isPlayerInTallGrass();

    if (!isInGrass) {
      this.wasInTallGrass = false;
      this.grassVisualTimer = 0;
      return;
    }

    if (!this.wasInTallGrass) {
      this.grassVisualStep++;
      this.bendGrassAroundPlayer(true);
      this.spawnGrassRustle(6);
      this.grassVisualTimer = 0;
    }

    if (this.player.isMoving()) {
      this.grassVisualTimer += delta;
      if (this.grassVisualTimer >= 135) {
        this.grassVisualTimer = 0;
        this.grassVisualStep++;
        this.bendGrassAroundPlayer(false);
        if (this.grassVisualStep % 2 === 0) this.spawnGrassRustle(2);
      }
    } else {
      this.grassVisualTimer = Math.min(this.grassVisualTimer, 90);
    }

    this.wasInTallGrass = true;
  }

  private isPlayerInTallGrass(): boolean {
    if (!this.tallGrassZones.some(zone => zone.contains(this.player.x, this.player.y))) return false;
    const row = Math.floor(this.player.y / TILE);
    const col = Math.floor(this.player.x / TILE);
    return this.tallGrassFrontTiles.has(`${row}:${col}`);
  }

  private bendGrassAroundPlayer(entering: boolean): void {
    const row = Math.floor(this.player.y / TILE);
    const col = Math.floor(this.player.x / TILE);
    const direction = this.player.getDirection();
    const strength = entering ? 1.25 : 1;

    [-1, 0, 1].forEach(offset => {
      const tile = this.tallGrassFrontTiles.get(`${row}:${col + offset}`);
      if (!tile?.active) return;

      let bend: number;
      if (direction === 'left') bend = -9;
      else if (direction === 'right') bend = 9;
      else if (offset < 0) bend = -7;
      else if (offset > 0) bend = 7;
      else bend = this.grassVisualStep % 2 === 0 ? -6 : 6;

      bend *= strength * (offset === 0 ? 1 : 0.62);
      this.tweens.killTweensOf(tile);
      tile.setAngle(0).setScale(1);
      this.tweens.add({
        targets: tile,
        angle: bend,
        scaleX: offset === 0 ? 1.08 : 1.04,
        scaleY: entering && offset === 0 ? 0.82 : 0.9,
        duration: 55,
        hold: 25,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => tile.setAngle(0).setScale(1),
      });
    });
  }

  private spawnGrassRustle(count: number): void {
    const colors = [0x9ab568, 0x769653, 0x4f713e];
    for (let index = 0; index < count; index++) {
      const side = index % 2 === 0 ? -1 : 1;
      const leaf = this.add.graphics().setName('grass-rustle').setDepth(this.player.depth + 0.012);
      leaf.fillStyle(colors[(this.grassVisualStep + index) % colors.length], 0.9);
      leaf.fillRect(-1, -2, index % 3 === 0 ? 2 : 1, index % 3 === 0 ? 2 : 3);
      leaf.setPosition(
        this.player.x + side * Phaser.Math.Between(3, 7),
        this.player.y - Phaser.Math.Between(2, 7),
      );
      leaf.setAngle(side * Phaser.Math.Between(12, 28));
      this.tweens.add({
        targets: leaf,
        x: leaf.x + side * Phaser.Math.Between(5, 10),
        y: leaf.y - Phaser.Math.Between(4, 9),
        angle: leaf.angle + side * Phaser.Math.Between(35, 80),
        alpha: 0,
        duration: Phaser.Math.Between(240, 360),
        ease: 'Quad.easeOut',
        onComplete: () => leaf.destroy(),
      });
    }
  }

  private updateZonePresentation(force: boolean): void {
    if (!this.player || !this.zoneHud || !this.zoneHudTitle || !this.zoneHudMeta || !this.zoneHudAccent || !this.zoneWash) return;
    const row = Math.floor(this.player.y / TILE);
    const zoneIndex = row < 13 ? 0 : row < 26 ? 1 : row < 39 ? 2 : row < CAVE_START_ROW ? 3 : row < CORE_START_ROW ? 4 : 5;
    if (!force && zoneIndex === this.currentZoneIndex) return;
    this.currentZoneIndex = zoneIndex;

    const zones = [
      { title: 'Echo Village', meta: 'ORIGIN // OPEN SIGNAL', accent: 0xd7ff4a, wash: 0x5e7848, alpha: 0.025 },
      { title: 'Signal Path', meta: 'WILD BAND // CH. 02', accent: 0x9ebd6a, wash: 0x4f6b42, alpha: 0.035 },
      { title: 'Neon Junction', meta: 'RELAY DISTRICT // CH. 03', accent: 0x49dfbf, wash: 0x315b55, alpha: 0.045 },
      { title: 'Fading Path', meta: 'WEAK SIGNAL // CH. 04', accent: 0x8da662, wash: 0x263b2d, alpha: 0.07 },
      this.cavePurified
        ? { title: 'Resonant Cave', meta: 'SIGNAL RESTORED // CH. 05', accent: 0xd7ff4a, wash: 0x315b45, alpha: 0.065 }
        : { title: 'Void Cave', meta: 'NO CARRIER // CH. 05', accent: 0x49dfbf, wash: 0x142f31, alpha: 0.09 },
      this.cavePurified
        ? { title: 'The Living Core', meta: 'MASTER FREQUENCY // CLEAN', accent: 0x49dfbf, wash: 0x244d3b, alpha: 0.07 }
        : { title: 'The Core', meta: 'TERMINAL FREQUENCY', accent: 0xff6b3d, wash: 0x351612, alpha: 0.12 },
    ];
    const zone = zones[zoneIndex];
    EventBus.emit(EVENTS.ZONE_UI_STATE, {
      title: zone.title,
      meta: zone.meta,
      accent: `#${zone.accent.toString(16).padStart(6, '0')}`,
    });
    this.zoneHudTitle.setText(zone.title.toUpperCase()).setColor(`#${zone.accent.toString(16).padStart(6, '0')}`);
    this.zoneHudMeta.setText(zone.meta);
    this.zoneHudAccent.clear();
    this.zoneHudAccent.fillStyle(zone.accent, 1);
    this.zoneHudAccent.fillRect(0, 0, 3, 39);

    this.zoneWash.clear();
    this.zoneWash.fillStyle(zone.wash, zone.alpha);
    this.zoneWash.fillRect(0, 0, this.scale.width, this.scale.height);

    this.tweens.killTweensOf(this.zoneHud);
    this.zoneHud.setPosition(this.scale.width - 154, 20).setAlpha(0);
    this.tweens.add({
      targets: this.zoneHud,
      x: this.scale.width - 166,
      alpha: 1,
      duration: 420,
      hold: 1800,
      yoyo: true,
      ease: 'Cubic.easeOut',
    });
  }

  private checkNpcProximity(interactionRequested: boolean): void {
    const px = this.player.x;
    const py = this.player.y;

    // NPC 1 — Elder Muse
    const d1 = this.npcSprite
      ? Phaser.Math.Distance.Between(px, py, this.npcSprite.x, this.npcSprite.y)
      : 999;
    const near1 = d1 < 30;
    this.npcInteractLabel?.setVisible(near1 && !this.dialogActive);
    if (near1 && !this.dialogActive && interactionRequested) {
      this.triggerNpc1();
    }

    // NPC 2 — Junction Guard
    const d2 = this.npc2Sprite
      ? Phaser.Math.Distance.Between(px, py, this.npc2Sprite.x, this.npc2Sprite.y)
      : 999;
    const near2 = d2 < 30;
    this.npc2InteractLabel?.setVisible(near2 && !this.dialogActive);
    if (near2 && !this.dialogActive && interactionRequested) {
      this.triggerNpc2();
    }

    // NPC 3 — Wandering Musician
    const d3 = this.npc3Sprite
      ? Phaser.Math.Distance.Between(px, py, this.npc3Sprite.x, this.npc3Sprite.y)
      : 999;
    const near3 = d3 < 30;
    this.npc3InteractLabel?.setVisible(near3 && !this.dialogActive);
    if (near3 && !this.dialogActive && interactionRequested) {
      this.triggerNpc3();
    }
  }

  // ── Spawning ──────────────────────────────────────────────────────────────

  private createInteractLabel(x: number, y: number): Phaser.GameObjects.Container {
    const bg = this.add.graphics();
    bg.fillStyle(0x050a08, 0.94);
    bg.fillRoundedRect(-9, -5, 18, 10, 2);
    bg.lineStyle(1, 0xd7ff4a, 1);
    bg.strokeRoundedRect(-9, -5, 18, 10, 2);

    // Draw the key glyph as geometry so it stays unambiguous under pixel scaling.
    const glyph = this.add.graphics();
    glyph.fillStyle(0xd7ff4a, 1);
    glyph.fillRect(-3, -4, 2, 8);
    glyph.fillRect(-1, -4, 5, 2);
    glyph.fillRect(-1, -1, 4, 2);
    glyph.fillRect(-1, 2, 5, 2);

    const container = this.add.container(x, y - 40, [bg, glyph]);
    container.setDepth(10).setVisible(false);

    this.tweens.add({ targets: container, y: y - 43, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    return container;
  }

  private createNpcVisual(
    x: number,
    y: number,
    visual: NpcVisualConfig,
  ): Phaser.GameObjects.Sprite {
    this.add.ellipse(x, y + 1, 18, 5, 0x07100c, 0.24).setDepth(3);
    const sprite = this.add.sprite(x, y, visual.texture)
      .setDepth(4)
      .setOrigin(visual.originX, visual.originY)
      .setScale(visual.worldScale);
    sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.createNpcBlocker(x, y);
    return sprite;
  }

  private createNpcBlocker(x: number, y: number): void {
    // Keep collision close to the feet instead of inheriting the PNG's large
    // transparent canvas, so approaching an NPC still feels natural.
    const blocker = this.add.zone(x, y - 4, 15, 9).setName('npc-blocker');
    this.physics.add.existing(blocker, true);
    this.physics.add.collider(this.player, blocker);
    this.npcBlockers.push(blocker);
  }

  private spawnNPC(x: number, y: number, _textureKey: string, _labelField: string): void {
    this.npcSprite = this.createNpcVisual(x, y, NPC_VISUALS.elder);
    this.npcInteractLabel = this.createInteractLabel(x, y);
  }

  private spawnNPC2(x: number, y: number): void {
    this.npc2Sprite = this.createNpcVisual(x, y, NPC_VISUALS.guard);
    this.npc2InteractLabel = this.createInteractLabel(x, y);
  }

  private spawnNPC3(x: number, y: number): void {
    this.npc3Sprite = this.createNpcVisual(x, y, NPC_VISUALS.musician);
    this.npc3InteractLabel = this.createInteractLabel(x, y);
  }

  private spawnFragments(mapResult: ReturnType<typeof MapBuilder.build>): void {
    const positions = [mapResult.fragment1Pos, mapResult.fragment2Pos, mapResult.fragment3Pos];
    positions.forEach((pos) => {
      // Ground glow beneath (visible through grass) — draw at (0,0) so tweens work from center
      const glow = this.add.graphics().setDepth(9);
      glow.setPosition(pos.x, pos.y);
      glow.fillStyle(0x49dfbf, 0.12);
      glow.fillCircle(0, 0, 15);
      glow.fillStyle(0xd7ff4a, 0.14);
      glow.fillCircle(0, 0, 9);
      this.tweens.add({ targets: glow, alpha: 0.34, duration: 920, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

      // Pulsing ring — draw centered at (0,0) so scale works from center
      const ring = this.add.graphics().setDepth(9);
      ring.setPosition(pos.x, pos.y);
      ring.lineStyle(1, 0x49dfbf, 0.42);
      ring.strokeCircle(0, 0, 13);
      ring.lineStyle(1, 0xd7ff4a, 0.22);
      ring.strokeCircle(0, 0, 9);
      this.tweens.add({
        targets: ring, alpha: 0, scaleX: 1.8, scaleY: 1.8,
        duration: 1800, repeat: -1,
        onRepeat: () => { ring.setAlpha(0.4); ring.setScale(1); },
      });

      // Two orbiting signal pips make the object read as an active audio source.
      const orbit = this.add.graphics().setDepth(10).setPosition(pos.x, pos.y);
      orbit.fillStyle(0xd7ff4a, 0.9); orbit.fillRect(-16, -1, 2, 2);
      orbit.fillStyle(0xff6b3d, 0.85); orbit.fillRect(14, -1, 2, 2);
      this.tweens.add({ targets: orbit, angle: 360, duration: 2600, repeat: -1, ease: 'Linear' });

      // Vinyl token — high depth so it remains visible above tall grass.
      const frag = this.physics.add.sprite(pos.x, pos.y, 'item-fragment').setDepth(10).setScale(1.08);
      frag.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.tweens.add({ targets: frag, y: pos.y - 5, duration: 1250, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

      // Store glow refs on the sprite for cleanup
      (frag as any)._glowFx = [glow, ring, orbit];

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

    const cx = sprite.x;
    const cy = sprite.y;
    this.tweens.killTweensOf(sprite);

    // Destroy glow effects
    const glowFx = (sprite as any)._glowFx as Phaser.GameObjects.GameObject[] | undefined;
    if (glowFx) {
      glowFx.forEach(fx => { this.tweens.add({ targets: fx, alpha: 0, duration: 300, onComplete: () => fx.destroy() }); });
    }

    // Vinyl grooves ripple out like a struck beat.
    const flash = this.add.graphics().setDepth(12).setPosition(cx, cy);
    flash.fillStyle(0x49dfbf, 0.2);
    flash.fillCircle(0, 0, 13);
    flash.lineStyle(1, 0xd7ff4a, 0.82);
    flash.strokeCircle(0, 0, 7);
    flash.lineStyle(1, 0x49dfbf, 0.58);
    flash.strokeCircle(0, 0, 12);
    flash.fillStyle(0xff6b3d, 0.9);
    flash.fillCircle(0, 0, 2);
    this.tweens.add({
      targets: flash, alpha: 0, scaleX: 2.2, scaleY: 2.2,
      duration: 420, ease: 'Quad.easeOut', onComplete: () => flash.destroy(),
    });

    // Short equalizer bars shoot out from the beat.
    const sparkColors = [0x49dfbf, 0xd7ff4a, 0xff6b3d];
    for (let i = 0; i < 8; i++) {
      const spark = this.add.graphics().setDepth(12);
      spark.fillStyle(sparkColors[i % sparkColors.length]);
      spark.fillRect(-1, -2, i % 2 === 0 ? 2 : 1, i % 2 === 0 ? 4 : 3);
      spark.setPosition(cx, cy);
      const angle = (i / 8) * Math.PI * 2;
      this.tweens.add({
        targets: spark,
        x: cx + Math.cos(angle) * 21, y: cy + Math.sin(angle) * 21,
        angle: i % 2 === 0 ? 70 : -70,
        alpha: 0, duration: 420, ease: 'Quad.easeOut',
        onComplete: () => spark.destroy(),
      });
    }

    // The record expands once like a struck beat, then dissolves.
    this.tweens.add({
      targets: sprite, scaleX: 3, scaleY: 3, alpha: 0,
      duration: 300, ease: 'Quad.easeOut',
      onComplete: () => sprite.destroy(),
    });

    // Keep the pickup wording aligned with the HUD's music-themed XP name.
    const pickup = this.add.text(cx, cy - 10, '+10 RESONANCE', {
      fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#d7ff4a',
      stroke: '#000000', strokeThickness: 2,
    }).setDepth(12).setOrigin(0.5).setScale(0.42).setVisible(false);
    EventBus.emit(EVENTS.UI_NOTICE, {
      eyebrow: 'ARCHIVE PICKUP // RESONANCE',
      title: '+10 resonance',
      detail: 'A sound fragment was added to your channel.',
      accent: '#d7ff4a',
      tone: 'success',
      duration: 1500,
    });
    this.tweens.add({
      targets: pickup, scaleX: 0.82, scaleY: 0.82, duration: 120, ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({ targets: pickup, y: cy - 30, alpha: 0, duration: 700, onComplete: () => pickup.destroy() });
      },
    });

    // Notes rise on slightly offset beats to reinforce the music connection.
    [
      { glyph: '\u266A', x: cx - 9, color: '#49dfbf', delay: 0 },
      { glyph: '\u266B', x: cx + 9, color: '#d7ff4a', delay: 90 },
    ].forEach(({ glyph, x, color, delay }) => {
      const note = this.add.text(x, cy, glyph, {
        fontFamily: 'serif', fontSize: '10px', color,
      }).setDepth(12).setOrigin(0.5).setAlpha(0.9);
      this.tweens.add({
        targets: note,
        x: x + (x < cx ? -4 : 4), y: cy - 27, alpha: 0,
        delay, duration: 650, ease: 'Quad.easeOut',
        onComplete: () => note.destroy(),
      });
    });

    const store = useGameStore.getState();
    const prevLevel = store.level;
    store.addXp(10);
    EventBus.emit(EVENTS.XP_GAINED, 10);
    if (store.level > prevLevel) {
      EventBus.emit(EVENTS.LEVEL_UP, store.level);
      this.showLevelUpEffect(store.level);
    }
  }

  public forceEncounter(enemyId: string): void {
    const def = ENEMY_DEFINITIONS.find(e => e.id === enemyId) ?? ENEMY_DEFINITIONS[0];
    this.startRandomEncounter(def);
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

  private startBossApproach(): void {
    this.bossApproachStarted = true;

    // Subtle dark vignette that fades in
    const vignette = this.add.graphics().setDepth(50).setScrollFactor(0);
    vignette.fillStyle(0x000000, 0.0);
    vignette.fillRect(0, 0, this.scale.width, this.scale.height);
    this.tweens.add({ targets: vignette, alpha: 0.18, duration: 3000, ease: 'Sine.easeIn' });
    this.approachEffects.push(vignette);

    // Periodic low-magnitude camera tremors
    this._approachShakeTimer = this.time.addEvent({
      delay: 4000,
      repeat: -1,
      callback: () => { if (!this.bossEncounterStarted) this.cameras.main.shake(600, 0.0015); },
    });

    // 12 red motes rising from the arena floor
    for (let i = 0; i < 12; i++) {
      this.time.delayedCall(i * 400, () => {
        const mote = this.add.graphics().setDepth(5);
        mote.fillStyle(0x880011, 0.5);
        mote.fillCircle(0, 0, 1.5);
        const sx = 8 * TILE + Math.random() * 32 * TILE;
        const sy = 91 * TILE;
        mote.setPosition(sx, sy);
        this.tweens.add({
          targets: mote,
          y: sy - 60 - Math.random() * 40,
          alpha: 0,
          duration: 2500 + Math.random() * 1500,
          repeat: -1,
          onRepeat: () => {
            mote.setPosition(8 * TILE + Math.random() * 32 * TILE, 91 * TILE);
            mote.setAlpha(0.5);
          },
        });
        this.approachEffects.push(mote);
      });
    }
  }

  private startBossEncounter(): void {
    if (this.bossEncounterStarted || this.battleActive) return;
    this.bossEncounterStarted = true;
    this.battleActive = true;
    this.player.freeze();

    // Heavy shake + brief zoom pulse
    this.cameras.main.shake(600, 0.012);
    this.tweens.add({
      targets: this.cameras.main,
      zoom: 2.4,
      duration: 800,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.tweens.add({ targets: this.cameras.main, zoom: 2.0, duration: 400, ease: 'Sine.easeOut' });
      },
    });

    // Red screen tint overlay (fixed to camera)
    const tint = this.add.graphics().setDepth(60).setScrollFactor(0);
    tint.fillStyle(0x440000, 0.0);
    tint.fillRect(0, 0, this.scale.width, this.scale.height);
    this.tweens.add({ targets: tint, alpha: 0.22, duration: 1000, ease: 'Sine.easeIn' });

    // Boss fades in with a short delay
    this.time.delayedCall(300, () => { this.boss?.setAlpha(1); });

    this.time.delayedCall(800, () => {
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
    });
  }

  private onBattleEnd = (result: { outcome: 'win' | 'lose'; isBoss: boolean }) => {
    this.battleActive = false;
    this.scene.resume();

    if (result.outcome === 'lose') {
      // Reset boss encounter flag so the player can retry
      if (result.isBoss) {
        this.bossEncounterStarted = false;
      }
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
    this.player.freeze();
    this._approachShakeTimer?.destroy();
    this._approachShakeTimer = undefined;
    this.approachEffects.forEach(effect => {
      if (!effect.active) return;
      this.tweens.killTweensOf(effect);
      this.tweens.add({ targets: effect, alpha: 0, duration: 420, onComplete: () => effect.destroy() });
    });
    this.approachEffects = [];

    if (this.boss) {
      this.boss.destroy();
      this.boss = undefined;
    }

    this.playCavePurification(() => {
      this.showDialog(
        [
          'The Gatekeeper breaks into pure frequency.',
          'A living wave races through every passage.',
          'Stone warms. Crystals answer. The silence lets go.',
          'At the heart of the restored cave, a master recording takes shape...',
          'THE LOST TRACK.',
          'Approach the record and reclaim the final sound.',
        ],
        () => {
          this.spawnLostTrack(true);
          this.player.unfreeze();
        }
      );
    });
  }

  private playCavePurification(onComplete: () => void): void {
    if (this.cavePurified) {
      onComplete();
      return;
    }
    this.cavePurified = true;

    const cx = this.PENTAGRAM_X;
    const cy = this.PENTAGRAM_Y;
    const worldWidth = MAP_COLS * TILE;
    const caveHeight = (MAP_ROWS - CAVE_START_ROW) * TILE;

    this.cameras.main.flash(280, 215, 255, 116, false);
    this.cameras.main.shake(760, 0.006);
    this.tweens.add({
      targets: this.cameras.main,
      zoom: 1.62,
      duration: 900,
      ease: 'Cubic.easeOut',
    });

    const backplate = this.add.graphics().setDepth(-9).setAlpha(0);
    backplate.fillGradientStyle(0x244a3b, 0x244a3b, 0x152f28, 0x152f28, 1, 1, 1, 1);
    backplate.fillRect(0, CAVE_START_ROW * TILE, worldWidth, caveHeight);
    this.purifiedCaveEffects.push(backplate);
    this.tweens.add({ targets: backplate, alpha: 0.96, duration: 1900, ease: 'Sine.easeInOut' });

    // A broad wavefront visibly leaves the Core and travels back through the dungeon.
    const sweep = this.add.graphics().setDepth(12).setPosition(0, cy + 28);
    sweep.fillGradientStyle(0x49dfbf, 0x49dfbf, 0xd7ff4a, 0xd7ff4a, 0, 0, 0.36, 0.36);
    sweep.fillRect(0, -12, worldWidth, 24);
    sweep.lineStyle(2, 0xeef5e9, 0.9); sweep.lineBetween(0, 0, worldWidth, 0);
    this.tweens.add({
      targets: sweep,
      y: CAVE_START_ROW * TILE - 24,
      alpha: 0,
      duration: 2200,
      ease: 'Cubic.easeOut',
      onComplete: () => sweep.destroy(),
    });

    [0x49dfbf, 0xd7ff4a, 0xeef5e9].forEach((color, index) => {
      const ring = this.add.graphics().setDepth(11).setPosition(cx, cy).setScale(0.35).setAlpha(0.9);
      ring.lineStyle(index === 2 ? 2 : 3, color, 0.82 - index * 0.14);
      ring.strokeCircle(0, 0, 12 + index * 3);
      this.tweens.add({
        targets: ring,
        scaleX: 45 + index * 5,
        scaleY: 45 + index * 5,
        alpha: 0,
        duration: 1750 + index * 260,
        delay: index * 120,
        ease: 'Cubic.easeOut',
        onComplete: () => ring.destroy(),
      });
    });

    const sortedTiles = [...this.caveSurfaceTiles].filter(tile => tile.active).sort((a, b) => (
      Phaser.Math.Distance.Squared(a.x, a.y, cx, cy) - Phaser.Math.Distance.Squared(b.x, b.y, cx, cy)
    ));
    const batches = 46;
    const batchSize = Math.max(1, Math.ceil(sortedTiles.length / batches));
    let batchIndex = 0;
    this.time.addEvent({
      delay: 38,
      repeat: batches - 1,
      callback: () => {
        const start = batchIndex * batchSize;
        const batch = sortedTiles.slice(start, start + batchSize);
        batch.forEach(tile => {
          const purifiedTexture = tile.getData('purifiedTexture') as string | undefined;
          if (purifiedTexture && this.textures.exists(purifiedTexture)) tile.setTexture(purifiedTexture);
        });
        const sparkTile = batch[Math.floor(batch.length / 2)];
        if (sparkTile && batchIndex % 2 === 0) this.spawnPurificationSpark(sparkTile.x, sparkTile.y);
        batchIndex++;
      },
    });
    this.time.delayedCall(1900, () => {
      sortedTiles.forEach(tile => {
        const texture = tile.getData('purifiedTexture') as string | undefined;
        if (texture) tile.setTexture(texture);
      });
    });

    this.caveCorruptionObjects.forEach((object, index) => {
      if (!object.active) return;
      this.tweens.killTweensOf(object);
      this.tweens.add({
        targets: object,
        alpha: 0,
        scaleX: 0.72,
        scaleY: 0.72,
        duration: 520,
        delay: Math.min(1450, index * 14),
        ease: 'Cubic.easeIn',
        onComplete: () => object.destroy(),
      });
    });
    this.caveCorruptionObjects = [];

    this.runeGraphics.forEach((object, index) => {
      this.tweens.killTweensOf(object);
      this.tweens.add({
        targets: object,
        alpha: 0,
        scaleX: 1.7,
        scaleY: 1.7,
        duration: 760,
        delay: index * 90,
        ease: 'Cubic.easeOut',
        onComplete: () => object.destroy(),
      });
    });
    this.runeGraphics = [];

    this.showPurificationBanner();
    this.time.delayedCall(1750, () => {
      this.createPurifiedCaveAtmosphere(false);
      this.currentZoneIndex = -1;
      this.updateZonePresentation(true);
    });
    this.time.delayedCall(2650, () => {
      this.tweens.add({ targets: this.cameras.main, zoom: 2, duration: 620, ease: 'Cubic.easeInOut' });
      onComplete();
    });
  }

  private applyPurifiedCaveInstant(): void {
    this.cavePurified = true;
    this.caveSurfaceTiles.forEach(tile => {
      const texture = tile.getData('purifiedTexture') as string | undefined;
      if (texture && this.textures.exists(texture)) tile.setTexture(texture);
    });
    [...this.caveCorruptionObjects, ...this.runeGraphics].forEach(object => {
      this.tweens.killTweensOf(object);
      object.destroy();
    });
    this.caveCorruptionObjects = [];
    this.runeGraphics = [];

    const backplate = this.add.graphics().setDepth(-9);
    backplate.fillGradientStyle(0x244a3b, 0x244a3b, 0x152f28, 0x152f28, 1, 1, 1, 1);
    backplate.fillRect(0, CAVE_START_ROW * TILE, MAP_COLS * TILE, (MAP_ROWS - CAVE_START_ROW) * TILE);
    this.purifiedCaveEffects.push(backplate);
    this.createPurifiedCaveAtmosphere(true);
    this.currentZoneIndex = -1;
    this.updateZonePresentation(true);
  }

  private createPurifiedCaveAtmosphere(instant: boolean): void {
    if (this.purifiedCaveEffects.some(effect => effect.name === 'purified-core')) return;
    const cx = this.PENTAGRAM_X;
    const cy = this.PENTAGRAM_Y;

    const core = this.add.graphics().setDepth(1).setPosition(cx, cy).setName('purified-core');
    core.lineStyle(2, 0x49dfbf, 0.46); core.strokeCircle(0, 0, 74);
    core.lineStyle(1, 0xd7ff4a, 0.36); core.strokeCircle(0, 0, 54);
    core.lineStyle(1, 0xeef5e9, 0.2); core.strokeCircle(0, 0, 30);
    for (let index = 0; index < 12; index++) {
      const angle = (Math.PI * 2 / 12) * index;
      const inner = 34 + (index % 3) * 5;
      const outer = inner + 7 + (index % 4) * 2;
      core.lineStyle(index % 2 === 0 ? 2 : 1, index % 2 === 0 ? 0xd7ff4a : 0x49dfbf, 0.54);
      core.lineBetween(Math.cos(angle) * inner, Math.sin(angle) * inner, Math.cos(angle) * outer, Math.sin(angle) * outer);
    }
    core.setAlpha(instant ? 0.62 : 0);
    this.tweens.add({ targets: core, alpha: 0.62, angle: 360, duration: 18000, repeat: -1, ease: 'Linear' });
    this.purifiedCaveEffects.push(core);

    const arch = this.add.graphics().setDepth(3).setName('purified-arch');
    arch.lineStyle(7, 0x315548, 0.92); arch.beginPath(); arch.arc(cx, 83 * TILE, 8 * TILE, Math.PI, 0, false); arch.strokePath();
    arch.lineStyle(2, 0x49dfbf, 0.56); arch.beginPath(); arch.arc(cx, 83 * TILE, 8 * TILE - 7, Math.PI + 0.1, -0.1, false); arch.strokePath();
    arch.setAlpha(instant ? 1 : 0);
    if (!instant) this.tweens.add({ targets: arch, alpha: 1, duration: 900 });
    this.purifiedCaveEffects.push(arch);

    const lightPools: [number, number][] = [[20,56],[10,63],[36,66],[38,72],[15,74],[18,79],[31,80],[24,87]];
    lightPools.forEach(([col, row], index) => {
      const pool = this.add.graphics().setDepth(0.6).setPosition(col * TILE, row * TILE).setName('purified-light');
      pool.fillStyle(index % 3 === 0 ? 0xd7ff4a : 0x49dfbf, 0.1); pool.fillEllipse(0, 0, 34, 12);
      pool.setAlpha(instant ? 0.72 : 0);
      this.tweens.add({ targets: pool, alpha: { from: instant ? 0.52 : 0, to: 0.86 }, scaleX: 1.14, duration: 1400 + index * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.purifiedCaveEffects.push(pool);
    });

    for (let index = 0; index < 34; index++) {
      const mote = this.add.graphics().setDepth(3).setName('purified-mote');
      const color = index % 5 === 0 ? 0xd7ff4a : index % 3 === 0 ? 0xeef5e9 : 0x49dfbf;
      mote.fillStyle(color, 0.76); mote.fillRect(0, 0, index % 7 === 0 ? 2 : 1, index % 7 === 0 ? 2 : 1);
      const startX = Phaser.Math.Between(6 * TILE, 42 * TILE);
      const startY = Phaser.Math.Between(CAVE_START_ROW * TILE, 91 * TILE);
      mote.setPosition(startX, startY).setAlpha(instant ? 0.48 : 0);
      this.tweens.add({
        targets: mote,
        x: startX + Phaser.Math.Between(-18, 18),
        y: startY - Phaser.Math.Between(18, 52),
        alpha: { from: instant ? 0.16 : 0, to: 0.7 },
        duration: 2600 + index * 83,
        delay: instant ? 0 : index * 34,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.purifiedCaveEffects.push(mote);
    }
  }

  private spawnPurificationSpark(x: number, y: number): void {
    const spark = this.add.graphics().setDepth(13).setPosition(x, y);
    spark.fillStyle(0xeef5e9, 0.96); spark.fillRect(-1, -4, 2, 8); spark.fillRect(-4, -1, 8, 2);
    this.tweens.add({
      targets: spark,
      alpha: 0,
      scaleX: 2.2,
      scaleY: 2.2,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => spark.destroy(),
    });
  }

  private showPurificationBanner(): void {
    EventBus.emit(EVENTS.UI_NOTICE, {
      eyebrow: 'VOID CAVE // PURIFICATION COMPLETE',
      title: 'Signal restored',
      detail: 'Corruption cleared. The original frequency is returning.',
      accent: '#49dfbf',
      tone: 'success',
      variant: 'hero',
      duration: 2800,
    });
    return;
    const ui = this.scene.get('UIScene') as Phaser.Scene;
    const width = 272;
    const centerX = ui.cameras.main.width / 2;
    const centerY = 118;
    const panel = ui.add.graphics();
    panel.setScrollFactor(0);
    panel.fillStyle(0x07100c, 0.92); panel.fillRect(centerX - width / 2, centerY - 22, width, 44);
    panel.lineStyle(1, 0x49dfbf, 0.72); panel.strokeRect(centerX - width / 2, centerY - 22, width, 44);
    panel.fillStyle(0xd7ff4a, 0.9); panel.fillRect(centerX - width / 2, centerY - 22, 46, 2);
    panel.fillStyle(0x49dfbf, 0.9); panel.fillRect(centerX + width / 2 - 82, centerY + 20, 82, 2);
    const title = ui.add.text(centerX, centerY - 11, 'SIGNAL RESTORED', {
      fontFamily: 'Syne', fontStyle: 'bold', fontSize: '14px', color: '#d7ff4a', letterSpacing: 2,
    }).setOrigin(0.5).setScrollFactor(0);
    const meta = ui.add.text(centerX, centerY + 9, 'VOID CAVE // PURIFICATION COMPLETE', {
      fontFamily: 'DM Mono', fontSize: '6px', color: '#9ecfbc', letterSpacing: 1,
    }).setOrigin(0.5).setScrollFactor(0);
    const banner = ui.add.container(0, 0, [panel, title, meta])
      .setDepth(96)
      .setScrollFactor(0)
      .setAlpha(0);
    ui.tweens.add({
      targets: banner,
      alpha: 1,
      duration: 460,
      hold: 1350,
      yoyo: true,
      ease: 'Back.easeOut',
      onComplete: () => banner.destroy(),
    });
  }

  private spawnLostTrack(cinematic = true): void {
    if (this.lostTrackItem?.active) return;
    const cx = this.PENTAGRAM_X;
    const cy = this.PENTAGRAM_Y;

    const pedestal = this.add.graphics().setDepth(3).setPosition(cx, cy + 7);
    pedestal.fillStyle(0x07100c, 0.58); pedestal.fillEllipse(0, 0, 78, 20);
    pedestal.lineStyle(2, 0x49dfbf, 0.52); pedestal.strokeEllipse(0, 0, 66, 16);
    pedestal.lineStyle(1, 0xd7ff4a, 0.42); pedestal.strokeEllipse(0, 0, 48, 11);
    pedestal.fillStyle(0xd7ff4a, 0.08); pedestal.fillEllipse(0, 0, 42, 9);
    this.tweens.add({ targets: pedestal, alpha: 0.48, scaleX: 1.12, duration: 1250, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.lostTrackEffects.push(pedestal);

    const beam = this.add.graphics().setDepth(3).setPosition(cx, cy);
    beam.fillGradientStyle(0x49dfbf, 0x49dfbf, 0xd7ff4a, 0xd7ff4a, 0, 0, 0.16, 0.16);
    beam.fillRect(-13, -124, 26, 130);
    beam.fillStyle(0xeef5e9, 0.12); beam.fillRect(-3, -124, 6, 130);
    beam.setAlpha(cinematic ? 0 : 0.64);
    this.tweens.add({ targets: beam, alpha: { from: cinematic ? 0 : 0.4, to: 0.76 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.lostTrackEffects.push(beam);

    const waveform = this.add.graphics().setDepth(5).setPosition(cx, cy - 5);
    waveform.lineStyle(1, 0x49dfbf, 0.72);
    waveform.beginPath(); waveform.moveTo(-48, 0);
    const peaks = [0,-3,2,-7,6,-13,9,-5,3,-10,14,-6,4,-2,0,3,-4,7,-9,4,0];
    peaks.forEach((peak, index) => waveform.lineTo(-48 + index * 4.8, peak));
    waveform.strokePath();
    waveform.lineStyle(1, 0xd7ff4a, 0.32); waveform.lineBetween(-52, 0, 52, 0);
    waveform.setAlpha(cinematic ? 0 : 0.82).setScale(0.4, 1);
    this.tweens.add({ targets: waveform, alpha: 0.86, scaleX: 1, duration: 1150, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: waveform, scaleY: 1.18, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.lostTrackEffects.push(waveform);

    // Two counter-rotating mastering rings frame the record without obscuring it.
    [0, 1].forEach(index => {
      const orbit = this.add.graphics().setDepth(5).setPosition(cx, cy - 6).setName('mastering-ring');
      orbit.lineStyle(index === 0 ? 2 : 1, index === 0 ? 0xd7ff4a : 0x49dfbf, 0.58);
      const radius = index === 0 ? 31 : 39;
      orbit.beginPath(); orbit.arc(0, 0, radius, 0.1, 1.55); orbit.strokePath();
      orbit.beginPath(); orbit.arc(0, 0, radius, 3.25, 4.7); orbit.strokePath();
      for (let tick = 0; tick < 8; tick++) {
        const a = (Math.PI * 2 / 8) * tick;
        orbit.fillStyle(tick % 2 === 0 ? 0xd7ff4a : 0x49dfbf, 0.72);
        orbit.fillRect(Math.cos(a) * radius - 1, Math.sin(a) * radius - 1, 2, 2);
      }
      orbit.setAlpha(cinematic ? 0 : 0.8).setScale(cinematic ? 0.4 : 1);
      this.tweens.add({ targets: orbit, alpha: 0.82, scaleX: 1, scaleY: 1, duration: 900 + index * 180, ease: 'Back.easeOut' });
      this.tweens.add({ targets: orbit, angle: index === 0 ? 360 : -360, duration: 8000 + index * 3000, repeat: -1, ease: 'Linear' });
      this.lostTrackEffects.push(orbit);
    });

    for (let index = 0; index < 16; index++) {
      const angle = (Math.PI * 2 / 16) * index;
      const shard = this.add.graphics().setDepth(6).setPosition(cx, cy - 6).setRotation(angle);
      shard.fillStyle(index % 3 === 0 ? 0xd7ff4a : 0x49dfbf, 0.9);
      shard.fillRect(45, -1, 5 + (index % 4) * 2, index % 2 === 0 ? 2 : 1);
      shard.setAlpha(cinematic ? 0 : 0.64).setScale(0.4);
      this.tweens.add({ targets: shard, alpha: 0.68, scaleX: 1, scaleY: 1, duration: 620, delay: index * 42, ease: 'Back.easeOut' });
      this.tweens.add({ targets: shard, angle: shard.angle + (index % 2 === 0 ? 12 : -12), duration: 1300 + index * 33, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.lostTrackEffects.push(shard);
    }

    this.lostTrackItem = this.add.sprite(cx, cy - 6, 'item-lost-track')
      .setDepth(8)
      .setAlpha(cinematic ? 0 : 1)
      .setScale(cinematic ? 0 : 0.78)
      .setAngle(cinematic ? -110 : 0);
    if (cinematic) {
      this.cameras.main.flash(460, 215, 255, 74, false);
      this.cameras.main.shake(520, 0.0045);
      this.tweens.add({ targets: this.cameras.main, zoom: 2.34, duration: 520, yoyo: true, ease: 'Cubic.easeOut' });
      this.tweens.add({
        targets: this.lostTrackItem,
        alpha: 1,
        scaleX: 0.9,
        scaleY: 0.9,
        angle: 0,
        duration: 1250,
        ease: 'Back.easeOut',
      });
      this.showLostTrackRevealBanner();
    }
    this.time.delayedCall(cinematic ? 1260 : 0, () => {
      if (!this.lostTrackItem?.active) return;
      this.tweens.add({ targets: this.lostTrackItem, y: cy - 13, duration: 1450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: this.lostTrackItem, angle: 360, duration: 12000, repeat: -1, ease: 'Linear' });
    });

    const label = this.add.text(cx, cy + 27, 'FINAL MASTER // 001', {
      fontFamily: 'DM Mono', fontSize: '5px', color: '#d7ff4a', letterSpacing: 1,
    }).setOrigin(0.5).setDepth(8).setAlpha(cinematic ? 0 : 0.86);
    if (cinematic) this.tweens.add({ targets: label, alpha: 0.86, y: cy + 24, duration: 760, delay: 760, ease: 'Cubic.easeOut' });
    this.lostTrackEffects.push(label);
  }

  private showLostTrackRevealBanner(): void {
    EventBus.emit(EVENTS.UI_NOTICE, {
      eyebrow: 'FINAL RECOVERY // MASTER SIGNAL',
      title: 'The Lost Track',
      detail: 'Original frequency restored.',
      accent: '#d7ff4a',
      tone: 'success',
      variant: 'hero',
      duration: 3000,
    });
    return;
    const ui = this.scene.get('UIScene') as Phaser.Scene;
    const centerX = ui.cameras.main.width / 2;
    const centerY = 154;
    const panel = ui.add.graphics();
    panel.setScrollFactor(0);
    panel.fillStyle(0x030706, 0.94); panel.fillRect(centerX - 174, centerY - 31, 348, 62);
    panel.lineStyle(1, 0xd7ff4a, 0.78); panel.strokeRect(centerX - 174, centerY - 31, 348, 62);
    panel.fillStyle(0x49dfbf, 0.85); panel.fillRect(centerX - 174, centerY - 31, 104, 2);
    panel.fillStyle(0xff6b3d, 0.72); panel.fillRect(centerX + 96, centerY + 29, 78, 2);
    const overline = ui.add.text(centerX, centerY - 18, 'FINAL RECOVERY // MASTER SIGNAL', {
      fontFamily: 'DM Mono', fontSize: '6px', color: '#49dfbf', letterSpacing: 2,
    }).setOrigin(0.5).setScrollFactor(0);
    const title = ui.add.text(centerX, centerY + 2, 'THE LOST TRACK', {
      fontFamily: 'Syne', fontStyle: 'bold', fontSize: '19px', color: '#eef5e9', letterSpacing: 3,
    }).setOrigin(0.5).setScrollFactor(0);
    const sub = ui.add.text(centerX, centerY + 21, 'ORIGINAL FREQUENCY RESTORED', {
      fontFamily: 'DM Mono', fontSize: '6px', color: '#d7ff4a', letterSpacing: 1,
    }).setOrigin(0.5).setScrollFactor(0);
    const banner = ui.add.container(0, 0, [panel, overline, title, sub])
      .setDepth(110)
      .setScrollFactor(0)
      .setAlpha(0);
    this.finaleOverlay?.destroy();
    this.finaleOverlay = banner;
    ui.tweens.add({
      targets: banner,
      alpha: 1,
      duration: 520,
      hold: 1650,
      yoyo: true,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (this.finaleOverlay === banner) this.finaleOverlay = undefined;
        banner.destroy();
      },
    });
  }

  private collectLostTrack(): void {
    if (!this.lostTrackItem) return;
    const item = this.lostTrackItem;
    const cx = item.x;
    const cy = item.y;
    this.lostTrackItem = undefined;
    this.player.freeze();
    this.tweens.killTweensOf(item);

    this.cameras.main.flash(520, 215, 255, 74, false);
    this.cameras.main.shake(720, 0.006);
    this.tweens.add({ targets: this.cameras.main, zoom: 2.46, duration: 460, yoyo: true, ease: 'Cubic.easeOut' });

    // The record is physically reclaimed by the player instead of merely fading away.
    this.tweens.add({
      targets: item,
      x: this.player.x,
      y: this.player.y - 20,
      scaleX: 1.18,
      scaleY: 1.18,
      angle: item.angle + 720,
      duration: 820,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        this.spawnFinalMasterBurst(this.player.x, this.player.y - 18);
        item.destroy();
      },
    });

    this.lostTrackEffects.forEach((effect, index) => {
      if (!effect.active) return;
      this.tweens.killTweensOf(effect);
      this.tweens.add({
        targets: effect,
        alpha: 0,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 520,
        delay: index * 12,
        onComplete: () => effect.destroy(),
      });
    });
    this.lostTrackEffects = [];
    this.showFinalMasterAcquired();

    this.time.delayedCall(1750, () => {
      this.showDialog(
        [
          'The master record locks into your frequency.',
          'Every stolen note surges back at once.',
          'The cave is no longer a tomb. It is an instrument.',
          'THE LOST TRACK has been restored.',
          'Play it loud.',
        ],
        () => {
          useGameStore.getState().unlockBonusSong();
          EventBus.emit(EVENTS.BONUS_SONG_UNLOCKED);
          this.player.unfreeze();
        }
      );
    });
  }

  private spawnFinalMasterBurst(x: number, y: number): void {
    const colors = [0xd7ff4a, 0x49dfbf, 0xeef5e9, 0xff6b3d];
    for (let index = 0; index < 28; index++) {
      const angle = (Math.PI * 2 / 28) * index;
      const length = 44 + (index % 5) * 9;
      const particle = this.add.graphics().setDepth(24).setPosition(x, y).setRotation(angle);
      particle.fillStyle(colors[index % colors.length], 0.94);
      particle.fillRect(5, -1, index % 3 === 0 ? 8 : 4, index % 4 === 0 ? 3 : 2);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * length,
        y: y + Math.sin(angle) * length,
        alpha: 0,
        scaleX: 1.8,
        duration: 680 + (index % 5) * 70,
        ease: 'Cubic.easeOut',
        onComplete: () => particle.destroy(),
      });
    }

    [0xd7ff4a, 0x49dfbf, 0xeef5e9].forEach((color, index) => {
      const ring = this.add.graphics().setDepth(23).setPosition(x, y).setScale(0.3);
      ring.lineStyle(3 - index, color, 0.9 - index * 0.18); ring.strokeCircle(0, 0, 12 + index * 4);
      this.tweens.add({
        targets: ring,
        scaleX: 8 + index * 2,
        scaleY: 8 + index * 2,
        alpha: 0,
        duration: 720 + index * 180,
        ease: 'Cubic.easeOut',
        onComplete: () => ring.destroy(),
      });
    });
  }

  private showFinalMasterAcquired(): void {
    EventBus.emit(EVENTS.UI_NOTICE, {
      eyebrow: 'FINAL OBJECTIVE // COMPLETE',
      title: 'Master acquired',
      detail: 'The Lost Track // Signal 100%',
      accent: '#d7ff4a',
      tone: 'success',
      variant: 'hero',
      duration: 3600,
    });
    return;
    const ui = this.scene.get('UIScene') as Phaser.Scene;
    this.finaleOverlay?.destroy();
    this.finaleOverlay = undefined;
    const width = ui.cameras.main.width;
    const height = ui.cameras.main.height;
    const wash = ui.add.graphics().setScrollFactor(0);
    wash.fillStyle(0x07100c, 0.82); wash.fillRect(0, 0, width, height);
    const frame = ui.add.graphics().setScrollFactor(0);
    frame.lineStyle(2, 0xd7ff4a, 0.85); frame.strokeRect(22, height / 2 - 68, width - 44, 136);
    frame.lineStyle(1, 0x49dfbf, 0.45); frame.strokeRect(28, height / 2 - 62, width - 56, 124);
    frame.fillStyle(0xd7ff4a, 0.9); frame.fillRect(22, height / 2 - 68, 118, 3);
    frame.fillStyle(0x49dfbf, 0.9); frame.fillRect(width - 174, height / 2 + 65, 152, 3);

    const equalizer = ui.add.graphics().setScrollFactor(0);
    const centerY = height / 2 + 37;
    for (let index = 0; index < 45; index++) {
      const barHeight = 3 + ((index * 11 + index * index) % 22);
      equalizer.fillStyle(index % 5 === 0 ? 0xd7ff4a : 0x49dfbf, 0.56);
      equalizer.fillRect(width / 2 - 135 + index * 6, centerY - barHeight / 2, 3, barHeight);
    }
    const overline = ui.add.text(width / 2, height / 2 - 39, 'FINAL OBJECTIVE COMPLETE', {
      fontFamily: 'DM Mono', fontSize: '7px', color: '#49dfbf', letterSpacing: 3,
    }).setOrigin(0.5).setScrollFactor(0);
    const title = ui.add.text(width / 2, height / 2 - 12, 'MASTER ACQUIRED', {
      fontFamily: 'Syne', fontStyle: 'bold', fontSize: '20px', color: '#eef5e9', letterSpacing: 2,
    }).setOrigin(0.5).setScrollFactor(0);
    const meta = ui.add.text(width / 2, height / 2 + 16, 'THE LOST TRACK // SIGNAL 100%', {
      fontFamily: 'DM Mono', fontSize: '8px', color: '#d7ff4a', letterSpacing: 2,
    }).setOrigin(0.5).setScrollFactor(0);
    const overlay = ui.add.container(0, 0, [wash, frame, equalizer, overline, title, meta])
      .setDepth(120)
      .setAlpha(0)
      .setScale(1.08);
    this.finaleOverlay = overlay;
    ui.tweens.add({
      targets: overlay,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 420,
      hold: 900,
      yoyo: true,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (this.finaleOverlay === overlay) this.finaleOverlay = undefined;
        overlay.destroy();
      },
    });
  }

  private setGateOpenVisual(animated: boolean): void {
    const leftPanel = this.children.getByName('gate-panel-left') as Phaser.GameObjects.Image | null;
    const rightPanel = this.children.getByName('gate-panel-right') as Phaser.GameObjects.Image | null;

    // Remove only the invisible doorway blockers; the stone arch remains part of the world.
    [...this.walls.getChildren()].forEach((child) => {
      const blocker = child as Phaser.GameObjects.Image;
      if (blocker.name === 'gate-blocker') this.walls.remove(blocker, true, true);
    });

    if (!animated) {
      leftPanel?.destroy();
      rightPanel?.destroy();
      return;
    }

    const openPanel = (panel: Phaser.GameObjects.Image | null, offsetX: number) => {
      if (!panel) return;
      this.tweens.add({
        targets: panel,
        x: panel.x + offsetX,
        alpha: 0,
        duration: 620,
        ease: 'Cubic.easeInOut',
        onComplete: () => panel.destroy(),
      });
    };
    openPanel(leftPanel, -28);
    openPanel(rightPanel, 28);

    const gateSignal = this.add.rectangle(21 * TILE, 38 * TILE, 52, 24, 0x49dfbf, 0)
      .setDepth(4);
    this.tweens.add({
      targets: gateSignal,
      alpha: 0.18,
      duration: 220,
      yoyo: true,
      hold: 120,
      onComplete: () => gateSignal.destroy(),
    });
    this.cameras.main.shake(220, 0.0025);
  }

  private openGate(showDialog = true): void {
    if (this.gateOpen) return;
    this.gateOpen = true;
    useGameStore.getState().openGate();
    this.setGateOpenVisual(true);
    EventBus.emit(EVENTS.GATE_OPEN);
    if (showDialog) {
      this.showDialog([
        'The Frequency Gate trembles.',
        'A low hum fills the air.',
        'Then — silence.',
        'The path to the Fading Path is open.',
      ]);
    }
  }

  private handlePlayerDeath(): void {
    this.player.freeze();
    this.cameras.main.shake(300, 0.008);

    this.time.delayedCall(400, () => {
      this.scene.launch('DeathScene');
      this.scene.pause();
    });
  }

  private onRespawn = (): void => {
    this.scene.resume();
    this.cameras.main.resetFX();
    this.cameras.main.setZoom(2);
    this.player.setPosition(this.spawnX, this.spawnY);
    this.player.unfreeze();

    // Reset all blocking state flags
    this.battleActive = false;
    this.bossEncounterStarted = false;
    this.dialogActive = false;
    this.worldFrozen = false;
    this.isTyping = false;

    // Clean up approach effects
    for (const fx of this.approachEffects) fx.destroy();
    this.approachEffects = [];
    this.bossApproachStarted = false;
    this._approachShakeTimer?.remove();
    this._approachShakeTimer = undefined;
    if (this.currentTypeTimer) { this.currentTypeTimer.destroy(); this.currentTypeTimer = undefined; }
    this.dialogQueue = [];
    if (this.dialogBox) { this.dialogBox.setVisible(false); }

    this.cameras.main.fadeIn(600, 0, 0, 0);
  };

  // ── Dialog system ─────────────────────────────────────────────────────────

  private showDialogOnce(key: string, lines: string[], onComplete?: () => void): void {
    if (this.shownOnce.has(key)) return;
    this.shownOnce.add(key);
    this.showDialog(lines, onComplete);
  }

  private createDialogBox(): void {
    const CAM_ZOOM = 2;
    const viewW = this.scale.width / CAM_ZOOM;
    const boxW = viewW - 8;
    const boxH = 72;

    const bg = this.add.graphics();
    bg.fillStyle(0x030806, 0.985);
    bg.fillRoundedRect(0, 0, boxW, boxH, 4);
    bg.lineStyle(1, 0x3d5145, 0.9);
    bg.strokeRoundedRect(0.5, 0.5, boxW - 1, boxH - 1, 4);
    bg.fillStyle(0x09130f, 1);
    bg.fillRoundedRect(7, 7, 52, 58, 3);
    bg.lineStyle(1, 0x25352b, 0.95);
    bg.strokeRoundedRect(7.5, 7.5, 51, 57, 3);
    bg.lineStyle(1, 0x718078, 0.08);
    for (let y = 8; y < boxH; y += 8) bg.lineBetween(62, y, boxW - 8, y);

    const accent = this.add.graphics();
    const portrait = this.add.image(32, 64, 'npc-elder-muse-v2').setVisible(false);
    const systemMark = this.add.text(33, 36, '◎', {
      fontFamily: 'Syne', fontStyle: 'bold', fontSize: '20px', color: '#d7ff4a',
    }).setOrigin(0.5).setAlpha(0.48);

    const speaker = this.add.text(69, 9, 'FIELD TRANSMISSION', {
      fontFamily: 'Syne', fontStyle: 'bold', fontSize: '7px', color: '#d7ff4a', letterSpacing: 1,
    }).setResolution(2);

    const channel = this.add.text(boxW - 11, 10, 'ARCHIVE SIGNAL', {
      fontFamily: 'DM Mono', fontSize: '5px', color: '#718078', letterSpacing: 1,
    }).setOrigin(1, 0).setResolution(2);

    const text = this.add.text(69, 25, '', {
      fontFamily: 'DM Mono', fontStyle: '500', fontSize: '9px', color: '#eef5e9',
      wordWrap: { width: boxW - 84, useAdvancedWrap: true },
      lineSpacing: 3,
      maxLines: 3,
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 1, fill: true },
    }).setResolution(2);

    const arrow = this.add.text(boxW - 14, boxH - 14, '▼', {
      fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#d7ff4a',
    });
    this.tweens.add({ targets: arrow, alpha: 0, duration: 500, yoyo: true, repeat: -1 });
    arrow.setVisible(false);

    const prompt = this.add.text(boxW - 11, boxH - 11, 'E / SPACE / TAP   ▼', {
      fontFamily: 'DM Mono', fontSize: '5px', color: '#d7ff4a', letterSpacing: 1,
    }).setOrigin(1, 1).setResolution(2);
    this.tweens.add({ targets: prompt, alpha: 0.38, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.dialogBox = this.add.container(0, 0, [bg, accent, systemMark, portrait, speaker, channel, text, prompt]);
    this.dialogBox.setDepth(200);
    this.dialogBox.setVisible(false);
    this.dialogBox.setData('text', text);
    this.dialogBox.setData('speaker', speaker);
    this.dialogBox.setData('channel', channel);
    this.dialogBox.setData('portrait', portrait);
    this.dialogBox.setData('systemMark', systemMark);
    this.dialogBox.setData('accent', accent);
    this.dialogBox.setData('callback', null);

    this.input.on('pointerdown', this.handleDialogAdvance, this);
    const advanceKeys = ['SPACE','ENTER','Z','E','W','S','A','D','UP','DOWN','LEFT','RIGHT'];
    advanceKeys.forEach(k => this.input.keyboard?.on(`keydown-${k}`, this.handleDialogAdvance, this));
  }

  private handleDialogAdvance(): void {
    if (!this.dialogActive) return;
    if (this.isTyping) {
      this.currentTypeTimer?.remove();
      this.currentTypeTimer = undefined;
      this.isTyping = false;
      (this.dialogBox!.getData('text') as Phaser.GameObjects.Text).setText(this.currentLine);
      return;
    }
    this.advanceDialog();
  }

  private setDialogSpeaker(name?: string): void {
    if (!this.dialogBox) return;
    this.activeDialogSpeaker = name;
    const speaker = this.dialogBox.getData('speaker') as Phaser.GameObjects.Text;
    const channel = this.dialogBox.getData('channel') as Phaser.GameObjects.Text;
    const portrait = this.dialogBox.getData('portrait') as Phaser.GameObjects.Image;
    const systemMark = this.dialogBox.getData('systemMark') as Phaser.GameObjects.Text;
    const accent = this.dialogBox.getData('accent') as Phaser.GameObjects.Graphics;
    const text = this.dialogBox.getData('text') as Phaser.GameObjects.Text;
    const visual = name ? DIALOG_SPEAKERS[name] : undefined;
    const isGatekeeper = name === 'THE GATEKEEPER';
    const accentColor = visual?.accent ?? (isGatekeeper ? 0xff6b3d : 0xd7ff4a);

    speaker.setText((name ?? 'FIELD TRANSMISSION').toUpperCase());
    speaker.setColor(`#${accentColor.toString(16).padStart(6, '0')}`);
    channel.setText(name ? 'VOICE CHANNEL // LIVE' : 'ARCHIVE SIGNAL');

    accent.clear();
    accent.fillStyle(accentColor, 1);
    accent.fillRoundedRect(0, 0, 4, 72, 3);
    accent.fillStyle(accentColor, 0.16);
    accent.fillRect(62, 20, 238, 1);

    if (visual) {
      portrait.setTexture(visual.texture)
        .setOrigin(visual.originX, visual.originY)
        .setPosition(32, 64)
        .setScale(visual.portraitScale)
        .setVisible(true);
      systemMark.setVisible(false);
      portrait.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    } else if (isGatekeeper) {
      const portraitTexture = this.textures.exists('boss-gatekeeper-battle-phase1')
        ? 'boss-gatekeeper-battle-phase1'
        : 'boss-gatekeeper';
      portrait.setTexture(portraitTexture)
        .setOrigin(0.5, 1)
        .setPosition(32, 62)
        .setScale(portraitTexture === 'boss-gatekeeper-battle-phase1' ? 0.045 : 1.25)
        .setVisible(true);
      portrait.texture.setFilter(portraitTexture === 'boss-gatekeeper-battle-phase1'
        ? Phaser.Textures.FilterMode.LINEAR
        : Phaser.Textures.FilterMode.NEAREST);
      systemMark.setVisible(false);
    } else {
      portrait.setVisible(false);
      systemMark.setVisible(true).setColor(`#${accentColor.toString(16).padStart(6, '0')}`);
    }

    text.setX(69).setWordWrapWidth(228, true);
    speaker.setX(69);
  }

  showDialog(lines: string[], onComplete?: () => void): void {
    if (!this.dialogBox || this.dialogActive) return;
    this.dialogActive = true;
    this.dialogQueue = [...lines];
    this.dialogBox.setData('callback', onComplete ?? null);
    this.setDialogSpeaker();
    // The visible conversation UI is rendered as a crisp DOM overlay. The
    // Phaser container remains as the input/state controller only.
    this.dialogBox.setVisible(false).setAlpha(0);
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

    let line = this.dialogQueue.shift()!;
    const speakerMatch = line.match(/^([^"\n]{1,32}):$/);
    if (speakerMatch) {
      this.setDialogSpeaker(speakerMatch[1]);
      if (this.dialogQueue.length === 0) {
        this.advanceDialog();
        return;
      }
      line = this.dialogQueue.shift()!;
    }

    const displayLine = line.startsWith('"') && line.endsWith('"') ? line.slice(1, -1) : line;
    this.currentLine = displayLine;
    const textObj = this.dialogBox.getData('text') as Phaser.GameObjects.Text;
    this.currentTypeTimer?.remove();
    this.currentTypeTimer = undefined;
    this.isTyping = false;
    textObj.setText(displayLine);
    const speakerName = this.activeDialogSpeaker ?? 'FIELD TRANSMISSION';
    const visual = this.activeDialogSpeaker ? DIALOG_SPEAKERS[this.activeDialogSpeaker] : undefined;
    const isGatekeeper = this.activeDialogSpeaker === 'THE GATEKEEPER';
    const payload: DialogPayload = {
      text: displayLine,
      speaker: speakerName,
      accent: `#${(visual?.accent ?? (isGatekeeper ? 0xff6b3d : 0xd7ff4a)).toString(16).padStart(6, '0')}`,
      portrait: this.activeDialogSpeaker === 'Elder Muse' ? 'elder'
        : this.activeDialogSpeaker === 'Junction Guard' ? 'guard'
          : this.activeDialogSpeaker === 'Wandering Musician' ? 'musician'
            : isGatekeeper ? 'gatekeeper' : undefined,
    };
    EventBus.emit(EVENTS.DIALOG, payload);
  }

  // ── Visual effects ────────────────────────────────────────────────────────

  private showLevelUpEffect(level: number): void {
    void level;
    this.cameras.main.flash(300, 255, 215, 0, false);
  }

  /**
   * Music-themed healing sequence:
   * 1. NPC tunes an equalizer signal
   * 2. Waveform packets travel to the player
   * 3. The received beat restores HP in a resonance burst
   * 4. Follow-up dialog resumes after the visual resolves
   */
  private playHealingMusic(
    npcSprite: Phaser.GameObjects.Sprite,
    healAmount: number,
    followUpLines: string[],
  ): void {
    this.worldFrozen = true;

    const nX = npcSprite.x;
    const nY = npcSprite.y;
    const pX = this.player.x;
    const pY = this.player.y;
    const sourceY = nY - 9;
    const targetY = pY - 9;
    const visual = npcSprite === this.npcSprite ? NPC_VISUALS.elder
      : npcSprite === this.npc2Sprite ? NPC_VISUALS.guard
        : NPC_VISUALS.musician;
    const accent = visual.accent;
    const accentCss = `#${accent.toString(16).padStart(6, '0')}`;
    const storeBefore = useGameStore.getState();
    const restoredAmount = Math.max(0, Math.min(healAmount, storeBefore.maxHp - storeBefore.hp));

    // Phase 1: The NPC tunes a short signal instead of emitting generic sparkles.
    for (let index = 0; index < 3; index++) {
      const ring = this.add.graphics()
        .setName('healing-tuning-ring')
        .setDepth(19)
        .setPosition(nX, sourceY)
        .setScale(0.65)
        .setAlpha(0.78);
      ring.lineStyle(1, index === 1 ? 0xd7ff4a : accent, 1);
      ring.strokeCircle(0, 0, 5 + index * 2);
      this.tweens.add({
        targets: ring,
        scaleX: 1.9,
        scaleY: 1.9,
        alpha: 0,
        delay: index * 105,
        duration: 520,
        ease: 'Quad.easeOut',
        onComplete: () => ring.destroy(),
      });
    }

    const equalizer = this.add.graphics()
      .setName('healing-equalizer')
      .setDepth(20)
      .setPosition(nX, nY - 19)
      .setScale(1, 0.2);
    [4, 8, 12, 7, 5].forEach((height, index) => {
      equalizer.fillStyle(index === 2 ? 0xd7ff4a : index === 4 ? 0xff6b3d : accent, 0.92);
      equalizer.fillRect(index * 3 - 7, -height, 2, height);
    });
    this.tweens.add({
      targets: equalizer,
      scaleY: 1,
      duration: 90,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      onComplete: () => this.tweens.add({
        targets: equalizer, alpha: 0, duration: 160, onComplete: () => equalizer.destroy(),
      }),
    });

    ['\u266A', '\u266B', '\u2669', '\u266C'].forEach((glyph, index) => {
      this.time.delayedCall(index * 95, () => {
        const side = index % 2 === 0 ? -1 : 1;
        const note = this.add.text(nX + side * (7 + index), nY - 17, glyph, {
          fontFamily: 'serif',
          fontSize: `${8 + index}px`,
          color: index % 2 === 0 ? accentCss : '#d7ff4a',
          stroke: '#07100c',
          strokeThickness: 1,
        }).setName('healing-note').setDepth(20).setOrigin(0.5).setAlpha(0.88);
        this.tweens.add({
          targets: note,
          x: note.x + side * 5,
          y: note.y - 14 - index * 2,
          angle: side * 12,
          alpha: 0,
          duration: 620,
          ease: 'Quad.easeOut',
          onComplete: () => note.destroy(),
        });
      });
    });

    // Phase 2: A visible waveform carries the melody from NPC to player.
    this.time.delayedCall(320, () => {
      const controlX = (nX + pX) / 2;
      const controlY = Math.min(sourceY, targetY) - 27;
      const signalPath = this.add.graphics().setName('healing-signal-path').setDepth(18).setAlpha(0);
      let previousX = nX;
      let previousY = sourceY;
      for (let step = 1; step <= 18; step++) {
        const t = step / 18;
        const x = (1 - t) * (1 - t) * nX + 2 * (1 - t) * t * controlX + t * t * pX;
        const y = (1 - t) * (1 - t) * sourceY + 2 * (1 - t) * t * controlY + t * t * targetY;
        signalPath.lineStyle(1, step % 3 === 0 ? 0xd7ff4a : accent, step % 2 === 0 ? 0.55 : 0.25);
        signalPath.lineBetween(previousX, previousY, x, y);
        previousX = x;
        previousY = y;
      }
      this.tweens.add({ targets: signalPath, alpha: 0.72, duration: 120 });
      this.time.delayedCall(700, () => this.tweens.add({
        targets: signalPath, alpha: 0, duration: 220, onComplete: () => signalPath.destroy(),
      }));

      const deltaX = pX - nX;
      const deltaY = targetY - sourceY;
      const distance = Math.max(1, Math.hypot(deltaX, deltaY));
      const normalX = -deltaY / distance;
      const normalY = deltaX / distance;

      for (let index = 0; index < 9; index++) {
        this.time.delayedCall(index * 65, () => {
          const packet = this.add.graphics()
            .setName('healing-signal-packet')
            .setDepth(20)
            .setPosition(nX, sourceY);
          packet.fillStyle(accent, 1); packet.fillRect(-4, -1, 2, 3);
          packet.fillStyle(0xd7ff4a, 1); packet.fillRect(-1, -3, 2, 6);
          packet.fillStyle(0xff6b3d, 0.92); packet.fillRect(2, 0, 2, 2);

          this.tweens.addCounter({
            from: 0,
            to: 1,
            duration: 510,
            ease: 'Sine.easeInOut',
            onUpdate: tween => {
              const t = tween.getValue() ?? 0;
              const wave = Math.sin(t * Math.PI * 6 + index * 0.8) * 1.7 * (1 - t);
              const x = (1 - t) * (1 - t) * nX + 2 * (1 - t) * t * controlX + t * t * pX;
              const y = (1 - t) * (1 - t) * sourceY + 2 * (1 - t) * t * controlY + t * t * targetY;
              packet.setPosition(x + normalX * wave, y + normalY * wave);
            },
            onComplete: () => {
              packet.destroy();
              const arrival = this.add.graphics()
                .setName('healing-arrival')
                .setDepth(20)
                .setPosition(pX, targetY)
                .setScale(0.4)
                .setAlpha(0.75);
              arrival.lineStyle(1, index % 2 === 0 ? accent : 0xd7ff4a, 1);
              arrival.strokeCircle(0, 0, 4);
              this.tweens.add({
                targets: arrival,
                scaleX: 1.5,
                scaleY: 1.5,
                alpha: 0,
                duration: 220,
                onComplete: () => arrival.destroy(),
              });
            },
          });
        });
      }
    });

    // Phase 3: The received beat blooms around the player and restores HP.
    this.time.delayedCall(1260, () => {
      useGameStore.getState().restoreHp(healAmount);

      const aura = this.add.graphics()
        .setName('healing-impact')
        .setDepth(19)
        .setPosition(pX, targetY)
        .setScale(0.65)
        .setAlpha(0.72);
      aura.fillStyle(accent, 0.16);
      aura.fillCircle(0, 0, 14);
      aura.lineStyle(2, 0xd7ff4a, 0.82);
      aura.strokeCircle(0, 0, 8);
      aura.lineStyle(1, accent, 0.9);
      aura.strokeCircle(0, 0, 13);
      this.tweens.add({
        targets: aura,
        scaleX: 2.15,
        scaleY: 2.15,
        alpha: 0,
        duration: 540,
        ease: 'Quad.easeOut',
        onComplete: () => aura.destroy(),
      });

      for (let index = 0; index < 8; index++) {
        const angle = (index / 8) * Math.PI * 2;
        const bar = this.add.graphics().setName('healing-beat-bar').setDepth(20).setPosition(pX, targetY);
        bar.fillStyle(index % 3 === 0 ? 0xd7ff4a : index % 3 === 1 ? accent : 0xff6b3d, 0.95);
        bar.fillRect(-1, -3, index % 2 === 0 ? 2 : 1, 6);
        bar.setAngle(Phaser.Math.RadToDeg(angle));
        this.tweens.add({
          targets: bar,
          x: pX + Math.cos(angle) * 22,
          y: targetY + Math.sin(angle) * 18,
          alpha: 0,
          duration: 440,
          ease: 'Quad.easeOut',
          onComplete: () => bar.destroy(),
        });
      }

      for (let index = 0; index < 5; index++) {
        const height = 5 + (2 - Math.abs(2 - index)) * 3;
        const rise = this.add.graphics()
          .setName('healing-rise-bar')
          .setDepth(18)
          .setPosition(pX + (index - 2) * 5, pY + 1)
          .setAlpha(0.72);
        rise.fillStyle(index === 2 ? 0xd7ff4a : accent, 0.86);
        rise.fillRect(-1, -height, 2, height);
        this.tweens.add({
          targets: rise,
          y: pY - 16,
          scaleY: 1.45,
          alpha: 0,
          delay: index * 35,
          duration: 480,
          ease: 'Quad.easeOut',
          onComplete: () => rise.destroy(),
        });
      }

      const basePlayerScale = this.player.scaleX;
      this.tweens.add({
        targets: this.player,
        scaleX: basePlayerScale * 1.06,
        scaleY: basePlayerScale * 1.06,
        duration: 90,
        yoyo: true,
        ease: 'Back.easeOut',
        onComplete: () => this.player.setScale(basePlayerScale),
      });

      const hpText = this.add.text(0, 0, `+${restoredAmount} HP`, {
        fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#d7ff4a',
        stroke: '#07100c', strokeThickness: 2,
      }).setOrigin(0.5);
      const resonanceText = this.add.text(0, 9, 'FULL RESONANCE', {
        fontFamily: '"Press Start 2P"', fontSize: '4px', color: accentCss,
        stroke: '#07100c', strokeThickness: 2,
      }).setOrigin(0.5);
      const feedback = this.add.container(pX, pY - 28, [hpText, resonanceText])
        .setName('healing-feedback')
        .setDepth(21)
        .setScale(0.44)
        .setVisible(false);
      EventBus.emit(EVENTS.UI_NOTICE, {
        eyebrow: 'HEALING FREQUENCY // SYNCED',
        title: `+${restoredAmount} HP`,
        detail: 'Full resonance restored by the channel keeper.',
        accent: accentCss,
        tone: 'success',
        duration: 2100,
      });
      this.tweens.add({
        targets: feedback,
        scaleX: 0.84,
        scaleY: 0.84,
        duration: 150,
        ease: 'Back.easeOut',
        onComplete: () => this.tweens.add({
          targets: feedback,
          y: feedback.y - 16,
          alpha: 0,
          delay: 260,
          duration: 620,
          ease: 'Quad.easeIn',
          onComplete: () => feedback.destroy(),
        }),
      });

      const red = (accent >> 16) & 0xff;
      const green = (accent >> 8) & 0xff;
      const blue = accent & 0xff;
      this.cameras.main.flash(140, red, green, blue, false);
      this.cameras.main.shake(120, 0.0015);
    });

    // Phase 4: Let the visual resolve before returning to the conversation.
    this.time.delayedCall(2150, () => {
      this.showDialog(followUpLines);
    });
  }

  shutdown(): void {
    EventBus.off(EVENTS.BATTLE_END, this.onBattleEnd, this);
    EventBus.off(EVENTS.RESPAWN, this.onRespawn, this);
    EventBus.off(EVENTS.ZONE_UI_REQUEST, this.onZoneUiRequest, this);
  }

  private onZoneUiRequest(): void {
    this.currentZoneIndex = -1;
    this.updateZonePresentation(true);
  }
}
