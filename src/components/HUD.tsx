import { useGameStore } from '../store/gameStore';
import { getXPProgress, getXPForNextLevel, getXPForCurrentLevel, MAX_LEVEL } from '../game/systems/XPSystem';

export function HUD() {
  const { hp, maxHp, xp, level, unlockedAttacks } = useGameStore(s => ({
    hp: s.hp,
    maxHp: s.maxHp,
    xp: s.xp,
    level: s.level,
    unlockedAttacks: s.unlockedAttacks,
  }));

  const hpFrac = Math.max(0, hp / maxHp);
  const xpFrac = getXPProgress(xp, level);
  const xpCurrent = xp - getXPForCurrentLevel(level);
  const xpNeeded = getXPForNextLevel(level) - getXPForCurrentLevel(level);
  const atMaxLevel = level >= MAX_LEVEL;

  const hpColor = hpFrac > 0.5 ? '#40c040' : hpFrac > 0.25 ? '#e0a030' : '#e03030';

  return (
    <div
      className="absolute top-2 left-2 flex flex-col gap-1 pointer-events-none"
      style={{ zIndex: 20 }}
    >
      {/* Level badge */}
      <div
        className="flex items-center gap-2"
        style={{
          fontFamily: '"Press Start 2P"',
          fontSize: '8px',
          color: '#ffd700',
        }}
      >
        <div
          style={{
            background: '#1a0a2e',
            border: '2px solid #ffd700',
            padding: '3px 8px',
            boxShadow: '0 0 8px rgba(255,215,0,0.4)',
          }}
        >
          LV {level}
        </div>
        {atMaxLevel && (
          <span style={{ fontSize: '6px', color: '#ff8800' }}>MAX</span>
        )}
      </div>

      {/* HP bar */}
      <div className="flex items-center gap-1">
        <span
          style={{
            fontFamily: '"Press Start 2P"',
            fontSize: '6px',
            color: '#e03030',
            minWidth: 16,
          }}
        >
          HP
        </span>
        <div className="relative" style={{ width: 80, height: 8, background: '#220000', border: '1px solid #440000' }}>
          <div
            style={{
              width: `${hpFrac * 100}%`,
              height: '100%',
              background: hpColor,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <span
          style={{
            fontFamily: '"Press Start 2P"',
            fontSize: '5px',
            color: '#aaaaaa',
          }}
        >
          {hp}/{maxHp}
        </span>
      </div>

      {/* XP bar */}
      {!atMaxLevel && (
        <div className="flex items-center gap-1">
          <span
            style={{
              fontFamily: '"Press Start 2P"',
              fontSize: '6px',
              color: '#4080ff',
              minWidth: 16,
            }}
          >
            XP
          </span>
          <div className="relative" style={{ width: 80, height: 8, background: '#001122', border: '1px solid #002244' }}>
            <div
              style={{
                width: `${xpFrac * 100}%`,
                height: '100%',
                background: '#4080ff',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <span
            style={{
              fontFamily: '"Press Start 2P"',
              fontSize: '5px',
              color: '#aaaaaa',
            }}
          >
            {xpCurrent}/{xpNeeded}
          </span>
        </div>
      )}

      {/* Attacks unlocked indicator */}
      <div className="flex gap-1 mt-1">
        {unlockedAttacks.slice(0, 4).map((atk) => (
          <div
            key={atk.id}
            title={atk.name}
            style={{
              width: 6,
              height: 6,
              background: '#' + atk.color.toString(16).padStart(6, '0'),
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 1,
            }}
          />
        ))}
      </div>
    </div>
  );
}
