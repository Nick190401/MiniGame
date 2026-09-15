import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { AudioManager } from '../game/audio/AudioManager';
import { SFX } from '../game/audio/AudioLibrary';
import { EventBus, EVENTS } from '../game/EventBus';

const playUiClick = () => AudioManager.playSfx(SFX.uiClick.key);

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index++) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channel = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const dataLength = channel.length * 2;
  const arrayBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let index = 0; index < channel.length; index++) {
    const sample = Math.max(-1, Math.min(1, channel[index]));
    view.setInt16(offset, sample * (sample < 0 ? 0x8000 : 0x7fff), true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

async function generateLostTrackAudio(): Promise<{ url: string; blob: Blob }> {
  const sampleRate = 44100;
  const duration = 28;
  const context = new OfflineAudioContext(1, sampleRate * duration, sampleRate);
  const frequencies = [261.63, 311.13, 349.23, 392, 466.16, 523.25, 622.25, 698.46];
  const melody: [number, number, number][] = [
    [0, 0.5, 2.2], [2, 3, 1.8], [3, 5, 2.2], [4, 7.5, 1.5],
    [3, 9.2, 2], [2, 11.5, 1.8], [0, 13.5, 2.8],
    [5, 16.5, 2.2], [3, 19, 1.8], [4, 21, 2.2], [2, 23.5, 1.5],
    [0, 25.2, 3],
  ];

  for (const [noteIndex, start, noteDuration] of melody) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = frequencies[noteIndex];
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.13, start + 0.12);
    gain.gain.setValueAtTime(0.11, start + noteDuration * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + noteDuration);
  }

  for (const [noteIndex, start, noteDuration] of melody) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequencies[noteIndex] * 2;
    gain.gain.setValueAtTime(0, start + 0.05);
    gain.gain.linearRampToValueAtTime(0.03, start + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration * 0.7);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + noteDuration);
  }

  for (const frequency of [130.81, 196]) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(frequency < 150 ? 0.04 : 0.025, 3);
    gain.gain.setValueAtTime(frequency < 150 ? 0.04 : 0.025, duration - 4);
    gain.gain.linearRampToValueAtTime(0, duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(0);
    oscillator.stop(duration);
  }

  const renderedBuffer = await context.startRendering();
  const blob = audioBufferToWav(renderedBuffer);
  return { url: URL.createObjectURL(blob), blob };
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

const WAVE_BARS = Array.from({ length: 44 }, (_, index) => 18 + ((index * 17 + index * index) % 68));

export function RewardModal() {
  const bonusSongUnlocked = useGameStore(state => state.bonusSongUnlocked);
  const [showModal, setShowModal] = useState(true);
  const [audioData, setAudioData] = useState<{ url: string; blob: Blob } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const generatedRef = useRef(false);

  useEffect(() => {
    if (!bonusSongUnlocked || generatedRef.current) return;
    generatedRef.current = true;
    setIsGenerating(true);
    generateLostTrackAudio()
      .then(data => setAudioData(data))
      .finally(() => setIsGenerating(false));
  }, [bonusSongUnlocked]);

  useEffect(() => {
    if (bonusSongUnlocked) EventBus.emit(EVENTS.REWARD_UI_STATE, showModal);
  }, [bonusSongUnlocked, showModal]);

  useEffect(() => () => {
    if (audioData?.url) URL.revokeObjectURL(audioData.url);
  }, [audioData]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTime = () => setCurrentTime(audio.currentTime);
    const handleMetadata = () => setTotalDuration(audio.duration);
    const handleEnd = () => setIsPlaying(false);
    audio.addEventListener('timeupdate', handleTime);
    audio.addEventListener('loadedmetadata', handleMetadata);
    audio.addEventListener('ended', handleEnd);
    return () => {
      audio.removeEventListener('timeupdate', handleTime);
      audio.removeEventListener('loadedmetadata', handleMetadata);
      audio.removeEventListener('ended', handleEnd);
    };
  }, [audioData]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    playUiClick();
    if (isPlaying) audio.pause();
    else void audio.play();
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

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
    if (!audioData) return;
    playUiClick();
    const link = document.createElement('a');
    link.href = audioData.url;
    link.download = 'the-lost-track.wav';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [audioData]);

  if (!bonusSongUnlocked) return null;

  if (!showModal) {
    return (
      <button className="reward-reopen" onClick={() => { playUiClick(); setShowModal(true); }}>
        <span className="reward-reopen__pulse" />
        Lost Track
        <span>↗</span>
      </button>
    );
  }

  const progress = totalDuration ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="reward-screen">
      <div className="reward-screen__grid" aria-hidden="true" />
      <article className="reward-card">
        <section className="reward-art">
          <div className="reward-art__catalog">SQ / ARCHIVE 001</div>
          <div className={`reward-record ${isPlaying ? 'is-playing' : ''}`} aria-hidden="true">
            <div className="reward-record__label"><span>SQ</span><small>Lost<br />Track</small></div>
          </div>
          <div className="reward-art__frequency">
            <span>Recovered frequency</span>
            <strong>261.63 Hz</strong>
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
            {audioData && <audio ref={audioRef} src={audioData.url} preload="auto" />}
            <div className="reward-player__heading">
              <div><span>Now playing</span><strong>The Lost Track</strong></div>
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
              <button className="reward-play" onClick={togglePlay} disabled={!audioData}>
                <span>{isPlaying ? 'Ⅱ' : '▶'}</span>
                {isGenerating ? 'Rendering audio…' : isPlaying ? 'Pause track' : 'Play track'}
              </button>
              <button className="reward-download" onClick={downloadTrack} disabled={!audioData}>Save WAV ↘</button>
            </div>
          </div>

          <button className="reward-continue" onClick={closeModal}>Return to the world <span>→</span></button>
        </section>
      </article>
    </div>
  );
}
