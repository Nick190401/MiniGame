import { BOOT_URLS } from './AssetStream';

/**
 * Downloads the loading screen's files while the player is still on the
 * title screen, so pressing start mostly skips that wait. PreloadScene then
 * reads each file from memory (a blob: URL) instead of the network.
 */

const CONCURRENCY = 6;
const blobUrls = new Map<string, string>();
const listeners = new Set<(progress: number) => void>();
let run: Promise<void> | null = null;

export function prefetchBootAssets(): Promise<void> {
  if (run) return run;
  const queue = [...BOOT_URLS];
  const worker = async () => {
    for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
      try {
        const response = await fetch(url);
        if (response.ok) blobUrls.set(url, URL.createObjectURL(await response.blob()));
      } catch {
        // PreloadScene requests it again and reports a failure as before.
      }
      const progress = bootPrefetchProgress();
      listeners.forEach(listener => listener(progress));
    }
  };
  run = Promise.all(Array.from({ length: CONCURRENCY }, worker)).then(() => undefined);
  return run;
}

/**
 * 0..1 share of the boot files already in memory; 0 before the prefetch
 * starts. Failed files don't count, so PreloadScene's own download of them
 * still moves the loading bar.
 */
export function bootPrefetchProgress(): number {
  return BOOT_URLS.length ? blobUrls.size / BOOT_URLS.length : 1;
}

export function onBootPrefetchProgress(listener: (progress: number) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The in-memory copy of a boot file when the prefetch has it, else the file's own URL. */
export function bootAssetUrl(url: string): string {
  return blobUrls.get(url) ?? url;
}

/** Frees the in-memory copies once Phaser has loaded them. */
export function releaseBootPrefetch(): void {
  blobUrls.forEach(blobUrl => URL.revokeObjectURL(blobUrl));
  blobUrls.clear();
}
