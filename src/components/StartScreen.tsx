import { useState } from 'react';
import { useGameStore } from '../store/gameStore';

export function StartScreen() {
  const setGamePhase = useGameStore(s => s.setGamePhase);
  const setPlayerName = useGameStore(s => s.setPlayerName);
  const [name, setName] = useState('');

  const handleStart = () => {
    const trimmed = name.trim() || 'Sound Keeper';
    setPlayerName(trimmed);
    setGamePhase('world');
  };

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center scanlines"
      style={{ background: 'radial-gradient(ellipse at center, #1a0a2e 0%, #000008 100%)' }}
    >
      {/* Stars background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 60 }).map((_, i) => (
          <div
            key={i}
            className="absolute bg-white rounded-full"
            style={{
              width: Math.random() > 0.8 ? 2 : 1,
              height: Math.random() > 0.8 ? 2 : 1,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.6 + 0.2,
              animation: `pixel-blink ${1 + Math.random() * 3}s step-end infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      {/* Title container */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-8 w-full" style={{ maxWidth: '700px' }}>

        {/* Pre-title */}
        <p
          style={{
            fontFamily: '"Press Start 2P"',
            fontSize: 'clamp(9px, 1.4vw, 13px)',
            color: '#8844cc',
            letterSpacing: '6px',
            textTransform: 'uppercase',
          }}
        >
          A Musical Journey
        </p>

        {/* Main title */}
        <div className="animate-title-glitch text-center">
          <h1
            style={{
              fontFamily: '"Press Start 2P"',
              fontSize: 'clamp(40px, 9vw, 88px)',
              color: '#ffd700',
              textShadow: '4px 4px #b8860b, -3px -3px #ff0080, 0 0 60px rgba(255,215,0,0.4)',
              lineHeight: 1.25,
              letterSpacing: '2px',
            }}
          >
            SOUND
            <br />
            QUEST
          </h1>
        </div>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: '"Press Start 2P"',
            fontSize: 'clamp(10px, 1.8vw, 16px)',
            color: '#00ccff',
            textShadow: '0 0 16px #00ccff',
            textAlign: 'center',
            lineHeight: 2,
          }}
        >
          Find the Lost Track
        </p>

        {/* Decorative separator */}
        <div className="flex items-center gap-4 w-full max-w-lg">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, #ffd700)' }} />
          <span style={{ fontFamily: '"Press Start 2P"', fontSize: 'clamp(12px, 2vw, 18px)', color: '#ffd700' }}>♪</span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, #ffd700)' }} />
        </div>

        {/* Lore text */}
        <div
          className="text-center"
          style={{
            fontFamily: '"Press Start 2P"',
            fontSize: 'clamp(8px, 1.3vw, 12px)',
            color: '#888899',
            lineHeight: 2.4,
            maxWidth: '480px',
          }}
        >
          A hidden song was lost<br />
          beyond the Void Gate.<br />
          <br />
          Defeat The Gatekeeper.<br />
          Claim what was silenced.
        </div>

        {/* Name input */}
        <div className="flex flex-col items-center gap-2 w-full" style={{ maxWidth: '320px' }}>
          <label
            style={{
              fontFamily: '"Press Start 2P"',
              fontSize: 'clamp(7px, 1.1vw, 10px)',
              color: '#8888aa',
              letterSpacing: '2px',
            }}
          >
            ENTER YOUR NAME
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 16))}
            onKeyDown={(e) => { if (e.key === 'Enter') handleStart(); }}
            placeholder="Sound Keeper"
            maxLength={16}
            style={{
              fontFamily: '"Press Start 2P"',
              fontSize: 'clamp(10px, 1.6vw, 14px)',
              color: '#ffd700',
              background: '#0a0818',
              border: '2px solid #4a3a6a',
              padding: 'clamp(8px, 1.2vw, 12px) clamp(12px, 2vw, 20px)',
              width: '100%',
              textAlign: 'center',
              outline: 'none',
              caretColor: '#ffd700',
              letterSpacing: '1px',
              imageRendering: 'pixelated',
              boxShadow: '0 0 12px rgba(138, 68, 204, 0.3) inset',
            }}
          />
          <span
            style={{
              fontFamily: '"Press Start 2P"',
              fontSize: 'clamp(6px, 0.9vw, 8px)',
              color: '#44445a',
            }}
          >
            {name.length}/16
          </span>
        </div>

        {/* Start button */}
        <button
          className="btn-pixel btn-gold animate-float"
          onClick={handleStart}
          style={{
            fontSize: 'clamp(10px, 1.8vw, 16px)',
            padding: 'clamp(14px, 2vw, 20px) clamp(28px, 4vw, 48px)',
            marginTop: '8px',
          }}
        >
          ▶ BEGIN JOURNEY
        </button>

        {/* Controls hint */}
        <div
          className="text-center"
          style={{
            fontFamily: '"Press Start 2P"',
            fontSize: 'clamp(7px, 1vw, 10px)',
            color: '#444455',
            lineHeight: 2.2,
            marginTop: '4px',
          }}
        >
          WASD / Arrow Keys to move<br />
          Touch controls on mobile
        </div>
      </div>

      {/* Bottom copyright */}
      <div
        className="absolute bottom-5"
        style={{
          fontFamily: '"Press Start 2P"',
          fontSize: 'clamp(6px, 0.9vw, 9px)',
          color: '#33334a',
          letterSpacing: '2px',
        }}
      >
        © SOUND QUEST — A Musical Experience
      </div>
    </div>
  );
}
