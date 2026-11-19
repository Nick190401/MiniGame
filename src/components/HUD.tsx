import { useEffect, useRef, type RefObject } from 'react';
import { useGameStore } from '../store/gameStore';
import { getXPProgress, getXPForNextLevel, getXPForCurrentLevel, MAX_LEVEL } from '../game/systems/XPSystem';
import { useCanvasBounds } from './useCanvasBounds';
import { PLAYER_BUST_URL, hpLevel, percent } from './vitals';

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
  const name = playerName || 'Sound Keeper';

  return (
    <div className="ui-layer hud-layer" style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}>
      <section className="hud" ref={hudRef} aria-label="Player status">
        <span className="avatar" aria-hidden="true"><img src={PLAYER_BUST_URL} alt="" draggable={false} /></span>
        <div className="hud__body">
          <div className="hud__head">
            <p className="hud__name">{name}</p>
            <p className="hud__level">Lv {level}</p>
          </div>
          <div className="hud__stat">
            <span className="hud__stat-label">HP</span>
            <div className="meter meter--hp" data-level={hpLevel(hp, maxHp)}>
              <i className="meter__fill" style={{ width: percent(hp, maxHp) }} />
            </div>
            <span className="hud__stat-value">{hp}/{maxHp}</span>
          </div>
          <div className="hud__stat">
            <span className="hud__stat-label">XP</span>
            <div className="meter meter--xp">
              <i className="meter__fill" style={{ width: `${xpProgress}%` }} />
            </div>
            <span className="hud__stat-value">{atMaxLevel ? 'Max' : `${xpCurrent}/${xpNeeded}`}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
