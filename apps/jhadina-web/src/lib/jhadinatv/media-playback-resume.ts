import type { MediaPlaybackProgress, MediaPlaybackStore, MediaQueueItem, UnifiedMediaSession } from '@jhadina/tv-core';
import { isMeaningfulResume } from '@jhadina/tv-core';

export interface MediaPlaybackProgressClient {
  get(userId: string, providerId: string, itemId: string): Promise<MediaPlaybackProgress | null>;
}

export interface MediaPlaybackResumeCoordinator {
  resolvePositionSeconds(item: MediaQueueItem): Promise<number>;
  loadItem(item: MediaQueueItem): Promise<number>;
}

function clampResumeSeconds(progress: MediaPlaybackProgress | null, item: MediaQueueItem): number {
  if (!isMeaningfulResume(progress)) return 0;

  const storedSeconds = Math.max(0, progress!.positionMs / 1000);
  const knownDuration = item.durationSeconds ?? (progress!.durationMs === undefined ? undefined : progress!.durationMs / 1000);
  if (knownDuration === undefined || !Number.isFinite(knownDuration) || knownDuration <= 0) return storedSeconds;

  // Never resume at the terminal edge; an end-state should advance rather than
  // immediately firing ended again. Leave a small safety margin for rounding.
  return Math.min(storedSeconds, Math.max(0, knownDuration - 0.5));
}

export function createMediaPlaybackResumeCoordinator(
  session: UnifiedMediaSession,
  progressClient: MediaPlaybackProgressClient,
): MediaPlaybackResumeCoordinator {
  return {
    async resolvePositionSeconds(item) {
      const progress = await progressClient.get(item.playback.providerId, item.playback.providerId, item.id);
      return clampResumeSeconds(progress, item);
    },
    async loadItem(item) {
      const positionSeconds = await this.resolvePositionSeconds(item);
      await session.loadPlayback(item.playback, positionSeconds);
      return positionSeconds;
    },
  };
}

export function createMediaPlaybackApiClient(fetchImpl: typeof fetch = fetch): MediaPlaybackProgressClient {
  return {
    async get(userId, providerId, itemId) {
      const response = await fetchImpl('/api/media/progress', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'get', userId, providerId, itemId }),
      });
      if (!response.ok) throw new Error('Unable to load saved playback progress.');
      const payload = (await response.json()) as { progress?: MediaPlaybackProgress | null };
      return payload.progress ?? null;
    },
  };
}
