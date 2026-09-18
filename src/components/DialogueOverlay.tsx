import { useEffect, useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';
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
  elder: '/assets/npc-elder-muse-v4.webp',
  guard: '/assets/npc-junction-guard-v3.webp',
  musician: '/assets/npc-wandering-musician-v3.webp',
  gatekeeper: '/assets/boss-gatekeeper-phase1-v2.webp',
};

// Cache tightly framed busts instead of squeezing padded full-body art into a square.
const portraitCache = new Map<string, Promise<string>>();
function preparePortrait(url: string): Promise<string> {
  if (!portraitCache.has(url)) portraitCache.set(url, (async () => {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width, top = canvas.height, right = 0, bottom = 0;
    for (let y = 0; y < canvas.height; y += 2) for (let x = 0; x < canvas.width; x += 2) {
      if (data[(y * canvas.width + x) * 4 + 3] < 100) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    const width = right - left + 1;
    const height = Math.min(bottom - top + 1, width * 1.2);
    canvas.width = 256; canvas.height = 308;
    ctx.drawImage(image, left, top, width, height, 0, 0, 256, 308);
    return canvas.toDataURL('image/png');
  })().catch(() => url));
  return portraitCache.get(url)!;
}

Object.values(PORTRAITS).forEach(url => { void preparePortrait(url); });

export function DialogueOverlay({ canvasParentRef }: DialogueOverlayProps) {
  const [dialog, setDialog] = useState<DialogPayload | null>(null);
  const [bounds, setBounds] = useState<OverlayBounds | null>(null);
  const [portraits, setPortraits] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    Object.values(PORTRAITS).forEach(url => {
      void preparePortrait(url).then(src => {
        if (mounted) setPortraits(previous => ({ ...previous, [url]: src }));
      });
    });
    const onDialog = (payload: DialogPayload | string) => {
      setDialog(typeof payload === 'string'
        ? { text: payload, speaker: 'FIELD TRANSMISSION', accent: '#ff7a2b' }
        : payload);
    };
    const onClear = () => setDialog(null);
    EventBus.on(EVENTS.DIALOG, onDialog);
    EventBus.on(EVENTS.DIALOG_CLEAR, onClear);
    return () => {
      mounted = false;
      EventBus.off(EVENTS.DIALOG, onDialog);
      EventBus.off(EVENTS.DIALOG_CLEAR, onClear);
    };
  }, []);

  useLayoutEffect(() => {
    const parent = canvasParentRef.current;
    if (!parent) return;

    const measure = () => {
      const canvas = parent.querySelector('canvas');
      if (!canvas) return;
      const stageRect = parent.parentElement?.getBoundingClientRect() ?? parent.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      if (canvasRect.width <= 0 || canvasRect.height <= 0) return;
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
    const canvas = parent.querySelector('canvas');
    if (canvas) resizeObserver.observe(canvas);
    window.addEventListener('resize', measure);
    measure();
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
            src={portraits[portraitUrl] ?? portraitUrl}
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
