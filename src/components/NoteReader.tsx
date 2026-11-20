import { useEffect, useRef, useState, type RefObject } from 'react';
import { EventBus, EVENTS, type NotePayload } from '../game/EventBus';
import { SOUND_LAB_NOTE_URL } from '../game/assets/InteriorArt';
import { useTr } from '../i18n';
import { useCanvasBounds } from './useCanvasBounds';

interface NoteReaderProps {
  canvasParentRef: RefObject<HTMLDivElement | null>;
}

/**
 * The reading view for a note found in the world: the painted sheet held up
 * close, with the writing set on it. The scene owns the note: it opens and
 * closes it and keeps the keys (E, Space, Enter, Esc, the A button). A tap
 * here only asks it to put the note down.
 */
export function NoteReader({ canvasParentRef }: NoteReaderProps) {
  const bounds = useCanvasBounds(canvasParentRef);
  const t = useTr();
  const [note, setNote] = useState<NotePayload | null>(null);
  const [plainPaper, setPlainPaper] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const pressOnLayerRef = useRef(false);

  useEffect(() => {
    const onNote = (payload: NotePayload | null) => {
      pressOnLayerRef.current = false;
      setNote(payload);
    };
    EventBus.on(EVENTS.NOTE_UI_STATE, onNote);
    return () => {
      EventBus.off(EVENTS.NOTE_UI_STATE, onNote);
    };
  }, []);

  // Assistive tech starts on the note. Focus leaves with it, so Space and
  // Enter go back to the game rather than to a stale element.
  useEffect(() => {
    if (!note) return;
    const sheet = sheetRef.current;
    sheet?.focus({ preventScroll: true });
    return () => {
      if (sheet?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    };
  }, [note]);

  if (!note || !bounds) return null;

  return (
    <div
      className="ui-layer note-layer"
      style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}
      onPointerDown={() => { pressOnLayerRef.current = true; }}
      onClick={() => {
        // Only a press that began here closes the note: not the click a touch
        // browser sends after the tap on the A button that opened it.
        if (!pressOnLayerRef.current) return;
        pressOnLayerRef.current = false;
        EventBus.emit(EVENTS.NOTE_UI_ACTION);
      }}
    >
      <div
        ref={sheetRef}
        className={`note-sheet${plainPaper ? ' is-plain' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-reader-title"
        tabIndex={-1}
      >
        {!plainPaper && (
          <img
            className="note-sheet__paper"
            src={SOUND_LAB_NOTE_URL}
            alt=""
            draggable={false}
            onError={() => setPlainPaper(true)}
          />
        )}
        <div className="note-sheet__writing">
          <h2 id="note-reader-title" className="note-sheet__title">{t(note.title)}</h2>
          {note.lines.map(line => <p key={line} className="note-sheet__line">{t(line)}</p>)}
          <p className="note-sheet__signature">{t(note.signature)}</p>
          {note.postscript && <p className="note-sheet__postscript">{t(note.postscript)}</p>}
        </div>
      </div>
      <p className="note-layer__hint" aria-hidden="true">
        <span className="hint-desktop"><kbd className="keycap">E</kbd> {t('Close')}</span>
        <span className="hint-touch">{t('Tap to close')}</span>
      </p>
    </div>
  );
}
