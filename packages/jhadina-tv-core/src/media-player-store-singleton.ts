import type { MediaSessionSnapshot } from './media-domain';
import type { MediaPlayerStore, MediaPlayerStoreOptions } from './media-player-store';
import { createMediaPlayerStore } from './media-player-store';

let browserStore: MediaPlayerStore | undefined;

/**
 * Returns the process-local browser player store. SSR deliberately returns a
 * fresh store so server requests cannot share playback state.
 */
export function getBrowserMediaPlayerStore(
  initial?: Partial<MediaSessionSnapshot>,
  options?: MediaPlayerStoreOptions,
): MediaPlayerStore {
  if (typeof window === 'undefined') return createMediaPlayerStore(initial, options);
  if (!browserStore) browserStore = createMediaPlayerStore(initial, options);
  return browserStore;
}

export function resetBrowserMediaPlayerStore(): void {
  if (typeof window !== 'undefined') browserStore = undefined;
}
