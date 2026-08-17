import Phaser from 'phaser';
import { EventBus, EVENTS, type ZoneUiPayload, type AttackUsedPayload, type ImpactPayload, type HealPayload } from '../EventBus';
import { MUSIC, SFX, ATTACK_SFX_BY_ID, ATTACK_SFX_BY_ENEMY_NAME, BOSS_PHASE_MUSIC, trackForZone } from './AudioLibrary';

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

type MusicOptions = { loop?: boolean; fadeMs?: number; volume?: number };
type SfxOptions = { volume?: number; rate?: number };
type Mode = 'world' | 'battle' | 'death' | 'reward';

/** Concrete sound classes all expose these; BaseSound's own type doesn't. */
type Fadeable = Phaser.Sound.BaseSound & { volume: number; setVolume(value: number): unknown };

const SETTINGS_KEY = 'sound-quest:audio-settings';
const DEFAULT_FADE_MS = 500;

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
      musicVolume: typeof parsed.musicVolume === 'number' ? parsed.musicVolume : fallback.musicVolume,
      sfxVolume: typeof parsed.sfxVolume === 'number' ? parsed.sfxVolume : fallback.sfxVolume,
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

  private settings: AudioSettings = loadSettings();
  private fadeTokens = new WeakMap<Fadeable, number>();
  private pendingSeek: { key: string; seconds: number } | null = null;

  /** Wire the manager up once the Phaser game instance exists. Safe to call more than once. */
  init(game: Phaser.Game): void {
    if (this.initialized) return;
    this.initialized = true;
    this.game = game;
    game.sound.mute = this.settings.muted;

    EventBus.on(EVENTS.ZONE_UI_STATE, this.onZoneState, this);
    EventBus.on(EVENTS.BATTLE_START, this.onBattleStart, this);
    EventBus.on(EVENTS.BATTLE_END, this.onBattleEnd, this);
    EventBus.on(EVENTS.BOSS_PHASE_CHANGED, this.onBossPhaseChanged, this);
    EventBus.on(EVENTS.PLAYER_DIED, this.onPlayerDied, this);
    EventBus.on(EVENTS.RESPAWN, this.onRespawn, this);
    EventBus.on(EVENTS.BONUS_SONG_UNLOCKED, this.onBonusSongUnlocked, this);
    EventBus.on(EVENTS.ATTACK_USED, this.onAttackUsed, this);
    EventBus.on(EVENTS.IMPACT, this.onImpact, this);
    EventBus.on(EVENTS.HEAL, this.onHeal, this);

    EventBus.on(EVENTS.BOSS_DEFEATED, () => this.playSfx(SFX.bossDefeated.key));
    EventBus.on(EVENTS.LEVEL_UP, () => this.playSfx(SFX.levelUp.key));
    EventBus.on(EVENTS.ITEM_COLLECTED, () => this.playSfx(SFX.itemPickup.key));
    EventBus.on(EVENTS.GATE_OPEN, () => this.playSfx(SFX.gateOpen.key));
    EventBus.on(EVENTS.GATE_BLOCKED, () => this.playSfx(SFX.gateBlocked.key));
    EventBus.on(EVENTS.DIALOG, () => this.playSfx(SFX.dialogBlip.key, { volume: 0.5 }));
  }

  // ── Reactions to game events ────────────────────────────────────────────

  private onZoneState(zone: ZoneUiPayload): void {
    this.zoneTrack = trackForZone(zone.title);
    if (this.mode === 'world') this.playMusic(this.zoneTrack);
  }

  private onBattleStart(data: { isBoss: boolean }): void {
    this.mode = 'battle';
    this.playMusic(data.isBoss ? BOSS_PHASE_MUSIC[0] : MUSIC.battle.key, { fadeMs: 350 });
  }

  private onBattleEnd(): void {
    this.mode = 'world';
    this.playMusic(this.zoneTrack, { fadeMs: 500 });
  }

  private onBossPhaseChanged(phaseIdx: number): void {
    this.playSfx(SFX.bossPhaseChange.key);
    const trackKey = BOSS_PHASE_MUSIC[phaseIdx];
    if (trackKey) this.playMusic(trackKey, { fadeMs: 600 });
  }

  private onPlayerDied(): void {
    this.mode = 'death';
    this.playMusic(MUSIC.death.key, { fadeMs: 400, loop: false });
  }

  private onRespawn(): void {
    this.mode = 'world';
    this.playMusic(this.zoneTrack, { fadeMs: 600 });
  }

  private onBonusSongUnlocked(): void {
    // RewardModal plays its own procedurally-generated track — just get out of its way.
    this.mode = 'reward';
    this.stopMusic(600);
  }

  private onAttackUsed(data: AttackUsedPayload): void {
    if (data.isPlayer) this.playSfx(ATTACK_SFX_BY_ID[data.attackId] ?? SFX.attackGeneric.key);
    else this.playSfx(ATTACK_SFX_BY_ENEMY_NAME[data.name] ?? SFX.enemyAttack.key);
  }

  private onImpact(data: ImpactPayload): void {
    this.playSfx(data.isPlayer ? SFX.playerHit.key : SFX.enemyHit.key);
  }

  private onHeal(data: HealPayload): void {
    this.playSfx(data.source === 'respawn' ? SFX.respawn.key : SFX.heal.key);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  playMusic(key: string, opts: MusicOptions = {}): void {
    if (!this.game) return;
    if (key === this.musicKey && this.music?.isPlaying) return;

    const { loop = true, fadeMs = DEFAULT_FADE_MS, volume = this.settings.musicVolume } = opts;

    const previous = this.music;
    this.music = null;
    this.musicKey = null;
    if (previous) this.fade(previous, previous.volume, 0, fadeMs, () => previous.stop());

    if (!this.game.cache.audio.has(key)) {
      console.debug(`[audio] music track not loaded yet: ${key}`);
      return;
    }

    // If MenuMusic (the pre-boot HTML <audio> theme on the title/loading
    // screens) just handed off this exact track, resume from its position
    // instead of restarting at 0 — otherwise the melody audibly jumps back.
    let seek = 0;
    if (this.pendingSeek?.key === key) {
      seek = this.pendingSeek.seconds;
      this.pendingSeek = null;
    }

    const sound = this.game.sound.add(key, { loop, volume: 0 }) as unknown as Fadeable;
    sound.play(seek > 0 ? { seek } : undefined);
    this.music = sound;
    this.musicKey = key;
    this.fade(sound, 0, volume, fadeMs);
  }

  /** Lets MenuMusic (see components/MenuMusic.tsx) pass its playback position for a gapless handoff. */
  setHandoffPosition(key: string, seconds: number): void {
    this.pendingSeek = { key, seconds: Math.max(0, seconds) };
  }

  stopMusic(fadeMs = DEFAULT_FADE_MS): void {
    if (!this.music) return;
    const sound = this.music;
    this.music = null;
    this.musicKey = null;
    this.fade(sound, sound.volume, 0, fadeMs, () => sound.stop());
  }

  playSfx(key: string, opts: SfxOptions = {}): void {
    if (!this.game || this.settings.muted) return;
    if (!this.game.cache.audio.has(key)) {
      console.debug(`[audio] sfx not loaded yet: ${key}`);
      return;
    }
    this.game.sound.play(key, { volume: (opts.volume ?? 1) * this.settings.sfxVolume, rate: opts.rate ?? 1 });
  }

  playAttackSfx(attackId: string): void {
    this.playSfx(ATTACK_SFX_BY_ID[attackId] ?? SFX.attackGeneric.key);
  }

  setMusicVolume(value: number): void {
    this.settings.musicVolume = Phaser.Math.Clamp(value, 0, 1);
    this.persist();
    this.music?.setVolume(this.settings.musicVolume);
  }

  setSfxVolume(value: number): void {
    this.settings.sfxVolume = Phaser.Math.Clamp(value, 0, 1);
    this.persist();
  }

  setMuted(muted: boolean): void {
    this.settings.muted = muted;
    if (this.game) this.game.sound.mute = muted;
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
