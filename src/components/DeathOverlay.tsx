import { useEffect, useRef, useState, type RefObject } from 'react';
import { EventBus, EVENTS, type DeathUiPayload } from '../game/EventBus';
import { ATTACK_ORDER, ATTACKS } from '../game/systems/AttackSystem';
import { MAX_LEVEL, getXPForCurrentLevel, getXPForNextLevel } from '../game/systems/XPSystem';
import { useGameStore } from '../store/gameStore';
import { useCanvasBounds } from './useCanvasBounds';
import { useTr } from '../i18n';

interface DeathOverlayProps {
  canvasParentRef: RefObject<HTMLDivElement | null>;
}

/** One useful next step, matched to how the fight was lost. Every claim here is a game rule. */
function deathTip(isBoss: boolean, level: number, xp: number): string {
  if (isBoss) {
    return level < MAX_LEVEL
      ? `The Gatekeeper hits harder once it drops to 75% and again at 25% health. Reach level ${MAX_LEVEL} first to unlock Reverb Strike.`
      : 'The Gatekeeper hits harder once it drops to 75% and again at 25% health. Go in with full HP.';
  }
  if (level < MAX_LEVEL) {
    const next = ATTACK_ORDER.map(id => ATTACKS[id]).find(attack => attack.unlockLevel === level + 1);
    const toGo = Math.max(0, getXPForNextLevel(level) - xp);
    return `Battles in the tall grass earn XP. ${toGo} more XP unlocks ${next?.name ?? 'a new move'} at level ${level + 1}.`;
  }
  return 'Hurt after a fight? Talk to Professor Krys in Echo Village and she restores your HP.';
}

export function DeathOverlay({ canvasParentRef }: DeathOverlayProps) {
  const bounds = useCanvasBounds(canvasParentRef);
  const [state, setState] = useState<DeathUiPayload>({ ready: false, reconnecting: false });
  const level = useGameStore(store => store.level);
  const xp = useGameStore(store => store.xp);
  const t = useTr();
  const respawnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onState = (payload: DeathUiPayload) => setState(payload);
    EventBus.on(EVENTS.DEATH_UI_STATE, onState);
    return () => {
      EventBus.off(EVENTS.DEATH_UI_STATE, onState);
    };
  }, []);

  // Keyboard users land on the only action as soon as it can be taken.
  useEffect(() => {
    if (state.ready && !state.reconnecting) respawnRef.current?.focus({ preventScroll: true });
  }, [state.ready, state.reconnecting]);

  if (!bounds) return null;
  const maxed = level >= MAX_LEVEL;
  const floor = getXPForCurrentLevel(level);
  const ceiling = getXPForNextLevel(level);
  const progress = maxed ? 1 : Math.min(1, Math.max(0, (xp - floor) / Math.max(1, ceiling - floor)));
  const eyebrow = t(state.isBoss
    ? 'The Gatekeeper silenced you'
    : state.defeatedBy ? `Defeated by ${state.defeatedBy}` : 'You were defeated');
  const title = t('Signal lost');

  return (
    <section
      className={`ui-layer death-screen${state.reconnecting ? ' is-reconnecting' : ''}`}
      style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="death-title"
      aria-describedby="death-detail"
    >
      <div className="death-screen__content">
        <p className="death-screen__eyebrow"><i aria-hidden="true" />{eyebrow}</p>
        <h1 id="death-title" className="death-screen__title" data-text={title}>{title}</h1>
        <p id="death-detail" className="death-screen__text">
          {t('You keep your level and XP, and wake up in Echo Village with full HP.')}
        </p>

        <div className="death-screen__progress" aria-label={t(maxed ? `Level ${level}, maximum level` : `Level ${level}, ${xp - floor} of ${ceiling - floor} XP to level ${level + 1}`)}>
          <span className="death-screen__level">{t(`Lv ${level}`)}</span>
          <div className="meter meter--xp" aria-hidden="true">
            <i className="meter__fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <span className="death-screen__xp">{t(maxed ? 'Max level' : `${ceiling - xp} XP to Lv ${level + 1}`)}</span>
        </div>

        <p className="death-screen__tip"><span>{t('Tip')}</span>{t(deathTip(!!state.isBoss, level, xp))}</p>

        <button
          ref={respawnRef}
          type="button"
          className="btn btn--primary death-screen__action"
          disabled={!state.ready || state.reconnecting}
          onClick={() => EventBus.emit(EVENTS.DEATH_UI_ACTION)}
        >
          {t(state.reconnecting ? 'Reconnecting…' : 'Respawn')}
          <kbd className="keycap hint-desktop" aria-hidden="true">Enter</kbd>
        </button>
      </div>
    </section>
  );
}
