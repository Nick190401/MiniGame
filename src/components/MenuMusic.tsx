import { useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { AudioManager } from '../game/audio/AudioManager';
import { MUSIC } from '../game/audio/AudioLibrary';
import { EventBus, EVENTS } from '../game/EventBus';

const TRACK_URL = `/${MUSIC.overworldDefault.url}`;

/**
 * Plays the game's theme on the title screen, independent of Phaser (which
 * hasn't booted yet at that point). Keeps playing at full volume straight
 * through the loading screen — it only fades out once WorldScene is
 * actually ready and its own AudioManager-driven music has taken over, so
 * the handoff is a clean crossfade instead of a cut during loading. Fades
 * back in if the player ever returns to the title screen (e.g. exiting the
 * map editor).
 */
export function MenuMusic() {
  const gamePhase = useGameStore(s => s.gamePhase);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);
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
      if (unlockedRef.current) return;
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

  // The one true handoff point: WorldScene is ready and its own music has
  // started, so this can fade out. Deliberately NOT tied to gamePhase
  // leaving 'title' — that flips the instant the loading screen appears,
  // which is long before the world (and its music) actually exist.
  useEffect(() => {
    const onSceneReady = (sceneKey: string) => {
      if (sceneKey !== 'WorldScene') return;
      const audio = audioRef.current;
      // Hand off the exact playback position so the in-game AudioManager
      // resumes the same track from here instead of restarting it at 0 —
      // otherwise the melody audibly jumps back at the exact handoff moment.
      if (audio) AudioManager.setHandoffPosition(MUSIC.overworldDefault.key, audio.currentTime);
      fadeTo(0, 800);
    };
    EventBus.on(EVENTS.SCENE_READY, onSceneReady);
    return () => { EventBus.off(EVENTS.SCENE_READY, onSceneReady); };
  }, [fadeTo]);

  // Editor mode has no music of its own, so cut here. Returning to the
  // title screen (from editor, or any other unexpected path back) resumes.
  useEffect(() => {
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
