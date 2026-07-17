import { useEffect, useState, type RefObject } from 'react';
import { EventBus, EVENTS, type LoadingUiPayload } from '../game/EventBus';
import { useCanvasBounds } from './useCanvasBounds';

interface LoadingOverlayProps {
  canvasParentRef: RefObject<HTMLDivElement | null>;
}

const initialLoading: LoadingUiPayload = {
  step: 0,
  total: 6,
  label: 'OPENING SONIC ARCHIVE',
  progress: 0,
};

export function LoadingOverlay({ canvasParentRef }: LoadingOverlayProps) {
  const bounds = useCanvasBounds(canvasParentRef);
  const [loading, setLoading] = useState(initialLoading);

  useEffect(() => {
    const onLoading = (payload: LoadingUiPayload) => setLoading(payload);
    EventBus.on(EVENTS.LOADING_UI_STATE, onLoading);
    return () => {
      EventBus.off(EVENTS.LOADING_UI_STATE, onLoading);
    };
  }, []);

  if (!bounds) return null;
  const progress = Math.max(0, Math.min(100, loading.progress));

  return (
    <section className="loading-overlay" style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}>
      <header className="loading-overlay__header">
        <div className="loading-brand"><b>SQ</b><span><strong>Sound Quest</strong><small>World link // boot sequence</small></span></div>
        <span className="loading-online"><i /> Link active</span>
      </header>
      <div className="loading-overlay__body">
        <div className="loading-copy">
          <small>Entering // the sonic archive</small>
          <h1>Signal<br /><em>Lock</em></h1>
          <p>Calibrating your frequency<br />for the world beyond.</p>
        </div>
        <div className="loading-dial" aria-hidden="true"><i /><i /><i /><b /><span /></div>
      </div>
      <footer className="loading-module">
        <div><span>{String(loading.step).padStart(2, '0')} // {loading.label}</span><strong>{String(Math.round(progress)).padStart(2, '0')}%</strong></div>
        <div className="loading-progress"><i style={{ width: `${progress}%` }} /></div>
        <ol>{Array.from({ length: loading.total }, (_, index) => <li key={index} className={index < loading.step ? 'is-done' : ''}>{String(index + 1).padStart(2, '0')}</li>)}</ol>
      </footer>
    </section>
  );
}
