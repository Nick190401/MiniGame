import { useGameStore } from '../store/gameStore';
import { getXPProgress, getXPForNextLevel, getXPForCurrentLevel, MAX_LEVEL } from '../game/systems/XPSystem';

function HeadphonesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H5a1 1 0 0 1-1-1v-5Zm16 0h-3v6h2a1 1 0 0 0 1-1v-5Z" />
    </svg>
  );
}

export function HUD() {
  const playerName = useGameStore(s => s.playerName);
  const hp = useGameStore(s => s.hp);
  const maxHp = useGameStore(s => s.maxHp);
  const xp = useGameStore(s => s.xp);
  const level = useGameStore(s => s.level);
  const unlockedAttacks = useGameStore(s => s.unlockedAttacks);

  const hpProgress = Math.max(0, (hp / maxHp) * 100);
  const xpProgress = getXPProgress(xp, level) * 100;
  const xpCurrent = xp - getXPForCurrentLevel(level);
  const xpNeeded = getXPForNextLevel(level) - getXPForCurrentLevel(level);
  const atMaxLevel = level >= MAX_LEVEL;

  return (
    <div className="game-hud">
      <div className="game-hud__identity">
        <span className="game-hud__avatar"><HeadphonesIcon /></span>
        <span className="game-hud__player">
          <small>Active signal</small>
          <strong>{playerName || 'Sound Keeper'}</strong>
        </span>
        <span className="game-hud__level">
          <small>Level</small>
          <strong>{level.toString().padStart(2, '0')}</strong>
        </span>
      </div>

      <div className="game-hud__stats">
        <div className="hud-stat hud-stat--hp">
          <div className="hud-stat__label"><span>Vital signal</span><strong>{hp} / {maxHp}</strong></div>
          <div className="hud-stat__track"><i style={{ width: `${hpProgress}%` }} /></div>
        </div>
        <div className="hud-stat hud-stat--xp">
          <div className="hud-stat__label">
            <span>{atMaxLevel ? 'Frequency mastered' : 'Resonance'}</span>
            <strong>{atMaxLevel ? 'MAX' : `${xpCurrent} / ${xpNeeded}`}</strong>
          </div>
          <div className="hud-stat__track"><i style={{ width: `${atMaxLevel ? 100 : xpProgress}%` }} /></div>
        </div>
      </div>

      <div className="game-hud__attacks" aria-label={`${unlockedAttacks.length} attacks unlocked`}>
        <span>{unlockedAttacks.length.toString().padStart(2, '0')}</span>
        <small>Moves</small>
        <div className="game-hud__attack-dots">
          {unlockedAttacks.slice(0, 4).map((attack) => (
            <i key={attack.id} title={attack.name} style={{ '--attack-color': `#${attack.color.toString(16).padStart(6, '0')}` } as React.CSSProperties} />
          ))}
        </div>
      </div>
    </div>
  );
}
