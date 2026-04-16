import { useGameStore } from '../store/gameStore';

export function StartScreen() {
  const setGamePhase = useGameStore(s => s.setGamePhase);

  const handleStart = () => {
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
      <div className="relative z-10 flex flex-col items-center gap-6 px-8">

        {/* Pre-title */}
        <p
          className="text-xs tracking-widest uppercase"
          style={{
            fontFamily: '"Press Start 2P"',
            fontSize: '8px',
            color: '#8844cc',
            letterSpacing: '4px',
          }}
        >
          A Musical Journey
        </p>

        {/* Main title */}
        <div className="animate-title-glitch text-center">
          <h1
            style={{
              fontFamily: '"Press Start 2P"',
              fontSize: 'clamp(24px, 6vw, 48px)',
              color: '#ffd700',
              textShadow: '3px 3px #b8860b, -2px -2px #ff0080, 0 0 40px rgba(255,215,0,0.3)',
              lineHeight: 1.3,
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
            fontSize: 'clamp(6px, 1.5vw, 9px)',
            color: '#00ccff',
            textShadow: '0 0 10px #00ccff',
            textAlign: 'center',
            lineHeight: 2,
          }}
        >
          Find the Lost Track
        </p>

        {/* Decorative separator */}
        <div className="flex items-center gap-3 w-full max-w-xs">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, #ffd700)' }} />
          <span style={{ fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffd700' }}>♪</span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, #ffd700)' }} />
        </div>

        {/* Lore text */}
        <div
          className="text-center max-w-sm"
          style={{
            fontFamily: '"Press Start 2P"',
            fontSize: 'clamp(5px, 1.2vw, 7px)',
            color: '#888899',
            lineHeight: 2.2,
          }}
        >
          A hidden song was lost<br />
          beyond the Void Gate.<br />
          <br />
          Defeat The Gatekeeper.<br />
          Claim what was silenced.
        </div>

        {/* Start button */}
        <button
          className="btn-pixel btn-gold animate-float mt-4"
          onClick={handleStart}
          style={{ fontSize: 'clamp(7px, 1.5vw, 10px)' }}
        >
          ▶ BEGIN JOURNEY
        </button>

        {/* Controls hint */}
        <div
          className="text-center mt-2"
          style={{
            fontFamily: '"Press Start 2P"',
            fontSize: '6px',
            color: '#444455',
            lineHeight: 2,
          }}
        >
          WASD / Arrow Keys to move<br />
          Touch controls on mobile
        </div>
      </div>

      {/* Bottom copyright */}
      <div
        className="absolute bottom-4"
        style={{
          fontFamily: '"Press Start 2P"',
          fontSize: '5px',
          color: '#333344',
        }}
      >
        © SOUND QUEST — A Musical Experience
      </div>
    </div>
  );
}
