import { useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { AudioManager } from '../game/audio/AudioManager';
import { MUSIC } from '../game/audio/AudioLibrary';

const TRACK_URL = `/${MUSIC.overworldDefault.url}`;

/**
 * Plays the game's theme on the title screen, independent of Phaser (which
 * hasn't booted yet at that point). Keeps playing through the loading screen
 * and into the world while the game's own copy of the track streams in; it
 * only fades out once AudioManager starts its music, so the handoff is a
 * clean crossfade from the same position. Until then it follows the in-game
 * music volume and mute. Fades back in if the player ever returns to the
 * title screen (e.g. exiting the map editor).
 */
export function MenuMusic() {
  const gamePhase = useGameStore(s => s.gamePhase);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);
  /** The game's own music has taken over. */
  const releasedRef = useRef(false);
  const fadeTokenRef = useRef(0);

  if (!audioRef.current && typeof Audio !== 'undefined') {
    const audio = new Audio(TRACK_URL);
    audio.loop = true;
    audio.volume = 0;
    audioRef.current = audio;
    (window as unknown as { menuMusic?: HTMLAudioElement }).menuMusic = audio;
  }

  // Cancellation-token guarded: a newer fadeTo() call always wins over an
  // older still-running one, so two overlapping fades can't fight over
  // audio.volume and drive it briefly outside [0, 1] (which throws).
  const fadeTo = useCallback((target: number, ms: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const token = ++fadeTokenRef.current;
    const from = audio.volume;
    const start = performance.now();
    const step = (now: number) => {
      if (fadeTokenRef.current !== token) return;
      const t = Math.min(1, (now - start) / ms);
      audio.volume = Math.max(0, Math.min(1, from + (target - from) * t));
      if (t < 1) requestAnimationFrame(step);
      else if (target === 0) audio.pause();
    };
    requestAnimationFrame(step);
  }, []);

  // Browsers block audio before any user gesture — start on the earliest one.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const unlock = () => {
      // Once the game's own music has taken over, the title theme stays out of it.
      if (unlockedRef.current || releasedRef.current) return;
      const { muted, musicVolume } = AudioManager.getSettings();
      if (muted) return;
      unlockedRef.current = true;
      audio.play().then(() => fadeTo(musicVolume, 900)).catch(() => { unlockedRef.current = false; });
    };

    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [fadeTo]);

  // The one true handoff point: AudioManager starts the game's own music.
  // Deliberately NOT tied to gamePhase leaving 'title' or to the world being
  // ready: the in-game copy of the track may still be downloading then.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    AudioManager.registerMenuMusic({
      trackKey: MUSIC.overworldDefault.key,
      position: () => (!releasedRef.current && !audio.paused ? audio.currentTime : null),
      setVolume: (value) => {
        if (releasedRef.current || !unlockedRef.current) return;
        // A fade to 0 pauses it; the slider change is a gesture, so it may play again.
        if (value > 0 && audio.paused) audio.play().catch(() => {});
        fadeTo(value, 150);
      },
      setMuted: (muted) => { audio.muted = muted; },
      release: () => {
        if (releasedRef.current) return;
        releasedRef.current = true;
        fadeTo(0, 800);
      },
    });
    return () => AudioManager.registerMenuMusic(null);
  }, [fadeTo]);

  // Editor mode has no music of its own, so cut here. Returning to the
  // title screen (from editor, or any other unexpected path back) resumes.
  useEffect(() => {
    if (gamePhase === 'title') releasedRef.current = false;
    if (!unlockedRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (gamePhase === 'title') {
      if (audio.paused) audio.play().catch(() => {});
      fadeTo(AudioManager.getSettings().musicVolume, 500);
    } else if (gamePhase === 'editor') {
      fadeTo(0, 500);
    }
  }, [gamePhase, fadeTo]);

  return null;
}
