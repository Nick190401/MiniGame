import { useEffect, useState, type RefObject } from 'react';
import { EventBus, EVENTS, type DeathUiPayload } from '../game/EventBus';
import { useCanvasBounds } from './useCanvasBounds';

interface DeathOverlayProps {
  canvasParentRef: RefObject<HTMLDivElement | null>;
}

export function DeathOverlay({ canvasParentRef }: DeathOverlayProps) {
  const bounds = useCanvasBounds(canvasParentRef);
  const [state, setState] = useState<DeathUiPayload>({ ready: false, reconnecting: false });

  useEffect(() => {
    const onState = (payload: DeathUiPayload) => setState(payload);
    EventBus.on(EVENTS.DEATH_UI_STATE, onState);
    return () => {
      EventBus.off(EVENTS.DEATH_UI_STATE, onState);
    };
  }, []);

  if (!bounds) return null;
  return (
    <section
      className="ui-layer death-screen"
      style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}
      aria-labelledby="death-title"
    >
      <img className="death-screen__figure" src="assets/characters/player/full.webp" alt="" draggable={false} />
      <div className="death-screen__content">
        <p className="death-screen__eyebrow">You were defeated</p>
        <h1 id="death-title" className="death-screen__title">Signal lost</h1>
        <p className="death-screen__text">Your progress is saved. You will wake up in Echo Village with full HP.</p>
        <button
          type="button"
          className="btn btn--primary death-screen__action"
          disabled={!state.ready || state.reconnecting}
          onClick={() => EventBus.emit(EVENTS.DEATH_UI_ACTION)}
        >
          {state.reconnecting ? 'Respawning…' : 'Respawn'}
          <kbd className="keycap hint-desktop" aria-hidden="true">Enter</kbd>
        </button>
      </div>
    </section>
  );
}
