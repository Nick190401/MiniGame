import { useEffect, useState, type CSSProperties, type RefObject } from 'react';
import { EventBus, EVENTS, type BattleUiPayload } from '../game/EventBus';
import { useCanvasBounds } from './useCanvasBounds';
import { PLAYER_BUST_URL, hpLevel, percent } from './vitals';

interface BattleOverlayProps {
  canvasParentRef: RefObject<HTMLDivElement | null>;
}

function HpRow({ hp, maxHp }: { hp: number; maxHp: number }) {
  return (
    <div className="battle-hp">
      <span className="battle-hp__label">HP</span>
      <div className="meter meter--hp" data-level={hpLevel(hp, maxHp)}>
        <i className="meter__fill" style={{ width: percent(hp, maxHp) }} />
      </div>
      <span className="battle-hp__value">{hp}<small>/{maxHp}</small></span>
    </div>
  );
}

export function BattleOverlay({ canvasParentRef }: BattleOverlayProps) {
  const bounds = useCanvasBounds(canvasParentRef);
  const [battle, setBattle] = useState<BattleUiPayload | null>(null);

  useEffect(() => {
    const onState = (payload: BattleUiPayload) => setBattle(payload);
    EventBus.on(EVENTS.BATTLE_UI_STATE, onState);
    EventBus.emit(EVENTS.BATTLE_UI_REQUEST);
    return () => {
      EventBus.off(EVENTS.BATTLE_UI_STATE, onState);
    };
  }, []);

  // Publish the message row's band, so a combat notice can take that row over
  // for its moment instead of covering the arena the player is watching.
  const messageTop = battle?.layout.messageTop;
  const messageHeight = battle?.layout.messageHeight;
  useEffect(() => {
    if (messageTop === undefined || messageHeight === undefined) return;
    const root = document.documentElement.style;
    root.setProperty('--battle-msg-top', `${messageTop}`);
    root.setProperty('--battle-msg-h', `${messageHeight}`);
    return () => {
      root.removeProperty('--battle-msg-top');
      root.removeProperty('--battle-msg-h');
    };
  }, [messageTop, messageHeight]);

  if (!battle || !bounds) return null;
  const style = {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
    // Rows the scene reserved for the DOM half of the battle UI.
    '--arena-h': `${battle.layout.arena * 100}%`,
    '--msg-top': `${battle.layout.messageTop * 100}%`,
    '--msg-h': `${battle.layout.messageHeight * 100}%`,
    '--menu-top': `${battle.layout.menuTop * 100}%`,
  } as CSSProperties;

  return (
    <section className="ui-layer battle-ui" style={style} aria-label="Battle">
      <article className="battle-card battle-card--enemy" style={{ '--card-accent': battle.enemy.accent } as CSSProperties}>
        <div className="battle-card__head">
          <p className="battle-card__name">{battle.enemy.name}</p>
          {battle.phase && <span className="battle-card__tag">{battle.phase}</span>}
        </div>
        <HpRow hp={battle.enemy.hp} maxHp={battle.enemy.maxHp} />
      </article>

      <article className="battle-card battle-card--player">
        <span className="avatar" aria-hidden="true"><img src={PLAYER_BUST_URL} alt="" draggable={false} /></span>
        <div className="battle-card__main">
          <div className="battle-card__head">
            <p className="battle-card__name">{battle.player.name}</p>
            <span className="battle-card__level">Lv {battle.player.level}</span>
          </div>
          <HpRow hp={battle.player.hp} maxHp={battle.player.maxHp} />
        </div>
      </article>

      <div
        className={`battle-log${battle.inputEnabled ? ' is-player-turn' : ''}`}
        style={{ '--turn-accent': battle.turnAccent } as CSSProperties}
        role="status"
        aria-live="polite"
      >
        <span className="battle-log__turn"><i aria-hidden="true" />{battle.turnStatus}</span>
        <p className="battle-log__text">{battle.message}</p>
      </div>

      <div className="battle-moves" role="group" aria-label="Moves">
        {battle.attacks.map((attack, index) => {
          const usable = attack.unlocked && battle.inputEnabled;
          return (
            <button
              key={attack.id}
              type="button"
              className={`battle-move${attack.unlocked ? '' : ' is-locked'}`}
              style={{ '--move-accent': attack.accent } as CSSProperties}
              disabled={!usable}
              onClick={() => EventBus.emit(EVENTS.BATTLE_UI_ACTION, index)}
              aria-keyshortcuts={attack.unlocked ? String(attack.key) : undefined}
            >
              <span className="battle-move__copy">
                <span className="battle-move__name">{attack.name}</span>
                <span className="battle-move__desc">
                  {attack.unlocked ? attack.description : `Unlocks at level ${attack.unlockLevel}`}
                </span>
              </span>
              <kbd className="keycap battle-move__key" aria-hidden="true">
                {attack.unlocked ? attack.key : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                )}
              </kbd>
            </button>
          );
        })}
      </div>
    </section>
  );
}
