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
      <div className="loading-overlay__prompt">
        <span className="loading-overlay__ring" aria-hidden="true" />
        <span className="loading-overlay__label">{loading.label}</span>
        <div className="loading-overlay__track"><i style={{ width: `${progress}%` }} /></div>
        <span className="loading-overlay__percent">{String(Math.round(progress)).padStart(2, '0')}%</span>
      </div>
    </section>
  );
}
