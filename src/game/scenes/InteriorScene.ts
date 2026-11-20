import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { EventBus, EVENTS, type DialogPayload, type NotePayload, type RoomSoundPayload } from '../EventBus';
import { useGameStore } from '../../store/gameStore';
import { consumeMobileAction } from '../input/MobileInput';
import { AudioManager } from '../audio/AudioManager';
import type { FootstepSurface } from '../audio/AudioLibrary';
import { WORLD_ZOOM } from '../render/RenderScale';
import { FX } from '../art/fx';
import { CHARACTER_HEIGHT } from '../art/characters';
import { addWorldImage, standingDepth } from '../art/worldTexture';
import { addAmbient, addRoomGrade, createRoomTextures, playHookEffect } from '../art/interiorArt';
import { PLAYER_TEXTURES } from '../assets/PlayerTextures';
import { SOUND_LAB_NOTE_URL, type InteriorRoomId } from '../assets/InteriorArt';
import { adoptRoomArt, isRoomArtSettled, prefetchRoomArt } from '../assets/InteriorStream';
import { INTERIOR_ROOMS } from '../maps/interiors';
import {
  INTERIOR_HERO_SCALE, roomBlockers, type Condition, type Hook, type Interactable, type InteriorRoom, type RoomPoint, type RoomRect, type Variant,
} from '../maps/interiors/room';
import { createInteractLabel } from '../world/InteractLabel';

/** As WorldScene's NPC_DIALOG_COOLDOWN_MS: the key that puts the note down must not pick it up again. */
const NOTE_COOLDOWN_MS = 1200;
/** A close request this soon after opening is the opening press itself. */
const NOTE_MIN_OPEN_MS = 250;
/** After lines close, a moment before the next use; short, so the INN's bell can be rung in a hurry. */
const LINES_COOLDOWN_MS = 250;
const FADE_IN_MS = 320;
const FADE_OUT_MS = 220;
/** How long the door waits for the painted room before the painted-in-code one stands in. */
const ART_WAIT_MS = 3000;
const ART_POLL_MS = 100;
const STEP_DUST_MS = 170;
const SHADOW_WIDTH = 16 * INTERIOR_HERO_SCALE;
const SHADOW_HEIGHT = 5.6 * INTERIOR_HERO_SCALE;
const SHADOW_OFFSET = INTERIOR_HERO_SCALE;
/** Room lines are narration: no name tag, no portrait. */
const NARRATOR = 'FIELD TRANSMISSION';
/** As the world's dialogue: what the player is called before a name is set. */
const DEFAULT_NAME = 'Mr Mario';

/** The hero indoors: feet to the top of his head, and half his figure's width facing up or down. */
const HERO_HEIGHT = CHARACTER_HEIGHT * INTERIOR_HERO_SCALE;
const HERO_HALF_WIDTH = 5.2 * INTERIOR_HERO_SCALE;
/** A key cap's default lift over its anchor (InteractLabel draws the tail's tip there). */
const CAP_LIFT = 7;
/** Room between the top of the hero's head and a raised key cap's tail. */
const CAP_HEAD_GAP = 1;
/** A key cap's top, at the top of its bob, sits this far above its anchor. */
const CAP_TOP = 18.5;
/** A key cap's bounds include its soft halo, this much wider on each side than the bubble (InteractLabel). */
const CAP_HALO = 5;

const contains = (rect: RoomRect, x: number, y: number) =>
  x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;

const overlaps = (a: RoomRect, b: RoomRect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

interface QueuedLine {
  text: string;
  /** Set off as this line shows. */
  hooks: Hook[];
}

/**
 * Inside a building: one painted room from the registry
 * (src/game/maps/interiors). WorldScene sleeps while it runs and wakes when
 * the hero walks out again.
 *
 * Nothing here is saved. There are no encounters, heals or gates inside, and
 * a reload while inside starts the journey at its usual place in the village.
 * Use counts, sequences and idle timers live for one visit only.
 */
export class InteriorScene extends Phaser.Scene {
  private room!: InteriorRoom;
  private player?: Player;
  private shadow?: Phaser.GameObjects.Image;
  private interactKey!: Phaser.Input.Keyboard.Key;
  /** Space and Enter read on; Esc only puts a note down (it opens the pause menu otherwise). */
  private advanceKeys: Phaser.Input.Keyboard.Key[] = [];
  private escKey!: Phaser.Input.Keyboard.Key;
  private labels = new Map<string, Phaser.GameObjects.Container>();
  private doorLabel?: Phaser.GameObjects.Container;
  private reducedMotion = false;
  /** Fading in or out, or waiting for the room's art: no input, no pause. */
  private transitioning = true;
  private reading = false;
  private noteOpenedAt = 0;
  /** Lines still to show; `talking` while one is on screen. */
  private lines: QueuedLine[] = [];
  private talking = false;
  private tapped = false;
  private readyAt = 0;
  private footstepSurface: FootstepSurface = 'none';
  private stepDustTimer = 0;
  private uses = new Map<string, number>();
  private rapidTimes = new Map<string, number[]>();
  private history: Array<{ id: string; at: number }> = [];
  private stillMs = 0;
  private idleDone = new Set<number>();
  /** The approach triggers the hero stands in, so each goes off once per walk in. */
  private approached = new Set<number>();
  private cameo?: Phaser.GameObjects.Image;
  private recordPlaying = false;
  private recordFx?: Phaser.Time.TimerEvent | Phaser.GameObjects.Image;

  constructor() {
    super({ key: 'InteriorScene' });
  }

  create(data: { room?: InteriorRoomId }): void {
    // The scene object is reused on every visit: start from a clean slate.
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.player = undefined;
    this.shadow = undefined;
    this.labels = new Map();
    this.doorLabel = undefined;
    this.transitioning = true;
    this.reading = false;
    this.noteOpenedAt = 0;
    this.lines = [];
    this.talking = false;
    this.tapped = false;
    this.readyAt = 0;
    this.footstepSurface = 'none';
    this.stepDustTimer = 0;
    this.uses = new Map();
    this.rapidTimes = new Map();
    this.history = [];
    this.stillMs = 0;
    this.idleDone = new Set();
    this.approached = new Set();
    this.cameo = undefined;
    this.recordPlaying = false;
    this.recordFx = undefined;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    const room = data?.room && INTERIOR_ROOMS[data.room];
    if (!room) {
      // Nothing to show: straight back out.
      this.scene.wake('WorldScene', { from: 'InteriorScene' });
      this.scene.stop();
      return;
    }
    this.room = room;
    EventBus.on(EVENTS.NOTE_UI_ACTION, this.onNoteAction, this);
    EventBus.on(EVENTS.RECORD_PLAYER_STOPPED, this.onRecordStopped, this);

    const keyboard = this.input.keyboard!;
    this.interactKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    // Not captured: a capture outlives the scene and would swallow Enter on
    // the game's DOM buttons for the rest of the session.
    this.advanceKeys = [
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, false),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER, false),
    ];
    this.escKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC, false);
    // A tap on the scene reads on, as in the world.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => { this.tapped = this.talking; });
    // A tap on the A button during the door's fade must not act in here.
    consumeMobileAction();

    this.cameras.main.setBackgroundColor('#050908');
    // Usually on its way since the hero neared the door.
    prefetchRoomArt(this.textures, room.id);
    this.waitForRoomArt(() => this.buildRoom());
  }

  /** Builds at once when the painted room is here (or failed); otherwise waits up to ART_WAIT_MS behind the black. */
  private waitForRoomArt(build: () => void): void {
    if (isRoomArtSettled(this.textures, this.room.id)) {
      build();
      return;
    }
    const poll = this.time.addEvent({
      delay: ART_POLL_MS,
      repeat: Math.ceil(ART_WAIT_MS / ART_POLL_MS) - 1,
      callback: () => {
        if (!isRoomArtSettled(this.textures, this.room.id) && poll.getRepeatCount() > 0) return;
        poll.remove(false);
        build();
      },
    });
  }

  private buildRoom(): void {
    const { room } = this;
    adoptRoomArt(this, room.id);
    createRoomTextures(this, room);
    addWorldImage(this, 0, 0, room.art.key).setOrigin(0, 0).setDepth(0);
    // Warm the browser cache for the reading view.
    if (room.interactables.some(item => item.note)) new Image().src = SOUND_LAB_NOTE_URL;

    this.physics.world.setBounds(0, 0, room.width, room.height);
    const walls = this.physics.add.staticGroup();
    roomBlockers(room).forEach(({ x, y, w, h }) => walls.add(this.add.zone(x + w / 2, y + h / 2, w, h)));
    walls.refresh();

    const player = new Player(this, room.spawn.x, room.spawn.y);
    // Arcade scales the body and its offset with the sprite, so the feet stay the anchor.
    player.setScale(player.scaleX * INTERIOR_HERO_SCALE);
    player.faceToward(room.spawn.x, room.spawn.y - 10);
    player.setDepth(standingDepth(player.y));
    this.physics.add.collider(player, walls);
    this.player = player;
    // Indoors there is no sun: only the soft contact shadow.
    this.shadow = this.add.image(player.x + SHADOW_OFFSET, player.y + SHADOW_OFFSET, FX.shadow)
      .setDisplaySize(SHADOW_WIDTH, SHADOW_HEIGHT).setAlpha(0.42).setDepth(4);

    addRoomGrade(this, room, this.reducedMotion);
    room.ambient?.filter(ambient => this.matches(ambient.when)).forEach(ambient => addAmbient(this, ambient, this.reducedMotion));
    const body = player.body as Phaser.Physics.Arcade.Body;
    for (const item of room.interactables) {
      const label = createInteractLabel(this, item.label?.x ?? 0, item.label?.y ?? 0, {
        lift: item.label?.lift ?? CAP_LIFT, verb: item.verb, reducedMotion: this.reducedMotion,
      });
      if (!item.label) {
        const { x, y } = this.defaultCap(item, label.getBounds().width / 2 - CAP_HALO, body.sourceWidth * player.scaleX, body.sourceHeight * player.scaleY);
        label.setPosition(x, y);
      } else {
        // A placed cap stays inside the room however long its verb is in the chosen language.
        const capHalfWidth = label.getBounds().width / 2 - CAP_HALO;
        label.setX(Phaser.Math.Clamp(item.label.x, capHalfWidth, room.width - capHalfWidth));
      }
      this.labels.set(item.id, label);
    }
    this.doorLabel = createInteractLabel(this, room.exit.label.x, room.exit.label.y, {
      lift: room.exit.label.lift, verb: 'Leave', reducedMotion: this.reducedMotion,
    });

    const cam = this.cameras.main;
    cam.setZoom(WORLD_ZOOM);
    cam.setRoundPixels(true);
    cam.startFollow(player, true, 1, 1);
    this.fitCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this);

    EventBus.emit(EVENTS.INTERIOR_STATE, true, room.musicDuck);
    cam.fadeIn(FADE_IN_MS, 5, 9, 8);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
      this.transitioning = false;
      EventBus.emit(EVENTS.UI_NOTICE, {
        eyebrow: room.zone,
        title: room.title,
        detail: room.detail,
        accent: room.accent,
        tone: 'info',
        variant: 'compact',
        duration: 2600,
      });
    });
  }

  /**
   * Where a key cap without its own place goes: over the object, but raised
   * just clear of the hero's head wherever he can stand in its reach under
   * it, and never so near the room's edges that it bobs past them (an upright
   * phone scrolls to the edge).
   */
  private defaultCap(item: Interactable, capHalfWidth: number, bodyWidth: number, bodyHeight: number): RoomPoint {
    const blockers = roomBlockers(this.room);
    const { reach } = item;
    const x = Phaser.Math.Clamp(item.object.x + item.object.w / 2, capHalfWidth, this.room.width - capHalfWidth);
    let anchor = item.object.y + 1.8;
    for (let feetX = reach.x; feetX <= reach.x + reach.w; feetX += 1) {
      if (Math.abs(feetX - x) >= capHalfWidth + HERO_HALF_WIDTH) continue;
      // The highest he can stand here: his body clear of everything.
      for (let feetY = reach.y; feetY <= reach.y + reach.h; feetY += 0.5) {
        const footprint = { x: feetX - bodyWidth / 2, y: feetY - bodyHeight, w: bodyWidth, h: bodyHeight };
        if (blockers.some(blocker => overlaps(footprint, blocker))) continue;
        anchor = Math.min(anchor, feetY - HERO_HEIGHT - CAP_HEAD_GAP);
        break;
      }
    }
    return { x, y: Math.max(anchor, CAP_TOP + 1) + CAP_LIFT };
  }

  /**
   * Centres the room when it is smaller than the view and lets the camera
   * scroll across it when it is larger (a phone held upright). Phaser's own
   * clamp would pin a small room to the top-left corner.
   */
  private fitCamera(): void {
    const cam = this.cameras.main;
    const { width, height } = this.room;
    const boundsWidth = Math.max(width, cam.width / cam.zoom);
    const boundsHeight = Math.max(height, cam.height / cam.zoom);
    cam.setBounds((width - boundsWidth) / 2, (height - boundsHeight) / 2, boundsWidth, boundsHeight);
  }

  update(_time: number, delta: number): void {
    // Read every key each frame, so a press during a fade or on a note cannot carry over.
    const mobileAction = consumeMobileAction();
    const keyboardAction = Phaser.Input.Keyboard.JustDown(this.interactKey);
    const advancePressed = this.advanceKeys.map(key => Phaser.Input.Keyboard.JustDown(key)).some(Boolean);
    const escPressed = Phaser.Input.Keyboard.JustDown(this.escKey);
    const tapped = this.tapped;
    this.tapped = false;
    const player = this.player;

    if (!player || this.transitioning) {
      this.halt();
      return;
    }
    if (this.reading) {
      this.halt();
      if (mobileAction || keyboardAction || advancePressed || escPressed) this.closeNote();
      return;
    }
    if (this.talking) {
      this.halt();
      if (mobileAction || keyboardAction || advancePressed || tapped) this.nextLine();
      return;
    }

    player.update(delta);
    player.setDepth(standingDepth(player.y));
    this.shadow?.setPosition(player.x + SHADOW_OFFSET, player.y + SHADOW_OFFSET)
      .setDisplaySize(player.isMoving() ? SHADOW_WIDTH * 1.075 : SHADOW_WIDTH, SHADOW_HEIGHT);
    this.setFootstepSurface(player.isMoving() ? 'ground' : 'none');
    this.kickUpDust(delta);
    if (this.checkIdle(delta)) return;
    this.checkApproach(player);

    const ready = this.time.now >= this.readyAt;
    const near = ready ? this.room.interactables.find(item => contains(item.reach, player.x, player.y)) : undefined;
    const atDoor = contains(this.room.exit.zone, player.x, player.y);
    this.labels.forEach((label, id) => label.setVisible(id === near?.id));
    this.doorLabel?.setVisible(atDoor && !near);

    const interact = mobileAction || keyboardAction;
    if (near && interact) {
      this.use(near);
      return;
    }
    const steppingOut = player.isMoving() && player.getDirection() === 'down' && player.y >= this.room.exit.stepOutY;
    if (atDoor && (interact || steppingOut)) this.leave();
  }

  /** Stops the hero where he stands. */
  private halt(): void {
    (this.player?.body as Phaser.Physics.Arcade.Body | undefined)?.setVelocity(0, 0);
    this.setFootstepSurface('none');
  }

  private hideLabels(): void {
    this.labels.forEach(label => label.setVisible(false));
    this.doorLabel?.setVisible(false);
  }

  private kickUpDust(delta: number): void {
    const player = this.player;
    if (this.reducedMotion || !player?.isMoving()) {
      this.stepDustTimer = 0;
      return;
    }
    this.stepDustTimer += delta;
    if (this.stepDustTimer < STEP_DUST_MS) return;
    this.stepDustTimer = 0;
    const size = INTERIOR_HERO_SCALE;
    const puff = this.add.image(player.x + Phaser.Math.Between(-3, 3) * size, player.y + size, FX.glow)
      .setDisplaySize(5 * size, 3 * size).setTint(0xa49a8c).setAlpha(0.34).setDepth(4.5);
    this.tweens.add({
      targets: puff,
      x: puff.x + Phaser.Math.Between(-5, 5) * size,
      y: puff.y - 2 * size,
      displayWidth: 12 * size,
      displayHeight: 6 * size,
      alpha: 0,
      duration: 560,
      ease: 'Quad.easeOut',
      onComplete: () => puff.destroy(),
    });
  }

  // ── What the hero has done so far ─────────────────────────────────────────

  private matches(when?: Condition): boolean {
    if (!when) return true;
    const state = useGameStore.getState();
    if (when.bossDefeated !== undefined && when.bossDefeated !== state.bossDefeated) return false;
    if (when.gateOpen !== undefined && when.gateOpen !== state.gateOpen) return false;
    if (when.bonusSongUnlocked !== undefined && when.bonusSongUnlocked !== state.bonusSongUnlocked) return false;
    if (when.fragments !== undefined && when.fragments !== state.fragmentsFound.length) return false;
    if (when.seen && !when.seen.every(key => state.seenDialogs.includes(key))) return false;
    if (when.recordPlaying !== undefined && when.recordPlaying !== this.recordPlaying) return false;
    if (when.sfxAudible !== undefined) {
      const audio = AudioManager.getSettings();
      if (when.sfxAudible !== (!audio.muted && audio.sfxVolume > 0)) return false;
    }
    return true;
  }

  /** The first matching variant that stands alone, then every matching one that adds to it. */
  private pickVariants(variants: readonly Variant[]): Variant[] {
    const main = variants.find(variant => !variant.append && this.matches(variant.when));
    const extras = variants.filter(variant => variant.append && this.matches(variant.when));
    return main ? [main, ...extras] : extras;
  }

  private pickStep(item: Interactable, count: number): number {
    const steps = item.steps?.length ?? 0;
    const selector = item.selector ?? { kind: 'state' };
    switch (selector.kind) {
      case 'cycle':
        return (count - 1) % Math.max(1, steps);
      case 'counter':
        return Math.max(0, selector.at.reduce((step, threshold, index) => (count >= threshold ? index : step), 0));
      case 'random': {
        let roll = Math.random();
        for (let index = 0; index < selector.chances.length; index++) {
          roll -= selector.chances[index];
          if (roll < 0) return index;
        }
        return 0;
      }
      case 'rapid': {
        const now = this.time.now;
        const times = [...(this.rapidTimes.get(item.id) ?? []), now].filter(at => now - at <= selector.windowMs);
        if (times.length >= selector.uses) {
          this.rapidTimes.delete(item.id);
          return 1;
        }
        this.rapidTimes.set(item.id, times);
        return 0;
      }
      default:
        return 0;
    }
  }

  /** A sequence completed by this use (and forgotten, so it can be played again). */
  private completedSequence(id: string): Variant | undefined {
    const now = this.time.now;
    this.history = [...this.history, { id, at: now }].slice(-8);
    for (const sequence of this.room.sequences ?? []) {
      const tail = this.history.slice(-sequence.order.length);
      if (tail.length === sequence.order.length && tail.every((use, index) => use.id === sequence.order[index])
        && now - tail[0].at <= sequence.windowMs) {
        this.history = [];
        return sequence.variant;
      }
    }
    return undefined;
  }

  // ── Using things ──────────────────────────────────────────────────────────

  private use(item: Interactable): void {
    const { object } = item;
    this.player?.faceToward(object.x + object.w / 2, object.y + object.h / 2);
    if (item.note) {
      this.openNote(item);
      return;
    }
    const count = (this.uses.get(item.id) ?? 0) + 1;
    this.uses.set(item.id, count);
    const variants = this.pickVariants(item.steps?.[this.pickStep(item, count)] ?? []);
    const sequence = this.completedSequence(item.id);
    if (sequence) variants.push(sequence);
    this.play(variants);
  }

  /** Reads the variants' lines out and sets off their hooks, each as the lines open or with its own line. */
  private play(variants: readonly Variant[]): void {
    const name = useGameStore.getState().playerName || DEFAULT_NAME;
    const lines: QueuedLine[] = [];
    const atOpen: Hook[] = [];
    for (const variant of variants) {
      const first = lines.length;
      // A function replacer, so a name holding "$&" stays as typed.
      variant.lines.forEach(line => lines.push({ text: line.replace(/\{playerName\}/g, () => name), hooks: [] }));
      for (const hook of variant.hooks ?? []) {
        if (hook.line === undefined || !variant.lines.length) atOpen.push(hook);
        else lines[first + Math.min(hook.line, variant.lines.length - 1)].hooks.push(hook);
      }
    }
    if (!lines.length) return;
    // Hooks read the state before they change it (the record player).
    atOpen.forEach(hook => this.runHook(hook));
    this.halt();
    this.hideLabels();
    this.lines = lines;
    this.talking = true;
    this.nextLine();
  }

  private nextLine(): void {
    const line = this.lines.shift();
    if (line === undefined) {
      this.talking = false;
      this.readyAt = this.time.now + LINES_COOLDOWN_MS;
      this.cameo?.destroy();
      this.cameo = undefined;
      EventBus.emit(EVENTS.DIALOG_CLEAR);
      return;
    }
    const payload: DialogPayload = { text: line.text, speaker: NARRATOR, accent: this.room.accent };
    EventBus.emit(EVENTS.DIALOG, payload);
    line.hooks.forEach(hook => this.runHook(hook));
  }

  private runHook(hook: Hook): void {
    switch (hook.type) {
      case 'sfx': {
        for (let play = 0; play <= (hook.repeat ?? 0); play++) {
          const cue: RoomSoundPayload = { key: hook.key, volume: (hook.volume ?? 1) * (hook.fade ?? 1) ** play, rate: hook.rate };
          const delay = (hook.delayMs ?? 0) + play * (hook.intervalMs ?? 0);
          if (delay) this.time.delayedCall(delay, () => EventBus.emit(EVENTS.ROOM_SOUND, cue));
          else EventBus.emit(EVENTS.ROOM_SOUND, cue);
        }
        return;
      }
      case 'glow':
      case 'motes':
        playHookEffect(this, hook, this.reducedMotion);
        return;
      case 'cameo':
        this.showCameo(hook.screen, hook.tint);
        return;
      case 'record':
        this.setRecord(hook.play, hook.platter);
        return;
    }
  }

  /** The hero, small and grainy, on a monitor: shown until the lines close. */
  private showCameo(screen: RoomRect, tint: number): void {
    this.cameo?.destroy();
    const cameo = this.add.image(screen.x + screen.w / 2, screen.y + screen.h * 0.92, PLAYER_TEXTURES.down[0]).setOrigin(0.5, 1);
    cameo.setScale((screen.h * 0.8) / cameo.height).setTint(tint).setAlpha(0.72).setDepth(1.5);
    if (!this.reducedMotion) {
      this.tweens.add({ targets: cameo, alpha: { from: 0.5, to: 0.8 }, duration: 140, yoyo: true, repeat: -1 });
    }
    this.cameo = cameo;
  }

  /** Needle down or up. AudioManager plays the song and tells us when it stops by itself. */
  private setRecord(play: boolean, platter?: RoomPoint): void {
    if (play === this.recordPlaying) return;
    this.recordPlaying = play;
    EventBus.emit(EVENTS.RECORD_PLAYER, play);
    this.stopRecordFx();
    if (!play || !platter) return;
    const notes = { type: 'motes', at: platter, tint: 0xffa860, count: 2, dir: 'rise' } as const;
    this.recordFx = this.reducedMotion
      ? this.add.image(platter.x, platter.y, FX.glow).setDisplaySize(18, 18).setTint(0xffa860)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDepth(1)
      : this.time.addEvent({ delay: 650, loop: true, callback: () => playHookEffect(this, notes, false) });
  }

  private stopRecordFx(): void {
    this.recordFx?.destroy();
    this.recordFx = undefined;
  }

  private onRecordStopped(): void {
    this.recordPlaying = false;
    this.stopRecordFx();
  }

  /** Standing still long enough somewhere plays that spot's lines, once per visit. Returns true when it did. */
  private checkIdle(delta: number): boolean {
    const player = this.player;
    const spots = this.room.idle ?? [];
    if (!player || !spots.length) return false;
    const index = spots.findIndex((spot, at) => !this.idleDone.has(at) && contains(spot.reach, player.x, player.y));
    if (index < 0 || player.isMoving()) {
      this.stillMs = 0;
      return false;
    }
    this.stillMs += delta;
    if (this.stillMs < spots[index].ms) return false;
    this.stillMs = 0;
    this.idleDone.add(index);
    this.play([spots[index].variant]);
    return true;
  }

  /** Walking into an approach trigger sets its hooks off; it waits until he has left it again. */
  private checkApproach(player: Player): void {
    this.room.approach?.forEach((spot, index) => {
      if (!contains(spot.reach, player.x, player.y)) {
        this.approached.delete(index);
        return;
      }
      if (this.approached.has(index)) return;
      this.approached.add(index);
      if (this.matches(spot.when)) spot.hooks.forEach(hook => this.runHook(hook));
    });
  }

  // ── The Sound Lab's note ─────────────────────────────────────────────────

  private openNote(item: Interactable): void {
    const spec = item.note!;
    const note: NotePayload = { title: spec.title, lines: [...spec.lines], signature: spec.signature };
    if (spec.postscript && this.matches(spec.postscript.when)) note.postscript = spec.postscript.text;
    this.reading = true;
    this.noteOpenedAt = this.time.now;
    this.hideLabels();
    this.halt();
    EventBus.emit(EVENTS.NOTE_UI_STATE, note);
  }

  private closeNote(): void {
    if (!this.reading) return;
    this.reading = false;
    this.readyAt = this.time.now + NOTE_COOLDOWN_MS;
    EventBus.emit(EVENTS.NOTE_UI_STATE, null);
  }

  /** A tap on the reading view. */
  private onNoteAction(): void {
    if (this.reading && this.time.now >= this.noteOpenedAt + NOTE_MIN_OPEN_MS) this.closeNote();
  }

  /** Out through the door: WorldScene wakes in front of it. */
  private leave(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.player?.freeze();
    this.setFootstepSurface('none');
    this.hideLabels();
    this.setRecord(false);
    const cam = this.cameras.main;
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      EventBus.emit(EVENTS.INTERIOR_STATE, false);
      this.scene.wake('WorldScene', { from: 'InteriorScene', room: this.room.id });
      this.scene.stop();
    });
    // Forced, so a fade still running cannot swallow the completion.
    cam.fade(FADE_OUT_MS, 5, 9, 8, true);
  }

  /** The pause menu asks WorldScene, which hands the question on while the hero is in here. */
  public pauseForMenu(): boolean {
    // Esc puts the note down instead.
    if (!this.scene.isActive() || this.transitioning || this.reading) return false;
    this.setFootstepSurface('none');
    // The record stops for the menu; the needle stays up afterwards.
    this.setRecord(false);
    this.scene.pause();
    return true;
  }

  public resumeFromMenu(): void {
    if (!this.scene.isPaused()) return;
    // Keys let go during the pause never reported it: start from no key held.
    this.input.keyboard?.resetKeys();
    this.scene.resume();
  }

  /** As WorldScene: the footstep loop follows changes of surface, not every frame. */
  private setFootstepSurface(surface: FootstepSurface): void {
    if (surface === this.footstepSurface) return;
    this.footstepSurface = surface;
    EventBus.emit(EVENTS.FOOTSTEPS, surface);
  }

  shutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
    EventBus.off(EVENTS.NOTE_UI_ACTION, this.onNoteAction, this);
    EventBus.off(EVENTS.RECORD_PLAYER_STOPPED, this.onRecordStopped, this);
    if (this.reading) EventBus.emit(EVENTS.NOTE_UI_STATE, null);
    if (this.talking) EventBus.emit(EVENTS.DIALOG_CLEAR);
    this.reading = false;
    this.talking = false;
    this.setRecord(false);
    this.setFootstepSurface('none');
    EventBus.emit(EVENTS.INTERIOR_STATE, false);
  }
}
