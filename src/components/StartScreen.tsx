import { useState, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';

// Stars are memoised so they don't re-render on every keystroke
function Stars() {
  const stars = useMemo(() =>
    Array.from({ length: 70 }, (_, i) => ({
      size:  Math.random() > 0.8 ? 2 : 1,
      left:  Math.random() * 100,
      top:   Math.random() * 100,
      opacity: Math.random() * 0.6 + 0.2,
      duration: 1 + Math.random() * 3,
      delay:    Math.random() * 3,
    })), []
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((s, i) => (
        <div
          key={i}
          className="absolute bg-white rounded-full"
          style={{
            width: s.size, height: s.size,
            left: `${s.left}%`, top: `${s.top}%`,
            opacity: s.opacity,
            animation: `pixel-blink ${s.duration}s step-end infinite`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export function StartScreen() {
  const setGamePhase = useGameStore(s => s.setGamePhase);
  const setPlayerName = useGameStore(s => s.setPlayerName);
  const [name, setName] = useState('');

  const handleStart = () => {
    setPlayerName(name.trim() || 'Sound Keeper');
    setGamePhase('world');
  };

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center scanlines"
      style={{ background: 'radial-gradient(ellipse at center, #1a0a2e 0%, #000008 100%)' }}
    >
      <Stars />

      {/* Scrollable content column */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          // Responsive gap: tight on small/landscape, generous on big screens
          gap: 'clamp(8px, 2.5vh, 28px)',
          // Responsive side padding
          padding: 'clamp(12px, 3vh, 32px) clamp(16px, 5vw, 48px)',
          width: '100%',
          maxWidth: 720,
          // Allow scrolling if content taller than viewport (landscape mobile)
          maxHeight: '100dvh',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}
      >
        {/* Pre-title */}
        <p style={{
          fontFamily: '"Press Start 2P"',
          fontSize: 'clamp(8px, 1.2vmin, 13px)',
          color: '#8844cc',
          letterSpacing: '5px',
          textTransform: 'uppercase',
          margin: 0,
        }}>
          A Musical Journey
        </p>

        {/* Main title — scales with vmin so it fits portrait AND landscape */}
        <div className="animate-title-glitch" style={{ textAlign: 'center', lineHeight: 1.2 }}>
          <h1 style={{
            fontFamily: '"Press Start 2P"',
            fontSize: 'clamp(32px, 10vmin, 96px)',
            color: '#ffd700',
            textShadow: '4px 4px #b8860b, -3px -3px #ff0080, 0 0 60px rgba(255,215,0,0.4)',
            lineHeight: 1.25,
            letterSpacing: '2px',
            margin: 0,
          }}>
            SOUND<br />QUEST
          </h1>
        </div>

        {/* Subtitle */}
        <p style={{
          fontFamily: '"Press Start 2P"',
          fontSize: 'clamp(9px, 1.8vmin, 16px)',
          color: '#00ccff',
          textShadow: '0 0 16px #00ccff',
          textAlign: 'center',
          lineHeight: 2,
          margin: 0,
        }}>
          Find the Lost Track
        </p>

        {/* Separator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 480 }}>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #ffd700)' }} />
          <span style={{ fontFamily: '"Press Start 2P"', fontSize: 'clamp(11px, 2vmin, 18px)', color: '#ffd700' }}>♪</span>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, #ffd700)' }} />
        </div>

        {/* Lore — hidden on very short viewports (landscape phone) */}
        <div
          style={{
            fontFamily: '"Press Start 2P"',
            fontSize: 'clamp(7px, 1.2vmin, 12px)',
            color: '#888899',
            lineHeight: 2.4,
            textAlign: 'center',
            maxWidth: 460,
          }}
          // Hide lore when screen height is very small (landscape mobile ≤ 500px)
          className="hide-on-short"
        >
          A hidden song was lost<br />
          beyond the Void Gate.<br />
          <br />
          Defeat The Gatekeeper.<br />
          Claim what was silenced.
        </div>

        {/* Name input */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%', maxWidth: 320 }}>
          <label style={{
            fontFamily: '"Press Start 2P"',
            fontSize: 'clamp(7px, 1vmin, 10px)',
            color: '#8888aa',
            letterSpacing: '2px',
          }}>
            ENTER YOUR NAME
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value.slice(0, 16))}
            onKeyDown={e => { if (e.key === 'Enter') handleStart(); }}
            placeholder="Sound Keeper"
            maxLength={16}
            style={{
              fontFamily: '"Press Start 2P"',
              fontSize: 'clamp(9px, 1.5vmin, 14px)',
              color: '#ffd700',
              background: '#0a0818',
              border: '2px solid #4a3a6a',
              padding: 'clamp(7px, 1.2vh, 12px) clamp(10px, 2vw, 20px)',
              width: '100%',
              textAlign: 'center',
              outline: 'none',
              caretColor: '#ffd700',
              letterSpacing: '1px',
              boxShadow: '0 0 12px rgba(138,68,204,0.3) inset',
              boxSizing: 'border-box',
            }}
          />
          <span style={{ fontFamily: '"Press Start 2P"', fontSize: 'clamp(6px, 0.9vmin, 8px)', color: '#44445a' }}>
            {name.length}/16
          </span>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(4px, 1vh, 10px)', width: '100%' }}>
          <button
            className="btn-pixel btn-gold animate-float"
            onClick={handleStart}
            style={{
              fontSize: 'clamp(9px, 1.8vmin, 16px)',
              padding: 'clamp(12px, 2vh, 20px) clamp(24px, 4vw, 48px)',
            }}
          >
            ▶ BEGIN JOURNEY
          </button>

          <button
            className="btn-pixel"
            onClick={() => setGamePhase('editor')}
            style={{
              fontSize: 'clamp(7px, 1.1vmin, 11px)',
              padding: 'clamp(7px, 1.2vh, 10px) clamp(16px, 3vw, 24px)',
              opacity: 0.65,
            }}
          >
            ◈ MAP EDITOR
          </button>
        </div>

        {/* Controls hint */}
        <p style={{
          fontFamily: '"Press Start 2P"',
          fontSize: 'clamp(6px, 0.9vmin, 9px)',
          color: '#444455',
          lineHeight: 2.2,
          textAlign: 'center',
          margin: 0,
        }}>
          WASD / Arrow Keys to move · Touch controls on mobile
        </p>
      </div>

      {/* Copyright — absolute bottom */}
      <div style={{
        position: 'absolute', bottom: 14,
        fontFamily: '"Press Start 2P"',
        fontSize: 'clamp(6px, 0.8vmin, 9px)',
        color: '#33334a',
        letterSpacing: '2px',
        pointerEvents: 'none',
      }}>
        © SOUND QUEST — A Musical Experience
      </div>
    </div>
  );
}
