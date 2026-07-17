import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { EventBus, EVENTS, type NoticePayload } from '../game/EventBus';
import { useCanvasBounds } from './useCanvasBounds';

interface GameNoticeOverlayProps {
  canvasParentRef: RefObject<HTMLDivElement | null>;
}

export function GameNoticeOverlay({ canvasParentRef }: GameNoticeOverlayProps) {
  const bounds = useCanvasBounds(canvasParentRef);
  const [notice, setNotice] = useState<(NoticePayload & { key: number }) | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const clear = () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      setNotice(null);
    };
    const show = (payload: NoticePayload) => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      setNotice({ ...payload, key: Date.now() });
      timerRef.current = window.setTimeout(clear, payload.duration ?? (payload.variant === 'hero' ? 3200 : 1900));
    };
    EventBus.on(EVENTS.UI_NOTICE, show);
    EventBus.on(EVENTS.UI_NOTICE_CLEAR, clear);
    return () => {
      EventBus.off(EVENTS.UI_NOTICE, show);
      EventBus.off(EVENTS.UI_NOTICE_CLEAR, clear);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!bounds || !notice) return null;
  const style = {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
    '--notice-accent': notice.accent ?? '#d7ff4a',
  } as CSSProperties;

  return (
    <div className={`game-notice-layer is-${notice.variant ?? 'compact'}`} style={style} aria-live="assertive">
      <article key={notice.key} className={`game-notice is-${notice.tone ?? 'info'}`}>
        <span className="game-notice__rail" aria-hidden="true" />
        <span className="game-notice__pulse" aria-hidden="true"><i /><i /><b /></span>
        <div>
          <small>{notice.eyebrow ?? 'FIELD UPDATE // LIVE'}</small>
          <strong>{notice.title}</strong>
          {notice.detail && <p>{notice.detail}</p>}
        </div>
      </article>
    </div>
  );
}
