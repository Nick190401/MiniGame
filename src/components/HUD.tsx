import { useGameStore } from '../store/gameStore';
import { getXPProgress, getXPForNextLevel, getXPForCurrentLevel, MAX_LEVEL } from '../game/systems/XPSystem';

export function HUD() {
  const playerName     = useGameStore(s => s.playerName);
  const hp             = useGameStore(s => s.hp);
  const maxHp          = useGameStore(s => s.maxHp);
  const xp             = useGameStore(s => s.xp);
  const level          = useGameStore(s => s.level);
  const unlockedAttacks = useGameStore(s => s.unlockedAttacks);

  const hpFrac = Math.max(0, hp / maxHp);
  const xpFrac = getXPProgress(xp, level);
  const xpCurrent = xp - getXPForCurrentLevel(level);
  const xpNeeded = getXPForNextLevel(level) - getXPForCurrentLevel(level);
  const atMaxLevel = level >= MAX_LEVEL;

  const hpColor = hpFrac > 0.5 ? '#40c040' : hpFrac > 0.25 ? '#e0a030' : '#e03030';

  return (
    <div
      className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none"
      style={{
        zIndex: 20,
        background: 'rgba(10, 4, 24, 0.85)',
        border: '2px solid #3a2a5a',
        borderRadius: '4px',
        padding: '8px 12px 8px 10px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
        minWidth: 180,
      }}
    >
      {/* Top row: Level badge + name */}
      <div
        className="flex items-center gap-3"
        style={{
          fontFamily: '"Press Start 2P"',
          marginBottom: 2,
        }}
      >
        <div
          style={{
            background: '#1a0a2e',
            border: '2px solid #ffd700',
            padding: '3px 10px',
            boxShadow: '0 0 10px rgba(255,215,0,0.35)',
            fontSize: '10px',
            color: '#ffd700',
          }}
        >
          LV {level}
        </div>
        <span style={{ fontSize: '9px', color: '#e0dce8', letterSpacing: '0.5px' }}>
          {playerName || 'Sound Keeper'}
        </span>
        {atMaxLevel && (
          <span style={{ fontSize: '7px', color: '#ff8800', marginLeft: 'auto' }}>MAX</span>
        )}
      </div>

      {/* HP bar */}
      <div className="flex items-center gap-2">
        <span
          style={{
            fontFamily: '"Press Start 2P"',
            fontSize: '8px',
            color: '#e03030',
            minWidth: 22,
          }}
        >
          HP
        </span>
        <div
          className="relative flex-1"
          style={{
            height: 10,
            background: '#220000',
            border: '1px solid #550000',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${hpFrac * 100}%`,
              height: '100%',
              background: `linear-gradient(180deg, ${hpColor}, ${hpColor}cc)`,
              transition: 'width 0.3s ease',
              boxShadow: `0 0 6px ${hpColor}88`,
            }}
          />
        </div>
        <span
          style={{
            fontFamily: '"Press Start 2P"',
            fontSize: '7px',
            color: '#cccccc',
            minWidth: 44,
            textAlign: 'right',
          }}
        >
          {hp}/{maxHp}
        </span>
      </div>

      {/* XP bar */}
      {!atMaxLevel && (
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: '"Press Start 2P"',
              fontSize: '8px',
              color: '#4080ff',
              minWidth: 22,
            }}
          >
            XP
          </span>
          <div
            className="relative flex-1"
            style={{
              height: 10,
              background: '#001122',
              border: '1px solid #003355',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${xpFrac * 100}%`,
                height: '100%',
                background: 'linear-gradient(180deg, #4080ff, #4080ffcc)',
                transition: 'width 0.4s ease',
                boxShadow: '0 0 6px #4080ff88',
              }}
            />
          </div>
          <span
            style={{
              fontFamily: '"Press Start 2P"',
              fontSize: '7px',
              color: '#cccccc',
              minWidth: 44,
              textAlign: 'right',
            }}
          >
            {xpCurrent}/{xpNeeded}
          </span>
        </div>
      )}

      {/* Attacks unlocked indicator */}
      <div className="flex gap-1.5 mt-0.5">
        {unlockedAttacks.slice(0, 4).map((atk) => (
          <div
            key={atk.id}
            title={atk.name}
            style={{
              width: 8,
              height: 8,
              background: '#' + atk.color.toString(16).padStart(6, '0'),
              border: '1px solid rgba(255,255,255,0.35)',
              borderRadius: 2,
              boxShadow: `0 0 4px ${'#' + atk.color.toString(16).padStart(6, '0')}66`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
