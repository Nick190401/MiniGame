import { useEffect, useState, type RefObject } from 'react';
import { EventBus, EVENTS, type DeathUiPayload } from '../game/EventBus';
import { useGameStore } from '../store/gameStore';
import { useCanvasBounds } from './useCanvasBounds';

interface DeathOverlayProps {
  canvasParentRef: RefObject<HTMLDivElement | null>;
}

export function DeathOverlay({ canvasParentRef }: DeathOverlayProps) {
  const bounds = useCanvasBounds(canvasParentRef);
  const playerName = useGameStore(state => state.playerName || 'Sound Keeper');
  const level = useGameStore(state => state.level);
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
    <section className="death-overlay" style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}>
      <header>
        <div><i /> <span><strong>Sound Quest</strong><small>System // broadcast failure</small></span></div>
        <b><i /> Link lost</b>
      </header>
      <div className="death-overlay__body">
        <main>
          <small>Transmission 00 // terminated</small>
          <h1>Signal <em>Lost</em></h1>
          <p>Your channel dropped below recoverable levels.<br />The sonic archive retained your progress.</p>
          <dl>
            <div><dt>Callsign</dt><dd>{playerName}</dd></div>
            <div><dt>Level</dt><dd>{String(level).padStart(2, '0')}</dd></div>
            <div><dt>Recovery point</dt><dd>Echo Village // Full HP</dd></div>
          </dl>
          <button disabled={!state.ready || state.reconnecting} onClick={() => EventBus.emit(EVENTS.DEATH_UI_ACTION)}>
            <span>{state.reconnecting ? 'Reconnecting…' : 'Reconnect signal'}</span><kbd>Enter</kbd>
          </button>
        </main>
        <aside aria-hidden="true"><div className="death-receiver"><i /><i /><i /><b /></div><small>No carrier // 00.0 Hz</small></aside>
      </div>
      <footer>Space / Enter / Tap <span>// Archive safe</span></footer>
    </section>
  );
}
