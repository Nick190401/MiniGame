import type { CSSProperties } from 'react';
import { useGameStore } from '../store/gameStore';
import { getXPProgress, getXPForNextLevel, getXPForCurrentLevel, MAX_LEVEL } from '../game/systems/XPSystem';

function HeadphonesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H5a1 1 0 0 1-1-1v-5Zm16 0h-3v6h2a1 1 0 0 0 1-1v-5Z" />
    </svg>
  );
}

// Decorative signal waveform beneath the deck — heights as % of track height.
const WAVE_HEIGHTS = [15, 20, 15, 30, 20, 45, 60, 40, 70, 90, 65, 85, 55, 75, 45, 60, 35, 50, 25, 40, 20, 30, 15, 20, 15];

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
  const levelLabel = level.toString().padStart(2, '0');

  return (
    <div className="game-hud">
      <div className="game-hud__deck">
        <i className="game-hud__screw game-hud__screw--tl" aria-hidden="true" />
        <i className="game-hud__screw game-hud__screw--tr" aria-hidden="true" />
        <i className="game-hud__screw game-hud__screw--bl" aria-hidden="true" />
        <i className="game-hud__screw game-hud__screw--br" aria-hidden="true" />

        <div className="game-hud__row">
          <span className="game-hud__avatar"><HeadphonesIcon /></span>

          <div className="game-hud__identity">
            <strong className="game-hud__name">{playerName || 'Sound Keeper'}</strong>
            <i className="game-hud__rule" aria-hidden="true" />
            <span className="game-hud__level"><small>Lv.</small><strong>{levelLabel}</strong></span>
          </div>

          <div className="game-hud__stats">
            <div className="hud-stat hud-stat--hp">
              <div className="hud-stat__label"><span>Vital Signal</span><strong>{hp} / {maxHp}</strong></div>
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

          <div className="game-hud__moves" aria-label={`${unlockedAttacks.length} attacks unlocked`}>
            <small>Moves</small>
            <strong>{unlockedAttacks.length}</strong>
            <div className="game-hud__moves-dots">
              {unlockedAttacks.slice(0, 4).map((attack) => (
                <i key={attack.id} title={attack.name} style={{ '--attack-color': `#${attack.color.toString(16).padStart(6, '0')}` } as CSSProperties} />
              ))}
            </div>
          </div>
        </div>

        <div className="game-hud__footer">
          <i className="game-hud__reel" aria-hidden="true" />
          <i className="game-hud__reel" aria-hidden="true" />
          <span className="game-hud__footer-label">SK-{levelLabel} · STEREO</span>
          <span className="game-hud__footer-bars" aria-hidden="true"><i /><i /><i /><i /></span>
        </div>
      </div>

      <div className="game-hud__wave" aria-hidden="true">
        <span className="game-hud__wave-play" />
        <span className="game-hud__wave-bars">
          {WAVE_HEIGHTS.map((h, idx) => (
            <i key={idx} style={{ '--h': h, '--d': `${idx * 0.08}s` } as CSSProperties} />
          ))}
        </span>
      </div>
    </div>
  );
}
