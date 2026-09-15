import { useCallback, useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { AudioManager } from '../game/audio/AudioManager';
import { SFX } from '../game/audio/AudioLibrary';

const playUiClick = () => AudioManager.playSfx(SFX.uiClick.key);

export function TitleScreen() {
  const setGamePhase = useGameStore(s => s.setGamePhase);
  const setPlayerName = useGameStore(s => s.setPlayerName);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');

  const openModal = useCallback(() => {
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
    if (showModal) return;
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
    <div className="title-screen">
      {!showModal && (
        <>
          <button className="title-screen__prompt" onClick={openModal} aria-label="Press start">
            <span className="title-screen__prompt-glow" aria-hidden="true" />
            <span className="title-screen__prompt-text">Press Start</span>
            <span className="title-screen__prompt-sub">Tap or press any key</span>
          </button>
          <p className="title-screen__meta">SQ-2026 // First transmission</p>
        </>
      )}

      {showModal && (
        <div className="name-modal-scrim" onClick={closeModal}>
          <div
            className="name-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Enter your callsign"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="name-modal__topline">
              <span>Identity channel</span>
              <span className="name-modal__topline-index">A/01</span>
            </div>

            <h2 className="name-modal__title">Tune your signal.</h2>
            <p className="name-modal__hint">Choose a callsign before you enter the frequency.</p>

            <label className="name-modal__field">
              <span className="name-modal__field-label">
                Callsign <small>{name.length.toString().padStart(2, '0')} / 16</small>
              </span>
              <span className="name-modal__field-control">
                <span className="name-modal__field-prefix">@</span>
                <input
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
              </span>
            </label>

            <button className="name-modal__submit" onClick={handleStart}>
              <span>Enter the frequency</span>
              <span className="name-modal__submit-icon" aria-hidden="true">↗</span>
            </button>

            <button className="name-modal__secondary" onClick={openEditor}>
              <span aria-hidden="true">⌗</span> Open world editor
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
