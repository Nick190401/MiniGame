import { useEffect, useRef, useState } from 'react';
import { EventBus, EVENTS } from '../game/EventBus';
import {
  MobileInput,
  queueMobileAction,
  resetMobileInput,
  type MobileDirection,
} from '../game/input/MobileInput';
import { useTr } from '../i18n';

type Direction = MobileDirection;

const DIRECTIONS: Direction[] = ['up', 'right', 'down', 'left'];

export function MobileControls() {
  const t = useTr();
  const [visible, setVisible] = useState(false);
  const [activeDirection, setActiveDirection] = useState<Direction | null>(null);
  const [dialogActive, setDialogActive] = useState(false);
  const activeDirectionRef = useRef<Direction | null>(null);
  const movementPointerRef = useRef<number | null>(null);
  const dpadRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  const applyDirection = (direction: Direction | null, haptic = false) => {
    if (activeDirectionRef.current === direction) return;

    (Object.keys(MobileInput) as Direction[]).forEach(key => {
      MobileInput[key] = key === direction;
    });
    activeDirectionRef.current = direction;
    setActiveDirection(direction);

    if (direction && haptic) navigator.vibrate?.(5);
  };

  const releaseMovement = () => {
    movementPointerRef.current = null;
    applyDirection(null);
  };

  useEffect(() => {
    const coarsePointer = window.matchMedia('(pointer: coarse)');
    const updateVisibility = () => setVisible(coarsePointer.matches || navigator.maxTouchPoints > 0);
    const onTouch = () => setVisible(true);
    const releaseControls = () => {
      resetMobileInput();
      activeDirectionRef.current = null;
      movementPointerRef.current = null;
      setActiveDirection(null);
    };

    updateVisibility();
    coarsePointer.addEventListener?.('change', updateVisibility);
    window.addEventListener('touchstart', onTouch, { once: true });
    window.addEventListener('blur', releaseControls);
    document.addEventListener('visibilitychange', releaseControls);
    return () => {
      resetMobileInput();
      coarsePointer.removeEventListener?.('change', updateVisibility);
      window.removeEventListener('touchstart', onTouch);
      window.removeEventListener('blur', releaseControls);
      document.removeEventListener('visibilitychange', releaseControls);
    };
  }, []);

  useEffect(() => {
    const showDialogAction = () => setDialogActive(true);
    const hideDialogAction = () => setDialogActive(false);
    EventBus.on(EVENTS.DIALOG, showDialogAction);
    EventBus.on(EVENTS.DIALOG_CLEAR, hideDialogAction);
    return () => {
      EventBus.off(EVENTS.DIALOG, showDialogAction);
      EventBus.off(EVENTS.DIALOG_CLEAR, hideDialogAction);
    };
  }, []);

  // Publish how much of the screen bottom the controls cover, so the dialogue
  // box can sit above them on an upright phone.
  useEffect(() => {
    if (!visible) return;
    const publish = () => {
      const tops = [dpadRef.current, actionRef.current]
        .filter((el): el is HTMLDivElement | HTMLButtonElement => el !== null)
        .map(el => el.getBoundingClientRect().top);
      if (!tops.length) return;
      const viewportBottom = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--touch-controls-h', `${Math.max(0, Math.round(viewportBottom - Math.min(...tops)))}px`);
    };
    publish();
    const observer = new ResizeObserver(publish);
    if (dpadRef.current) observer.observe(dpadRef.current);
    window.addEventListener('resize', publish);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', publish);
      document.documentElement.style.removeProperty('--touch-controls-h');
    };
  }, [visible]);

  if (!visible) return null;

  const resolveDirection = (
    event: React.PointerEvent<HTMLDivElement>,
  ): Direction | null => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left - bounds.width / 2;
    const y = event.clientY - bounds.top - bounds.height / 2;
    const deadZone = Math.min(bounds.width, bounds.height) * 0.16;

    if (Math.hypot(x, y) < deadZone) return null;
    if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left';
    return y > 0 ? 'down' : 'up';
  };

  const beginMovement = (event: React.PointerEvent<HTMLDivElement>) => {
    if (movementPointerRef.current !== null) return;
    event.preventDefault();
    movementPointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    applyDirection(resolveDirection(event), true);
  };

  const updateMovement = (event: React.PointerEvent<HTMLDivElement>) => {
    if (movementPointerRef.current !== event.pointerId) return;
    event.preventDefault();
    applyDirection(resolveDirection(event), true);
  };

  const endMovement = (event: React.PointerEvent<HTMLDivElement>) => {
    if (movementPointerRef.current !== event.pointerId) return;
    event.preventDefault();
    releaseMovement();
  };

  const triggerAction = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    queueMobileAction();
    navigator.vibrate?.(12);
  };

  return (
    <>
      <div
        ref={dpadRef}
        className="touch-dpad"
        data-direction={activeDirection ?? 'idle'}
        role="group"
        aria-label={t('Movement pad')}
        onPointerDown={beginMovement}
        onPointerMove={updateMovement}
        onPointerUp={endMovement}
        onPointerCancel={endMovement}
        onLostPointerCapture={releaseMovement}
        onContextMenu={event => event.preventDefault()}
      >
        <span className="touch-dpad__thumb" aria-hidden="true" />
        {DIRECTIONS.map((direction) => (
          <span
            key={direction}
            className={`touch-dpad__arrow touch-dpad__arrow--${direction}${activeDirection === direction ? ' is-active' : ''}`}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 14 6-6 6 6" />
            </svg>
          </span>
        ))}
      </div>
      <button
        ref={actionRef}
        type="button"
        className={`touch-action${dialogActive ? ' is-dialog' : ''}`}
        aria-label={t(dialogActive ? 'Continue dialogue' : 'Interact')}
        onPointerDown={triggerAction}
        onContextMenu={event => event.preventDefault()}
      >
        <span className="touch-action__key" aria-hidden="true">A</span>
        <span className="touch-action__label" aria-hidden="true">{t(dialogActive ? 'Next' : 'Interact')}</span>
      </button>
    </>
  );
}
