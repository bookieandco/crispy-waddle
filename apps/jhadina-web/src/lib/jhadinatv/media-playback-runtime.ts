import type { MediaPlaybackStore, MediaQueueItem, UnifiedMediaSession } from '@jhadina/tv-core';
import { createMediaPlaybackStore } from '@jhadina/tv-core';

let store: MediaPlaybackStore | null = null;
let session: UnifiedMediaSession | null = null;
let unsubscribeSession: (() => void) | null = null;

export function getMediaPlaybackStore(): MediaPlaybackStore {
  if (!store) store = createMediaPlaybackStore();
  return store;
}

export function getMediaPlaybackSession(): UnifiedMediaSession | null {
  return session;
}

export function attachMediaPlaybackSession(nextSession: UnifiedMediaSession, item: MediaQueueItem): void {
  detachMediaPlaybackSession();
  session = nextSession;
  const playbackStore = getMediaPlaybackStore();
  playbackStore.setCurrent(item, 0);
  unsubscribeSession = nextSession.subscribe((state) => playbackStore.updatePlayerState(state));
  playbackStore.updatePlayerState(nextSession.getState());
}

export function detachMediaPlaybackSession(): void {
  unsubscribeSession?.();
  unsubscribeSession = null;
  session?.dispose();
  session = null;
}
