import { useEffect, useRef, useState } from 'react';
import { EventBus, EVENTS } from '../game/EventBus';
import {
  MobileInput,
  queueMobileAction,
  resetMobileInput,
  type MobileDirection,
} from '../game/input/MobileInput';

type Direction = MobileDirection;

const ARROWS: Record<Direction, string> = {
  up: '\u2191',
  right: '\u2192',
  down: '\u2193',
  left: '\u2190',
};

export function MobileControls() {
  const [visible, setVisible] = useState(false);
  const [activeDirection, setActiveDirection] = useState<Direction | null>(null);
  const [dialogActive, setDialogActive] = useState(false);
  const activeDirectionRef = useRef<Direction | null>(null);
  const movementPointerRef = useRef<number | null>(null);

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
      <div className="mobile-control-wrap" aria-label="Movement controls">
        <div className="mobile-control-label"><span>Signal pad</span><small>4-way input</small></div>
        <div
          className={`mobile-dpad${activeDirection ? ' is-engaged' : ''}`}
          data-direction={activeDirection ?? 'idle'}
          role="group"
          aria-label="Four-way movement pad"
          onPointerDown={beginMovement}
          onPointerMove={updateMovement}
          onPointerUp={endMovement}
          onPointerCancel={endMovement}
          onLostPointerCapture={releaseMovement}
          onContextMenu={event => event.preventDefault()}
        >
          <div className="mobile-dpad__ring" />
          {(Object.keys(ARROWS) as Direction[]).map((direction) => (
            <button
              key={direction}
              type="button"
              className={`mobile-dpad__button mobile-dpad__button--${direction}${activeDirection === direction ? ' is-active' : ''}`}
              aria-label={`Move ${direction}`}
              tabIndex={-1}
            >
              <span aria-hidden="true">{ARROWS[direction]}</span>
            </button>
          ))}
          <div className={`mobile-dpad__core ${activeDirection ? 'is-active' : ''}`}>
            <i />
            <span>{activeDirection ? ARROWS[activeDirection] : 'SQ'}</span>
            <small>{activeDirection ? 'MOVE' : 'NAV'}</small>
          </div>
        </div>
      </div>
      <div className={`mobile-action-wrap${dialogActive ? ' is-dialog' : ''}`}>
        <button
          className="mobile-action"
          aria-label={dialogActive ? 'Continue dialogue' : 'Interact'}
          onPointerDown={triggerAction}
          onContextMenu={event => event.preventDefault()}
        >
          <strong>A</strong>
          <span>{dialogActive ? 'Next' : 'Action'}</span>
        </button>
      </div>
    </>
  );
}
