import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type Phaser from 'phaser';
import type { WorldScene } from '../game/scenes/WorldScene';
import { AudioManager } from '../game/audio/AudioManager';
import { SFX } from '../game/audio/AudioLibrary';
import { EventBus, EVENTS } from '../game/EventBus';
import { useGameStore } from '../store/gameStore';
import { useLanguageStore, useTr, type Language } from '../i18n';
import { useCanvasBounds } from './useCanvasBounds';
import { SETTINGS_TIP_KEY } from './useSettingsTip';
import './PauseMenu.css';

interface PauseMenuProps {
  gameRef: RefObject<Phaser.Game | null>;
  canvasParentRef: RefObject<HTMLDivElement | null>;
  /** The world is on screen and free to pause: no battle, death screen or cutscene. */
  available: boolean;
}

/** Shortest gap between two preview clicks while the effects slider moves. */
const PREVIEW_GAP_MS = 160;

const percentOf = (value: number) => Math.round(value * 100);
const playUiClick = () => AudioManager.playSfx(SFX.uiClick.key);

/** Each language is offered in its own words, so it can be found from the other. */
const LANGUAGES: readonly { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'de', label: 'Deutsch' },
];

/**
 * The pause menu: Esc or the HUD button freezes the world and opens the sound
 * and language settings. M mutes and unmutes anywhere in the game, battles included.
 */
export function PauseMenu({ gameRef, canvasParentRef, available }: PauseMenuProps) {
  const bounds = useCanvasBounds(canvasParentRef);
  const t = useTr();
  const language = useLanguageStore(state => state.language);
  const setLanguage = useLanguageStore(state => state.setLanguage);
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(() => AudioManager.getSettings());
  const dialogRef = useRef<HTMLDivElement>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef(false);
  const availableRef = useRef(available);
  // Whether the world is paused by this menu, so it only ever resumes its own pause.
  const holdsPauseRef = useRef(false);
  const rewardOpenRef = useRef(false);
  const lastPreviewRef = useRef(0);
  const pressOnBackdropRef = useRef(false);

  availableRef.current = available;
  openRef.current = open;

  const worldScene = useCallback(
    () => gameRef.current?.scene.getScene('WorldScene') as WorldScene | undefined,
    [gameRef],
  );

  const openMenu = useCallback(() => {
    if (openRef.current || !availableRef.current || rewardOpenRef.current) return;
    if (!worldScene()?.pauseForMenu()) return;
    holdsPauseRef.current = true;
    openRef.current = true;
    pressOnBackdropRef.current = false;
    setSettings(AudioManager.getSettings());
    setOpen(true);
    playUiClick();
    // Found the settings on their own: the tip pointing at them has nothing left to say.
    useGameStore.getState().markSeen(SETTINGS_TIP_KEY);
  }, [worldScene]);

  const closeMenu = useCallback(() => {
    if (!openRef.current) return;
    openRef.current = false;
    setOpen(false);
    if (holdsPauseRef.current) {
      holdsPauseRef.current = false;
      worldScene()?.resumeFromMenu();
    }
  }, [worldScene]);

  // Something else took over the screen: step aside without touching its pause.
  useEffect(() => {
    if (available || !openRef.current) return;
    holdsPauseRef.current = false;
    openRef.current = false;
    setOpen(false);
  }, [available]);

  useEffect(() => {
    const onRewardState = (visible: boolean) => { rewardOpenRef.current = visible; };
    EventBus.on(EVENTS.PAUSE_MENU_OPEN, openMenu);
    EventBus.on(EVENTS.REWARD_UI_STATE, onRewardState);
    return () => {
      EventBus.off(EVENTS.PAUSE_MENU_OPEN, openMenu);
      EventBus.off(EVENTS.REWARD_UI_STATE, onRewardState);
    };
  }, [openMenu]);

  // Esc and M, caught before the game's own key handling sees them.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if ((event.target as HTMLElement | null)?.closest?.('input[type="text"], textarea, [contenteditable="true"]')) return;
      // The reward screen has its own player and its own Esc.
      if (rewardOpenRef.current) return;
      if (event.key === 'Escape') {
        if (openRef.current) {
          event.preventDefault();
          playUiClick();
          closeMenu();
        } else {
          openMenu();
        }
        return;
      }
      if (event.key === 'm' || event.key === 'M') {
        const muted = AudioManager.toggleMute();
        setSettings(AudioManager.getSettings());
        EventBus.emit(EVENTS.UI_NOTICE, {
          eyebrow: 'Sound',
          title: muted ? 'Sound off' : 'Sound on',
          detail: muted ? 'Press M to turn it back on.' : undefined,
          tone: 'info',
          duration: 1400,
        });
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [openMenu, closeMenu]);

  // Focus stays in the menu, and keys pressed there never reach the paused game.
  // On resume focus goes back to the game itself, not to a button: Space and
  // Enter advance dialogue, and a focused HUD button would answer them too.
  useEffect(() => {
    if (!open) return;
    resumeRef.current?.focus({ preventScroll: true });
    const dialog = dialogRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? []);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    dialog?.addEventListener('keydown', onKeyDown);
    return () => {
      dialog?.removeEventListener('keydown', onKeyDown);
      if (dialog?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    };
  }, [open]);

  const setVolume = (kind: 'music' | 'sfx', percent: number) => {
    const value = percent / 100;
    // Moving a slider while muted means the player wants to hear it.
    if (AudioManager.getSettings().muted) AudioManager.setMuted(false);
    if (kind === 'music') {
      AudioManager.setMusicVolume(value);
    } else {
      AudioManager.setSfxVolume(value);
      const now = performance.now();
      if (now - lastPreviewRef.current >= PREVIEW_GAP_MS) {
        lastPreviewRef.current = now;
        playUiClick();
      }
    }
    setSettings(AudioManager.getSettings());
  };

  if (!open || !bounds) return null;
  const music = percentOf(settings.musicVolume);
  const effects = percentOf(settings.sfxVolume);

  return (
    <div
      className="ui-layer pause-layer"
      style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}
      onPointerDown={event => { pressOnBackdropRef.current = event.target === event.currentTarget; }}
      onClick={event => {
        // Only a press that began on the backdrop closes the menu: not the click a
        // touch browser sends after the tap that opened it, nor a slider drag ending here.
        if (event.target !== event.currentTarget || !pressOnBackdropRef.current) return;
        pressOnBackdropRef.current = false;
        playUiClick();
        closeMenu();
      }}
    >
      <div
        ref={dialogRef}
        className="pause-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-menu-title"
        aria-describedby="pause-menu-state"
      >
        <header className="pause-menu__head">
          <p id="pause-menu-state" className="pause-menu__eyebrow">{t('Game paused')}</p>
          <h2 id="pause-menu-title" className="pause-menu__title">{t('Settings')}</h2>
        </header>

        <div className="pause-menu__controls">
          <label className="pause-menu__slider">
            <span>{t('Music')}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={music}
              aria-label={t('Music volume')}
              aria-valuetext={`${music}%`}
              onChange={event => setVolume('music', Number(event.target.value))}
            />
            <output aria-hidden="true">{music}%</output>
          </label>
          <label className="pause-menu__slider">
            <span>{t('Effects')}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={effects}
              aria-label={t('Sound effects volume')}
              aria-valuetext={`${effects}%`}
              onChange={event => setVolume('sfx', Number(event.target.value))}
            />
            <output aria-hidden="true">{effects}%</output>
          </label>
          <label className="pause-menu__switch">
            <span className="pause-menu__switch-copy">
              {t('Mute all sound')}
              <small className="hint-desktop">{t('Shortcut: M, also in battle')}</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={settings.muted}
              onChange={event => {
                AudioManager.setMuted(event.target.checked);
                setSettings(AudioManager.getSettings());
              }}
            />
          </label>
          <div className="pause-menu__setting">
            <span id="pause-menu-language">{t('Language')}</span>
            <div className="pause-menu__choices" role="radiogroup" aria-labelledby="pause-menu-language">
              {LANGUAGES.map(option => (
                <label key={option.id} className="pause-menu__choice" lang={option.id}>
                  <input
                    type="radio"
                    name="pause-menu-language"
                    value={option.id}
                    checked={language === option.id}
                    onChange={() => {
                      setLanguage(option.id);
                      playUiClick();
                    }}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <button
          ref={resumeRef}
          type="button"
          className="btn btn--primary pause-menu__resume"
          onClick={() => {
            playUiClick();
            closeMenu();
          }}
        >
          {t('Resume')}
          <kbd className="keycap hint-desktop" aria-hidden="true">Esc</kbd>
        </button>
      </div>
    </div>
  );
}
