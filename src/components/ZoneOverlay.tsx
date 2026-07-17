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
        <span aria-hidden="true" />
        <div>
          <small>Current frequency</small>
          <strong>{zone.title}</strong>
          <p>{zone.meta}</p>
        </div>
      </article>
    </div>
  );
}
