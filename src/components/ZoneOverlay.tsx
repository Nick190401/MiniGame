import { useEffect, useState, type CSSProperties, type RefObject } from 'react';
import { EventBus, EVENTS, type ZoneUiPayload } from '../game/EventBus';
import { useCanvasBounds } from './useCanvasBounds';
import { useTr } from '../i18n';

interface ZoneOverlayProps {
  canvasParentRef: RefObject<HTMLDivElement | null>;
}

export function ZoneOverlay({ canvasParentRef }: ZoneOverlayProps) {
  const bounds = useCanvasBounds(canvasParentRef);
  const t = useTr();
  const [zone, setZone] = useState<(ZoneUiPayload & { key: number }) | null>(null);

  useEffect(() => {
    const onZone = (payload: ZoneUiPayload) => {
      if (payload.replay === false) return;
      setZone({ ...payload, key: Date.now() });
    };
    EventBus.on(EVENTS.ZONE_UI_STATE, onZone);
    EventBus.emit(EVENTS.ZONE_UI_REQUEST);
    return () => {
      EventBus.off(EVENTS.ZONE_UI_STATE, onZone);
    };
  }, []);

  if (!bounds || !zone) return null;

  return (
    <div
      className="ui-layer zone-layer"
      style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}
      aria-live="polite"
    >
      {/* Keyed so every zone change replays the banner from the start. */}
      <div key={zone.key} className="zone-banner" style={{ '--zone-accent': zone.accent } as CSSProperties}>
        <p className="zone-banner__meta">{t(zone.meta)}</p>
        <p className="zone-banner__title">{t(zone.title)}</p>
      </div>
    </div>
  );
}
