import { useEffect } from 'react';
import { EventBus, EVENTS, type NoticePayload } from '../game/EventBus';
import { useGameStore } from '../store/gameStore';

/** seenDialogs key: the tip is shown once per journey. Opening the menu first counts as seen. */
export const SETTINGS_TIP_KEY = 'tip-settings';

/** On a phone a notice covers the HUD; 'under-hud' sits below it instead, for a tip about its buttons. */
export type HudNotice = NoticePayload & { placement?: 'under-hud' };

/** How long a notice stays up when its payload does not say. */
export function noticeDuration(payload: NoticePayload): number {
  return payload.duration ?? (payload.variant === 'hero' ? 3200 : 2200);
}

/** Lets the world settle first: the zone banner, the new quest card or the welcome back. */
const FIRST_DELAY_MS = 2600;
const GAP_AFTER_NOTICE_MS = 900;
const DIALOG_RETRY_MS = 1200;
const TIP_DURATION_MS = 5200;

// Tracked from the start: the notices that end the intro or greet a continued
// journey are sent before the HUD (and this hook) mounts.
let noticeUntil = 0;
let dialogOpen = false;
EventBus.on(EVENTS.UI_NOTICE, (payload: NoticePayload) => { noticeUntil = performance.now() + noticeDuration(payload); });
EventBus.on(EVENTS.UI_NOTICE_CLEAR, () => { noticeUntil = 0; });
EventBus.on(EVENTS.DIALOG, () => { dialogOpen = true; });
EventBus.on(EVENTS.DIALOG_CLEAR, () => { dialogOpen = false; });

/**
 * Once the world is free to explore (the HUD is up), points out where the sound
 * settings are. It waits for any notice or conversation on screen to finish.
 */
export function useSettingsTip(): void {
  const seen = useGameStore(state => state.seenDialogs.includes(SETTINGS_TIP_KEY));

  useEffect(() => {
    if (seen) return;
    let timer = 0;
    const attempt = () => {
      const store = useGameStore.getState();
      if (store.seenDialogs.includes(SETTINGS_TIP_KEY)) return;
      const wait = dialogOpen ? DIALOG_RETRY_MS : noticeUntil + GAP_AFTER_NOTICE_MS - performance.now();
      if (wait > 0) {
        timer = window.setTimeout(attempt, wait);
        return;
      }
      const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      EventBus.emit(EVENTS.UI_NOTICE, {
        eyebrow: 'Tip',
        title: touch
          ? 'Tap the pause button to change music and sound volume.'
          : 'Press Esc or the pause button to change music and sound volume.',
        tone: 'info',
        duration: TIP_DURATION_MS,
        // The pause button it names is in the HUD: a phone must still show it.
        placement: 'under-hud',
      } satisfies HudNotice);
      store.markSeen(SETTINGS_TIP_KEY);
    };
    timer = window.setTimeout(attempt, FIRST_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [seen]);
}
