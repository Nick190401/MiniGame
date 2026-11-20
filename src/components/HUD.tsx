import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
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

const HP_GAIN_MS = 500;
/** The meter keeps its gain styling until the glow is over (`meter-gain-glow` in index.css). */
const HP_GAIN_GLOW_MS = 900;

interface HpGain {
  id: number;
  fromHp: number;
  /** The fill before and after, in percent of the track: the light crosses the part between. */
  fromShare: number;
  toShare: number;
}

const share = (hp: number, maxHp: number) => (100 * hp) / Math.max(1, maxHp);
const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * The HP row. A rise plays as one move: the number counts up while the fill
 * grows, the regained part takes one pass of light and the bar glows once.
 * A loss, and any change under reduced motion, shows at once as before.
 */
function HpStat({ hp, maxHp }: { hp: number; maxHp: number }) {
  const t = useTr();
  const [seen, setSeen] = useState({ hp, maxHp });
  const [gain, setGain] = useState<HpGain | null>(null);
  const [counted, setCounted] = useState(hp);

  // Compared while rendering, not in an effect: the gain has to reach the DOM in
  // the same commit as the new width, or the fill has already started its plain move.
  if (seen.hp !== hp || seen.maxHp !== maxHp) {
    setSeen({ hp, maxHp });
    if (hp > seen.hp && !prefersReducedMotion()) {
      const fromHp = gain ? counted : seen.hp;
      setCounted(fromHp);
      setGain({ id: (gain?.id ?? 0) + 1, fromHp, fromShare: share(seen.hp, seen.maxHp), toShare: share(hp, maxHp) });
    } else {
      setGain(null);
    }
  }

  useEffect(() => {
    if (!gain) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now: number) {
      const elapsed = Math.max(0, now - start);
      const progress = Math.min(1, elapsed / HP_GAIN_MS);
      setCounted(Math.round(gain.fromHp + (hp - gain.fromHp) * (1 - (1 - progress) ** 3)));
      if (elapsed < HP_GAIN_GLOW_MS) frame = requestAnimationFrame(tick);
      else setGain(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [gain, hp]);

  // The colour band follows the number on show, so the bar never turns green while it is still short.
  const shownHp = gain ? counted : hp;

  return (
    <div className="hud__stat">
      <span className="hud__stat-label">{t('HP')}</span>
      <div
        className={`meter meter--hp${gain ? ' is-gaining' : ''}`}
        data-level={hpLevel(shownHp, maxHp)}
        style={gain ? ({ '--gain-from': gain.fromShare, '--gain-to': gain.toShare } as CSSProperties) : undefined}
      >
        <i className="meter__fill" style={{ width: percent(hp, maxHp) }}>
          {gain && <i key={gain.id} className="meter__gain" aria-hidden="true" />}
        </i>
      </div>
      <span className="hud__stat-value">{shownHp}/{maxHp}</span>
    </div>
  );
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
          <HpStat hp={hp} maxHp={maxHp} />
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
