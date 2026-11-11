import { useEffect, useState, type RefObject } from 'react';
import { EventBus, EVENTS, type PortalLabelPayload } from '../game/EventBus';
import { useCanvasBounds } from './useCanvasBounds';
import './PortalOverlay.css';

export function PortalOverlay({ canvasParentRef }: { canvasParentRef: RefObject<HTMLDivElement | null> }) {
  const bounds = useCanvasBounds(canvasParentRef);
  const [labels, setLabels] = useState<PortalLabelPayload[]>([]);

  useEffect(() => {
    const update = (next: PortalLabelPayload[]) => setLabels(previous => (
      previous.length === next.length && previous.every((label, index) =>
        label.id === next[index].id && label.x === next[index].x && label.y === next[index].y)
        ? previous : next
    ));
    EventBus.on(EVENTS.PORTAL_LABEL_STATE, update);
    return () => { EventBus.off(EVENTS.PORTAL_LABEL_STATE, update); };
  }, []);

  if (!bounds || labels.length === 0) return null;
  return (
    <div className="portal-overlay" style={bounds}>
      {labels.map(label => (
        <div className="portal-overlay__label" key={label.id} style={{ left: `${label.x * 100}%`, top: `${label.y * 100}%` }}>
          <strong>Universe</strong><span aria-hidden="true">//</span><span>Soon</span>
        </div>
      ))}
    </div>
  );
}
