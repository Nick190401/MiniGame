import { useEffect, useState, type CSSProperties, type RefObject } from 'react';
import { EventBus, EVENTS, type DialogPayload } from '../game/EventBus';
import { useCanvasBounds } from './useCanvasBounds';

interface DialogueOverlayProps {
  canvasParentRef: RefObject<HTMLDivElement | null>;
}

const PORTRAITS: Partial<Record<NonNullable<DialogPayload['portrait']>, string>> = {
  elder: 'assets/characters/professor/bust.webp',
  guard: 'assets/characters/guard/bust.webp',
  musician: 'assets/characters/musician/bust.webp',
  gatekeeper: 'assets/battle/gatekeeper-phase1.webp',
};

// Remove transparent margins while preserving the complete character and its proportions.
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
    if (right < left || bottom < top) return url;
    // Include the pixels between samples at the right and bottom edges.
    const width = Math.min(canvas.width - left, right - left + 2);
    const height = Math.min(canvas.height - top, bottom - top + 2);
    const scale = Math.min(256 / width, 308 / height);
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    ctx.drawImage(image, left, top, width, height, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  })().catch(() => url));
  return portraitCache.get(url)!;
}

Object.values(PORTRAITS).forEach(url => { void preparePortrait(url); });

/** Lines without a speaker are narration and carry no name tag. */
const NARRATOR = 'FIELD TRANSMISSION';

/** Story data shouts a few names in capitals; the tag reads them in title case. */
function displayName(speaker: string): string {
  if (speaker !== speaker.toUpperCase()) return speaker;
  return speaker.toLowerCase().replace(/(^|\s)\S/g, letter => letter.toUpperCase());
}

export function DialogueOverlay({ canvasParentRef }: DialogueOverlayProps) {
  const bounds = useCanvasBounds(canvasParentRef);
  const [dialog, setDialog] = useState<DialogPayload | null>(null);
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
        ? { text: payload, speaker: NARRATOR, accent: '#ff7a2b' }
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

  if (!dialog || !bounds) return null;
  const portraitUrl = dialog.portrait ? PORTRAITS[dialog.portrait] : undefined;
  const speaker = dialog.speaker && dialog.speaker !== NARRATOR ? displayName(dialog.speaker) : null;
  const classes = ['dialogue'];
  if (portraitUrl) classes.push('has-portrait');
  if (dialog.portrait === 'gatekeeper') classes.push('is-gatekeeper');

  return (
    <div className="ui-layer dialogue-layer" style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}>
      <aside
        className={classes.join(' ')}
        style={{ '--dialog-accent': dialog.accent } as CSSProperties}
        role="status"
        aria-live="polite"
      >
        {portraitUrl && (
          <div className="dialogue__portrait" aria-hidden="true">
            <img src={portraits[portraitUrl] ?? portraitUrl} alt="" draggable={false} />
          </div>
        )}
        <div className="dialogue__body">
          {speaker && <p className="dialogue__name">{speaker}</p>}
          <p className="dialogue__text">{dialog.text}</p>
          <p className="dialogue__continue" aria-hidden="true">
            <span className="hint-desktop"><kbd className="keycap">E</kbd> Continue</span>
            <span className="hint-touch">Tap to continue</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </p>
        </div>
      </aside>
    </div>
  );
}
