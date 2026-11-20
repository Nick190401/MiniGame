import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Npc } from '../entities/Npc';
import { ENEMY_DEFINITIONS, BOSS_DEFINITION } from '../entities/Enemy';
import type { EnemyData } from '../../types/game.types';
import { Boss } from '../entities/Boss';
import {
  BOSS_CORE_COL,
  BOSS_CORE_ROW,
  BROOK_START_ROW,
  CAVE_START_ROW,
  CORE_START_ROW,
  FADING_START_ROW,
  GATE_CENTER_COL,
  GATE_START_ROW,
  GROVE_START_ROW,
  JUNCTION_START_ROW,
  MAP_COLS,
  MAP_ROWS,
  MapBuilder,
  SIGNAL_START_ROW,
} from '../utils/MapBuilder';
import { EventBus, EVENTS, type DialogPayload, type ZoneUiPayload } from '../EventBus';
import { FRAGMENT_COUNT, useGameStore } from '../../store/gameStore';
import { getXPForNextLevel } from '../systems/XPSystem';
import { consumeMobileAction } from '../input/MobileInput';
import type { FootstepSurface } from '../audio/AudioLibrary';
import { WORLD_ZOOM, canvasZoom, logicalSize, shakeIntensity } from '../render/RenderScale';
import type { TerrainLayer } from '../world/terrain/TerrainLayer';
import { WorldLighting } from '../world/WorldLighting';
import { FX } from '../art/fx';
import { SpriteShadow } from '../art/castShadow';
import { CHARACTER_HEIGHT } from '../art/characters';
import { playNpcHeal, type NpcHealHandle } from '../world/NpcHeal';
import { FrequencyGate } from '../world/FrequencyGate';
import { isStreamGroupReady } from '../assets/AssetStream';
import { createInteractLabel as buildInteractLabel } from '../world/InteractLabel';
import { interiorDoors, type InteriorDoor } from '../maps/interiors';
import type { InteriorRoomId } from '../assets/InteriorArt';
import { prefetchRoomArt, releaseRoomArt } from '../assets/InteriorStream';
import type { InteriorScene } from './InteriorScene';
import { tr } from '../../i18n';

const TILE = 16;
const NPC_DIALOG_COOLDOWN_MS = 1200;
const SIGN_READ_DISTANCE = 28;
/** A signpost is shorter than a person: its key cap floats just above the board. */
const SIGN_LABEL_LIFT = 15;
/** A door's key cap floats over it, above the hero's head. */
const DOOR_LABEL_LIFT = 23;
/** The nearest room's painting starts downloading this close to its door. */
const DOOR_PREFETCH_DISTANCE = 96;
const DOOR_FADE_OUT_MS = 220;
const DOOR_FADE_IN_MS = 320;
// The master record is painted at 192 px (four times the original 48 px art).
const LOST_TRACK_SCALE = 0.14;
/** Fragment tokens: 192 px texture shown ~13 world units wide; pickup stays 26 units. */
const FRAGMENT_SCALE = 0.07;
const FRAGMENT_PICKUP_SIZE = 26;

interface NpcVisualConfig {
  portraitTexture: string;
  portraitScale: number;
  originX: number;
  originY: number;
  accent: number;
}

const NPC_VISUALS: Record<'professor' | 'guard' | 'musician', NpcVisualConfig> = {
  professor: {
    portraitTexture: 'portrait-professor', portraitScale: 0.2,
    originX: 0.5, originY: 1, accent: 0x6ea8d8,
  },
  guard: {
    portraitTexture: 'portrait-guard', portraitScale: 0.2,
    originX: 0.5, originY: 1, accent: 0xff7a2b,
  },
  musician: {
    portraitTexture: 'portrait-musician', portraitScale: 0.2,
    originX: 0.5, originY: 1, accent: 0xe8b465,
  },
};

const DIALOG_SPEAKERS: Record<string, NpcVisualConfig> = {
  'Professor Krys': NPC_VISUALS.professor,
  'Guard Quincy': NPC_VISUALS.guard,
  'Kian Vero': NPC_VISUALS.musician,
};

interface AfterBossLines {
  /** Repeat talks cycle through these. */
  talks: string[][];
  /** Follows an NPC heal in place of the journey's own follow-up. */
  heal: string[];
}

/** What each NPC says once the Gatekeeper has fallen: while the Lost Track waits in The Core, then once it is reclaimed. */
function afterBossDialog(name: string): Record<Npc['npcId'], { speaker: string; pending: AfterBossLines; restored: AfterBossLines }> {
  return {
    professor: {
      speaker: 'Professor Krys:',
      pending: {
        talks: [[
          `"The silence broke, ${name}. I felt it."`,
          '"My fork rings true again."',
          '"But the Lost Track still waits in The Core."',
          '"Go back and reclaim it."',
        ]],
        heal: [
          '"Your signal is fully restored."',
          '"Now go. The Lost Track waits in The Core."',
        ],
      },
      restored: {
        talks: [
          [
            `"You did it, ${name}."`,
            '"The Lost Track plays on every road again."',
            '"Echo Village remembers its song."',
          ],
          [
            '"Listen... even the wind keeps time now."',
            '"My fork has never rung so true."',
          ],
          [
            '"I will write the old melodies down again."',
            '"This time, no silence will take them."',
          ],
        ],
        heal: [
          '"The old melodies carry more power than ever."',
          '"Your signal is fully restored."',
        ],
      },
    },
    guard: {
      speaker: 'Guard Quincy:',
      pending: {
        talks: [[
          '"So the Gatekeeper finally fell."',
          '"Never thought I\'d live to see it, kid."',
          '"But the Lost Track is still down in The Core."',
          '"Don\'t leave a record like that lying around."',
        ]],
        heal: [
          '"A guard\'s remedy."',
          '"Now go get that Lost Track, kid."',
        ],
      },
      restored: {
        talks: [
          [
            '"So you\'re the one who beat the Gatekeeper."',
            '"Nothing left to guard but my records."',
          ],
          [
            '"Played the Lost Track on my old turntable."',
            '"Three times in a row."',
            '"Don\'t tell anyone."',
          ],
          [
            '"Neon Junction hasn\'t been this loud in years."',
            `"Stay loud, ${name}."`,
          ],
        ],
        heal: [
          '"A guard\'s remedy."',
          '"Even heroes need one now and then."',
        ],
      },
    },
    musician: {
      speaker: 'Kian Vero:',
      pending: {
        talks: [[
          '"The silence broke. I felt it in my strings."',
          '"But the Lost Track is still in The Core."',
          '"Please... bring it home."',
        ]],
        heal: [
          '"Music heals all wounds."',
          '"Now bring the Lost Track home, friend."',
        ],
      },
      restored: {
        talks: [
          [
            '"You brought it back... the Lost Track!"',
            '"I hear it in every street."',
            '"I thought I\'d never play again."',
          ],
          [
            '"I tuned my strings to the Lost Track."',
            '"Now I play it every evening."',
          ],
          [
            '"Thank you, friend."',
            '"The most beautiful thing... and it\'s ours again."',
          ],
        ],
        heal: [
          '"Music heals all wounds."',
          '"And now the whole world can hear it."',
        ],
      },
    },
  };
}

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private boss?: Boss;
  private fragments: Phaser.GameObjects.Sprite[] = [];
  private insideGateZone = false;
  private lastZonePayload?: ZoneUiPayload;
  private reducedMotion = false;
  private lostTrackItem?: Phaser.GameObjects.Sprite;
  private lostTrackEffects: Phaser.GameObjects.GameObject[] = [];
  private runeGraphics: Phaser.GameObjects.GameObject[] = [];
  private caveSurfaceTiles: Phaser.GameObjects.Image[] = [];
  private terrain?: TerrainLayer;
  private lighting?: WorldLighting;
  private caveCorruptionObjects: Phaser.GameObjects.GameObject[] = [];
  private universePortals: Array<{ x: number; y: number }> = [];
  private nearbyUniversePortals = new Set<number>();
  private nextUniversePortalNoticeAt = 0;
  private purifiedCaveEffects: Phaser.GameObjects.GameObject[] = [];
  private cavePurified = false;
  private finaleOverlay?: Phaser.GameObjects.Container;

  // NPCs
  private npcSprite?: Npc;   // Professor Krys — Echo Village
  private npc2Sprite?: Npc;  // Guard Quincy — Neon Junction
  private npc3Sprite?: Npc;  // Kian Vero — Neon Junction

  private npcInteractLabel?: Phaser.GameObjects.Container;
  private npc2InteractLabel?: Phaser.GameObjects.Container;
  private npc3InteractLabel?: Phaser.GameObjects.Container;

  private npcFirstDialogDone  = false;
  private npc2FirstDialogDone = false;
  private npc3FirstDialogDone = false;
  /** Post-boss talks so far, per NPC and quest state, so repeat visits cycle through the lines. */
  private afterBossTurns = new Map<string, number>();

  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private gateOpen = false;

  // Dialog
  private dialogBox?: Phaser.GameObjects.Container;
  private dialogActive = false;
  private npcInteractionReadyAt = 0;
  private dialogQueue: string[] = [];
  private isTyping = false;
  private currentTypeTimer?: Phaser.Time.TimerEvent;
  private currentLine = '';
  private activeDialogSpeaker?: string;
  private introActive = false;
  private introCameraBeat = -1;
  private introCinematicOverlay?: {
    scene: Phaser.Scene;
    items: Phaser.GameObjects.GameObject[];
  };

  // State
  private battleActive = false;
  private worldFrozen = false;

  // Pentagram center — boss triggers when player walks into the rune circle
  private readonly PENTAGRAM_X = BOSS_CORE_COL * TILE;
  private readonly PENTAGRAM_Y = BOSS_CORE_ROW * TILE;
  private readonly PENTAGRAM_TRIGGER_RADIUS = 4 * TILE; // ~64 px, just inside the outer ring
  private bossEncounterStarted = false;

  // Boss approach zone — final antechamber before the actual encounter.
  private bossApproachRect = new Phaser.Geom.Rectangle(0, (CORE_START_ROW - 4) * TILE, MAP_COLS * TILE, 4 * TILE);
  private bossApproachStarted = false;
  private approachEffects: Phaser.GameObjects.GameObject[] = [];
  private _approachShakeTimer?: Phaser.Time.TimerEvent;

  // Gate zone — the doorway itself, within reach of the seal.
  private gateZoneRect = new Phaser.Geom.Rectangle(
    (GATE_CENTER_COL - 2) * TILE,
    (GATE_START_ROW - 1) * TILE + 4,
    4 * TILE,
    TILE + 12,
  );

  // Sign positions
  /** Every signpost on the map: where it stands, what it says, its key cap. */
  private activeHeal?: NpcHealHandle;
  private gate?: FrequencyGate;
  private signs: Array<{ x: number; y: number; lines: () => string[]; label: Phaser.GameObjects.Container }> = [];
  /** Every building's front door: where it stands, the step in front of it, its key cap. */
  private doors: Array<InteriorDoor & { zone: Phaser.Geom.Rectangle; label: Phaser.GameObjects.Container }> = [];
  /** The room whose painting was last asked for: the nearest door's. */
  private prefetchedRoom?: InteriorRoomId;
  /** The hero is inside a building (InteriorScene); this scene sleeps meanwhile. */
  private interiorOpen = false;
  /** Fading out through a door. */
  private doorTransition = false;

  // Input
  private interactKey!: Phaser.Input.Keyboard.Key;

  // Footstep audio
  private footstepSurface: FootstepSurface = 'none';

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
  private playerShadow?: Phaser.GameObjects.Image;
  private playerCastShadow?: SpriteShadow;
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
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.npcInteractionReadyAt = 0;
    // A continued journey remembers who the hero has met and what was said once.
    this.shownOnce = new Set(useGameStore.getState().seenDialogs);
    this.npcFirstDialogDone = this.shownOnce.has('professor-intro');
    this.npc2FirstDialogDone = this.shownOnce.has('quincy-met');
    this.npc3FirstDialogDone = this.shownOnce.has('kian-met');
    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');
    EventBus.emit(EVENTS.CUTSCENE_STATE, true);

    // Build map
    const mapResult = MapBuilder.build(this);
    this.terrain = mapResult.terrain;
    this.walls = mapResult.walls;
    this.universePortals = mapResult.universePortals;
    this.nearbyUniversePortals.clear();
    this.nextUniversePortalNoticeAt = 0;
    this.gate?.destroy();
    this.gate = FrequencyGate.create(this, {
      reducedMotion: this.reducedMotion,
      open: useGameStore.getState().gateOpen,
      progress: () => {
        const state = useGameStore.getState();
        return { level: state.level, xp: state.xp, xpForLevel2: getXPForNextLevel(1) };
      },
      shake: (duration, intensity) => this.cameraShake(duration, shakeIntensity(intensity)),
    });
    if (useGameStore.getState().gateOpen) {
      this.gateOpen = true;
      this.setGateOpenVisual(false);
    }

    // Spawn player
    this.spawnX = mapResult.spawnX;
    this.spawnY = mapResult.spawnY;
    this.player = new Player(this, this.spawnX, this.spawnY);

    this.createWorldAtmosphere();
    this.lighting = new WorldLighting(this);
    this.lighting.addLights(mapResult.lights);

    this.cameras.main.startFollow(this.player, true, 1, 1);
    this.cameras.main.setZoom(WORLD_ZOOM);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(850, 5, 9, 8);

    this.physics.add.collider(this.player, this.walls);

    // Signposts, readable as often as the player likes.
    const sign = (pos: { x: number; y: number }, lines: () => string[]) => ({
      ...pos, lines, label: this.createInteractLabel(pos.x, pos.y, SIGN_LABEL_LIFT),
    });
    this.signs = [
      sign(mapResult.signPos, () => [
        'SIGNAL MEADOW — south.',
        'Tall grass stretches across the road.',
        'Brookside Crossing lies beyond.',
        `Walk carefully, ${useGameStore.getState().playerName || 'Mr Mario'}.`,
      ]),
      sign(mapResult.overlookSignPos, () => [
        'EAST OVERLOOK.',
        'The whole meadow hums from up here.',
        'A quiet clearing lies to the west, off the road.',
      ]),
      sign(mapResult.sign2Pos, () => [
        'WARNING.',
        'FREQUENCY GATE — south.',
        'Passage requires Level 2.',
        'Beyond: the Fading Highlands.',
        'Beyond that: silence.',
      ]),
      sign(mapResult.alcoveSignPos, () => [
        'HIGHLAND ALCOVE.',
        'Lost sounds drift down into the hollow below.',
        'The Void Cave lies south. Go in with full HP.',
      ]),
    ];

    // Every building's door: E (or A) on the step in front of it goes inside.
    this.interiorOpen = false;
    this.doorTransition = false;
    this.prefetchedRoom = undefined;
    this.doors = interiorDoors().map(door => ({
      ...door,
      zone: new Phaser.Geom.Rectangle(door.x - 12, door.y, 24, 22),
      label: buildInteractLabel(this, door.x, door.y, { lift: DOOR_LABEL_LIFT, verb: 'Enter', reducedMotion: this.reducedMotion }),
    }));
    this.events.on(Phaser.Scenes.Events.WAKE, this.onWake, this);

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
      this.boss.setRevealAlpha(0);
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
    this.worldFrozen = true;
    this.player.freeze();
    this.time.delayedCall(120, () => {
      if (this.shownOnce.has('professor-intro')) this.resumeJourney();
      else this.startIntroCutscene();
    });
    // The loading overlay lifts once the world has actually been drawn.
    this.events.once(Phaser.Scenes.Events.RENDER, () => EventBus.emit(EVENTS.SCENE_READY, 'WorldScene'));
  }

  /** A continued journey skips the introduction: the hero wakes up in Echo Village. */
  private resumeJourney(): void {
    this.player.unfreeze();
    this.worldFrozen = false;
    EventBus.emit(EVENTS.CUTSCENE_STATE, false);
    this.currentZoneIndex = -1;
    this.updateZonePresentation(true);
    const store = useGameStore.getState();
    EventBus.emit(EVENTS.UI_NOTICE, {
      eyebrow: 'Welcome back',
      title: store.playerName,
      detail: `Level ${store.level}, ${store.fragmentsFound.length} of ${FRAGMENT_COUNT} sound fragments. You wake up in Echo Village.`,
      tone: 'info',
      duration: 3600,
    });
  }

  /** Marks a one-time moment as played, for this run and for the save. */
  private remember(key: string): void {
    this.shownOnce.add(key);
    useGameStore.getState().markSeen(key);
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(time: number, delta: number): void {
    this.gate?.update(time, delta, this.player);
    this.updateLighting();
    // Anchor dialog box to the bottom of the camera viewport every frame
    if (this.dialogBox && this.cameras.main) {
      const wv = this.cameras.main.worldView;
      this.dialogBox.setPosition(wv.x + 4, wv.y + wv.height - 76);
    }

    this.updateNpcs(delta);

    // During the introduction the player tracks Professor Krys instead of
    // staring straight ahead while she approaches and speaks.
    if (this.introActive && this.npcSprite) {
      this.player.faceToward(this.npcSprite.x, this.npcSprite.y);
    }

    const mobileAction = consumeMobileAction();
    // Consume E even while dialogue freezes the world, so it cannot carry over.
    const keyboardAction = Phaser.Input.Keyboard.JustDown(this.interactKey);
    if (mobileAction && this.dialogActive) {
      this.handleDialogAdvance();
      (this.player?.body as Phaser.Physics.Arcade.Body | undefined)?.setVelocity(0, 0);
      this.setFootstepSurface('none');
      return;
    }

    if (this.worldFrozen || this.battleActive) {
      (this.player?.body as Phaser.Physics.Arcade.Body | undefined)?.setVelocity(0, 0);
      this.setFootstepSurface('none');
      return;
    }

    this.player.update(delta);
    this.updateWorldPresentation(delta);
    this.setFootstepSurface(
      this.player.isMoving() ? (this.isPlayerInTallGrass() ? 'grass' : 'ground') : 'none',
    );

    // ── NPC proximity interactions ─────────────────────────────────────────
    const interactionRequested = mobileAction || keyboardAction;
    this.checkNpcProximity(interactionRequested);
    this.checkUniversePortalProximity(interactionRequested);

    // ── Signs (E to read, again whenever wanted) ───────────────────────────
    // The cooldown keeps the key press that closes a sign from reopening it.
    const nearSign = !this.dialogActive && this.time.now >= this.npcInteractionReadyAt
      ? this.signs.find(s => Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y) < SIGN_READ_DISTANCE)
      : undefined;
    this.signs.forEach(s => s.label.setVisible(s === nearSign));
    if (nearSign && interactionRequested) {
      nearSign.label.setVisible(false);
      this.player.faceToward(nearSign.x, nearSign.y);
      this.showDialog(nearSign.lines());
    }

    // Building doors (E to go inside)
    if (this.checkDoors(interactionRequested)) return;

    // ── Gate zone ─────────────────────────────────────────────────────────
    if (!this.gateOpen && this.gateZoneRect.contains(this.player.x, this.player.y)) {
      const store = useGameStore.getState();
      if (store.level >= 2) {
        this.openGate();
      } else {
        // The sound and notice follow the gate's own denial, which has a cooldown.
        if (!this.insideGateZone && (this.gate?.deny(this.player.x, this.player.y) ?? true)) {
          EventBus.emit(EVENTS.GATE_BLOCKED);
          if (this.shownOnce.has('gate-lock')) {
            const toGo = Math.max(0, getXPForNextLevel(store.level) - store.xp);
            EventBus.emit(EVENTS.UI_NOTICE, {
              eyebrow: 'Frequency Gate',
              title: 'Sealed until level 2',
              detail: `${toGo} XP to go. Battles in the tall grass nearby earn XP.`,
              tone: 'info',
              duration: 2600,
            });
          }
          this.showDialogOnce('gate-lock', [
            `You are Level ${store.level}.`,
            'The Frequency Gate remains sealed.',
            'Reach Level 2 to pass.',
            'Train in the tall grass nearby.',
          ]);
        }
      }
    }
    this.insideGateZone = !this.gateOpen && this.gateZoneRect.contains(this.player.x, this.player.y);

    // ── Boss approach zone — pre-encounter tension ───────────────────────
    if (!this.bossApproachStarted && this.gateOpen &&
        this.bossApproachRect.contains(this.player.x, this.player.y)) {
      this.startBossApproach();
    }

    // ── Boss zone — triggers only when player steps into the rune circle ──
    // The boss's art and sounds stream in behind the world; the circle waits for them.
    if (!this.bossEncounterStarted && this.gateOpen && isStreamGroupReady(this, 'boss')) {
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
    // A doorstep is never a battlefield, whatever an edited map grows there.
    const inGrass = this.player.isMoving() && this.isPlayerInTallGrass()
      && !this.doors.some(door => door.zone.contains(this.player.x, this.player.y));
    // No encounter until the battle art and sounds have streamed in.
    if (inGrass && this.postBattleCooldown <= 0 && isStreamGroupReady(this, 'battle')) {
      this.grassStepTimer += delta;
      if (this.grassStepTimer >= this.GRASS_STEP_MS) {
        this.grassStepTimer = 0;
        if (Math.random() < this.ENCOUNTER_CHANCE) {
          this.startRandomEncounter(this.pickEncounter(Math.floor(this.player.y / TILE)));
        }
      }
    } else if (!inGrass) {
      this.grassStepTimer = 0;
    }
  }

  private updateLighting(): void {
    if (!this.lighting || !this.player) return;
    this.lighting.setPlayer(this.player.x, this.player.y);
    // Darkness follows the camera so cutscene flights into the cave read correctly.
    const row = this.cameras.main.worldView.centerY / TILE;
    const depth = Phaser.Math.Clamp((row - 109) / 8, 0, 1);
    const core = Phaser.Math.Clamp((row - (CORE_START_ROW - 2)) / 4, 0, 1);
    this.lighting.setTargetDarkness(depth * (this.cavePurified ? 0.36 : 0.74) + core * (this.cavePurified ? 0 : 0.06));
  }

  // ── NPC helpers ───────────────────────────────────────────────────────────

  private createWorldAtmosphere(): void {
    const viewW = this.scale.width;

    this.playerShadow = this.add.image(this.player.x, this.player.y + 1, FX.shadow).setDisplaySize(16, 5.6).setAlpha(0.5);
    this.playerShadow.setDepth(4);
    this.playerCastShadow = new SpriteShadow(this, this.player);

    // Drifting pollen and seed fluff catch the light above the meadows.
    for (let index = 0; index < 60; index++) {
      const color = index % 7 === 0 ? 0xbfe8ff : index % 3 === 0 ? 0xfff0b8 : 0xf6f2dc;
      const size = 1 + Math.random() * 1.6;
      const startX = 4 * TILE + Math.random() * (MAP_COLS - 8) * TILE;
      const startY = 2 * TILE + Math.random() * (CAVE_START_ROW - 8) * TILE;
      const mote = this.add.image(startX, startY, FX.mote).setDisplaySize(size, size)
        .setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(30);
      this.tweens.add({
        targets: mote,
        x: startX + Phaser.Math.Between(-30, 30),
        y: startY - Phaser.Math.Between(18, 52),
        alpha: { from: 0.05, to: 0.7 },
        duration: 3600 + Math.random() * 3400,
        delay: Math.random() * 2400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Soft cinematic grade: gentle vignette and a touch of contrast.
    if (this.cameras.main.postFX) {
      this.cameras.main.postFX.addVignette(0.5, 0.5, 0.92, 0.28);
      const grade = this.cameras.main.postFX.addColorMatrix();
      grade.contrast(0.06, true);
      grade.saturate(0.08, true);
    }

    this.zoneWash = this.add.graphics().setDepth(43).setScrollFactor(0);

    const panel = this.add.graphics();
    panel.fillStyle(0x0a0605, 0.84);
    panel.fillRect(0, 0, 148, 39);
    panel.lineStyle(1, 0xff7a2b, 0.2);
    panel.strokeRect(0, 0, 148, 39);
    this.zoneHudAccent = this.add.graphics();
    this.zoneHudTitle = this.add.text(12, 7, '', {
      fontFamily: 'Sora', fontStyle: 'bold', fontSize: '9px', color: '#f8ece2',
    });
    this.zoneHudMeta = this.add.text(12, 23, '', {
      fontFamily: 'DM Mono', fontSize: '5px', color: '#82776f', letterSpacing: 1,
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
      this.playerShadow.setPosition(this.player.x + 1, this.player.y + 1);
      this.playerShadow.setDisplaySize(this.player.isMoving() ? 17.2 : 16, 5.6);
      this.playerShadow.setAlpha(this.player.y >= CAVE_START_ROW * TILE ? 0.62 : 0.5);
    }
    // No sun underground.
    this.playerCastShadow?.sync(this.player.y < CAVE_START_ROW * TILE);

    this.footstepTimer += delta;
    if (this.player.isMoving() && this.footstepTimer >= 150) {
      this.footstepTimer = 0;
      const inCave = this.player.y >= (CAVE_START_ROW - 4) * TILE;
      const onGrass = this.isPlayerInTallGrass();
      if (!onGrass) {
        // A small puff of dust kicked up by the step.
        const dust = this.add.image(this.player.x + Phaser.Math.Between(-3, 3), this.player.y + 1, FX.glow)
          .setDisplaySize(5, 3).setTint(inCave ? 0x8fa8b0 : 0xd8c69a).setAlpha(inCave ? 0.32 : 0.4).setDepth(4.5);
        this.tweens.add({
          targets: dust,
          x: dust.x + Phaser.Math.Between(-5, 5),
          y: dust.y - 2,
          displayWidth: 12,
          displayHeight: 6,
          alpha: 0,
          duration: 520,
          ease: 'Quad.easeOut',
          onComplete: () => dust.destroy(),
        });
      }
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

  /**
   * Announces what the player is walking on, but only when it actually
   * changes — the footstep loop is driven by state transitions, not by a
   * per-frame event.
   */
  private setFootstepSurface(surface: FootstepSurface): void {
    if (surface === this.footstepSurface) return;
    this.footstepSurface = surface;
    EventBus.emit(EVENTS.FOOTSTEPS, surface);
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
      const baseScale = (tile.getData('baseScale') as number | undefined) ?? 1;
      this.tweens.killTweensOf(tile);
      tile.setAngle(0).setScale(baseScale);
      this.tweens.add({
        targets: tile,
        angle: bend,
        scaleX: baseScale * (offset === 0 ? 1.08 : 1.04),
        scaleY: baseScale * (entering && offset === 0 ? 0.82 : 0.9),
        duration: 55,
        hold: 25,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => tile.setAngle(0).setScale(baseScale),
      });
    });
  }

  private spawnGrassRustle(count: number): void {
    // Torn blade tips and seed husks fly up as the grass parts.
    const colors = [0x8fb455, 0x6f9a44, 0xc4b46a];
    for (let index = 0; index < count; index++) {
      const side = index % 2 === 0 ? -1 : 1;
      const leaf = this.add.image(
        this.player.x + side * Phaser.Math.Between(3, 7),
        this.player.y - Phaser.Math.Between(2, 7),
        FX.leaf,
      ).setName('grass-rustle').setDepth(this.player.depth + 0.012)
        .setTint(colors[(this.grassVisualStep + index) % colors.length])
        .setDisplaySize(index % 3 === 0 ? 3 : 2.2, index % 3 === 0 ? 1.6 : 1.2);
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
    const zoneIndex = row < SIGNAL_START_ROW ? 0
      : row < BROOK_START_ROW ? 1
        : row < JUNCTION_START_ROW ? 2
          : row < GROVE_START_ROW ? 3
            : row < FADING_START_ROW ? 4
              : row < CAVE_START_ROW ? 5
                : row < CORE_START_ROW ? 6 : 7;
    if (!force && zoneIndex === this.currentZoneIndex) return;
    this.currentZoneIndex = zoneIndex;

    const zones = [
      { title: 'Echo Village', meta: 'Where the journey begins', accent: 0xff7a2b, wash: 0x725d4e, alpha: 0.025 },
      { title: 'Signal Meadow', meta: 'Open fields', accent: 0xab907c, wash: 0x6d4f40, alpha: 0.035 },
      { title: 'Brookside Crossing', meta: 'River crossing', accent: 0x75b7ad, wash: 0x35564e, alpha: 0.035 },
      { title: 'Neon Junction', meta: 'Relay district', accent: 0x6ea8d8, wash: 0x5d3e2f, alpha: 0.045 },
      { title: 'Whisper Grove', meta: 'Old woods', accent: 0x89a97c, wash: 0x314a39, alpha: 0.05 },
      { title: 'Fading Highlands', meta: 'The signal grows weak', accent: 0x9e806b, wash: 0x3c2d25, alpha: 0.07 },
      this.cavePurified
        ? { title: 'Resonant Cave', meta: 'Sound restored', accent: 0xff7a2b, wash: 0x5d3e2f, alpha: 0.065 }
        : { title: 'Void Cave', meta: 'Nothing but silence', accent: 0x6ea8d8, wash: 0x301e15, alpha: 0.09 },
      this.cavePurified
        ? { title: 'The Living Core', meta: 'Sound restored', accent: 0x6ea8d8, wash: 0x4f3122, alpha: 0.07 }
        : { title: 'The Core', meta: 'The Gatekeeper waits', accent: 0xe8b465, wash: 0x351612, alpha: 0.12 },
    ];
    const zone = zones[zoneIndex];
    this.lastZonePayload = {
      title: zone.title,
      meta: zone.meta,
      accent: `#${zone.accent.toString(16).padStart(6, '0')}`,
    };
    EventBus.emit(EVENTS.ZONE_UI_STATE, this.lastZonePayload);
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

  private checkUniversePortalProximity(interactionRequested: boolean): void {
    if (this.dialogActive || this.worldFrozen || this.battleActive) return;

    for (let index = 0; index < this.universePortals.length; index++) {
      const portal = this.universePortals[index];
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, portal.x, portal.y);
      if (distance > 56) {
        this.nearbyUniversePortals.delete(index);
        continue;
      }
      if (distance > 42) continue;
      if (this.nearbyUniversePortals.has(index) && !interactionRequested) continue;
      if (this.time.now < this.nextUniversePortalNoticeAt) continue;

      // Stay quiet while the player remains nearby; E/touch can repeat the notice.
      this.nearbyUniversePortals.add(index);
      this.nextUniversePortalNoticeAt = this.time.now + 4500;
      EventBus.emit(EVENTS.GATE_BLOCKED);
      EventBus.emit(EVENTS.UI_NOTICE, {
        eyebrow: 'Universe portal',
        title: 'Dormant',
        detail: 'The portal hums, but no signal answers from the other side.',
        accent: '#b59aff',
        tone: 'info',
        duration: 4500,
      });
      return;
    }
  }

  /** The buildings' doors. Returns true once the hero goes inside. */
  private checkDoors(interactionRequested: boolean): boolean {
    this.prefetchNearestRoom();
    // The cooldown keeps the press that closed a dialogue from opening a door.
    const door = !this.dialogActive && !this.doorTransition && this.time.now >= this.npcInteractionReadyAt
      ? this.doors.find(candidate => candidate.zone.contains(this.player.x, this.player.y))
      : undefined;
    this.doors.forEach(candidate => candidate.label.setVisible(candidate === door));
    if (!door || !interactionRequested) return false;
    this.enterInterior(door);
    return true;
  }

  /**
   * Room paintings never load with the world: the nearest door's starts on
   * the approach, and the room left behind is freed once its door is no
   * longer the nearest (the hero walked away from it).
   */
  private prefetchNearestRoom(): void {
    let nearest: InteriorRoomId | undefined;
    let nearestDistance = DOOR_PREFETCH_DISTANCE;
    for (const door of this.doors) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, door.x, door.y);
      if (distance < nearestDistance) {
        nearest = door.room;
        nearestDistance = distance;
      }
    }
    if (nearest === this.prefetchedRoom) return;
    if (this.prefetchedRoom) releaseRoomArt(this.textures, this.prefetchedRoom);
    this.prefetchedRoom = nearest;
    if (nearest) prefetchRoomArt(this.textures, nearest);
  }

  private enterInterior(door: InteriorDoor & { label: Phaser.GameObjects.Container }): void {
    this.doorTransition = true;
    this.worldFrozen = true;
    door.label.setVisible(false);
    this.player.faceToward(door.x, door.y - 20);
    this.player.freeze();
    this.setFootstepSurface('none');
    const cam = this.cameras.main;
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.interiorOpen = true;
      this.scene.launch('InteriorScene', { room: door.room });
      this.scene.sleep();
    });
    // Forced, so a fade still running cannot swallow the completion.
    cam.fade(DOOR_FADE_OUT_MS, 5, 9, 8, true);
  }

  /** Back from a building: the hero steps out in front of its door, facing away from it. */
  private onWake(_sys: Phaser.Scenes.Systems, data?: { from?: string; room?: InteriorRoomId }): void {
    if (data?.from !== 'InteriorScene') return;
    this.interiorOpen = false;
    this.doorTransition = false;
    this.player.unfreeze();
    const door = this.doors.find(candidate => candidate.room === data.room);
    if (door) {
      (this.player.body as Phaser.Physics.Arcade.Body).reset(door.x, door.exitY);
      this.player.faceToward(door.x, door.exitY + 20);
    }
    this.worldFrozen = false;
    // Keys pressed or let go inside never reached this scene, and an A tap
    // during the fade must not act out here.
    this.input.keyboard?.resetKeys();
    consumeMobileAction();
    // The scene clock stood still while asleep; scenes are stepped with the loop's time.
    this.npcInteractionReadyAt = this.game.loop.now + NPC_DIALOG_COOLDOWN_MS;
    this.cameras.main.fadeIn(DOOR_FADE_IN_MS, 5, 9, 8);
  }

  private interiorScene(): InteriorScene | undefined {
    return this.scene.get('InteriorScene') as InteriorScene | undefined;
  }

  private checkNpcProximity(interactionRequested: boolean): void {
    if (this.time.now < this.npcInteractionReadyAt) {
      this.npcInteractLabel?.setVisible(false);
      this.npc2InteractLabel?.setVisible(false);
      this.npc3InteractLabel?.setVisible(false);
      return;
    }
    const px = this.player.x;
    const py = this.player.y;

    // NPC 1 — Professor Krys
    const d1 = this.npcSprite
      ? Phaser.Math.Distance.Between(px, py, this.npcSprite.x, this.npcSprite.y)
      : 999;
    const near1 = d1 < 30;
    this.npcInteractLabel?.setVisible(near1 && !this.dialogActive);
    if (near1 && this.npcSprite && !this.dialogActive && interactionRequested) {
      this.player.faceToward(this.npcSprite.x, this.npcSprite.y);
      this.npcSprite.faceToward(px, py);
      this.triggerNpc1();
    }

    // NPC 2 — Guard Quincy
    const d2 = this.npc2Sprite
      ? Phaser.Math.Distance.Between(px, py, this.npc2Sprite.x, this.npc2Sprite.y)
      : 999;
    const near2 = d2 < 30;
    this.npc2InteractLabel?.setVisible(near2 && !this.dialogActive);
    if (near2 && this.npc2Sprite && !this.dialogActive && interactionRequested) {
      this.player.faceToward(this.npc2Sprite.x, this.npc2Sprite.y);
      this.npc2Sprite.faceToward(px, py);
      this.triggerNpc2();
    }

    // NPC 3 — Kian Vero
    const d3 = this.npc3Sprite
      ? Phaser.Math.Distance.Between(px, py, this.npc3Sprite.x, this.npc3Sprite.y)
      : 999;
    const near3 = d3 < 30;
    this.npc3InteractLabel?.setVisible(near3 && !this.dialogActive);
    if (near3 && this.npc3Sprite && !this.dialogActive && interactionRequested) {
      this.player.faceToward(this.npc3Sprite.x, this.npc3Sprite.y);
      this.npc3Sprite.faceToward(px, py);
      this.triggerNpc3();
    }
  }

  // ── Spawning ──────────────────────────────────────────────────────────────

  private createInteractLabel(x: number, y: number, lift = CHARACTER_HEIGHT): Phaser.GameObjects.Container {
    return buildInteractLabel(this, x, y, { lift });
  }

  private spawnNPC(x: number, y: number, _textureKey: string, _labelField: string): void {
    this.npcSprite = this.createNpcActor(x, y, 'professor', 26, 18);
    this.npcInteractLabel = this.createInteractLabel(x, y);
  }

  private spawnNPC2(x: number, y: number): void {
    this.npc2Sprite = this.createNpcActor(x, y, 'guard', 18, 10);
    this.npc2InteractLabel = this.createInteractLabel(x, y);
  }

  private spawnNPC3(x: number, y: number): void {
    this.npc3Sprite = this.createNpcActor(x, y, 'musician', 42, 24);
    this.npc3InteractLabel = this.createInteractLabel(x, y);
  }

  private createNpcActor(
    x: number,
    y: number,
    npcId: 'professor' | 'guard' | 'musician',
    radiusX: number,
    radiusY: number,
  ): Npc {
    const npc = new Npc(this, x, y, npcId, { radiusX, radiusY });
    this.physics.add.collider(npc, this.walls);
    this.physics.add.collider(this.player, npc);
    return npc;
  }

  private updateNpcs(delta: number): void {
    const movementEnabled = !this.worldFrozen && !this.battleActive && !this.dialogActive;
    const entries: Array<[Npc | undefined, Phaser.GameObjects.Container | undefined]> = [
      [this.npcSprite, this.npcInteractLabel],
      [this.npc2Sprite, this.npc2InteractLabel],
      [this.npc3Sprite, this.npc3InteractLabel],
    ];

    entries.forEach(([npc, label]) => {
      npc?.update(delta, movementEnabled);
      if (npc && label) label.setPosition(npc.x, npc.y);
    });
  }

  private startIntroCutscene(): void {
    if (this.introActive || this.shownOnce.has('professor-intro') || !this.npcSprite) return;

    this.introActive = true;
    // Saved as seen only once it has played out: a reload mid-intro shows it again.
    this.shownOnce.add('professor-intro');
    this.npcFirstDialogDone = true;
    this.worldFrozen = true;
    this.player.freeze();
    this.npcSprite.stopPatrol();
    this.zoneHud?.setVisible(false);
    EventBus.emit(EVENTS.UI_NOTICE_CLEAR);

    this.cameras.main.stopFollow();
    this.createIntroCinematicOverlay();

    // Open on Professor Krys's laboratory before gliding across the village.
    // The camera starts moving while the scene is still fading in, so the
    // loading transition resolves into an establishing shot instead of a cut.
    const laboratoryX = 22 * TILE;
    const laboratoryY = 7 * TILE;
    this.moveIntroCamera(laboratoryX, laboratoryY, this.introZoom(1.55), 820, 'Cubic.easeInOut');

    const approachX = this.player.x - 30;
    const approachY = this.player.y;
    const focusX = (approachX + this.player.x) / 2;
    const focusY = this.player.y - 7;

    this.time.delayedCall(760, () => {
      if (!this.introActive || !this.npcSprite) return;
      this.moveIntroCamera(focusX, focusY, this.introZoom(2.08), 1500, 'Sine.easeInOut');

      // Walk on the village paths in two readable legs. A direct diagonal
      // tween would slide while showing only one directional walk cycle.
      this.npcSprite.walkScriptedTo(this.npcSprite.x, approachY, 1180, () => {
        if (!this.introActive || !this.npcSprite) return;
        this.npcSprite.walkScriptedTo(approachX, approachY, 620, () => {
          this.npcSprite?.faceToward(this.player.x, this.player.y);
          this.player.faceToward(approachX, approachY);
        });
      });
    });

    const playerName = useGameStore.getState().playerName || 'Listener';
    this.time.delayedCall(2740, () => {
      if (!this.introActive) return;
      this.showDialog([
        'Professor Krys:',
        `"${playerName}, wait. The Gatekeeper stole the Lost Track."`,
        '"Follow the signal south. Two Sound Fragments lie on the road, the third beyond the Frequency Gate."',
        '"Reach Level 2 to cross the gate, then find him in the silence beyond."',
        '"If your signal fades, find one of us. We can tune it back into shape."',
      ], () => this.finishIntroCutscene(), beat => this.playIntroBeat(beat));
    });
  }

  private playIntroBeat(beat: number): void {
    if (!this.npcSprite) return;
    this.introCameraBeat = beat;

    if (beat === 0) {
      this.npcSprite.faceToward(this.player.x, this.player.y);
      const focusX = (this.npcSprite.x + this.player.x) / 2;
      const focusY = (this.npcSprite.y + this.player.y) / 2 - 7;
      this.moveIntroCamera(focusX, focusY, this.introZoom(2.2), 520, 'Sine.easeOut');
      this.pulseProfessorSignal();
      return;
    }

    if (beat === 1) {
      const fragment = this.fragments[0];
      const targetX = fragment?.x ?? 13 * TILE + TILE / 2;
      const targetY = fragment?.y ?? 29 * TILE + TILE / 2;
      this.moveIntroCamera(targetX, targetY - 8, this.introZoom(1.72), 980, 'Cubic.easeInOut');
      this.time.delayedCall(610, () => {
        if (this.introActive && this.introCameraBeat === beat) {
          this.pulseIntroTarget(targetX, targetY, 'Sound fragment', 0x78b4e6);
        }
      });
      return;
    }

    if (beat === 2) {
      const gateX = GATE_CENTER_COL * TILE;
      const gateY = (GATE_START_ROW + 1) * TILE;
      // This long southbound sweep briefly exposes the scale of the journey
      // before landing on the locked gate named in the current dialog line.
      this.moveIntroCamera(gateX, gateY, this.introZoom(1.28), 1450, 'Sine.easeInOut');
      this.time.delayedCall(1110, () => {
        if (this.introActive && this.introCameraBeat === beat) {
          this.pulseIntroTarget(gateX, gateY, 'Locked gate', 0xff7a2b);
          this.cameraShake(180, shakeIntensity(0.0018));
        }
      });
      return;
    }

    const professorFocusX = (this.npcSprite.x + this.player.x) / 2;
    const professorFocusY = (this.npcSprite.y + this.player.y) / 2 - 5;
    this.moveIntroCamera(professorFocusX, professorFocusY, this.introZoom(2.08), 1180, 'Cubic.easeInOut');
    this.time.delayedCall(820, () => {
      if (this.introActive && this.introCameraBeat === beat) this.pulseProfessorSignal();
    });
    this.npcSprite.faceToward(this.player.x, this.player.y);
  }

  private finishIntroCutscene(): void {
    this.worldFrozen = true;
    this.introCameraBeat = -1;
    this.moveIntroCamera(this.player.x, this.player.y, 2, 1250, 'Cubic.easeInOut');

    this.time.delayedCall(460, () => {
      if (!this.introActive) return;
      EventBus.emit(EVENTS.UI_NOTICE, {
        eyebrow: 'New quest',
        title: 'Recover the Lost Track',
        detail: 'Collect 3 sound fragments, reach level 2 to open the gate, then defeat the Gatekeeper.',
        accent: '#f2c35f',
        tone: 'info',
        variant: 'hero',
        duration: 2300,
      });
    });

    this.time.delayedCall(920, () => this.dismissIntroCinematicOverlay());
    this.time.delayedCall(1380, () => {
      if (!this.introActive) return;
      this.cameras.main.startFollow(this.player, true, 1, 1);
      this.cameras.main.setZoom(WORLD_ZOOM);
      this.player.unfreeze();
      this.introActive = false;
      this.worldFrozen = false;
      useGameStore.getState().markSeen('professor-intro');
      EventBus.emit(EVENTS.CUTSCENE_STATE, false);
      this.currentZoneIndex = -1;
      this.updateZonePresentation(true);
    });
  }

  private moveIntroCamera(
    x: number,
    y: number,
    zoom: number,
    duration: number,
    ease: string,
  ): void {
    this.cameras.main.pan(x, y, duration, ease, true);
    this.cameras.main.zoomTo(canvasZoom(zoom), duration, ease, true);
  }

  private introZoom(baseZoom: number): number {
    // Portrait screens show substantially more vertical world space, so a
    // modest boost keeps the subject readable without changing the route.
    return this.scale.height > this.scale.width ? baseZoom * 1.1 : baseZoom;
  }

  private createIntroCinematicOverlay(): void {
    this.introCinematicOverlay?.items.forEach(item => item.destroy());

    // Fixed cinematic chrome belongs to UIScene. World-space objects with a
    // zero scroll factor can still be culled during the long flight to the
    // gate; the UI camera stays at the origin for the entire sequence.
    const ui = this.scene.get('UIScene') as Phaser.Scene;
    const { width, height } = logicalSize(ui);
    const barHeight = Phaser.Math.Clamp(Math.round(height * 0.075), 26, 42);
    const bars = ui.add.graphics().setDepth(90).setAlpha(0);
    bars.fillStyle(0x070504, 0.96);
    bars.fillRect(0, 0, width, barHeight);
    bars.fillRect(0, height - barHeight, width, barHeight);
    bars.fillStyle(0xff7a2b, 0.9);
    bars.fillRect(18, barHeight - 2, Math.min(118, width * 0.25), 1);
    // Type is sized in screen pixels, so the captions read the same on a
    // phone (board shrunk) and on a monitor (board enlarged).
    const screenPerUnit = Math.max(0.1, ui.scale.displaySize.width / width);
    const screenPx = (px: number) => `${Math.round((px / screenPerUnit) * 10) / 10}px`;
    const chapter = ui.add.text(18, barHeight / 2, tr('Prologue'), {
      fontFamily: 'Sora',
      fontSize: screenPx(15),
      fontStyle: 'bold',
      color: '#f7efe8',
    }).setOrigin(0, 0.5).setDepth(91).setResolution(4).setAlpha(0);
    const location = ui.add.text(width - 18, barHeight / 2, 'Echo Village', {
      fontFamily: 'DM Sans',
      fontSize: screenPx(14),
      color: '#cfc2b6',
    }).setOrigin(1, 0.5).setDepth(91).setResolution(4).setAlpha(0);

    const items: Phaser.GameObjects.GameObject[] = [bars, chapter, location];
    this.introCinematicOverlay = { scene: ui, items };

    ui.tweens.add({
      targets: items,
      alpha: 1,
      duration: 520,
      ease: 'Sine.easeOut',
    });
  }

  private dismissIntroCinematicOverlay(): void {
    const overlay = this.introCinematicOverlay;
    if (!overlay) return;
    this.introCinematicOverlay = undefined;
    overlay.scene.tweens.add({
      targets: overlay.items,
      alpha: 0,
      duration: 440,
      ease: 'Sine.easeIn',
      onComplete: () => overlay.items.forEach(item => item.destroy()),
    });
  }

  private pulseProfessorSignal(): void {
    if (!this.npcSprite) return;

    for (let index = 0; index < 3; index++) {
      const ring = this.add.graphics()
        .setDepth(9)
        .setPosition(this.npcSprite.x, this.npcSprite.y - 12)
        .setScale(0.45)
        .setAlpha(0.8);
      ring.lineStyle(index === 1 ? 2 : 1, index === 2 ? 0xff7a2b : 0x6ea8d8, 0.92);
      ring.strokeCircle(0, 0, 8 + index * 3);
      this.tweens.add({
        targets: ring,
        scaleX: 1.65,
        scaleY: 1.65,
        alpha: 0,
        delay: index * 90,
        duration: 520,
        ease: 'Quad.easeOut',
        onComplete: () => ring.destroy(),
      });
    }
  }

  private pulseIntroTarget(x: number, y: number, label: string, color: number): void {
    const marker = this.add.graphics().setDepth(14).setPosition(x, y).setScale(0.35).setAlpha(0);
    marker.lineStyle(2, color, 0.95);
    marker.strokeCircle(0, 0, 18);
    marker.lineStyle(1, 0xf8ece2, 0.7);
    marker.strokeCircle(0, 0, 25);
    marker.lineBetween(-31, 0, -20, 0);
    marker.lineBetween(20, 0, 31, 0);
    marker.lineBetween(0, -31, 0, -20);
    marker.lineBetween(0, 20, 0, 31);

    const targetLabel = this.add.text(x, y - 39, tr(label), {
      fontFamily: 'DM Sans',
      fontStyle: 'bold',
      fontSize: '7px',
      color: '#f7efe8',
      backgroundColor: '#100c0a',
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(15).setResolution(4).setAlpha(0);

    this.tweens.add({
      targets: marker,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      angle: 90,
      duration: 380,
      hold: 620,
      yoyo: true,
      ease: 'Back.easeOut',
      onComplete: () => marker.destroy(),
    });
    this.tweens.add({
      targets: targetLabel,
      y: y - 44,
      alpha: 1,
      duration: 300,
      hold: 650,
      yoyo: true,
      ease: 'Cubic.easeOut',
      onComplete: () => targetLabel.destroy(),
    });
  }

  private spawnFragments(mapResult: ReturnType<typeof MapBuilder.build>): void {
    const positions = [mapResult.fragment1Pos, mapResult.fragment2Pos, mapResult.fragment3Pos];
    const found = useGameStore.getState().fragmentsFound;
    positions.forEach((pos, index) => {
      if (found.includes(index)) return;
      // Ground glow beneath (visible through grass) — draw at (0,0) so tweens work from center
      const glow = this.add.graphics().setDepth(9);
      glow.setPosition(pos.x, pos.y);
      glow.fillStyle(0x6ea8d8, 0.12);
      glow.fillCircle(0, 0, 10);
      glow.fillStyle(0xff7a2b, 0.14);
      glow.fillCircle(0, 0, 6);
      this.tweens.add({ targets: glow, alpha: 0.34, duration: 920, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

      // Pulsing ring — draw centered at (0,0) so scale works from center
      const ring = this.add.graphics().setDepth(9);
      ring.setPosition(pos.x, pos.y);
      ring.lineStyle(0.8, 0x6ea8d8, 0.42);
      ring.strokeCircle(0, 0, 8.5);
      ring.lineStyle(0.8, 0xff7a2b, 0.22);
      ring.strokeCircle(0, 0, 6);
      this.tweens.add({
        targets: ring, alpha: 0, scaleX: 1.8, scaleY: 1.8,
        duration: 1800, repeat: -1,
        onRepeat: () => { ring.setAlpha(0.4); ring.setScale(1); },
      });

      // Two orbiting signal pips make the object read as an active audio source.
      const orbit = this.add.container(pos.x, pos.y).setDepth(10);
      orbit.add([
        this.add.image(-10, 0, FX.mote).setDisplaySize(2.6, 2.6).setTint(0xff9a4a).setBlendMode(Phaser.BlendModes.ADD),
        this.add.image(10, 0, FX.mote).setDisplaySize(2.3, 2.3).setTint(0xffd890).setBlendMode(Phaser.BlendModes.ADD),
      ]);
      this.tweens.add({ targets: orbit, angle: 360, duration: 2600, repeat: -1, ease: 'Linear' });

      // Vinyl token — high depth so it remains visible above tall grass. It is
      // drawn about half a character tall, while the pickup body keeps its
      // original 26-unit footprint so collecting works exactly as before.
      const frag = this.physics.add.sprite(pos.x, pos.y, 'item-fragment-mr').setDepth(10).setScale(FRAGMENT_SCALE)
        .setData('fragmentIndex', index);
      const pickupSize = FRAGMENT_PICKUP_SIZE / FRAGMENT_SCALE;
      (frag.body as Phaser.Physics.Arcade.Body).setSize(pickupSize, pickupSize, true);
      this.tweens.add({ targets: frag, y: pos.y - 3, duration: 1250, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

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
        'Professor Krys:',
        `"Welcome, young ${pName}."`,
        '"This is Echo Village."',
        '"Long ago, music filled every road."',
        '"Then The Gatekeeper came."',
        '"It sealed the Lost Track in silence."',
        '"Head south through Signal Meadow."',
        '"Grow strong in the tall grass."',
        '"Then find Neon Junction."',
        '"The road forward lies beyond."',
      ]);
    } else {
      const store = useGameStore.getState();
      if (store.hp < store.maxHp) {
        this.showDialog(
          [
            'Professor Krys:',
            `"You look weary, ${useGameStore.getState().playerName}."`,
            '"Close your eyes. Listen..."',
          ],
          () => {
            this.playHealingMusic(this.npcSprite!, this.afterBossLines('professor', true) ?? [
              'Professor Krys:',
              '"The old melodies still carry power."',
              '"Your signal is fully restored."',
            ]);
          }
        );
      } else {
        this.showDialog(this.afterBossLines('professor') ?? [
          'Professor Krys:',
          `"You look well, ${useGameStore.getState().playerName}."`,
          '"The road ahead awaits."',
        ]);
      }
    }
  }

  /** After a first conversation, a hurt hero is healed as the intro promised. */
  private offerFirstMeetingHeal(npc: Npc | undefined, lines: string[]): void {
    const store = useGameStore.getState();
    if (!npc || store.hp >= store.maxHp) return;
    this.playHealingMusic(npc, lines);
  }

  /**
   * An NPC's post-boss lines, read from the store on every talk so a continued
   * save reacts the same way. Undefined until the Gatekeeper falls, so the
   * journey's own lines apply. Repeat talks cycle; heal follow-ups do not.
   */
  private afterBossLines(npcId: Npc['npcId'], healed = false): string[] | undefined {
    const { bossDefeated, bonusSongUnlocked, playerName } = useGameStore.getState();
    if (!bossDefeated) return undefined;
    const dialog = afterBossDialog(playerName)[npcId];
    const lines = bonusSongUnlocked ? dialog.restored : dialog.pending;
    if (healed) return [dialog.speaker, ...lines.heal];
    // Keyed by quest state too, so reclaiming the Lost Track starts its lines from the top.
    const key = `${npcId}:${bonusSongUnlocked}`;
    const turn = this.afterBossTurns.get(key) ?? 0;
    this.afterBossTurns.set(key, turn + 1);
    return [dialog.speaker, ...lines.talks[turn % lines.talks.length]];
  }

  private triggerNpc2(): void {
    if (!this.npc2FirstDialogDone) {
      this.npc2FirstDialogDone = true;
      this.remember('quincy-met');
      this.showDialog(this.afterBossLines('guard') ?? [
        'Guard Quincy:',
        '"You crossed Signal Meadow and Brookside."',
        `"Few reach this far, ${useGameStore.getState().playerName}."`,
        '"The Frequency Gate lies south."',
        '"It demands Level 2 strength."',
        '"Beware what lies beyond."',
        '"The Fading Highlands lead to Void Cave."',
        '"And in that cave..."',
        '"The Gatekeeper waits in The Core."',
      ], () => this.offerFirstMeetingHeal(this.npc2Sprite, this.afterBossLines('guard', true) ?? [
        'Guard Quincy:',
        '"You look rough. Take this old recording with you."',
      ]));
    } else {
      const store = useGameStore.getState();
      if (store.hp < store.maxHp) {
        this.showDialog(
          [
            'Guard Quincy:',
            '"You look rough, kid."',
            '"Hold on... I have an old recording."',
            '"Listen."',
          ],
          () => {
            this.playHealingMusic(this.npc2Sprite!, this.afterBossLines('guard', true) ?? [
              'Guard Quincy:',
              '"A guard\'s remedy."',
              '"Don\'t tell anyone."',
            ]);
          }
        );
      } else {
        this.showDialog(this.afterBossLines('guard') ?? [
          'Guard Quincy:',
          '"The gate opens for the worthy."',
          `"Stay determined, ${useGameStore.getState().playerName}."`,
        ]);
      }
    }
  }

  private triggerNpc3(): void {
    if (!this.npc3FirstDialogDone) {
      this.npc3FirstDialogDone = true;
      this.remember('kian-met');
      this.showDialog(this.afterBossLines('musician') ?? [
        'Kian Vero:',
        '"I used to play every evening."',
        '"Then the silence spread."',
        '"I heard the Lost Track once."',
        '"Just a fragment."',
        '"But it was the most beautiful thing."',
        '"Please... bring it back."',
      ], () => this.offerFirstMeetingHeal(this.npc3Sprite, this.afterBossLines('musician', true) ?? [
        'Kian Vero:',
        '"Music heals all wounds. It always has."',
      ]));
    } else {
      const store = useGameStore.getState();
      if (store.hp < store.maxHp) {
        this.showDialog(
          [
            'Kian Vero:',
            '"You look beaten up, friend."',
            '"Let me play you something..."',
          ],
          () => {
            this.playHealingMusic(this.npc3Sprite!, this.afterBossLines('musician', true) ?? [
              'Kian Vero:',
              '"Music heals all wounds."',
              '"It always has."',
            ]);
          }
        );
      } else {
        this.showDialog(this.afterBossLines('musician') ?? [
          'Kian Vero:',
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
    flash.fillStyle(0x6ea8d8, 0.2);
    flash.fillCircle(0, 0, 13);
    flash.lineStyle(1, 0xff7a2b, 0.82);
    flash.strokeCircle(0, 0, 7);
    flash.lineStyle(1, 0x6ea8d8, 0.58);
    flash.strokeCircle(0, 0, 12);
    flash.fillStyle(0xe8b465, 0.9);
    flash.fillCircle(0, 0, 2);
    this.tweens.add({
      targets: flash, alpha: 0, scaleX: 2.2, scaleY: 2.2,
      duration: 420, ease: 'Quad.easeOut', onComplete: () => flash.destroy(),
    });

    // Short equalizer bars shoot out from the beat.
    const sparkColors = [0x6ea8d8, 0xff7a2b, 0xe8b465];
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
      targets: sprite, scaleX: sprite.scaleX * (3 / 1.08), scaleY: sprite.scaleY * (3 / 1.08), alpha: 0,
      duration: 300, ease: 'Quad.easeOut',
      onComplete: () => sprite.destroy(),
    });

    // Keep the pickup wording aligned with the HUD's music-themed XP name.
    const pickup = this.add.text(cx, cy - 10, tr('+10 RESONANCE'), {
      fontFamily: 'Sora', fontSize: '5px', color: '#ff7a2b',
      stroke: '#000000', strokeThickness: 2,
    }).setDepth(12).setOrigin(0.5).setScale(0.42).setVisible(false);
    EventBus.emit(EVENTS.ITEM_COLLECTED, 'sound-fragment');
    useGameStore.getState().collectFragment(sprite.getData('fragmentIndex') as number);
    const found = useGameStore.getState().fragmentsFound.length;
    EventBus.emit(EVENTS.UI_NOTICE, {
      eyebrow: `Sound fragment ${found} of ${FRAGMENT_COUNT}`,
      title: '+10 XP',
      detail: found >= FRAGMENT_COUNT ? 'All fragments found. The Lost Track is within reach.' : 'One step closer to the Lost Track.',
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
      { glyph: '\u266A', x: cx - 9, color: '#6ea8d8', delay: 0 },
      { glyph: '\u266B', x: cx + 9, color: '#ff7a2b', delay: 90 },
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
    const currentLevel = useGameStore.getState().level;
    if (currentLevel > prevLevel) {
      EventBus.emit(EVENTS.LEVEL_UP, currentLevel);
      this.showLevelUpEffect(currentLevel);
    }
  }

  /** Which signal answers from the grass depends on how far south the player is. */
  private pickEncounter(row: number): EnemyData {
    const table: Array<[string, number]> = row < BROOK_START_ROW
      ? [['static-noise', 0.75], ['broken-signal', 0.25]]
      : row < FADING_START_ROW
        ? [['static-noise', 0.25], ['broken-signal', 0.5], ['silence', 0.25]]
        : [['broken-signal', 0.4], ['silence', 0.6]];
    let roll = Math.random();
    const id = (table.find(([, weight]) => (roll -= weight) < 0) ?? table[table.length - 1])[0];
    return ENEMY_DEFINITIONS.find(enemy => enemy.id === id) ?? ENEMY_DEFINITIONS[0];
  }

  /** Camera flash and shake, left out for players who ask for reduced motion. */
  private cameraFlash(duration: number, red?: number, green?: number, blue?: number, force?: boolean): void {
    if (!this.reducedMotion) this.cameras.main.flash(duration, red, green, blue, force);
  }

  private cameraShake(duration: number, intensity: number): void {
    if (!this.reducedMotion) this.cameras.main.shake(duration, intensity);
  }

  /**
   * Freezes the world for the pause menu. Refuses while the world is not the
   * player's to pause (a battle or the intro is taking over), so the menu never
   * holds a pause that belongs to something else.
   */
  public pauseForMenu(): boolean {
    // Inside a building the interior holds the pause; the door's fade belongs to neither.
    if (this.interiorOpen) return this.interiorScene()?.pauseForMenu() ?? false;
    if (this.doorTransition) return false;
    // A heal and the gate opening are choreographed to sounds a pause could not stop.
    if (!this.scene.isActive() || this.battleActive || this.introActive || this.activeHeal?.busy || this.gate?.busy) return false;
    this.setFootstepSurface('none');
    this.scene.pause();
    return true;
  }

  public resumeFromMenu(): void {
    if (this.interiorOpen) {
      this.interiorScene()?.resumeFromMenu();
      return;
    }
    if (!this.scene.isPaused()) return;
    // Keys let go during the pause never reported it: start from no key held.
    this.input.keyboard?.resetKeys();
    this.scene.resume();
  }

  public forceEncounter(enemyId: string): void {
    const def = ENEMY_DEFINITIONS.find(e => e.id === enemyId) ?? ENEMY_DEFINITIONS[0];
    this.startRandomEncounter(def);
  }

  private startRandomEncounter(data: EnemyData): void {
    // Never inside a building (the dev console can ask), nor while walking through a door.
    if (this.battleActive || this.dialogActive || this.interiorOpen || this.doorTransition) return;
    this.battleActive = true;
    this.grassStepTimer = 0;
    this.player.freeze();
    EventBus.emit(EVENTS.ENCOUNTER);
    this.cameraFlash(200, 255, 255, 255);
    this.time.delayedCall(250, () => {
      this.scene.launch('BattleScene', { enemyData: data, isBoss: false });
      this.scene.pause();
    });
  }

  private startBossApproach(): void {
    this.bossApproachStarted = true;
    if (useGameStore.getState().bossDefeated) return;

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
      callback: () => { if (!this.bossEncounterStarted) this.cameraShake(600, shakeIntensity(0.0015)); },
    });

    // 12 red motes rising from the arena floor
    for (let i = 0; i < 12; i++) {
      this.time.delayedCall(i * 400, () => {
        const mote = this.add.graphics().setDepth(5);
        mote.fillStyle(0x880011, 0.5);
        mote.fillCircle(0, 0, 1.5);
        const sx = 12 * TILE + Math.random() * (MAP_COLS - 24) * TILE;
        const sy = (MAP_ROWS - 3) * TILE;
        mote.setPosition(sx, sy);
        this.tweens.add({
          targets: mote,
          y: sy - 60 - Math.random() * 40,
          alpha: 0,
          duration: 2500 + Math.random() * 1500,
          repeat: -1,
          onRepeat: () => {
            mote.setPosition(12 * TILE + Math.random() * (MAP_COLS - 24) * TILE, (MAP_ROWS - 3) * TILE);
            mote.setAlpha(0.5);
          },
        });
        this.approachEffects.push(mote);
      });
    }
  }

  teleportToBoss(): boolean {
    if (!this.player || this.battleActive || this.dialogActive || this.worldFrozen) return false;
    if (useGameStore.getState().bossDefeated) {
      console.log('The boss is already defeated. Start a new game to fight it again.');
      return false;
    }
    this.openGate(false);
    this.bossEncounterStarted = false;
    this.player.unfreeze();
    // Stay one tile north of the trigger; walking south starts the reveal.
    (this.player.body as Phaser.Physics.Arcade.Body).reset(
      this.PENTAGRAM_X, this.PENTAGRAM_Y - this.PENTAGRAM_TRIGGER_RADIUS - TILE,
    );
    this.cameras.main.centerOn(this.player.x, this.player.y);
    return true;
  }

  private startBossEncounter(): void {
    if (this.bossEncounterStarted || this.battleActive || useGameStore.getState().bossDefeated) return;
    this.bossEncounterStarted = true;
    this.battleActive = true;
    this.player.freeze();

    // boss_erscheinen.wav peaks at 560 ms and finishes at 1682 ms.
    // Start its buildup now; reveal and camera impact share the same peak.
    const impactMs = 560;
    const revealMs = 280;
    const dialogMs = 1800;
    this._approachShakeTimer?.remove();
    this._approachShakeTimer = undefined;
    this.boss?.setRevealAlpha(0);
    EventBus.emit(EVENTS.BOSS_SUMMONING);

    this.tweens.add({
      targets: this.cameras.main,
      zoom: canvasZoom(2.4),
      duration: impactMs,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.boss?.setRevealAlpha(1);
        this.cameraShake(360, shakeIntensity(0.012));
        this.tweens.add({ targets: this.cameras.main, zoom: canvasZoom(2), duration: 400, ease: 'Sine.easeOut' });
      },
    });

    const reveal = { alpha: 0 };
    this.tweens.add({
      targets: reveal,
      alpha: 1,
      delay: impactMs - revealMs,
      duration: revealMs,
      ease: 'Sine.easeIn',
      onUpdate: () => this.boss?.setRevealAlpha(reveal.alpha),
    });

    this.time.delayedCall(dialogMs, () => {
      this.showDialog(
        [
          'The summoning fades. The Gatekeeper stands before you.',
          'THE GATEKEEPER:',
          '"No sound passes through The Core."',
          '"Your journey ends here."',
        ],
        () => {
          this.cameraFlash(500, 100, 0, 180);
          EventBus.emit(EVENTS.ENCOUNTER);
          this.time.delayedCall(400, () => {
            this.scene.launch('BattleScene', { enemyData: BOSS_DEFINITION, isBoss: true });
            this.scene.pause();
          });
        }
      );
    });
  }

  private onBattleEnd = (result: { outcome: 'win' | 'lose'; isBoss: boolean; enemyId?: string }) => {
    this.scene.resume();

    if (result.outcome === 'lose') {
      // Keep the world locked throughout the hand-off to DeathScene. Releasing
      // these flags while the player is still standing in the boss rune would
      // immediately queue a second boss dialog behind the game-over screen.
      this.battleActive = true;
      if (result.isBoss) this.bossEncounterStarted = true;
      this.handlePlayerDeath(result.enemyId, result.isBoss);
      return;
    }

    this.battleActive = false;
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
    this.worldFrozen = true;
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

    this.cameraFlash(280, 215, 255, 116, false);
    this.cameraShake(760, shakeIntensity(0.006));
    this.tweens.add({
      targets: this.cameras.main,
      zoom: canvasZoom(1.62),
      duration: 900,
      ease: 'Cubic.easeOut',
    });

    // The living frequency washes outward from the Core through the terrain itself.
    this.terrain?.purify(cx, cy, 2400);

    // A broad wavefront visibly leaves the Core and travels back through the dungeon.
    const sweep = this.add.graphics().setDepth(12).setPosition(0, cy + 28);
    sweep.fillGradientStyle(0x6ea8d8, 0x6ea8d8, 0xff7a2b, 0xff7a2b, 0, 0, 0.36, 0.36);
    sweep.fillRect(0, -12, worldWidth, 24);
    sweep.lineStyle(2, 0xf8ece2, 0.9); sweep.lineBetween(0, 0, worldWidth, 0);
    this.tweens.add({
      targets: sweep,
      y: CAVE_START_ROW * TILE - 24,
      alpha: 0,
      duration: 2200,
      ease: 'Cubic.easeOut',
      onComplete: () => sweep.destroy(),
    });

    [0x6ea8d8, 0xff7a2b, 0xf8ece2].forEach((color, index) => {
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
      const scaled = object as Phaser.GameObjects.GameObject & { scaleX?: number; scaleY?: number };
      this.tweens.add({
        targets: object,
        alpha: 0,
        scaleX: (scaled.scaleX ?? 1) * 0.72,
        scaleY: (scaled.scaleY ?? 1) * 0.72,
        duration: 520,
        delay: Math.min(1450, index * 14),
        ease: 'Cubic.easeIn',
        onComplete: () => object.destroy(),
      });
    });
    this.caveCorruptionObjects = [];

    this.runeGraphics.forEach((object, index) => {
      this.tweens.killTweensOf(object);
      const scaled = object as Phaser.GameObjects.GameObject & { scaleX?: number; scaleY?: number };
      this.tweens.add({
        targets: object,
        alpha: 0,
        scaleX: (scaled.scaleX ?? 1) * 1.7,
        scaleY: (scaled.scaleY ?? 1) * 1.7,
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
      this.tweens.add({ targets: this.cameras.main, zoom: canvasZoom(2), duration: 620, ease: 'Cubic.easeInOut' });
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

    this.terrain?.setPurified(this.PENTAGRAM_X, this.PENTAGRAM_Y);
    this.createPurifiedCaveAtmosphere(true);
    this.currentZoneIndex = -1;
    this.updateZonePresentation(true);
  }

  private createPurifiedCaveAtmosphere(instant: boolean): void {
    if (this.purifiedCaveEffects.some(effect => effect.name === 'purified-core')) return;
    const cx = this.PENTAGRAM_X;
    const cy = this.PENTAGRAM_Y;

    const core = this.add.graphics().setDepth(1).setPosition(cx, cy).setName('purified-core');
    core.lineStyle(2, 0x6ea8d8, 0.46); core.strokeCircle(0, 0, 74);
    core.lineStyle(1, 0xff7a2b, 0.36); core.strokeCircle(0, 0, 54);
    core.lineStyle(1, 0xf8ece2, 0.2); core.strokeCircle(0, 0, 30);
    for (let index = 0; index < 12; index++) {
      const angle = (Math.PI * 2 / 12) * index;
      const inner = 34 + (index % 3) * 5;
      const outer = inner + 7 + (index % 4) * 2;
      core.lineStyle(index % 2 === 0 ? 2 : 1, index % 2 === 0 ? 0xff7a2b : 0x6ea8d8, 0.54);
      core.lineBetween(Math.cos(angle) * inner, Math.sin(angle) * inner, Math.cos(angle) * outer, Math.sin(angle) * outer);
    }
    core.setAlpha(instant ? 0.62 : 0);
    this.tweens.add({ targets: core, alpha: 0.62, angle: 360, duration: 18000, repeat: -1, ease: 'Linear' });
    this.purifiedCaveEffects.push(core);

    const arch = this.add.graphics().setDepth(3).setName('purified-arch');
    arch.lineStyle(7, 0x573c2f, 0.92); arch.beginPath(); arch.arc(cx, (CORE_START_ROW + 1) * TILE, 8 * TILE, Math.PI, 0, false); arch.strokePath();
    arch.lineStyle(2, 0x6ea8d8, 0.56); arch.beginPath(); arch.arc(cx, (CORE_START_ROW + 1) * TILE, 8 * TILE - 7, Math.PI + 0.1, -0.1, false); arch.strokePath();
    arch.setAlpha(instant ? 1 : 0);
    if (!instant) this.tweens.add({ targets: arch, alpha: 1, duration: 900 });
    this.purifiedCaveEffects.push(arch);

    const lightPools: [number, number][] = [[32,121],[14,128],[51,127],[32,136],[14,141],[50,140],[32,146],[32,156]];
    lightPools.forEach(([col, row], index) => {
      const pool = this.add.graphics().setDepth(0.6).setPosition(col * TILE, row * TILE).setName('purified-light');
      pool.fillStyle(index % 3 === 0 ? 0xff7a2b : 0x6ea8d8, 0.1); pool.fillEllipse(0, 0, 34, 12);
      pool.setAlpha(instant ? 0.72 : 0);
      this.tweens.add({ targets: pool, alpha: { from: instant ? 0.52 : 0, to: 0.86 }, scaleX: 1.14, duration: 1400 + index * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.purifiedCaveEffects.push(pool);
    });

    for (let index = 0; index < 34; index++) {
      const mote = this.add.graphics().setDepth(3).setName('purified-mote');
      const color = index % 5 === 0 ? 0xff7a2b : index % 3 === 0 ? 0xf8ece2 : 0x6ea8d8;
      mote.fillStyle(color, 0.76); mote.fillRect(0, 0, index % 7 === 0 ? 2 : 1, index % 7 === 0 ? 2 : 1);
      const startX = Phaser.Math.Between(4 * TILE, (MAP_COLS - 4) * TILE);
      const startY = Phaser.Math.Between(CAVE_START_ROW * TILE, (MAP_ROWS - 3) * TILE);
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
    spark.fillStyle(0xf8ece2, 0.96); spark.fillRect(-1, -4, 2, 8); spark.fillRect(-4, -1, 8, 2);
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
      eyebrow: 'Void Cave cleansed',
      title: 'Signal restored',
      detail: 'The corruption is gone and the sound is returning.',
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
    panel.fillStyle(0x110906, 0.92); panel.fillRect(centerX - width / 2, centerY - 22, width, 44);
    panel.lineStyle(1, 0x6ea8d8, 0.72); panel.strokeRect(centerX - width / 2, centerY - 22, width, 44);
    panel.fillStyle(0xff7a2b, 0.9); panel.fillRect(centerX - width / 2, centerY - 22, 46, 2);
    panel.fillStyle(0x6ea8d8, 0.9); panel.fillRect(centerX + width / 2 - 82, centerY + 20, 82, 2);
    const title = ui.add.text(centerX, centerY - 11, tr('SIGNAL RESTORED'), {
      fontFamily: 'Sora', fontStyle: 'bold', fontSize: '14px', color: '#ff7a2b', letterSpacing: 2,
    }).setOrigin(0.5).setScrollFactor(0);
    const meta = ui.add.text(centerX, centerY + 9, tr('VOID CAVE // PURIFICATION COMPLETE'), {
      fontFamily: 'DM Mono', fontSize: '6px', color: '#8fbdde', letterSpacing: 1,
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
    pedestal.fillStyle(0x110906, 0.58); pedestal.fillEllipse(0, 0, 78, 20);
    pedestal.lineStyle(2, 0x6ea8d8, 0.52); pedestal.strokeEllipse(0, 0, 66, 16);
    pedestal.lineStyle(1, 0xff7a2b, 0.42); pedestal.strokeEllipse(0, 0, 48, 11);
    pedestal.fillStyle(0xff7a2b, 0.08); pedestal.fillEllipse(0, 0, 42, 9);
    this.tweens.add({ targets: pedestal, alpha: 0.48, scaleX: 1.12, duration: 1250, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.lostTrackEffects.push(pedestal);

    const beam = this.add.graphics().setDepth(3).setPosition(cx, cy);
    beam.fillGradientStyle(0x6ea8d8, 0x6ea8d8, 0xff7a2b, 0xff7a2b, 0, 0, 0.16, 0.16);
    beam.fillRect(-13, -124, 26, 130);
    beam.fillStyle(0xf8ece2, 0.12); beam.fillRect(-3, -124, 6, 130);
    beam.setAlpha(cinematic ? 0 : 0.64);
    this.tweens.add({ targets: beam, alpha: { from: cinematic ? 0 : 0.4, to: 0.76 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.lostTrackEffects.push(beam);

    const waveform = this.add.graphics().setDepth(5).setPosition(cx, cy - 5);
    waveform.lineStyle(1, 0x6ea8d8, 0.72);
    waveform.beginPath(); waveform.moveTo(-48, 0);
    const peaks = [0,-3,2,-7,6,-13,9,-5,3,-10,14,-6,4,-2,0,3,-4,7,-9,4,0];
    peaks.forEach((peak, index) => waveform.lineTo(-48 + index * 4.8, peak));
    waveform.strokePath();
    waveform.lineStyle(1, 0xff7a2b, 0.32); waveform.lineBetween(-52, 0, 52, 0);
    waveform.setAlpha(cinematic ? 0 : 0.82).setScale(0.4, 1);
    this.tweens.add({ targets: waveform, alpha: 0.86, scaleX: 1, duration: 1150, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: waveform, scaleY: 1.18, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.lostTrackEffects.push(waveform);

    // Two counter-rotating mastering rings frame the record without obscuring it.
    [0, 1].forEach(index => {
      const orbit = this.add.graphics().setDepth(5).setPosition(cx, cy - 6).setName('mastering-ring');
      orbit.lineStyle(index === 0 ? 2 : 1, index === 0 ? 0xff7a2b : 0x6ea8d8, 0.58);
      const radius = index === 0 ? 31 : 39;
      orbit.beginPath(); orbit.arc(0, 0, radius, 0.1, 1.55); orbit.strokePath();
      orbit.beginPath(); orbit.arc(0, 0, radius, 3.25, 4.7); orbit.strokePath();
      for (let tick = 0; tick < 8; tick++) {
        const a = (Math.PI * 2 / 8) * tick;
        orbit.fillStyle(tick % 2 === 0 ? 0xff7a2b : 0x6ea8d8, 0.72);
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
      shard.fillStyle(index % 3 === 0 ? 0xff7a2b : 0x6ea8d8, 0.9);
      shard.fillRect(45, -1, 5 + (index % 4) * 2, index % 2 === 0 ? 2 : 1);
      shard.setAlpha(cinematic ? 0 : 0.64).setScale(0.4);
      this.tweens.add({ targets: shard, alpha: 0.68, scaleX: 1, scaleY: 1, duration: 620, delay: index * 42, ease: 'Back.easeOut' });
      this.tweens.add({ targets: shard, angle: shard.angle + (index % 2 === 0 ? 12 : -12), duration: 1300 + index * 33, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.lostTrackEffects.push(shard);
    }

    this.lostTrackItem = this.add.sprite(cx, cy - 6, 'item-lost-track')
      .setDepth(8)
      .setAlpha(cinematic ? 0 : 1)
      .setScale(cinematic ? 0 : 0.78 * LOST_TRACK_SCALE)
      .setAngle(cinematic ? -110 : 0);
    if (cinematic) {
      this.cameraFlash(460, 215, 255, 74, false);
      this.cameraShake(520, shakeIntensity(0.0045));
      this.tweens.add({ targets: this.cameras.main, zoom: canvasZoom(2.34), duration: 520, yoyo: true, ease: 'Cubic.easeOut' });
      this.tweens.add({
        targets: this.lostTrackItem,
        alpha: 1,
        scaleX: 0.9 * LOST_TRACK_SCALE,
        scaleY: 0.9 * LOST_TRACK_SCALE,
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

    const label = this.add.text(cx, cy + 27, tr('FINAL MASTER // 001'), {
      fontFamily: 'DM Mono', fontSize: '5px', color: '#ff7a2b', letterSpacing: 1,
    }).setOrigin(0.5).setDepth(8).setAlpha(cinematic ? 0 : 0.86);
    if (cinematic) this.tweens.add({ targets: label, alpha: 0.86, y: cy + 24, duration: 760, delay: 760, ease: 'Cubic.easeOut' });
    this.lostTrackEffects.push(label);
  }

  private showLostTrackRevealBanner(): void {
    EventBus.emit(EVENTS.UI_NOTICE, {
      eyebrow: 'Found it',
      title: 'The Lost Track',
      detail: 'The original sound is back.',
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
    panel.fillStyle(0x080403, 0.94); panel.fillRect(centerX - 174, centerY - 31, 348, 62);
    panel.lineStyle(1, 0xff7a2b, 0.78); panel.strokeRect(centerX - 174, centerY - 31, 348, 62);
    panel.fillStyle(0x6ea8d8, 0.85); panel.fillRect(centerX - 174, centerY - 31, 104, 2);
    panel.fillStyle(0xe8b465, 0.72); panel.fillRect(centerX + 96, centerY + 29, 78, 2);
    const overline = ui.add.text(centerX, centerY - 18, tr('FINAL RECOVERY // MASTER SIGNAL'), {
      fontFamily: 'DM Mono', fontSize: '6px', color: '#6ea8d8', letterSpacing: 2,
    }).setOrigin(0.5).setScrollFactor(0);
    const title = ui.add.text(centerX, centerY + 2, 'THE LOST TRACK', {
      fontFamily: 'Sora', fontStyle: 'bold', fontSize: '19px', color: '#f8ece2', letterSpacing: 3,
    }).setOrigin(0.5).setScrollFactor(0);
    const sub = ui.add.text(centerX, centerY + 21, tr('ORIGINAL FREQUENCY RESTORED'), {
      fontFamily: 'DM Mono', fontSize: '6px', color: '#ff7a2b', letterSpacing: 1,
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
    this.worldFrozen = true;
    this.setFootstepSurface('none');
    this.tweens.killTweensOf(item);
    EventBus.emit(EVENTS.ITEM_COLLECTED, 'lost-track');

    this.cameraFlash(520, 215, 255, 74, false);
    this.cameraShake(720, shakeIntensity(0.006));
    this.tweens.add({ targets: this.cameras.main, zoom: canvasZoom(2.46), duration: 460, yoyo: true, ease: 'Cubic.easeOut' });

    // The record is physically reclaimed by the player instead of merely fading away.
    this.tweens.add({
      targets: item,
      x: this.player.x,
      y: this.player.y - CHARACTER_HEIGHT * 0.6,
      scaleX: 1.18 * LOST_TRACK_SCALE,
      scaleY: 1.18 * LOST_TRACK_SCALE,
      angle: item.angle + 720,
      duration: 820,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        this.spawnFinalMasterBurst(this.player.x, this.player.y - CHARACTER_HEIGHT * 0.55);
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
    const colors = [0xff7a2b, 0x6ea8d8, 0xf8ece2, 0xe8b465];
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

    [0xff7a2b, 0x6ea8d8, 0xf8ece2].forEach((color, index) => {
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
      eyebrow: 'Quest complete',
      title: 'Lost Track recovered',
      detail: 'The world can hear its song again.',
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
    wash.fillStyle(0x110906, 0.82); wash.fillRect(0, 0, width, height);
    const frame = ui.add.graphics().setScrollFactor(0);
    frame.lineStyle(2, 0xff7a2b, 0.85); frame.strokeRect(22, height / 2 - 68, width - 44, 136);
    frame.lineStyle(1, 0x6ea8d8, 0.45); frame.strokeRect(28, height / 2 - 62, width - 56, 124);
    frame.fillStyle(0xff7a2b, 0.9); frame.fillRect(22, height / 2 - 68, 118, 3);
    frame.fillStyle(0x6ea8d8, 0.9); frame.fillRect(width - 174, height / 2 + 65, 152, 3);

    const equalizer = ui.add.graphics().setScrollFactor(0);
    const centerY = height / 2 + 37;
    for (let index = 0; index < 45; index++) {
      const barHeight = 3 + ((index * 11 + index * index) % 22);
      equalizer.fillStyle(index % 5 === 0 ? 0xff7a2b : 0x6ea8d8, 0.56);
      equalizer.fillRect(width / 2 - 135 + index * 6, centerY - barHeight / 2, 3, barHeight);
    }
    const overline = ui.add.text(width / 2, height / 2 - 39, tr('FINAL OBJECTIVE COMPLETE'), {
      fontFamily: 'DM Mono', fontSize: '7px', color: '#6ea8d8', letterSpacing: 3,
    }).setOrigin(0.5).setScrollFactor(0);
    const title = ui.add.text(width / 2, height / 2 - 12, tr('MASTER ACQUIRED'), {
      fontFamily: 'Sora', fontStyle: 'bold', fontSize: '20px', color: '#f8ece2', letterSpacing: 2,
    }).setOrigin(0.5).setScrollFactor(0);
    const meta = ui.add.text(width / 2, height / 2 + 16, 'THE LOST TRACK // SIGNAL 100%', {
      fontFamily: 'DM Mono', fontSize: '8px', color: '#ff7a2b', letterSpacing: 2,
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
    if (this.gate) {
      this.gate.open(animated, () => this.removeGateBlockers());
      if (animated) this.cameraShake(220, shakeIntensity(0.0015));
      return;
    }
    const leftPanel = this.children.getByName('gate-panel-left') as Phaser.GameObjects.Image | null;
    const rightPanel = this.children.getByName('gate-panel-right') as Phaser.GameObjects.Image | null;

    this.removeGateBlockers();

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

    const gateSignal = this.add.rectangle(
      GATE_CENTER_COL * TILE,
      (GATE_START_ROW + 1) * TILE,
      52,
      24,
      0x6ea8d8,
      0,
    )
      .setDepth(4);
    this.tweens.add({
      targets: gateSignal,
      alpha: 0.18,
      duration: 220,
      yoyo: true,
      hold: 120,
      onComplete: () => gateSignal.destroy(),
    });
    this.cameraShake(220, shakeIntensity(0.0025));
  }

  /** Removes only the invisible doorway blockers; the stone stays part of the world. */
  private removeGateBlockers(): void {
    [...this.walls.getChildren()].forEach((child) => {
      const blocker = child as Phaser.GameObjects.Image;
      if (blocker.name === 'gate-blocker') this.walls.remove(blocker, true, true);
    });
  }

  /** A silent open (the dev teleport) skips the animation: the gate may be off-screen. */
  private openGate(showDialog = true): void {
    if (this.gateOpen) return;
    this.gateOpen = true;
    useGameStore.getState().openGate();
    this.setGateOpenVisual(showDialog);
    EventBus.emit(EVENTS.GATE_OPEN);
    if (showDialog) {
      this.showDialog([
        'The Frequency Gate trembles.',
        'A low hum fills the air.',
        'Then — silence.',
        'The path to the Fading Highlands is open.',
      ]);
    }
  }

  private handlePlayerDeath(enemyId: string | undefined, isBoss: boolean): void {
    this.player.freeze();
    // The battle already played the fall and switched the picture off, so the
    // death screen takes over at once: the world never shows in between.
    this.scene.launch('DeathScene', { enemyId, isBoss });
    this.scene.pause();
  }

  private onRespawn = (): void => {
    this.scene.resume();
    this.cameras.main.resetFX();
    this.cameras.main.setZoom(WORLD_ZOOM);
    this.player.setPosition(this.spawnX, this.spawnY);
    this.player.unfreeze();

    // Reset all blocking state flags; the boss stays done once it is beaten.
    const bossDefeated = useGameStore.getState().bossDefeated;
    this.battleActive = false;
    this.bossEncounterStarted = bossDefeated;
    this.dialogActive = false;
    this.worldFrozen = false;
    this.isTyping = false;

    // Clean up approach effects
    for (const fx of this.approachEffects) fx.destroy();
    this.approachEffects = [];
    this.bossApproachStarted = bossDefeated;
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
    this.remember(key);
    this.showDialog(lines, onComplete);
  }

  private createDialogBox(): void {
    const viewW = this.scale.width / WORLD_ZOOM;
    const boxW = viewW - 8;
    const boxH = 72;

    const bg = this.add.graphics();
    bg.fillStyle(0x080403, 0.985);
    bg.fillRoundedRect(0, 0, boxW, boxH, 4);
    bg.lineStyle(1, 0x54433a, 0.9);
    bg.strokeRoundedRect(0.5, 0.5, boxW - 1, boxH - 1, 4);
    bg.fillStyle(0x140b08, 1);
    bg.fillRoundedRect(7, 7, 52, 58, 3);
    bg.lineStyle(1, 0x362a24, 0.95);
    bg.strokeRoundedRect(7.5, 7.5, 51, 57, 3);
    bg.lineStyle(1, 0x82776f, 0.08);
    for (let y = 8; y < boxH; y += 8) bg.lineBetween(62, y, boxW - 8, y);

    const accent = this.add.graphics();
    const portrait = this.add.image(32, 64, 'portrait-professor').setVisible(false);
    const systemMark = this.add.text(33, 36, '◎', {
      fontFamily: 'Sora', fontStyle: 'bold', fontSize: '20px', color: '#ff7a2b',
    }).setOrigin(0.5).setAlpha(0.48);

    const speaker = this.add.text(69, 9, 'FIELD TRANSMISSION', {
      fontFamily: 'Sora', fontStyle: 'bold', fontSize: '7px', color: '#ff7a2b', letterSpacing: 1,
    }).setResolution(2);

    const channel = this.add.text(boxW - 11, 10, 'ARCHIVE SIGNAL', {
      fontFamily: 'DM Mono', fontSize: '5px', color: '#82776f', letterSpacing: 1,
    }).setOrigin(1, 0).setResolution(2);

    const text = this.add.text(69, 25, '', {
      fontFamily: 'DM Mono', fontStyle: '500', fontSize: '9px', color: '#f8ece2',
      wordWrap: { width: boxW - 84, useAdvancedWrap: true },
      lineSpacing: 3,
      maxLines: 3,
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 1, fill: true },
    }).setResolution(2);

    const arrow = this.add.text(boxW - 14, boxH - 14, '▼', {
      fontFamily: 'Sora', fontSize: '8px', color: '#ff7a2b',
    });
    this.tweens.add({ targets: arrow, alpha: 0, duration: 500, yoyo: true, repeat: -1 });
    arrow.setVisible(false);

    const prompt = this.add.text(boxW - 11, boxH - 11, 'E / SPACE / TAP   ▼', {
      fontFamily: 'DM Mono', fontSize: '5px', color: '#ff7a2b', letterSpacing: 1,
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
    this.dialogBox.setData('lineCallback', null);
    this.dialogBox.setData('lineIndex', 0);

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
    const accentColor = visual?.accent ?? (isGatekeeper ? 0xe8b465 : 0xff7a2b);

    speaker.setText((name ?? 'FIELD TRANSMISSION').toUpperCase());
    speaker.setColor(`#${accentColor.toString(16).padStart(6, '0')}`);
    channel.setText(name ? 'VOICE CHANNEL // LIVE' : 'ARCHIVE SIGNAL');

    accent.clear();
    accent.fillStyle(accentColor, 1);
    accent.fillRoundedRect(0, 0, 4, 72, 3);
    accent.fillStyle(accentColor, 0.16);
    accent.fillRect(62, 20, 238, 1);

    if (visual) {
      portrait.setTexture(visual.portraitTexture)
        .setOrigin(visual.originX, visual.originY)
        .setPosition(32, 64)
        .setScale(visual.portraitScale)
        .setVisible(true);
      systemMark.setVisible(false);
    } else if (isGatekeeper) {
      const portraitTexture = this.textures.exists('boss-gatekeeper-battle-phase1')
        ? 'boss-gatekeeper-battle-phase1'
        : 'boss-gatekeeper';
      portrait.setTexture(portraitTexture)
        .setOrigin(0.5, 1)
        .setPosition(32, 62)
        .setVisible(true);
      // The painted boss fills the 40-unit portrait slot whatever its source size.
      portrait.setScale(portraitTexture === 'boss-gatekeeper-battle-phase1' ? 40 / portrait.height : 1.25);
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

  showDialog(
    lines: string[],
    onComplete?: () => void,
    onLine?: (lineIndex: number) => void,
  ): void {
    if (!this.dialogBox || this.dialogActive) return;
    this.dialogActive = true;
    this.dialogQueue = [...lines];
    this.dialogBox.setData('callback', onComplete ?? null);
    this.dialogBox.setData('lineCallback', onLine ?? null);
    this.dialogBox.setData('lineIndex', 0);
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
      this.npcInteractionReadyAt = this.time.now + NPC_DIALOG_COOLDOWN_MS;
      EventBus.emit(EVENTS.DIALOG_CLEAR);
      const cb = this.dialogBox.getData('callback') as (() => void) | null;
      this.dialogBox.setData('callback', null);
      this.dialogBox.setData('lineCallback', null);
      this.dialogBox.setData('lineIndex', 0);
      cb?.();
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
      accent: `#${(visual?.accent ?? (isGatekeeper ? 0xe8b465 : 0xff7a2b)).toString(16).padStart(6, '0')}`,
      portrait: this.activeDialogSpeaker === 'Professor Krys' ? 'elder'
        : this.activeDialogSpeaker === 'Guard Quincy' ? 'guard'
          : this.activeDialogSpeaker === 'Kian Vero' ? 'musician'
            : isGatekeeper ? 'gatekeeper' : undefined,
    };
    EventBus.emit(EVENTS.DIALOG, payload);
    const lineCallback = this.dialogBox.getData('lineCallback') as ((lineIndex: number) => void) | null;
    const lineIndex = this.dialogBox.getData('lineIndex') as number;
    this.dialogBox.setData('lineIndex', lineIndex + 1);
    lineCallback?.(lineIndex);
  }

  // ── Visual effects ────────────────────────────────────────────────────────

  private showLevelUpEffect(level: number): void {
    void level;
    this.cameraFlash(300, 255, 215, 0, false);
  }

  /**
   * The NPC heal (src/game/world/NpcHeal.ts). Its sound starts with it, the
   * hero is healed on the sound's peak, and the conversation resumes after.
   */
  private playHealingMusic(
    npcSprite: Npc,
    followUpLines: string[],
  ): void {
    this.worldFrozen = true;
    // Their visibility is only updated by checkNpcProximity, which pauses with the world.
    this.npcInteractLabel?.setVisible(false);
    this.npc2InteractLabel?.setVisible(false);
    this.npc3InteractLabel?.setVisible(false);

    const store = useGameStore.getState();
    const amount = Math.max(0, store.maxHp - store.hp);
    const accent = NPC_VISUALS[npcSprite.npcId].accent;
    const accentCss = `#${accent.toString(16).padStart(6, '0')}`;
    this.activeHeal?.destroy();
    this.activeHeal = playNpcHeal(this, {
      npc: npcSprite,
      player: this.player,
      playerShadow: this.playerShadow,
      syncHeroShadow: () => this.playerCastShadow?.sync(this.player.y < CAVE_START_ROW * TILE),
      accent,
      amount,
      reducedMotion: this.reducedMotion,
      // HEAL starts the heal sound, which carries the whole sequence; HP follows on its peak.
      onSound: () => EventBus.emit(EVENTS.HEAL, { amount, source: 'npc' }),
      onRestoreHp: () => {
        const state = useGameStore.getState();
        state.restoreHp(state.maxHp);
      },
      onNotice: () => EventBus.emit(EVENTS.UI_NOTICE, {
        eyebrow: 'Healed',
        title: `+${amount} HP`,
        detail: 'Your health is fully restored.',
        accent: accentCss,
        tone: 'success',
        duration: 2400,
      }),
      onDone: () => this.showDialog(followUpLines),
    });
  }

  shutdown(): void {
    this.gate?.destroy();
    this.gate = undefined;
    this.activeHeal?.destroy();
    this.activeHeal = undefined;
    this.setFootstepSurface('none');
    EventBus.emit(EVENTS.CUTSCENE_STATE, false);
    EventBus.off(EVENTS.BATTLE_END, this.onBattleEnd, this);
    EventBus.off(EVENTS.RESPAWN, this.onRespawn, this);
    EventBus.off(EVENTS.ZONE_UI_REQUEST, this.onZoneUiRequest, this);
    this.events.off(Phaser.Scenes.Events.WAKE, this.onWake, this);
  }

  private onZoneUiRequest(): void {
    if (this.lastZonePayload) {
      EventBus.emit(EVENTS.ZONE_UI_STATE, { ...this.lastZonePayload, replay: false });
      return;
    }
    this.currentZoneIndex = -1;
    this.updateZonePresentation(true);
  }
}
