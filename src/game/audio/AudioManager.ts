// Type-only: the audio manager talks about Phaser objects but never constructs
// one, so importing the types keeps the engine out of the initial bundle.
import type Phaser from 'phaser';
import {
  EventBus, EVENTS, type ZoneUiPayload, type AttackUsedPayload, type ImpactPayload, type HealPayload, type RoomSoundPayload,
} from '../EventBus';
import {
  MUSIC, SFX, ATTACK_SFX_BY_ID, ATTACK_SFX_BY_ENEMY_NAME, BOSS_PHASE_MUSIC, LOST_TRACK,
  SFX_URL_BY_KEY, SFX_START_OFFSET, FOOTSTEP_SFX_BY_SURFACE, FOOTSTEP_VOLUME, tracksForZone,
  type FootstepSurface,
} from './AudioLibrary';

/**
 * Owns every music/SFX decision in the game. Scenes never call `sound.play`
 * directly — they emit the EventBus events they already emit for other
 * reasons (BATTLE_START, ZONE_UI_STATE, LEVEL_UP, ...) and AudioManager
 * reacts. This keeps scenes audio-agnostic: swapping a track or adding a
 * new sound only ever means editing AudioLibrary.ts and this file.
 *
 * BattleScene emits three additional narration-only events (ATTACK_USED,
 * IMPACT, BOSS_PHASE_CHANGED) purely so combat SFX can hook in without
 * importing this file.
 */

type MusicOptions = { loop?: boolean; fadeMs?: number; volume?: number; onComplete?: () => void };

/**
 * The title theme (components/MenuMusic.tsx), an HTML audio element that
 * streams the overworld track. It keeps playing into the world until the
 * game's own copy of that track has downloaded, then hands over.
 */
export interface MenuMusicHandle {
  trackKey: string;
  /** Playback position in seconds while it is audible, else null. */
  position(): number | null;
  setVolume(value: number): void;
  setMuted(muted: boolean): void;
  /** Fades it out; the game's music has taken over. */
  release(): void;
}
type SfxOptions = { volume?: number; rate?: number };
type Mode = 'world' | 'battle' | 'death' | 'reward';

/** Concrete sound classes all expose these; BaseSound's own type doesn't. */
type Fadeable = Phaser.Sound.BaseSound & { volume: number; setVolume(value: number): unknown };

const SETTINGS_KEY = 'sound-quest:audio-settings';
const DEFAULT_FADE_MS = 500;
const BATTLE_MUSIC_VOLUME_MULTIPLIER = 0.9;
/** Indoors the world's music plays on, muffled by the walls (a room may set its own share). */
const INTERIOR_MUSIC_VOLUME_MULTIPLIER = 0.3;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

interface AudioSettings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

function loadSettings(): AudioSettings {
  const fallback: AudioSettings = { musicVolume: 0.55, sfxVolume: 0.8, muted: false };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      musicVolume: typeof parsed.musicVolume === 'number' ? clamp01(parsed.musicVolume) : fallback.musicVolume,
      sfxVolume: typeof parsed.sfxVolume === 'number' ? clamp01(parsed.sfxVolume) : fallback.sfxVolume,
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : fallback.muted,
    };
  } catch {
    return fallback;
  }
}

class AudioManagerImpl {
  private game: Phaser.Game | null = null;
  private initialized = false;

  private music: Fadeable | null = null;
  private musicKey: string | null = null;
  private zoneTrack: string = MUSIC.overworldDefault.key;
  private mode: Mode = 'world';
  /** The hero is inside a building. */
  private interior = false;
  /** Share of the music volume heard through the walls of the building the hero is in. */
  private interiorShare = INTERIOR_MUSIC_VOLUME_MULTIPLIER;
  /**
   * Quincy's record player: the Lost Track, streamed by an audio element so
   * Phaser never decodes it. The world's music fades out while it plays.
   */
  private record: HTMLAudioElement | null = null;
  private recordWanted = false;
  /** play() was refused outside a user gesture (iOS): the next tap or key press starts it. */
  private recordAwaitsGesture = false;

  private settings: AudioSettings = loadSettings();
  private fadeTokens = new WeakMap<Fadeable, number>();
  private menuMusic: MenuMusicHandle | null = null;
  /** A track asked for before its file arrived; it starts on arrival. */
  private wantedMusic: { key: string; opts: MusicOptions } | null = null;
  private preBootSfx = new Map<string, HTMLAudioElement>();
  private footstepSound: Fadeable | null = null;
  private footstepSurface: FootstepSurface = 'none';
  private encounterSound: Phaser.Sound.BaseSound | null = null;
  /** The current move's sound, so a combo that ends early can fade it out. */
  private attackSound: Fadeable | null = null;

  /** Wire the manager up once the Phaser game instance exists. Safe to call more than once. */
  init(game: Phaser.Game): void {
    if (this.initialized) return;
    this.initialized = true;
    this.game = game;
    game.sound.mute = this.settings.muted;
    // Most audio streams in after the world opens (see AssetStream.ts).
    // Cache event 'add' (Phaser.Cache.Events.ADD): Phaser is type-only here.
    game.cache.audio.events.on('add', this.onAudioAdded, this);

    EventBus.on(EVENTS.ZONE_UI_STATE, this.onZoneState, this);
    EventBus.on(EVENTS.BATTLE_START, this.onBattleStart, this);
    EventBus.on(EVENTS.BATTLE_END, this.onBattleEnd, this);
    EventBus.on(EVENTS.BOSS_PHASE_CHANGED, this.onBossPhaseChanged, this);
    EventBus.on(EVENTS.PLAYER_DIED, this.onPlayerDied, this);
    EventBus.on(EVENTS.RESPAWN, this.onRespawn, this);
    EventBus.on(EVENTS.BONUS_SONG_UNLOCKED, this.onBonusSongUnlocked, this);
    EventBus.on(EVENTS.REWARD_UI_STATE, this.onRewardUiState, this);
    EventBus.on(EVENTS.ATTACK_USED, this.onAttackUsed, this);
    EventBus.on(EVENTS.ATTACK_SOUND_CUT, this.onAttackSoundCut, this);
    EventBus.on(EVENTS.IMPACT, this.onImpact, this);
    EventBus.on(EVENTS.HEAL, this.onHeal, this);
    EventBus.on(EVENTS.ENEMY_DEFEATED, this.onEnemyDefeated, this);
    EventBus.on(EVENTS.FOOTSTEPS, this.onFootsteps, this);
    EventBus.on(EVENTS.INTERIOR_STATE, this.onInteriorState, this);
    EventBus.on(EVENTS.ROOM_SOUND, this.onRoomSound, this);
    EventBus.on(EVENTS.RECORD_PLAYER, this.onRecordPlayer, this);
    // A hidden page stops the game and its sounds; the record's audio element would play on.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stopRecord(true);
    });

    // ENEMY_DEFEATED already covers bosses; BOSS_DEFEATED is the later story beat.
    EventBus.on(EVENTS.ENCOUNTER, () => {
      this.onFootsteps('none');
      this.mode = 'battle';
      this.playMusic(MUSIC.battle.key, { fadeMs: 150 });
      this.encounterSound?.destroy();
      this.encounterSound = null;
      if (this.game && this.resolveKey(SFX.encounter.key)) {
        const sound = this.game.sound.add(SFX.encounter.key, { volume: this.settings.sfxVolume });
        this.encounterSound = sound;
        sound.once('complete', () => {
          if (this.encounterSound === sound) this.encounterSound = null;
          sound.destroy();
        });
        sound.play();
      }
    });
    EventBus.on(EVENTS.LEVEL_UP, () => this.playSfx(SFX.levelUp.key));
    EventBus.on(EVENTS.BOSS_SUMMONING, () => {
      this.onFootsteps('none');
      this.playSfx(SFX.bossAppeared.key);
    });
    EventBus.on(EVENTS.ITEM_COLLECTED, () => this.playSfx(SFX.itemPickup.key));
    EventBus.on(EVENTS.GATE_OPEN, () => this.playSfx(SFX.gateOpen.key));
    EventBus.on(EVENTS.GATE_BLOCKED, () => this.playSfx(SFX.gateBlocked.key));
    EventBus.on(EVENTS.DIALOG, () => {
      this.playAvailableSfx([SFX.dialogBlip.key, SFX.uiClick.key], { volume: 0.5 });
    });
    EventBus.on(EVENTS.DEATH_UI_ACTION, () => {
      this.playAvailableSfx([SFX.uiConfirm.key, SFX.uiClick.key]);
    });
    // Picking an attack is the game's main "select" interaction.
    EventBus.on(EVENTS.BATTLE_UI_ACTION, () => this.playSfx(SFX.uiClick.key));
  }

  // ── Reactions to game events ────────────────────────────────────────────

  private onInteriorState(inside: boolean, share = INTERIOR_MUSIC_VOLUME_MULTIPLIER): void {
    if (!inside) this.releaseRecord();
    if (inside === this.interior) return;
    this.interior = inside;
    this.interiorShare = share;
    this.applyMusicVolume(600);
  }

  /** The world's music (and the title theme still standing in for it) follows the current duck. */
  private applyMusicVolume(fadeMs: number): void {
    if (this.music) this.fade(this.music, this.music.volume, this.targetMusicVolume(), fadeMs);
    this.menuMusic?.setVolume(this.settings.musicVolume * this.interiorDuck());
  }

  private onRoomSound(cue: RoomSoundPayload): void {
    this.playSfx(cue.key, { volume: cue.volume, rate: cue.rate });
  }

  private onRecordPlayer(play: boolean): void {
    if (play) this.playRecord();
    else this.stopRecord(false);
  }

  private playRecord(): void {
    if (typeof Audio === 'undefined') return;
    if (!this.record) {
      const record = new Audio(`/${LOST_TRACK.url}`);
      record.preload = 'auto';
      record.addEventListener('ended', () => this.stopRecord(true));
      record.addEventListener('error', () => this.stopRecord(true));
      this.record = record;
    }
    this.recordWanted = true;
    this.applyRecordLevel();
    this.record.currentTime = 0;
    this.applyMusicVolume(600);
    this.startRecord();
  }

  private startRecord(): void {
    const record = this.record;
    if (!record || !this.recordWanted) return;
    record.play().catch((error: unknown) => {
      if (!this.recordWanted) return;
      // Only the gesture rule can be worked around; anything else stops the record.
      if (error instanceof DOMException && error.name === 'NotAllowedError' && !this.recordAwaitsGesture) {
        this.recordAwaitsGesture = true;
        // A touch unlocks media on lifting the finger (pointerup, touchend), not on pointerdown.
        window.addEventListener('pointerdown', this.onRecordGesture, true);
        window.addEventListener('pointerup', this.onRecordGesture, true);
        window.addEventListener('touchend', this.onRecordGesture, true);
        window.addEventListener('keydown', this.onRecordGesture, true);
      } else {
        this.stopRecord(true);
      }
    });
  }

  private onRecordGesture = (): void => {
    this.clearRecordGesture();
    this.startRecord();
  };

  private clearRecordGesture(): void {
    this.recordAwaitsGesture = false;
    window.removeEventListener('pointerdown', this.onRecordGesture, true);
    window.removeEventListener('pointerup', this.onRecordGesture, true);
    window.removeEventListener('touchend', this.onRecordGesture, true);
    window.removeEventListener('keydown', this.onRecordGesture, true);
  }

  /** iOS ignores a script's volume on media elements, so a music level of 0 has to mute the record. */
  private applyRecordLevel(): void {
    if (!this.record) return;
    this.record.volume = clamp01(this.settings.musicVolume);
    this.record.muted = this.settings.muted || this.settings.musicVolume === 0;
  }

  /** Out of the building: the record stops and its element lets go of the downloaded song. */
  private releaseRecord(): void {
    this.stopRecord(false);
    const record = this.record;
    if (!record) return;
    this.record = null;
    record.removeAttribute('src');
    record.load();
  }

  /** Lifts the needle; `bySelf` tells the room the record stopped without being asked. */
  private stopRecord(bySelf: boolean): void {
    this.clearRecordGesture();
    if (!this.recordWanted) return;
    this.recordWanted = false;
    this.record?.pause();
    this.applyMusicVolume(900);
    if (bySelf) EventBus.emit(EVENTS.RECORD_PLAYER_STOPPED);
  }

  private onZoneState(zone: ZoneUiPayload): void {
    const tracks = tracksForZone(zone.title);
    this.zoneTrack = this.resolveKey(...tracks) ?? tracks[tracks.length - 1];
    if (this.mode === 'world') this.playMusic(this.zoneTrack);
  }

  private onBattleStart(data: { isBoss: boolean }): void {
    this.mode = 'battle';
    // The world stops updating during a fight, so it can't tell us to stop.
    this.onFootsteps('none');
    // Boss phases have their own slots but no files yet, so the shared battle
    // theme stands in rather than the fight starting silent.
    const key = data.isBoss
      ? this.resolveKey(BOSS_PHASE_MUSIC[0], MUSIC.battle.key)
      : this.resolveKey(MUSIC.battle.key);
    // The short encounter cue accompanies the world transition; the actual
    // fight starts with the looping battle theme, without a second intro track.
    // Layer the still-playing encounter cue over the battle music immediately.
    if (key) this.playMusic(key, { fadeMs: 150 });
  }

  private onBattleEnd(data?: { outcome?: 'win' | 'lose'; isBoss?: boolean }): void {
    // On a loss the death theme is about to take over, so returning to the
    // zone track here would stab in for a moment and immediately be replaced.
    if (data?.outcome === 'lose') return;
    if (data?.outcome === 'win') this.playSfx(SFX.victory.key);
    // The restored zone title arrives after the purification animation.
    // Switch immediately on victory instead of briefly restarting cave music.
    if (data?.outcome === 'win' && data.isBoss) this.zoneTrack = MUSIC.overworldDefault.key;
    this.mode = 'world';
    this.playMusic(this.zoneTrack, { fadeMs: 500 });
  }

  private onBossPhaseChanged(phaseIdx: number): void {
    // Phase III has its own, longer sequence; its sound follows that timing.
    this.playAvailableSfx(phaseIdx >= 2 ? [SFX.bossPhaseFinal.key, SFX.bossPhaseChange.key] : [SFX.bossPhaseChange.key]);
    // Only switch tracks if this phase actually has its own music; otherwise
    // keep whatever is already playing instead of restarting the fallback.
    const trackKey = this.resolveKey(BOSS_PHASE_MUSIC[phaseIdx] ?? '');
    if (trackKey) this.playMusic(trackKey, { fadeMs: 600 });
  }

  private onPlayerDied(): void {
    this.mode = 'death';
    this.onFootsteps('none');
    this.playMusic(MUSIC.death.key, { fadeMs: 400, loop: false });
  }

  private onRespawn(): void {
    this.mode = 'world';
    this.playMusic(this.zoneTrack, { fadeMs: 600 });
  }

  private onBonusSongUnlocked(): void {
    // RewardModal plays the uploaded Lost Track song — just get out of its way.
    this.onRewardUiState(true);
  }

  private onRewardUiState(isOpen: boolean): void {
    if (!isOpen) {
      if (this.mode !== 'reward') return;
      this.mode = 'world';
      this.playMusic(this.zoneTrack, { fadeMs: 600 });
      return;
    }

    this.mode = 'reward';
    this.onFootsteps('none');
    // The reward screen plays the same song: never both at once.
    this.stopRecord(true);
    this.stopMusic(600);
  }

  private onAttackUsed(data: AttackUsedPayload): void {
    if (data.isPlayer) this.playAttackSfx(data.attackId);
    else {
      const key = this.resolveKey(ATTACK_SFX_BY_ENEMY_NAME[data.name] ?? SFX.enemyAttack.key, SFX.enemyAttack.key);
      if (key) this.playAttackSound(key);
    }
  }

  /** Like playSfx, but keeps the sound so ATTACK_SOUND_CUT can fade it. */
  private playAttackSound(key: string): void {
    if (this.settings.muted || !this.game) return;
    if (!this.game.cache.audio.has(key)) {
      console.debug(`[audio] sfx not loaded yet: ${key}`);
      return;
    }
    const sound = this.game.sound.add(key, { volume: this.settings.sfxVolume }) as unknown as Fadeable;
    sound.once('complete', () => {
      if (this.attackSound === sound) this.attackSound = null;
      sound.destroy();
    });
    sound.play({ seek: SFX_START_OFFSET[key] ?? 0 });
    this.attackSound = sound;
  }

  private onAttackSoundCut(fadeMs: number): void {
    const sound = this.attackSound;
    this.attackSound = null;
    if (sound) this.fade(sound, sound.volume, 0, fadeMs, () => sound.destroy());
  }

  private onImpact(data: ImpactPayload): void {
    this.playSfx(data.isPlayer ? SFX.playerHit.key : SFX.enemyHit.key);
  }

  private onHeal(data: HealPayload): void {
    // Respawn has no dedicated sound yet — the heal cue covers it, since a
    // respawn is a full heal anyway.
    const key = data.source === 'respawn'
      ? this.resolveKey(SFX.respawn.key, SFX.heal.key)
      : this.resolveKey(SFX.heal.key);
    if (key) this.playSfx(key);
  }

  private onEnemyDefeated(isBoss: boolean): void {
    const key = isBoss
      ? this.resolveKey(SFX.bossDefeated.key, SFX.enemyDefeated.key)
      : this.resolveKey(SFX.enemyDefeated.key);
    if (key) this.playSfx(key);
  }

  /**
   * Footsteps are a sustained loop rather than one-shots, swapped when the
   * player moves between surfaces and faded out the moment they stop — so
   * the loop is only ever audible while they are actually walking.
   */
  private onFootsteps(surface: FootstepSurface): void {
    if (this.mode !== 'world') surface = 'none';
    if (surface === this.footstepSurface) return;
    this.footstepSurface = surface;
    this.stopFootsteps();
    if (surface === 'none' || !this.game) return;

    const key = this.resolveKey(FOOTSTEP_SFX_BY_SURFACE[surface], SFX.footstepsGround.key);
    if (!key) return;

    const sound = this.game.sound.add(key, { loop: true, volume: 0 }) as unknown as Fadeable;
    sound.play();
    this.footstepSound = sound;
    this.fade(sound, 0, FOOTSTEP_VOLUME * this.settings.sfxVolume, 110);
  }

  private stopFootsteps(): void {
    const sound = this.footstepSound;
    this.footstepSound = null;
    // Destroy, not just stop: every start/stop creates a new Sound, and
    // stopped ones stay registered with the manager forever otherwise —
    // a long walk would pile up hundreds of them.
    if (sound) this.fade(sound, sound.volume, 0, 90, () => sound.destroy());
  }

  /** A streamed file arrived: start the track that was waiting for it, upgrade the footstep loop. */
  private onAudioAdded(_cache: unknown, key: string): void {
    if (this.wantedMusic?.key === key) this.playMusic(key, this.wantedMusic.opts);
    const surface = this.footstepSurface;
    if (surface !== 'none' && key === FOOTSTEP_SFX_BY_SURFACE[surface]) {
      this.footstepSurface = 'none';
      this.onFootsteps(surface);
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * First of `keys` that actually has audio loaded, or null if none do.
   * Lets a slot that has no file yet degrade to a sensible stand-in (boss
   * phase music → the general battle theme) instead of silence.
   */
  private resolveKey(...keys: string[]): string | null {
    if (!this.game) return null;
    return keys.find(key => this.game!.cache.audio.has(key)) ?? null;
  }

  private playAvailableSfx(keys: string[], opts: SfxOptions = {}): void {
    const key = this.resolveKey(...keys);
    if (key) this.playSfx(key, opts);
  }

  playMusic(key: string, opts: MusicOptions = {}): void {
    if (!this.game) return;
    if (key === this.musicKey && this.music?.isPlaying) return;

    const { loop = true, fadeMs = DEFAULT_FADE_MS, volume = this.targetMusicVolume() } = opts;

    const previous = this.music;
    this.music = null;
    this.musicKey = null;
    if (previous) this.fade(previous, previous.volume, 0, fadeMs, () => previous.destroy());

    if (!this.game.cache.audio.has(key)) {
      // Still streaming in: it starts when it arrives. The title theme plays
      // on meanwhile if it is this very track; any other track means it stops.
      this.wantedMusic = { key, opts };
      if (key !== this.menuMusic?.trackKey) this.menuMusic?.release();
      return;
    }
    this.wantedMusic = null;

    // Taking over from the title theme: resume from its position instead of
    // restarting at 0, otherwise the melody audibly jumps back.
    const seek = key === this.menuMusic?.trackKey ? this.menuMusic.position() ?? 0 : 0;

    const sound = this.game.sound.add(key, { loop, volume: 0 }) as unknown as Fadeable;
    if (opts.onComplete) {
      sound.once('complete', () => {
        // A stopped/replaced intro must never restart battle music later.
        if (this.music === sound) opts.onComplete?.();
      });
    }
    sound.play(seek > 0 ? { seek } : undefined);
    this.music = sound;
    this.musicKey = key;
    this.fade(sound, 0, volume, fadeMs);
    this.menuMusic?.release();
  }

  /** MenuMusic (components/MenuMusic.tsx) registers the title theme for the handoff. */
  registerMenuMusic(handle: MenuMusicHandle | null): void {
    this.menuMusic = handle;
  }

  stopMusic(fadeMs = DEFAULT_FADE_MS): void {
    this.wantedMusic = null;
    this.menuMusic?.release();
    if (!this.music) return;
    const sound = this.music;
    this.music = null;
    this.musicKey = null;
    this.fade(sound, sound.volume, 0, fadeMs, () => sound.destroy());
  }

  playSfx(key: string, opts: SfxOptions = {}): void {
    if (this.settings.muted) return;
    const volume = (opts.volume ?? 1) * this.settings.sfxVolume;

    // Title-screen menus fire before Phaser is created, so fall back to a
    // plain audio element there instead of dropping the cue.
    if (!this.game) {
      this.playSfxBeforeBoot(key, volume);
      return;
    }
    if (!this.game.cache.audio.has(key)) {
      console.debug(`[audio] sfx not loaded yet: ${key}`);
      return;
    }
    this.game.sound.play(key, { volume, rate: opts.rate ?? 1, seek: SFX_START_OFFSET[key] ?? 0 });
  }

  private playSfxBeforeBoot(key: string, volume: number): void {
    const url = SFX_URL_BY_KEY[key];
    if (!url || typeof Audio === 'undefined') return;
    let element = this.preBootSfx.get(key);
    if (!element) {
      element = new Audio(`/${url}`);
      this.preBootSfx.set(key, element);
    }
    element.currentTime = SFX_START_OFFSET[key] ?? 0;
    element.volume = clamp01(volume);
    void element.play().catch(() => {
      // Missing file or blocked before any gesture — nothing to recover.
    });
  }

  playAttackSfx(attackId: string): void {
    this.playAttackSound(ATTACK_SFX_BY_ID[attackId] ?? SFX.attackBassDrop.key);
  }

  setMusicVolume(value: number): void {
    this.settings.musicVolume = clamp01(value);
    this.persist();
    this.music?.setVolume(this.targetMusicVolume());
    this.menuMusic?.setVolume(this.settings.musicVolume * this.interiorDuck());
    this.applyRecordLevel();
  }

  setSfxVolume(value: number): void {
    this.settings.sfxVolume = clamp01(value);
    this.persist();
    // The footstep loop keeps playing: it follows the new level at once.
    if (this.footstepSound) this.fade(this.footstepSound, this.footstepSound.volume, FOOTSTEP_VOLUME * this.settings.sfxVolume, 0);
  }

  setMuted(muted: boolean): void {
    this.settings.muted = muted;
    if (this.game) this.game.sound.mute = muted;
    this.menuMusic?.setMuted(muted);
    this.applyRecordLevel();
    this.persist();
  }

  toggleMute(): boolean {
    this.setMuted(!this.settings.muted);
    return this.settings.muted;
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private targetMusicVolume(): number {
    return this.settings.musicVolume * (this.mode === 'battle' ? BATTLE_MUSIC_VOLUME_MULTIPLIER : 1) * this.interiorDuck();
  }

  /** Only the world's own music is muffled indoors, not a battle, death or reward track; a playing record silences it. */
  private interiorDuck(): number {
    if (!this.interior || this.mode !== 'world') return 1;
    return this.recordWanted ? 0 : this.interiorShare;
  }

  private persist(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // storage unavailable (private mode, etc.) — settings just won't persist
    }
  }

  // Cancellation-token guarded per sound instance: if the same sound gets
  // faded again before the first fade finishes (e.g. rapid playMusic calls),
  // the newer call wins instead of both writing sound.volume every frame.
  private fade(sound: Fadeable, from: number, to: number, duration: number, onComplete?: () => void): void {
    const token = (this.fadeTokens.get(sound) ?? 0) + 1;
    this.fadeTokens.set(sound, token);

    if (duration <= 0) {
      sound.volume = Math.max(0, Math.min(1, to));
      onComplete?.();
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      if (this.fadeTokens.get(sound) !== token) return;
      const t = Math.min(1, (now - start) / duration);
      sound.volume = Math.max(0, Math.min(1, from + (to - from) * t));
      if (t < 1) requestAnimationFrame(step);
      else onComplete?.();
    };
    requestAnimationFrame(step);
  }
}

export const AudioManager = new AudioManagerImpl();
