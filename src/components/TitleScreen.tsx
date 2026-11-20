import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useGameStore } from '../store/gameStore';
import { FRAGMENT_COUNT, readSave } from '../store/save';
import { getLevelFromXP } from '../game/systems/XPSystem';
import { AudioManager } from '../game/audio/AudioManager';
import { SFX } from '../game/audio/AudioLibrary';
import { BrandLogo } from './BrandLogo';
import { COMING_SOON, WORLD_EDITOR_ENABLED } from '../config';
import { useKeyArt } from './useKeyArt';
import { GameLogo } from './GameLogo';
import { useTr } from '../i18n';

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
  const startJourney = useGameStore(s => s.startJourney);
  const continueJourney = useGameStore(s => s.continueJourney);
  const [save, setSave] = useState(readSave);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const keyArt = useKeyArt();
  const t = useTr();

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
    startJourney(name.trim() || 'Mr Mario');
  }, [name, startJourney]);

  const handleContinue = useCallback(() => {
    playUiClick();
    // The save can vanish meanwhile (cleared storage, another tab): start fresh instead.
    if (!continueJourney()) {
      setSave(null);
      setShowModal(true);
    }
  }, [continueJourney]);

  const openEditor = useCallback(() => {
    playUiClick();
    setGamePhase('editor');
  }, [setGamePhase]);

  // Classic arcade convention: any key takes the main action, not just a click:
  // continue a saved journey, or begin a new one.
  useEffect(() => {
    if (COMING_SOON || showModal) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab' || ['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
      // Keys on a focused button belong to that button (New game, for one).
      if (event.target instanceof HTMLButtonElement && (event.key === 'Enter' || event.key === ' ')) return;
      if (save) handleContinue();
      else openModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showModal, openModal, save, handleContinue]);

  const savedLevel = save ? getLevelFromXP(save.xp) : 1;
  // A typed name is never translated, only the title an unnamed hero gets.
  const savedName = save?.playerName === 'Sound Keeper' ? t('Sound Keeper') : save?.playerName;

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
              <span className="title-screen__soon-badge">{t('Coming soon')}</span>
              <span className="title-screen__soon-text">{t('Sound Quest is in development.')}</span>
            </div>
          ) : (
            <div className="title-screen__cta">
              {save ? (
                <>
                  <div className="title-screen__actions">
                    <button type="button" className="title-screen__start" onClick={handleContinue} aria-describedby="title-save-summary">
                      {t('Continue')}
                      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>
                    </button>
                    <button type="button" className="title-screen__new" onClick={openModal}>{t('New game')}</button>
                  </div>
                  <p id="title-save-summary" className="title-screen__save">
                    {savedName} · {t(`Level ${savedLevel}`)} · {t(`${save.fragmentsFound.length}/${FRAGMENT_COUNT} fragments`)}
                    <span className="hint-desktop"> · {t('or press any key')}</span>
                  </p>
                </>
              ) : (
                <>
                  <button type="button" className="title-screen__start" onClick={openModal}>
                    {t('Start game')}
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>
                  </button>
                  <p className="title-screen__start-hint hint-desktop">{t('or press any key')}</p>
                </>
              )}
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
            aria-describedby={save ? 'name-dialog-hint name-dialog-warning' : 'name-dialog-hint'}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="name-dialog-title" className="name-dialog__title">{t('What should we call you?')}</h2>
            <p id="name-dialog-hint" className="name-dialog__hint">{t('Characters in the world will greet you by this name.')}</p>
            {save && (
              <p id="name-dialog-warning" className="name-dialog__warning">
                {t('A new journey replaces the saved one')} ({savedName}, {t(`level ${savedLevel}`)}).
              </p>
            )}

            <label className="name-dialog__field">
              <span className="name-dialog__label-row">
                {t('Your name')} <span id="name-dialog-count" className="name-dialog__count" aria-hidden="true">{name.length}/16</span>
              </span>
              <input
                className="name-dialog__input"
                type="text"
                autoFocus
                aria-describedby="name-dialog-limit"
                value={name}
                onChange={(event) => setName(event.target.value.slice(0, 16))}
                onKeyDown={(event) => { if (event.key === 'Enter') handleStart(); }}
                placeholder="Mr Mario"
                maxLength={16}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <span id="name-dialog-limit" className="sr-only">{t('Up to 16 characters.')}</span>

            <div className="name-dialog__actions">
              <button type="button" className="btn btn--ghost" onClick={closeModal}>{t('Back')}</button>
              <button type="button" className="btn btn--primary" onClick={handleStart}>
                {t('Start journey')}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </div>

            {WORLD_EDITOR_ENABLED && (
              <button type="button" className="name-dialog__editor" onClick={openEditor}>{t('Open world editor')}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
