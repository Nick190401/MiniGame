import { useEffect, useState, type RefObject } from 'react';
import { EventBus, EVENTS } from '../game/EventBus';
import { useCanvasBounds } from './useCanvasBounds';
import './IntroOverlay.css';

export function IntroOverlay({ canvasParentRef }: { canvasParentRef: RefObject<HTMLDivElement | null> }) {
  const bounds = useCanvasBounds(canvasParentRef);
  const [active, setActive] = useState(false);

  useEffect(() => {
    EventBus.on(EVENTS.INTRO_UI_STATE, setActive);
    return () => { EventBus.off(EVENTS.INTRO_UI_STATE, setActive); };
  }, []);

  if (!bounds) return null;

  return (
    <div className={`intro-overlay${active ? ' is-active' : ''}`} style={bounds} aria-hidden={!active}>
      <header className="intro-overlay__header">
        <strong className="intro-overlay__title">First transmission</strong>
        <div className="intro-overlay__location">
          <span>Echo Village</span>
          <i aria-hidden="true">/</i>
          <span>Origin signal</span>
        </div>
      </header>
      <div className="intro-overlay__footer" aria-hidden="true" />
    </div>
  );
}
