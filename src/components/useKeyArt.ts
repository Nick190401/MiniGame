import { useEffect, useState } from 'react';
import { paintKeyArt } from '../game/art/keyArt';

const PORTRAIT_QUERY = '(max-width: 760px) and (orientation: portrait)';
const cache = new Map<'landscape' | 'portrait', string>();

function artFor(layout: 'landscape' | 'portrait'): string {
  const cached = cache.get(layout);
  if (cached) return cached;
  const canvas = layout === 'portrait'
    ? paintKeyArt({ width: 1080, height: 1920 })
    : paintKeyArt({ width: 1920, height: 1080 });
  const url = canvas.toDataURL('image/jpeg', 0.9);
  cache.set(layout, url);
  return url;
}

/**
 * The painted key art as an image URL, rendered after first paint so the
 * title never blocks on it. Follows the phone's orientation.
 */
export function useKeyArt(): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    const layout = window.matchMedia(PORTRAIT_QUERY).matches ? 'portrait' : 'landscape';
    return cache.get(layout) ?? null;
  });

  useEffect(() => {
    const media = window.matchMedia(PORTRAIT_QUERY);
    let cancelled = false;
    const render = () => {
      const layout = media.matches ? 'portrait' : 'landscape';
      const cached = cache.get(layout);
      if (cached) { setUrl(cached); return; }
      // Yield first so the title chrome paints before the artwork is drawn.
      window.setTimeout(() => { if (!cancelled) setUrl(artFor(layout)); }, 30);
    };
    render();
    media.addEventListener('change', render);
    return () => { cancelled = true; media.removeEventListener('change', render); };
  }, []);

  return url;
}
