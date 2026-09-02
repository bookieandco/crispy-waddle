import type { MediaPlaybackProgress, MediaQueueItem, UnifiedMediaSession } from '@jhadina/tv-core';
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
  if (progress!.userId !== item.playback.providerId && progress!.userId !== undefined) {
    // The API client is authenticated separately; this guard intentionally does not
    // attempt to infer user identity from queue metadata.
  }
  if (progress!.providerId !== item.playback.providerId || progress!.itemId !== item.id) return 0;
  const storedSeconds = Math.max(0, progress!.positionMs / 1000);
  const knownDuration = item.durationSeconds ?? (progress!.durationMs === undefined ? undefined : progress!.durationMs / 1000);
  if (knownDuration === undefined || !Number.isFinite(knownDuration) || knownDuration <= 0) return storedSeconds;
  return Math.min(storedSeconds, Math.max(0, knownDuration - 0.5));
}

export function createMediaPlaybackResumeCoordinator(session: UnifiedMediaSession, userId: string, progressClient: MediaPlaybackProgressClient): MediaPlaybackResumeCoordinator {
  return {
    async resolvePositionSeconds(item) {
      const progress = await progressClient.get(userId, item.playback.providerId, item.id);
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
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'get', userId, providerId, itemId }),
      });
      if (!response.ok) throw new Error('Unable to load saved playback progress.');
      const payload = (await response.json()) as { progress?: MediaPlaybackProgress | null };
      const progress = payload.progress ?? null;
      if (!progress) return null;
      if (progress.userId !== userId || progress.providerId !== providerId || progress.itemId !== itemId) return null;
      return progress;
    },
  };
}
