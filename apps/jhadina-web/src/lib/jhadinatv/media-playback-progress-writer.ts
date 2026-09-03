import type { MediaPlaybackProgress, MediaPlaybackStore, MediaQueueItem, UnifiedMediaSession } from '@jhadina/tv-core';
import { configureMediaPlaybackProgressPersistence, flushMediaPlaybackProgress, getMediaPlaybackStore } from './media-playback-runtime';
import type { RuntimeProgressClient, RuntimeProgressPersistence } from './media-playback-progress-runtime';

export interface MediaPlaybackProgressWriterClient extends RuntimeProgressClient {}
export interface MediaPlaybackProgressWriter { flush(completed?: boolean): Promise<void>; dispose(): void; }
export interface MediaPlaybackProgressWriterDeps {
  /** Retained for API compatibility. Runtime persistence no longer owns this element. */
  video: HTMLVideoElement;
  session: UnifiedMediaSession;
  item?: MediaQueueItem;
  store?: MediaPlaybackStore;
  userId: string;
  client: MediaPlaybackProgressWriterClient;
  throttleMs?: number;
  onError?: (error: unknown) => void;
}

export function createMediaPlaybackProgressApiClient(fetchImpl: typeof fetch = fetch): MediaPlaybackProgressWriterClient {
  return {
    async upsert(progress: MediaPlaybackProgress) {
      const response = await fetchImpl('/api/media/progress', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'upsert', userId: progress.userId, providerId: progress.providerId, itemId: progress.itemId, progress }),
      });
      if (!response.ok) throw new Error('Unable to save playback progress.');
      const payload = (await response.json()) as { progress?: MediaPlaybackProgress };
      if (!payload.progress) throw new Error('Playback progress save returned no record.');
      return payload.progress;
    },
  };
}

/**
 * Compatibility facade for older watch routes. The actual observer is now
 * attached to the runtime-owned session, so route unmounts cannot stop
 * persistence while playback continues in the global player.
 */
export function attachMediaPlaybackProgressWriter({ userId, client, throttleMs, onError }: MediaPlaybackProgressWriterDeps): MediaPlaybackProgressWriter {
  const persistence: RuntimeProgressPersistence | null = configureMediaPlaybackProgressPersistence({ userId, client, throttleMs, onError });
  return {
    flush: persistence ? (completed = false) => persistence.flush(completed) : flushMediaPlaybackProgress,
    dispose: () => undefined,
  };
}

/** @deprecated Use getMediaPlaybackStore() from the runtime directly. */
export function getPlaybackProgressStore(): MediaPlaybackStore {
  return getMediaPlaybackStore();
}
