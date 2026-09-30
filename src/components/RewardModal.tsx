import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { AudioManager } from '../game/audio/AudioManager';
import { SFX } from '../game/audio/AudioLibrary';
import { EventBus, EVENTS } from '../game/EventBus';
import { BrandLogo } from './BrandLogo';
import { getWaveformHeights } from '../game/audio/Waveform';
import './RewardModal.css';

const playUiClick = () => AudioManager.playSfx(SFX.uiClick.key);

const LOST_TRACK_URL = '/assets/audio/music/reward/du-schaffst-das.mp3';

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

const WAVE_BAR_COUNT = 44;

export function RewardModal() {
  const bonusSongUnlocked = useGameStore(state => state.bonusSongUnlocked);
  const playerName = useGameStore(state => state.playerName);
  const [showModal, setShowModal] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(() => {
    const settings = AudioManager.getSettings();
    return settings.muted ? 0 : Math.round(settings.musicVolume * 100);
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const [waveBars, setWaveBars] = useState<number[]>([]);
  const [waveError, setWaveError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume / 100;
    audio.muted = volume === 0;
  }, [volume, bonusSongUnlocked]);
  useEffect(() => {
    if (!bonusSongUnlocked) return;
    const controller = new AbortController();
    setWaveError(false);
    setWaveBars([]);

    async function loadWaveform() {
      try {
        const response = await fetch(LOST_TRACK_URL, { signal: controller.signal });
        if (!response.ok) throw new Error(`Track load failed: ${response.status}`);
        const bytes = await response.arrayBuffer();
        if (controller.signal.aborted) return;
        // Offline decoding does not start playback or require an audio gesture.
        const context = new OfflineAudioContext(1, 1, 44100);
        const buffer = await context.decodeAudioData(bytes);
        if (controller.signal.aborted) return;
        const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
        setWaveBars(getWaveformHeights(channels, WAVE_BAR_COUNT));
      } catch {
        if (!controller.signal.aborted) setWaveError(true);
      }
    }

    void loadWaveform();
    return () => controller.abort();
  }, [bonusSongUnlocked]);

  useEffect(() => {
    if (bonusSongUnlocked) EventBus.emit(EVENTS.REWARD_UI_STATE, showModal);
  }, [bonusSongUnlocked, showModal]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    playUiClick();
    if (!audio.paused) {
      audio.pause();
      return;
    }
    audio.volume = volume / 100;
    audio.muted = volume === 0;
    setAudioError(false);
    try {
      await audio.play();
    } catch {
      setAudioError(true);
      setIsPlaying(false);
    }
  }, [volume]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !totalDuration) return;
    audio.currentTime = Math.max(0, Math.min(totalDuration, seconds));
    setCurrentTime(audio.currentTime);
  }, [totalDuration]);

  const closeModal = useCallback(() => {
    playUiClick();
    audioRef.current?.pause();
    setIsPlaying(false);
    setShowModal(false);
  }, []);

  useEffect(() => {
    if (!bonusSongUnlocked || !showModal) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      // Keep game shortcuts from firing while the archive has focus.
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); closeModal(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled)') ?? []);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    };
    const dialog = dialogRef.current;
    dialog?.addEventListener('keydown', onKeyDown);
    return () => {
      dialog?.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [bonusSongUnlocked, showModal, closeModal]);

  const downloadTrack = useCallback(() => {
    playUiClick();
    const link = document.createElement('a');
    link.href = LOST_TRACK_URL;
    link.download = 'MR MARIO-Du schaffst das.mp3';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, []);

  if (!bonusSongUnlocked) return null;

  // Keep the same element mounted when the archive closes, preserving position.
  const audioElement = <audio
    ref={audioRef}
    src={LOST_TRACK_URL}
    preload="metadata"
    onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)}
    onLoadedMetadata={event => setTotalDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
    onPlay={() => setIsPlaying(true)}
    onPause={() => setIsPlaying(false)}
    onEnded={() => setIsPlaying(false)}
    onError={() => { setAudioError(true); setIsPlaying(false); }}
  />;

  if (!showModal) {
    return (
      <>{audioElement}<button className="reward-reopen" onClick={() => { playUiClick(); setShowModal(true); }}>
        <span className="reward-reopen__pulse" />
        Lost Track
        <span>↗</span>
      </button></>
    );
  }

  const progress = totalDuration ? (currentTime / totalDuration) * 100 : 0;

  return (
    <>{audioElement}<div className="reward-screen">
      <div className="reward-screen__grid" aria-hidden="true" />
      <article className="reward-card reward-card--archive" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="reward-title" tabIndex={-1}>
        <section className="reward-art">
          <div className="reward-art__catalog"><span>SQ / ARCHIVE 001</span><b>UNLOCKED</b></div>
          <div className="reward-art__mission">QUEST COMPLETE<span>The silence is broken.</span></div>
          <div className={`reward-record ${isPlaying ? 'is-playing' : ''}`} aria-hidden="true">
            <div className="reward-record__label"><BrandLogo /><small>THE LOST TRACK</small><i className="reward-record__spindle" /></div>
          </div>
          <div className="reward-art__frequency">
            <span>RECOVERED BY</span>
            <strong>{playerName || 'Sound Keeper'}</strong>
          </div>
        </section>

        <section className="reward-content">
          <button className="reward-close" onClick={closeModal} aria-label="Close reward">×</button>
          <p className="reward-kicker"><span>LOST TRACK RECOVERED</span></p>
          <h2 id="reward-title">Signal<br /><em>restored.</em></h2>
          <p className="reward-description">
            You broke the Gatekeeper's silence. This track is your reward. Press play and take it with you.
          </p>

          <div className="reward-player">
            <div className="reward-player__status"><span>TRACK 01 / 01</span><b className={isPlaying ? 'is-playing' : ''}>{isPlaying ? 'NOW PLAYING' : currentTime > 0 ? 'PAUSED' : 'READY TO PLAY'}</b></div>
            <div className="reward-player__heading">
              <div><span>MR MARIO</span><strong>Du schaffst das</strong></div>
              <span className="reward-player__time">{formatTime(currentTime)} / {formatTime(totalDuration)}</span>
            </div>

            <div className="reward-timeline">
            <div className="reward-wave" aria-hidden="true">
              {waveBars.map((height, index) => (
                <i key={index} className={progress > 0 && index / waveBars.length < progress / 100 ? 'is-passed' : ''} style={{ height: `${height}%` }} />
              ))}
            </div>
            <span className="reward-playhead" style={{ left: `${Math.min(100, progress)}%` }} aria-hidden="true" />
            <input className="reward-seek" type="range" min={0} max={totalDuration || 1} step={0.1} value={Math.min(currentTime, totalDuration)} disabled={!totalDuration} onChange={event => seek(Number(event.target.value))} aria-label="Track position" aria-valuetext={`${formatTime(currentTime)} of ${formatTime(totalDuration)}`} />
            {waveBars.length === 0 && <small className="reward-wave-status" role="status">{waveError ? 'Waveform unavailable.' : 'Loading waveform…'}</small>}
            </div>
            <div className="reward-player__scale" aria-hidden="true"><span>0:00</span><span>SEEK THE SIGNAL</span><span>{formatTime(totalDuration)}</span></div>

            <div className="reward-player__controls">
              <button className="reward-play" onClick={togglePlay}>
                <span>{isPlaying ? 'Ⅱ' : '▶'}</span>
                {isPlaying ? 'Pause track' : 'Play track'}
              </button>
              <button className="reward-download" onClick={downloadTrack}>Save MP3 ↘</button>
            </div>
            <label className="reward-volume">
              <span>Volume</span>
              <input type="range" min={0} max={100} step={1} value={volume} onChange={event => setVolume(Number(event.target.value))} aria-label="Lost Track volume" aria-valuetext={volume === 0 ? 'Muted' : `${volume}%`} />
              <output>{volume}%</output>
            </label>
          </div>

          {audioError && <p role="alert">The song could not be played. Please try again.</p>}

          <button className="reward-continue" onClick={closeModal}>Return to the world <span aria-hidden="true">→</span></button>

          <a
            className="reward-continue reward-community"
            href="https://chat.whatsapp.com/DbOJG6cX5AuIstZURlWxOt"
            target="_blank"
            rel="noopener noreferrer"
            onClick={playUiClick}
          >
            Join the WhatsApp Community <span aria-hidden="true">↗</span>
          </a>

        </section>
      </article>
    </div></>
  );
}
