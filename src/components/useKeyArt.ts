import { useEffect, useState } from 'react';
import { paintKeyArt } from '../game/art/keyArt';

const PORTRAIT_QUERY = '(max-width: 760px) and (orientation: portrait)';
const HEROES = ['professor', 'musician', 'guard', 'player'] as const;
const cache = new Map<'landscape' | 'portrait', string>();

let heroBacks: Promise<HTMLImageElement[]> | null = null;
/** The heroes' painted back views; the art is painted without them if one fails to load. */
function loadHeroes(): Promise<HTMLImageElement[]> {
  heroBacks ??= Promise.all(HEROES.map(id => {
    const image = new Image();
    image.src = `assets/characters/${id}/up-0.webp`;
    return image.decode().then(() => image);
  })).catch(() => []);
  return heroBacks;
}

function artFor(layout: 'landscape' | 'portrait', figures: HTMLImageElement[]): string {
  const cached = cache.get(layout);
  if (cached) return cached;
  const canvas = layout === 'portrait'
    ? paintKeyArt({ width: 1080, height: 1920, figures })
    : paintKeyArt({ width: 1920, height: 1080, figures });
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
      // The title chrome paints first; the artwork follows once the heroes have loaded.
      void loadHeroes().then(figures => { if (!cancelled) setUrl(artFor(layout, figures)); });
    };
    render();
    media.addEventListener('change', render);
    return () => { cancelled = true; media.removeEventListener('change', render); };
  }, []);

  return url;
}
