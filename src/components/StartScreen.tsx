import { useMemo, useState } from 'react';
import { useGameStore } from '../store/gameStore';

function SignalField() {
  const particles = useMemo(
    () => Array.from({ length: 24 }, (_, index) => ({
      id: index,
      x: (index * 37 + 11) % 100,
      y: (index * 53 + 7) % 100,
      delay: (index % 7) * 0.42,
      duration: 5 + (index % 5),
      size: index % 6 === 0 ? 3 : 1,
    })),
    [],
  );

  return (
    <div className="signal-field" aria-hidden="true">
      <div className="signal-field__grid" />
      <div className="signal-field__glow signal-field__glow--lime" />
      <div className="signal-field__glow signal-field__glow--orange" />
      <div className="signal-field__sweep" />
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="signal-particle"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

function Waveform() {
  return (
    <svg className="waveform" viewBox="0 0 520 84" role="img" aria-label="Animated audio waveform">
      <path className="waveform__ghost" d="M2 42h52l12-18 13 36 16-48 18 61 14-31h41l13-13 14 26 16-40 16 54 14-27h42l10-18 13 37 18-49 18 62 14-32h38l16-23 13 44 14-30 14 10h35" />
      <path className="waveform__line" pathLength="1" d="M2 42h52l12-18 13 36 16-48 18 61 14-31h41l13-13 14 26 16-40 16 54 14-27h42l10-18 13 37 18-49 18 62 14-32h38l16-23 13 44 14-30 14 10h35" />
    </svg>
  );
}

function RecordGlyph() {
  return (
    <div className="signal-disc" aria-hidden="true">
      <span className="signal-disc__orbit signal-disc__orbit--one" />
      <span className="signal-disc__orbit signal-disc__orbit--two" />
      <span className="signal-disc__label">SQ</span>
      <span className="signal-disc__needle" />
      <span className="signal-disc__readout">96.4</span>
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
    <div className="start-screen">
      <SignalField />

      <header className="launch-header">
        <a className="brand-lockup" href="#main-menu" aria-label="Sound Quest home">
          <span className="brand-lockup__mark">SQ</span>
          <span className="brand-lockup__copy">
            <strong>Sound Quest</strong>
            <small>Sonic archive // 01</small>
          </span>
        </a>
        <div className="signal-status">
          <span className="signal-status__dot" />
          Signal acquired
          <span className="signal-status__code">48.06 N / 11.58 E</span>
        </div>
      </header>

      <main id="main-menu" className="launch-layout">
        <section className="launch-hero">
          <p className="launch-eyebrow"><span>01</span> An interactive sound odyssey</p>
          <h1 className="launch-title" aria-label="Sound Quest">
            <span>Sound</span>
            <span className="launch-title__accent">Quest</span>
          </h1>
          <p className="launch-intro">
            A hidden frequency vanished beyond the Void Gate.
            Trace the distortion, face the silence, and bring the lost track home.
          </p>
          <Waveform />
          <div className="launch-meta" aria-label="Game information">
            <div><span>Format</span><strong>Audio RPG</strong></div>
            <div><span>Journey</span><strong>Single player</strong></div>
            <div><span>Protocol</span><strong>WASD / Touch</strong></div>
          </div>
        </section>

        <aside className="launch-console" aria-label="Player setup">
          <div className="console-topline">
            <span>Player setup</span>
            <span className="console-topline__index">A/01</span>
          </div>

          <RecordGlyph />

          <div className="console-copy">
            <p>Identity channel</p>
            <h2>Tune your signal.</h2>
          </div>

          <label className="callsign-field">
            <span className="callsign-field__label">
              Callsign <small>{name.length.toString().padStart(2, '0')} / 16</small>
            </span>
            <span className="callsign-field__control">
              <span className="callsign-field__prefix">@</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value.slice(0, 16))}
                onKeyDown={(event) => { if (event.key === 'Enter') handleStart(); }}
                placeholder="Sound Keeper"
                maxLength={16}
                autoComplete="off"
                spellCheck={false}
              />
            </span>
          </label>

          <button className="launch-primary" onClick={handleStart}>
            <span>Enter the frequency</span>
            <span className="launch-primary__icon" aria-hidden="true">↗</span>
          </button>

          <button className="launch-secondary" onClick={() => setGamePhase('editor')}>
            <span className="launch-secondary__icon" aria-hidden="true">⌗</span>
            Open world editor
            <span className="launch-secondary__key">E</span>
          </button>
        </aside>
      </main>

      <footer className="launch-footer">
        <p>Headphones recommended</p>
        <div className="launch-footer__ticker" aria-hidden="true">
          <span>Find the signal</span><i />
          <span>Break the silence</span><i />
          <span>Recover the track</span>
        </div>
        <p className="launch-footer__edition">SQ-2026 // First transmission</p>
      </footer>
    </div>
  );
}
