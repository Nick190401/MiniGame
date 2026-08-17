import { useEffect, useState, type CSSProperties, type RefObject } from 'react';
import { EventBus, EVENTS, type DialogPayload } from '../game/EventBus';

interface DialogueOverlayProps {
  canvasParentRef: RefObject<HTMLDivElement | null>;
}

interface OverlayBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

const PORTRAITS: Partial<Record<NonNullable<DialogPayload['portrait']>, string>> = {
  elder: '/assets/npc-elder-muse-v2.png',
  guard: '/assets/npc-junction-guard-v2.png',
  musician: '/assets/npc-wandering-musician-v2.png',
  gatekeeper: '/assets/boss-gatekeeper-phase1-v2.png',
};

export function DialogueOverlay({ canvasParentRef }: DialogueOverlayProps) {
  const [dialog, setDialog] = useState<DialogPayload | null>(null);
  const [bounds, setBounds] = useState<OverlayBounds | null>(null);

  useEffect(() => {
    const onDialog = (payload: DialogPayload | string) => {
      setDialog(typeof payload === 'string'
        ? { text: payload, speaker: 'FIELD TRANSMISSION', accent: '#ff7a2b' }
        : payload);
    };
    const onClear = () => setDialog(null);
    EventBus.on(EVENTS.DIALOG, onDialog);
    EventBus.on(EVENTS.DIALOG_CLEAR, onClear);
    return () => {
      EventBus.off(EVENTS.DIALOG, onDialog);
      EventBus.off(EVENTS.DIALOG_CLEAR, onClear);
    };
  }, []);

  useEffect(() => {
    const parent = canvasParentRef.current;
    if (!parent) return;

    const measure = () => {
      const canvas = parent.querySelector('canvas');
      if (!canvas) return;
      const stageRect = parent.parentElement?.getBoundingClientRect() ?? parent.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const width = canvasRect.width * 0.9;
      const height = Math.min(190, Math.max(88, canvasRect.height * 0.28));
      setBounds({
        left: canvasRect.left - stageRect.left + canvasRect.width * 0.05,
        top: canvasRect.bottom - stageRect.top - height - Math.max(4, canvasRect.height * 0.012),
        width,
        height,
      });
    };

    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(parent, { childList: true });
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(parent);
    window.addEventListener('resize', measure);
    const frame = requestAnimationFrame(measure);

    return () => {
      cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [canvasParentRef]);

  if (!dialog || !bounds) return null;
  const portraitUrl = dialog.portrait ? PORTRAITS[dialog.portrait] : undefined;
  const style = {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
    '--dialog-accent': dialog.accent,
  } as CSSProperties;

  return (
    <aside
      className={`dialog-overlay${dialog.portrait === 'gatekeeper' ? ' has-gatekeeper' : ''}`}
      style={style}
      role="status"
      aria-live="polite"
    >
      <span className="dialog-overlay__rail" aria-hidden="true" />
      <div className="dialog-overlay__portrait" aria-hidden="true">
        {portraitUrl ? (
          <img
            className={`dialog-overlay__portrait-image is-${dialog.portrait}`}
            src={portraitUrl}
            alt=""
          />
        ) : (
          <span className={`dialog-overlay__signal ${dialog.portrait === 'gatekeeper' ? 'is-gatekeeper' : ''}`}>
            {dialog.portrait === 'gatekeeper' ? '◇' : '◎'}
          </span>
        )}
      </div>
      <div className="dialog-overlay__content">
        <header className="dialog-overlay__header">
          <strong>{dialog.speaker}</strong>
          <span>Voice // Live</span>
        </header>
        <p>{dialog.text}</p>
        <div className="dialog-overlay__continue">
          <span className="dialog-hint--desktop">E</span>
          <span className="dialog-hint--desktop">SPACE</span>
          <span className="dialog-hint--mobile">A / TAP</span>
          <i aria-hidden="true">↓</i>
        </div>
      </div>
    </aside>
  );
}
