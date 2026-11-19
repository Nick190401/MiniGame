import { useEffect, useState, type RefObject } from 'react';
import { EventBus, EVENTS, type LoadingUiPayload } from '../game/EventBus';
import { useCanvasBounds } from './useCanvasBounds';
import { BrandLogo } from './BrandLogo';
import { GameLogo } from './GameLogo';
import { useKeyArt } from './useKeyArt';

interface LoadingOverlayProps {
  canvasParentRef: RefObject<HTMLDivElement | null>;
}

const initialLoading: LoadingUiPayload = {
  step: 0,
  total: 6,
  label: 'Opening the sound archive',
  progress: 0,
};

export function LoadingOverlay({ canvasParentRef }: LoadingOverlayProps) {
  const bounds = useCanvasBounds(canvasParentRef);
  const [loading, setLoading] = useState(initialLoading);
  const keyArt = useKeyArt();

  useEffect(() => {
    const onLoading = (payload: LoadingUiPayload) => setLoading(payload);
    EventBus.on(EVENTS.LOADING_UI_STATE, onLoading);
    return () => {
      EventBus.off(EVENTS.LOADING_UI_STATE, onLoading);
    };
  }, []);

  if (!bounds) return null;
  const progress = Math.round(Math.max(0, Math.min(100, loading.progress)));

  return (
    <section
      className="ui-layer loading-screen"
      style={{
        left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height,
        backgroundImage: keyArt ? `url(${keyArt})` : undefined,
      }}
    >
      <div className="brand-stamp"><BrandLogo /></div>
      <GameLogo compact />
      <div
        className="loading-screen__status"
        role="progressbar"
        aria-label="Loading the world"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-valuetext={`${loading.label}, ${progress}%`}
      >
        <div className="loading-screen__row">
          <span className="loading-screen__label">{loading.label}</span>
          <span className="loading-screen__percent">{progress}%</span>
        </div>
        <div className="meter meter--loading"><i className="meter__fill" style={{ width: `${progress}%` }} /></div>
      </div>
    </section>
  );
}
