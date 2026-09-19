import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { AudioManager } from '../game/audio/AudioManager';
import { SFX } from '../game/audio/AudioLibrary';
import { EventBus, EVENTS } from '../game/EventBus';
import { BrandLogo } from './BrandLogo';

const playUiClick = () => AudioManager.playSfx(SFX.uiClick.key);

const LOST_TRACK_URL = '/assets/audio/music/reward/du-schaffst-das.mp3';

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

const WAVE_BARS = Array.from({ length: 44 }, (_, index) => 18 + ((index * 17 + index * index) % 68));

export function RewardModal() {
  const bonusSongUnlocked = useGameStore(state => state.bonusSongUnlocked);
  const [showModal, setShowModal] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
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
    const settings = AudioManager.getSettings();
    audio.volume = settings.musicVolume;
    audio.muted = settings.muted;
    setAudioError(false);
    try {
      await audio.play();
    } catch {
      setAudioError(true);
      setIsPlaying(false);
    }
  }, []);

  const seek = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !totalDuration) return;
    playUiClick();
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    audio.currentTime = ratio * totalDuration;
  }, [totalDuration]);

  const closeModal = useCallback(() => {
    playUiClick();
    audioRef.current?.pause();
    setIsPlaying(false);
    setShowModal(false);
  }, []);

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
      <article className="reward-card">
        <section className="reward-art">
          <div className="reward-art__catalog">SQ / ARCHIVE 001</div>
          <div className={`reward-record ${isPlaying ? 'is-playing' : ''}`} aria-hidden="true">
            <div className="reward-record__label"><BrandLogo /><small>THE LOST TRACK</small><i className="reward-record__spindle" /></div>
          </div>
          <div className="reward-art__frequency">
            <span>MR MARIO</span>
            <strong>Du schaffst das</strong>
          </div>
        </section>

        <section className="reward-content">
          <button className="reward-close" onClick={closeModal} aria-label="Close reward">×</button>
          <p className="reward-kicker"><span>Transmission restored</span> 01 / 01</p>
          <h2>You found<br /><em>the lost track.</em></h2>
          <p className="reward-description">
            The Gatekeeper's silence has been broken. This frequency belongs to you now.
          </p>

          <div className="reward-player">
            <div className="reward-player__heading">
              <div><span>MR MARIO</span><strong>Du schaffst das</strong></div>
              <span className="reward-player__time">{formatTime(currentTime)} / {formatTime(totalDuration)}</span>
            </div>

            <div className="reward-wave" aria-hidden="true">
              {WAVE_BARS.map((height, index) => (
                <i key={index} className={index / WAVE_BARS.length <= progress / 100 ? 'is-passed' : ''} style={{ height: `${height}%` }} />
              ))}
            </div>

            <div className="reward-progress" onClick={seek} role="slider" aria-label="Track progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
              <span style={{ width: `${progress}%` }} />
            </div>

            <div className="reward-player__controls">
              <button className="reward-play" onClick={togglePlay}>
                <span>{isPlaying ? 'Ⅱ' : '▶'}</span>
                {isPlaying ? 'Pause track' : 'Play track'}
              </button>
              <button className="reward-download" onClick={downloadTrack}>Save MP3 ↘</button>
            </div>
          </div>

          {audioError && <p role="alert">The song could not be played. Please try again.</p>}

          <button className="reward-continue" onClick={closeModal}>Return to the world <span>→</span></button>
        </section>
      </article>
    </div></>
  );
}
