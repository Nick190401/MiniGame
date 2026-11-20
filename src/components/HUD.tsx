import { useEffect, useRef, type RefObject } from 'react';
import { EventBus, EVENTS } from '../game/EventBus';
import { FRAGMENT_COUNT, useGameStore } from '../store/gameStore';
import { getXPProgress, getXPForNextLevel, getXPForCurrentLevel, MAX_LEVEL } from '../game/systems/XPSystem';
import { useCanvasBounds } from './useCanvasBounds';
import { PLAYER_BUST_URL, hpLevel, percent } from './vitals';
import { useSettingsTip } from './useSettingsTip';
import { useTr } from '../i18n';

interface HUDProps {
  canvasParentRef: RefObject<HTMLDivElement | null>;
}

export function HUD({ canvasParentRef }: HUDProps) {
  const bounds = useCanvasBounds(canvasParentRef);
  const playerName = useGameStore(s => s.playerName);
  const hp = useGameStore(s => s.hp);
  const maxHp = useGameStore(s => s.maxHp);
  const xp = useGameStore(s => s.xp);
  const level = useGameStore(s => s.level);
  const fragments = useGameStore(s => s.fragmentsFound.length);
  const t = useTr();
  // The HUD is up exactly while the world is free to explore.
  useSettingsTip();

  const hudRef = useRef<HTMLDivElement>(null);

  // Publish where the card ends, so the zone banner and notices can stack
  // under it on a phone instead of colliding with it.
  useEffect(() => {
    const el = hudRef.current;
    if (!el) return;
    const publish = () => {
      document.documentElement.style.setProperty('--hud-h', `${Math.round(el.offsetTop + el.offsetHeight)}px`);
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--hud-h');
    };
  }, [bounds !== null]);

  if (!bounds) return null;

  const atMaxLevel = level >= MAX_LEVEL;
  const xpProgress = atMaxLevel ? 100 : getXPProgress(xp, level) * 100;
  const xpCurrent = xp - getXPForCurrentLevel(level);
  const xpNeeded = getXPForNextLevel(level) - getXPForCurrentLevel(level);
  const name = playerName || 'Mr Mario';

  return (
    <div className="ui-layer hud-layer" style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}>
      <section className="hud" ref={hudRef} aria-label={t('Player status')}>
        <span className="avatar" aria-hidden="true"><img src={PLAYER_BUST_URL} alt="" draggable={false} /></span>
        <div className="hud__body">
          <div className="hud__head">
            <p className="hud__name">{t(name)}</p>
            <p className="hud__level">{t(`Lv ${level}`)}</p>
            <button
              type="button"
              className="hud__menu"
              aria-label={t('Pause menu')}
              aria-haspopup="dialog"
              title={t('Pause (Esc)')}
              onPointerDown={event => {
                // Touch opens on press, like the A button: a second finger gets no click
                // while the thumb holds the D-pad. Capture keeps the following click on this button.
                if (event.pointerType !== 'touch') return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                EventBus.emit(EVENTS.PAUSE_MENU_OPEN);
              }}
              onClick={event => {
                // Space and Enter advance dialogue: a focused button would reopen the menu.
                event.currentTarget.blur();
                EventBus.emit(EVENTS.PAUSE_MENU_OPEN);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                <path d="M9 6.5v11M15 6.5v11" />
              </svg>
            </button>
          </div>
          <div className="hud__stat">
            <span className="hud__stat-label">{t('HP')}</span>
            <div className="meter meter--hp" data-level={hpLevel(hp, maxHp)}>
              <i className="meter__fill" style={{ width: percent(hp, maxHp) }} />
            </div>
            <span className="hud__stat-value">{hp}/{maxHp}</span>
          </div>
          <div className="hud__stat">
            <span className="hud__stat-label">{t('XP')}</span>
            <div className="meter meter--xp">
              <i className="meter__fill" style={{ width: `${xpProgress}%` }} />
            </div>
            <span className="hud__stat-value">{atMaxLevel ? t('Max') : `${xpCurrent}/${xpNeeded}`}</span>
          </div>
          <div className="hud__quest" aria-label={t(`Sound fragments: ${fragments} of ${FRAGMENT_COUNT}`)}>
            <span className="hud__stat-label">{t('Fragments')}</span>
            <span className="hud__pips" aria-hidden="true">
              {Array.from({ length: FRAGMENT_COUNT }, (_, index) => <i key={index} className={index < fragments ? 'is-found' : undefined} />)}
            </span>
            <span className="hud__stat-value">{fragments}/{FRAGMENT_COUNT}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
