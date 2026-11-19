import { useEffect, useState } from 'react';

const PORTRAIT_QUERY = '(max-width: 760px) and (orientation: portrait)';

/** Hand-painted title artwork, framed for wide screens and for phones held upright. */
const KEY_ART = {
  landscape: 'assets/title/keyart-landscape.webp',
  portrait: 'assets/title/keyart-portrait.webp',
} as const;

const decoded = new Set<string>();

const urlFor = (portrait: boolean) => KEY_ART[portrait ? 'portrait' : 'landscape'];

/**
 * The title key art for the current orientation, handed out once it has
 * decoded so the title fades it in whole instead of drawing it top-down.
 * Follows the phone's orientation.
 */
export function useKeyArt(): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    const next = urlFor(window.matchMedia(PORTRAIT_QUERY).matches);
    return decoded.has(next) ? next : null;
  });

  useEffect(() => {
    const media = window.matchMedia(PORTRAIT_QUERY);
    let cancelled = false;
    const show = () => {
      const next = urlFor(media.matches);
      if (decoded.has(next)) { setUrl(next); return; }
      const image = new Image();
      image.src = next;
      // Without the art the title keeps its dark backdrop; nothing else depends on it.
      void image.decode().then(() => {
        decoded.add(next);
        if (!cancelled) setUrl(next);
      }).catch(() => {});
    };
    show();
    media.addEventListener('change', show);
    return () => { cancelled = true; media.removeEventListener('change', show); };
  }, []);

  return url;
}
