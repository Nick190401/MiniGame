import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { AudioManager } from '../game/audio/AudioManager';
import { SFX } from '../game/audio/AudioLibrary';
import { EventBus, EVENTS } from '../game/EventBus';
import { BrandLogo } from './BrandLogo';
import { getWaveformHeights } from '../game/audio/Waveform';
import { useTr } from '../i18n';

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
  const t = useTr();
  // Opens the moment the track is won; a continued journey that already has it starts closed.
  const [showModal, setShowModal] = useState(() => !useGameStore.getState().bonusSongUnlocked);
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
      <>{audioElement}<button type="button" className="btn btn--ghost reward-reopen" aria-label={t('Open the Lost Track')} onClick={() => { playUiClick(); setShowModal(true); }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
        <span className="reward-reopen__label">{t('Lost Track')}</span>
      </button></>
    );
  }

  const progress = totalDuration ? (currentTime / totalDuration) * 100 : 0;
  const playerState = t(isPlaying ? 'Now playing' : currentTime > 0 ? 'Paused' : 'Ready to play');

  return (
    <>{audioElement}<div className="reward-screen">
      <article className="reward-card" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="reward-title" tabIndex={-1}>
        <section className="reward-art">
          <p className="reward-art__eyebrow">{t('Quest complete')}</p>
          <div className={`reward-record${isPlaying ? ' is-playing' : ''}`} aria-hidden="true">
            <div className="reward-record__label"><BrandLogo /></div>
          </div>
          <p className="reward-art__credit">
            <span>{t('Recovered by')}</span>
            <strong>{t(playerName || 'Mr Mario')}</strong>
          </p>
        </section>

        <section className="reward-content">
          <button type="button" className="reward-close" onClick={closeModal} aria-label={t('Close')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
          <p className="reward-eyebrow">{t('Lost Track recovered')}</p>
          <h2 id="reward-title" className="reward-title">{t('Signal restored.')}</h2>
          <p className="reward-text">
            {t("You broke the Gatekeeper's silence. This track is your reward. Press play and take it with you.")}
          </p>

          <div className="reward-player">
            <div className="reward-player__head">
              <div>
                <p className="reward-player__artist">MR MARIO</p>
                <p className="reward-player__track">Du schaffst das</p>
              </div>
              <p className={`reward-player__state${isPlaying ? ' is-playing' : ''}`}>{playerState}</p>
            </div>

            <div className="reward-timeline">
              <div className="reward-wave" aria-hidden="true">
                {waveBars.map((height, index) => (
                  <i key={index} className={progress > 0 && index / waveBars.length < progress / 100 ? 'is-passed' : ''} style={{ height: `${height}%` }} />
                ))}
              </div>
              <span className="reward-playhead" style={{ left: `${Math.min(100, progress)}%` }} aria-hidden="true" />
              <input className="reward-seek" type="range" min={0} max={totalDuration || 1} step={0.1} value={Math.min(currentTime, totalDuration)} disabled={!totalDuration} onChange={event => seek(Number(event.target.value))} aria-label={t('Track position')} aria-valuetext={t(`${formatTime(currentTime)} of ${formatTime(totalDuration)}`)} />
              {waveBars.length === 0 && <small className="reward-wave-status" role="status">{t(waveError ? 'Waveform unavailable.' : 'Loading waveform…')}</small>}
            </div>
            <div className="reward-player__times" aria-hidden="true"><span>{formatTime(currentTime)}</span><span>{formatTime(totalDuration)}</span></div>

            <div className="reward-player__controls">
              <button type="button" className="btn btn--primary reward-play" onClick={togglePlay}>
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  {isPlaying
                    ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
                    : <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />}
                </svg>
                {t(isPlaying ? 'Pause' : 'Play')}
              </button>
              <button type="button" className="btn btn--ghost" onClick={downloadTrack}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
                {t('Save MP3')}
              </button>
            </div>
            <label className="reward-volume">
              <span>{t('Volume')}</span>
              <input type="range" min={0} max={100} step={1} value={volume} onChange={event => setVolume(Number(event.target.value))} aria-label={t('Volume')} aria-valuetext={volume === 0 ? t('Muted') : `${volume}%`} />
              <output>{volume}%</output>
            </label>
          </div>

          {audioError && <p className="reward-error" role="alert">{t('The song could not be played. Please try again.')}</p>}

          <div className="reward-actions">
            <button type="button" className="btn btn--ghost" onClick={closeModal}>{t('Back to the world')}</button>
            <a
              className="btn btn--ghost"
              href="https://chat.whatsapp.com/DbOJG6cX5AuIstZURlWxOt"
              target="_blank"
              rel="noopener noreferrer"
              onClick={playUiClick}
            >
              {t('Join the WhatsApp community')}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
            </a>
          </div>
        </section>
      </article>
    </div></>
  );
}
