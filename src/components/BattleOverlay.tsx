import { useEffect, useState, type CSSProperties, type RefObject } from 'react';
import { EventBus, EVENTS, type BattleUiPayload } from '../game/EventBus';

interface BattleOverlayProps {
  canvasParentRef: RefObject<HTMLDivElement | null>;
}

interface OverlayBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

const hpPercent = (hp: number, maxHp: number) => `${Math.max(0, Math.min(100, (hp / Math.max(1, maxHp)) * 100))}%`;

export function BattleOverlay({ canvasParentRef }: BattleOverlayProps) {
  const [battle, setBattle] = useState<BattleUiPayload | null>(null);
  const [bounds, setBounds] = useState<OverlayBounds | null>(null);

  useEffect(() => {
    const onState = (payload: BattleUiPayload) => setBattle(payload);
    EventBus.on(EVENTS.BATTLE_UI_STATE, onState);
    EventBus.emit(EVENTS.BATTLE_UI_REQUEST);
    return () => {
      EventBus.off(EVENTS.BATTLE_UI_STATE, onState);
    };
  }, []);

  useEffect(() => {
    const parent = canvasParentRef.current;
    if (!parent) return;
    const measure = () => {
      const canvas = parent.querySelector('canvas');
      if (!canvas) return;
      const stageRect = parent.parentElement?.getBoundingClientRect() ?? parent.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      setBounds({
        left: canvasRect.left - stageRect.left,
        top: canvasRect.top - stageRect.top,
        width: canvasRect.width,
        height: canvasRect.height,
      });
    };

    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(parent, { childList: true });
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(parent);
    window.addEventListener('resize', measure);
    const frame = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [canvasParentRef]);

  if (!battle || !bounds) return null;
  const style = {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
    '--enemy-accent': battle.enemy.accent,
    '--turn-accent': battle.turnAccent,
  } as CSSProperties;

  return (
    <section className={`battle-overlay${battle.isBoss ? ' is-boss' : ''}`} style={style} aria-label="Battle controls">
      <article className="battle-card battle-card--enemy" style={{ '--card-accent': battle.enemy.accent } as CSSProperties}>
        <i className="battle-card__screw battle-card__screw--tl" aria-hidden="true" />
        <i className="battle-card__screw battle-card__screw--tr" aria-hidden="true" />
        <i className="battle-card__screw battle-card__screw--bl" aria-hidden="true" />
        <i className="battle-card__screw battle-card__screw--br" aria-hidden="true" />
        <span className="battle-card__rail" aria-hidden="true" />
        <header className="battle-card__header">
          <span><i aria-hidden="true" /> Target signal</span>
          <strong>{battle.phase}</strong>
        </header>
        <h2>{battle.enemy.name}</h2>
        <div className="battle-vital">
          <span>HP</span>
          <div className="battle-vital__track"><i style={{ width: hpPercent(battle.enemy.hp, battle.enemy.maxHp) }} /></div>
          <strong>{battle.enemy.hp}<small> / {battle.enemy.maxHp}</small></strong>
        </div>
      </article>

      <article className="battle-card battle-card--player" style={{ '--card-accent': '#49dfbf' } as CSSProperties}>
        <i className="battle-card__screw battle-card__screw--tl" aria-hidden="true" />
        <i className="battle-card__screw battle-card__screw--tr" aria-hidden="true" />
        <i className="battle-card__screw battle-card__screw--bl" aria-hidden="true" />
        <i className="battle-card__screw battle-card__screw--br" aria-hidden="true" />
        <span className="battle-card__rail" aria-hidden="true" />
        <header className="battle-card__header">
          <span><i aria-hidden="true" /> Player channel</span>
          <strong>LV {String(battle.player.level).padStart(2, '0')}</strong>
        </header>
        <h2>{battle.player.name}</h2>
        <div className="battle-vital">
          <span>HP</span>
          <div className="battle-vital__track"><i style={{ width: hpPercent(battle.player.hp, battle.player.maxHp) }} /></div>
          <strong>{battle.player.hp}<small> / {battle.player.maxHp}</small></strong>
        </div>
      </article>

      <aside className="battle-message" role="status" aria-live="polite">
        <i className="battle-card__screw battle-card__screw--tl" aria-hidden="true" />
        <i className="battle-card__screw battle-card__screw--tr" aria-hidden="true" />
        <i className="battle-card__screw battle-card__screw--bl" aria-hidden="true" />
        <i className="battle-card__screw battle-card__screw--br" aria-hidden="true" />
        <span className="battle-message__rail" aria-hidden="true" />
        <div className="battle-message__signal" aria-hidden="true"><i /><i /><b /></div>
        <div className="battle-message__content">
          <header>
            <strong>Battle comms</strong>
            <span style={{ color: battle.turnAccent }}>{battle.turnStatus}</span>
          </header>
          <p>{battle.message}</p>
        </div>
      </aside>

      <div className="battle-actions" aria-label="Available attacks">
        {battle.attacks.map((attack, index) => {
          const usable = attack.unlocked && battle.inputEnabled;
          return (
            <button
              key={attack.id}
              className={`battle-action${attack.unlocked ? '' : ' is-locked'}`}
              style={{ '--attack-accent': attack.accent } as CSSProperties}
              disabled={!usable}
              onClick={() => EventBus.emit(EVENTS.BATTLE_UI_ACTION, index)}
              aria-label={attack.unlocked ? `Use ${attack.name}` : `${attack.name} unlocks at level ${attack.unlockLevel}`}
            >
              <span className="battle-action__rail" aria-hidden="true" />
              <span className="battle-action__copy">
                <small>Track {String(attack.key).padStart(2, '0')} // {attack.unlocked ? (usable ? 'Ready' : 'Standby') : 'Locked'}</small>
                <strong>
                  {attack.unlocked ? attack.name : (
                    <>
                      <span className="battle-locked--desktop">Unavailable</span>
                      <span className="battle-locked--mobile">Locked</span>
                    </>
                  )}
                </strong>
                <em>{attack.unlocked ? attack.description : `Unlocks at level ${String(attack.unlockLevel).padStart(2, '0')}`}</em>
              </span>
              <kbd>{attack.unlocked ? attack.key : '—'}</kbd>
            </button>
          );
        })}
      </div>
    </section>
  );
}
