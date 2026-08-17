import { useEffect, useState, type CSSProperties, type RefObject } from 'react';
import { EventBus, EVENTS, type ZoneUiPayload } from '../game/EventBus';
import { useCanvasBounds } from './useCanvasBounds';

interface ZoneOverlayProps {
  canvasParentRef: RefObject<HTMLDivElement | null>;
}

export function ZoneOverlay({ canvasParentRef }: ZoneOverlayProps) {
  const bounds = useCanvasBounds(canvasParentRef);
  const [zone, setZone] = useState<(ZoneUiPayload & { key: number }) | null>(null);

  useEffect(() => {
    const onZone = (payload: ZoneUiPayload) => setZone({ ...payload, key: Date.now() });
    EventBus.on(EVENTS.ZONE_UI_STATE, onZone);
    EventBus.emit(EVENTS.ZONE_UI_REQUEST);
    return () => {
      EventBus.off(EVENTS.ZONE_UI_STATE, onZone);
    };
  }, []);

  if (!bounds || !zone) return null;
  const style = {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
    '--zone-accent': zone.accent,
  } as CSSProperties;

  return (
    <div className="zone-overlay" style={style} aria-live="polite">
      <article key={zone.key} className="zone-card">
        <i className="zone-card__screw zone-card__screw--tl" aria-hidden="true" />
        <i className="zone-card__screw zone-card__screw--tr" aria-hidden="true" />
        <i className="zone-card__screw zone-card__screw--bl" aria-hidden="true" />
        <i className="zone-card__screw zone-card__screw--br" aria-hidden="true" />

        <div className="zone-card__topbar">
          <span className="zone-card__topbar-icon" aria-hidden="true">↺</span>
          <small>Current frequency</small>
          <span className="zone-card__topbar-line" aria-hidden="true" />
          <span className="zone-card__topbar-arrow" aria-hidden="true">→</span>
          <span className="zone-card__signal" aria-hidden="true"><i /><i /><i /><i /></span>
        </div>

        <div className="zone-card__body">
          <i className="zone-card__reel" aria-hidden="true" />
          <strong>{zone.title}</strong>
          <i className="zone-card__reel" aria-hidden="true" />
        </div>

        <div className="zone-card__footer">
          <span className="zone-card__grille" aria-hidden="true" />
          <p>{zone.meta}</p>
          <span className="zone-card__grille" aria-hidden="true" />
        </div>
      </article>
    </div>
  );
}
