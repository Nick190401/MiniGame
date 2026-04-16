import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';

// ── WAV encoder ──────────────────────────────────────────────────────────────

function wStr(v: DataView, o: number, s: string) {
  for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
}

function bufToWav(buf: AudioBuffer): Blob {
  const ch = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const dLen = ch.length * 2;
  const ab = new ArrayBuffer(44 + dLen);
  const v = new DataView(ab);
  wStr(v, 0, 'RIFF');
  v.setUint32(4, 36 + dLen, true);
  wStr(v, 8, 'WAVE');
  wStr(v, 12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  wStr(v, 36, 'data');
  v.setUint32(40, dLen, true);
  let off = 44;
  for (let i = 0; i < ch.length; i++) {
    const s = Math.max(-1, Math.min(1, ch[i]));
    v.setInt16(off, s * (s < 0 ? 0x8000 : 0x7fff), true);
    off += 2;
  }
  return new Blob([ab], { type: 'audio/wav' });
}

// ── Melody generator ─────────────────────────────────────────────────────────

async function generateLostTrackAudio(): Promise<{ url: string; blob: Blob }> {
  const sr = 44100;
  const dur = 28;
  const ctx = new OfflineAudioContext(1, sr * dur, sr);

  // C minor pentatonic — haunting music-box melody
  const f = [261.63, 311.13, 349.23, 392.00, 466.16, 523.25, 622.25, 698.46];

  const melody: [number, number, number][] = [
    [0, 0.5, 2.2],  [2, 3, 1.8],   [3, 5, 2.2],   [4, 7.5, 1.5],
    [3, 9.2, 2],     [2, 11.5, 1.8],[0, 13.5, 2.8],
    [5, 16.5, 2.2],  [3, 19, 1.8],  [4, 21, 2.2],  [2, 23.5, 1.5],
    [0, 25.2, 3],
  ];

  // Main triangle melody
  for (const [ni, st, nd] of melody) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = f[ni];
    g.gain.setValueAtTime(0, st);
    g.gain.linearRampToValueAtTime(0.13, st + 0.12);
    g.gain.setValueAtTime(0.11, st + nd * 0.5);
    g.gain.exponentialRampToValueAtTime(0.001, st + nd);
    o.connect(g); g.connect(ctx.destination);
    o.start(st); o.stop(st + nd);
  }

  // Octave-up shimmer (sine, quiet)
  for (const [ni, st, nd] of melody) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f[ni] * 2;
    g.gain.setValueAtTime(0, st + 0.05);
    g.gain.linearRampToValueAtTime(0.03, st + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, st + nd * 0.7);
    o.connect(g); g.connect(ctx.destination);
    o.start(st); o.stop(st + nd);
  }

  // Background drone (C3 + G3)
  for (const freq of [130.81, 196.00]) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, 0);
    g.gain.linearRampToValueAtTime(freq < 150 ? 0.04 : 0.025, 3);
    g.gain.setValueAtTime(freq < 150 ? 0.04 : 0.025, dur - 4);
    g.gain.linearRampToValueAtTime(0, dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(0); o.stop(dur);
  }

  const buffer = await ctx.startRendering();
  const blob = bufToWav(buffer);
  return { url: URL.createObjectURL(blob), blob };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export function RewardModal() {
  const bonusSongUnlocked = useGameStore(s => s.bonusSongUnlocked);
  const [showModal, setShowModal] = useState(true);
  const [audioData, setAudioData] = useState<{ url: string; blob: Blob } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [totalDur, setTotalDur] = useState(0);
  const [generating, setGenerating] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const generatedRef = useRef(false);

  // Generate audio on first unlock
  useEffect(() => {
    if (bonusSongUnlocked && !generatedRef.current) {
      generatedRef.current = true;
      setGenerating(true);
      generateLostTrackAudio().then(data => {
        setAudioData(data);
        setGenerating(false);
      });
    }
  }, [bonusSongUnlocked]);

  // Audio event listeners
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurTime(a.currentTime);
    const onMeta = () => setTotalDur(a.duration);
    const onEnd = () => setIsPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
    };
  }, [audioData]);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) { a.pause(); setIsPlaying(false); }
    else { a.play(); setIsPlaying(true); }
  }, [isPlaying]);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !totalDur) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * totalDur;
  }, [totalDur]);

  const handleClose = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
    setShowModal(false);
  }, []);

  const handleDownload = useCallback(() => {
    if (!audioData) return;
    const u = URL.createObjectURL(audioData.blob);
    const a = document.createElement('a');
    a.href = u; a.download = 'the-lost-track.wav';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(u);
  }, [audioData]);

  if (!bonusSongUnlocked) return null;

  // ── Mini reopen button (when modal closed) ──
  if (!showModal) {
    return (
      <button
        onClick={() => setShowModal(true)}
        style={{
          position: 'absolute', bottom: 16, right: 16, zIndex: 50,
          fontFamily: '"Press Start 2P"', fontSize: '7px',
          padding: '10px 16px',
          background: '#080020', color: '#00ffff',
          border: '2px solid #00ffff44',
          boxShadow: '0 0 12px rgba(0,255,255,0.2)',
          cursor: 'pointer',
          animation: 'float 3s ease-in-out infinite',
        }}
      >
        ♫ The Lost Track
      </button>
    );
  }

  // ── Full modal ──
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(0,20,40,0.97) 0%, rgba(0,0,8,0.99) 100%)',
        zIndex: 100, backdropFilter: 'blur(2px)',
      }}
    >
      {/* Ambient particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="absolute rounded-full" style={{
            width: 2, height: 2,
            background: i % 3 === 0 ? '#00ffff' : i % 3 === 1 ? '#8800ff' : '#ffdd00',
            left: `${((i * 37 + 13) % 100)}%`,
            top: `${((i * 53 + 7) % 100)}%`,
            opacity: 0,
            animation: `pixel-blink ${2 + (i % 4)}s ease-in-out infinite`,
            animationDelay: `${(i * 0.4) % 4}s`,
          }} />
        ))}
      </div>

      {/* Modal card */}
      <div
        className="animate-reward-enter relative flex flex-col items-center gap-4 text-center"
        style={{
          background: 'linear-gradient(160deg, #0d0030 0%, #050015 100%)',
          border: '2px solid #00ffff',
          boxShadow: '0 0 40px #00ffff66, 0 0 80px #8800ff33, inset 0 0 30px rgba(0,255,255,0.04)',
          padding: 'clamp(20px, 4vw, 36px)',
          maxWidth: 'min(460px, 92vw)', width: '100%',
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute', top: 8, right: 12,
            fontFamily: '"Press Start 2P"', fontSize: '10px',
            color: '#555577', background: 'none', border: 'none',
            cursor: 'pointer', padding: '4px 8px', zIndex: 10,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ff4444')}
          onMouseLeave={e => (e.currentTarget.style.color = '#555577')}
        >
          X
        </button>

        {/* Accent lines */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(to right, transparent, #00ffff, #8800ff, #00ffff, transparent)',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(to right, transparent, #8800ff, #00ffff, #8800ff, transparent)',
        }} />

        {/* Crystal icon */}
        <div className="animate-float">
          <div className="animate-glow-pulse" style={{
            width: 56, height: 56, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="56" height="56" viewBox="0 0 64 64" style={{ imageRendering: 'pixelated' }}>
              <ellipse cx="32" cy="56" rx="18" ry="5" fill="#00ffff" opacity="0.2" />
              <polygon points="32,8 16,40 32,52 48,40" fill="#00ccff" opacity="0.9" />
              <polygon points="32,12 20,38 28,46 36,38" fill="#80ffff" opacity="0.6" />
              <polygon points="32,52 48,40 40,48" fill="#006688" opacity="0.8" />
              <polygon points="32,16 24,36 30,42 34,36" fill="#ffffff" opacity="0.35" />
              <rect x="10" y="16" width="3" height="3" fill="#fff" opacity="0.7" />
              <rect x="50" y="20" width="3" height="3" fill="#fff" opacity="0.7" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div>
          <p style={{
            fontFamily: '"Press Start 2P"', fontSize: 'clamp(5px, 1.2vw, 7px)',
            color: '#888899', marginBottom: 6, letterSpacing: 2,
          }}>YOU FOUND IT</p>
          <h2 style={{
            fontFamily: '"Press Start 2P"', fontSize: 'clamp(11px, 2.8vw, 18px)',
            color: '#00ffff',
            textShadow: '0 0 16px #00ffff, 0 0 32px #00ffff66',
            lineHeight: 1.4,
          }}>THE LOST TRACK</h2>
        </div>

        {/* Divider */}
        <div style={{
          width: '80%', height: 1,
          background: 'linear-gradient(to right, transparent, #00ffff33, #8800ff33, transparent)',
        }} />

        {/* Audio Player */}
        {audioData ? (
          <div style={{
            width: '100%', maxWidth: 360, padding: '14px 18px',
            background: 'rgba(0,8,24,0.9)', border: '1px solid #00ffff22',
          }}>
            <audio ref={audioRef} src={audioData.url} preload="auto" />

            {/* Track info row */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 10,
            }}>
              <span style={{
                fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#aaaacc',
              }}>The Lost Track</span>
              <span style={{
                fontFamily: '"Press Start 2P"', fontSize: '5px', color: '#555577',
              }}>{fmtTime(curTime)} / {fmtTime(totalDur)}</span>
            </div>

            {/* Progress bar */}
            <div
              onClick={seek}
              style={{
                width: '100%', height: 6, background: '#0a0a1a',
                border: '1px solid #00ffff33', cursor: 'pointer', marginBottom: 14,
              }}
            >
              <div style={{
                width: `${totalDur ? (curTime / totalDur) * 100 : 0}%`,
                height: '100%',
                background: 'linear-gradient(to right, #00ffff, #8844ff)',
                boxShadow: isPlaying ? '0 0 6px #00ffff88' : 'none',
                transition: 'width 0.15s linear',
              }} />
            </div>

            {/* Control buttons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={togglePlay} style={{
                fontFamily: '"Press Start 2P"', fontSize: '7px',
                padding: '8px 18px', cursor: 'pointer',
                background: isPlaying ? '#0a0830' : '#0a0020',
                color: '#00ffff',
                border: `2px solid ${isPlaying ? '#00ffff' : '#00ffff66'}`,
                boxShadow: isPlaying ? '0 0 12px rgba(0,255,255,0.3)' : 'none',
                transition: 'all 0.15s',
              }}>
                {isPlaying ? '|| Pause' : '> Play'}
              </button>
              <button onClick={handleDownload} style={{
                fontFamily: '"Press Start 2P"', fontSize: '7px',
                padding: '8px 18px', cursor: 'pointer',
                background: '#0a0020', color: '#8888cc',
                border: '2px solid #8888cc44',
                transition: 'all 0.15s',
              }}>
                Save .wav
              </button>
            </div>
          </div>
        ) : (
          <p style={{
            fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#555577',
            padding: '20px 0',
          }}>
            {generating ? '~ Generating melody...' : ''}
          </p>
        )}

        {/* Story text */}
        <p style={{
          fontFamily: '"Press Start 2P"', fontSize: 'clamp(4px, 1vw, 6px)',
          color: '#667788', lineHeight: 2.2, maxWidth: 300,
        }}>
          The Gatekeeper's silence has been broken.
          <br />This frequency belongs to you now.
        </p>

        <p style={{
          fontFamily: '"Press Start 2P"', fontSize: '4px', color: '#2a2a44',
        }}>
          SOUND QUEST
        </p>
      </div>
    </div>
  );
}
