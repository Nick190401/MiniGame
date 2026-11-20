import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { EventBus, EVENTS, type NoticePayload } from '../game/EventBus';
import { useCanvasBounds } from './useCanvasBounds';
import { noticeDuration, type HudNotice } from './useSettingsTip';
import { useTr } from '../i18n';
import './GameNoticeOverlay.css';

interface GameNoticeOverlayProps {
  canvasParentRef: RefObject<HTMLDivElement | null>;
}

type Tone = NonNullable<NoticePayload['tone']>;

/** Default accent per tone. An explicit `accent` (an attack's own colour, an
 *  NPC's colour) still wins. */
const TONE_ACCENT: Record<Tone, string> = {
  info: 'var(--steel)',
  success: 'var(--gold)',
  danger: 'var(--danger)',
  combat: 'var(--ember)',
};

/** Each tone has its own glyph, so the kind of news never rests on colour alone. */
const TONE_ICON: Record<Tone, ReactNode> = {
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" /></>,
  success: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.7 2.7L16.2 9.6" /></>,
  danger: <><path d="M10.3 4.6 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0Z" /><path d="M12 10v4M12 17v.5" /></>,
  combat: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />,
};

export function GameNoticeOverlay({ canvasParentRef }: GameNoticeOverlayProps) {
  const bounds = useCanvasBounds(canvasParentRef);
  const t = useTr();
  const [notice, setNotice] = useState<(HudNotice & { key: number; ms: number }) | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const clear = () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      setNotice(null);
    };
    const show = (payload: HudNotice) => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      const ms = noticeDuration(payload);
      setNotice({ ...payload, key: Date.now(), ms });
      timerRef.current = window.setTimeout(clear, ms);
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
  const tone = notice.tone ?? 'info';
  const style = {
    '--notice-accent': notice.accent ?? TONE_ACCENT[tone],
    '--notice-ms': `${notice.ms}ms`,
  } as CSSProperties;

  return (
    <div
      className={`ui-layer notice-layer is-${notice.variant ?? 'compact'}${notice.placement === 'under-hud' ? ' is-under-hud' : ''}`}
      style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}
      role="status"
    >
      <article key={notice.key} className="notice" style={style}>
        <span className="notice__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {TONE_ICON[tone]}
          </svg>
        </span>
        <div className="notice__copy">
          {notice.eyebrow && <p className="notice__eyebrow">{t(notice.eyebrow)}</p>}
          <p className="notice__title">{t(notice.title)}</p>
          {notice.detail && <p className="notice__detail">{t(notice.detail)}</p>}
        </div>
      </article>
    </div>
  );
}
