import { useState } from 'react';
import { useGameStore } from '../store/gameStore';

async function simulateSignedDownload(): Promise<string> {
  // Simulate a call to a signing API (e.g. S3 presigned URL)
  await new Promise(resolve => setTimeout(resolve, 1500));

  // In production: return a real signed URL from your backend
  // e.g. const res = await fetch('/api/reward/signed-url'); const { url } = await res.json();
  const content = [
    '╔══════════════════════════════════════╗',
    '║        🎵  THE LOST TRACK  🎵        ║',
    '╚══════════════════════════════════════╝',
    '',
    'You defeated The Gatekeeper.',
    'The silence is broken.',
    '',
    'This track was hidden beyond the Void Gate,',
    'waiting for someone brave enough to find it.',
    '',
    'Track: The Lost Track',
    'Artist: [Your Artist Name]',
    'Duration: 3:47',
    'Released: Sound Quest Edition',
    '',
    '──────────────────────────────────────',
    '',
    '[Replace this file with the real audio]',
    '',
    'In production, this would be a signed URL',
    'to an actual .mp3 or .wav file hosted on',
    'S3, R2, or your CDN of choice.',
    '',
    'Play it loud. You earned it.',
    '',
    '══════════════════════════════════════',
    '           SOUND QUEST © 2025',
    '══════════════════════════════════════',
  ].join('\n');

  const blob = new Blob([content], { type: 'text/plain' });
  return URL.createObjectURL(blob);
}

export function RewardModal() {
  const bonusSongUnlocked = useGameStore(s => s.bonusSongUnlocked);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState('');

  if (!bonusSongUnlocked) return null;

  const handleDownload = async () => {
    if (downloading || downloaded) return;
    setDownloading(true);
    setError('');

    try {
      const url = await simulateSignedDownload();
      const a = document.createElement('a');
      a.href = url;
      a.download = 'the-lost-track.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloaded(true);
    } catch {
      setError('Download failed. Try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(0,20,40,0.97) 0%, rgba(0,0,8,0.99) 100%)',
        zIndex: 100,
        backdropFilter: 'blur(2px)',
      }}
    >
      {/* Ambient particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 3,
              height: 3,
              background: i % 2 === 0 ? '#00ffff' : '#8800ff',
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: 0,
              animation: `pixel-blink ${1 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {/* Modal card */}
      <div
        className="animate-reward-enter relative flex flex-col items-center gap-6 text-center"
        style={{
          background: 'linear-gradient(160deg, #0d0030 0%, #050015 100%)',
          border: '2px solid #00ffff',
          boxShadow: '0 0 40px #00ffff88, 0 0 80px #8800ff44, inset 0 0 30px rgba(0,255,255,0.05)',
          padding: 'clamp(24px, 5vw, 48px)',
          maxWidth: 'min(480px, 90vw)',
          width: '100%',
        }}
      >
        {/* Top accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'linear-gradient(to right, transparent, #00ffff, #8800ff, #00ffff, transparent)',
          }}
        />

        {/* Crystal icon */}
        <div className="animate-float">
          <div
            className="animate-glow-pulse"
            style={{
              width: 64,
              height: 64,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* SVG crystal */}
            <svg width="64" height="64" viewBox="0 0 64 64" style={{ imageRendering: 'pixelated' }}>
              {/* Outer glow */}
              <ellipse cx="32" cy="56" rx="20" ry="6" fill="#00ffff" opacity="0.2" />
              {/* Crystal body */}
              <polygon points="32,8 16,40 32,52 48,40" fill="#00ccff" opacity="0.9" />
              {/* Crystal highlight */}
              <polygon points="32,12 20,38 28,46 36,38" fill="#80ffff" opacity="0.6" />
              {/* Crystal shadow */}
              <polygon points="32,52 48,40 40,48" fill="#006688" opacity="0.8" />
              {/* Inner shine */}
              <polygon points="32,16 24,36 30,42 34,36" fill="#ffffff" opacity="0.4" />
              {/* Sparkles */}
              <rect x="8" y="14" width="4" height="4" fill="#ffffff" opacity="0.8" />
              <rect x="52" y="18" width="4" height="4" fill="#ffffff" opacity="0.8" />
              <rect x="18" y="52" width="3" height="3" fill="#00ffff" opacity="0.9" />
              <rect x="44" y="50" width="3" height="3" fill="#00ffff" opacity="0.9" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div>
          <p
            style={{
              fontFamily: '"Press Start 2P"',
              fontSize: 'clamp(6px, 1.5vw, 8px)',
              color: '#888899',
              marginBottom: 12,
              letterSpacing: 2,
            }}
          >
            YOU FOUND IT
          </p>
          <h2
            style={{
              fontFamily: '"Press Start 2P"',
              fontSize: 'clamp(12px, 3vw, 20px)',
              color: '#00ffff',
              textShadow: '0 0 20px #00ffff, 0 0 40px #00ffff88',
              lineHeight: 1.4,
            }}
          >
            THE LOST TRACK
          </h2>
        </div>

        {/* Divider */}
        <div
          style={{
            width: '80%',
            height: 1,
            background: 'linear-gradient(to right, transparent, #00ffff44, #8800ff44, transparent)',
          }}
        />

        {/* Story text */}
        <p
          style={{
            fontFamily: '"Press Start 2P"',
            fontSize: 'clamp(5px, 1.2vw, 7px)',
            color: '#aaaacc',
            lineHeight: 2.2,
            maxWidth: 320,
          }}
        >
          The Gatekeeper's silence has been broken.
          <br /><br />
          This frequency existed before the void.
          <br />
          It belongs to you now.
        </p>

        {/* Download button */}
        <div className="flex flex-col items-center gap-3">
          <button
            className="btn-pixel btn-cyan"
            onClick={handleDownload}
            disabled={downloading || downloaded}
            style={{
              opacity: downloading || downloaded ? 0.7 : 1,
              cursor: downloading || downloaded ? 'default' : 'pointer',
              fontSize: 'clamp(7px, 1.5vw, 9px)',
              padding: '14px 28px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {downloading ? (
              <span>
                ◌ Generating link...
              </span>
            ) : downloaded ? (
              <span style={{ color: '#40ff80' }}>
                ✓ Track downloaded
              </span>
            ) : (
              '⬇ Download Bonus Song'
            )}
          </button>

          {error && (
            <p
              style={{
                fontFamily: '"Press Start 2P"',
                fontSize: '6px',
                color: '#ff4444',
              }}
            >
              {error}
            </p>
          )}

          {downloaded && (
            <p
              style={{
                fontFamily: '"Press Start 2P"',
                fontSize: 'clamp(5px, 1.2vw, 7px)',
                color: '#40c880',
                lineHeight: 2,
                textAlign: 'center',
              }}
            >
              Track unlocked.
              <br />
              Play it loud.
            </p>
          )}
        </div>

        {/* Bottom note */}
        <p
          style={{
            fontFamily: '"Press Start 2P"',
            fontSize: '5px',
            color: '#333355',
            marginTop: 4,
          }}
        >
          SOUND QUEST — HIDDEN TRACK EDITION
        </p>

        {/* Bottom accent line */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'linear-gradient(to right, transparent, #8800ff, #00ffff, #8800ff, transparent)',
          }}
        />
      </div>
    </div>
  );
}
