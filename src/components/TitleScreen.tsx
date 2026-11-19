import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useGameStore } from '../store/gameStore';
import { AudioManager } from '../game/audio/AudioManager';
import { SFX } from '../game/audio/AudioLibrary';
import { BrandLogo } from './BrandLogo';
import { COMING_SOON, WORLD_EDITOR_ENABLED } from '../config';
import { useKeyArt } from './useKeyArt';
import { GameLogo } from './GameLogo';

const playUiClick = () => AudioManager.playSfx(SFX.uiClick.key);

/** Embers drifting up from the Gatekeeper's fire; fixed values keep renders stable. */
const EMBERS = Array.from({ length: 22 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return {
    '--x': `${(r(1) * 100).toFixed(1)}%`,
    '--s': `${(2 + r(2) * 3.5).toFixed(1)}px`,
    '--t': `${(7 + r(3) * 8).toFixed(1)}s`,
    '--d': `${(-r(4) * 15).toFixed(1)}s`,
    '--drift': `${((r(5) - 0.5) * 120).toFixed(0)}px`,
  } as CSSProperties;
});

export function TitleScreen() {
  const setGamePhase = useGameStore(s => s.setGamePhase);
  const setPlayerName = useGameStore(s => s.setPlayerName);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const keyArt = useKeyArt();

  const openModal = useCallback(() => {
    if (COMING_SOON) return;
    playUiClick();
    setShowModal(true);
  }, []);
  const closeModal = useCallback(() => {
    playUiClick();
    setShowModal(false);
  }, []);

  const handleStart = useCallback(() => {
    playUiClick();
    setPlayerName(name.trim() || 'Sound Keeper');
    setGamePhase('world');
  }, [name, setPlayerName, setGamePhase]);

  const openEditor = useCallback(() => {
    playUiClick();
    setGamePhase('editor');
  }, [setGamePhase]);

  // Classic arcade convention: any key opens the modal, not just a click.
  useEffect(() => {
    if (COMING_SOON || showModal) return;
    const onKeyDown = () => openModal();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showModal, openModal]);

  useEffect(() => {
    if (!showModal) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showModal, closeModal]);

  return (
    <div className={`title-screen${keyArt ? ' has-art' : ''}`}>
      <div className="title-screen__art" style={keyArt ? { backgroundImage: `url(${keyArt})` } : undefined} aria-hidden="true" />
      <div className="title-screen__embers" aria-hidden="true">
        {EMBERS.map((style, index) => <i key={index} style={style} />)}
      </div>
      {(COMING_SOON || !showModal) && (
        <>
          <div className="brand-stamp"><BrandLogo /></div>
          <GameLogo />
          {COMING_SOON ? (
            <div className="title-screen__soon">
              <span className="title-screen__soon-badge">Coming soon</span>
              <span className="title-screen__soon-text">Sound Quest is in development.</span>
            </div>
          ) : (
            <div className="title-screen__cta">
              <button type="button" className="title-screen__start" onClick={openModal}>
                Start game
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>
              </button>
              <p className="title-screen__start-hint hint-desktop">or press any key</p>
            </div>
          )}
        </>
      )}

      {!COMING_SOON && showModal && (
        <div className="name-dialog-scrim" onClick={closeModal}>
          <div
            className="name-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="name-dialog-title"
            aria-describedby="name-dialog-hint"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="name-dialog-title" className="name-dialog__title">What should we call you?</h2>
            <p id="name-dialog-hint" className="name-dialog__hint">Characters in the world will greet you by this name.</p>

            <label className="name-dialog__field">
              <span className="name-dialog__label-row">
                Your name <span className="name-dialog__count">{name.length}/16</span>
              </span>
              <input
                className="name-dialog__input"
                type="text"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value.slice(0, 16))}
                onKeyDown={(event) => { if (event.key === 'Enter') handleStart(); }}
                placeholder="Sound Keeper"
                maxLength={16}
                autoComplete="off"
                spellCheck={false}
              />
            </label>

            <div className="name-dialog__actions">
              <button type="button" className="btn btn--ghost" onClick={closeModal}>Back</button>
              <button type="button" className="btn btn--primary" onClick={handleStart}>
                Start journey
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </div>

            {WORLD_EDITOR_ENABLED && (
              <button type="button" className="name-dialog__editor" onClick={openEditor}>Open world editor</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
