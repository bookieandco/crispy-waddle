import type { MediaPlaybackProgress, MediaQueueItem, UnifiedMediaSession } from '@jhadina/tv-core';
import { isMeaningfulResume } from '@jhadina/tv-core';

export const MEDIA_PLAYBACK_RESUME_CANCELLED = 'JHADINA_MEDIA_PLAYBACK_RESUME_CANCELLED';

export interface MediaPlaybackProgressClient {
  get(userId: string, providerId: string, itemId: string): Promise<MediaPlaybackProgress | null>;
}

export interface MediaPlaybackResumeCoordinator {
  resolvePositionSeconds(item: MediaQueueItem): Promise<number>;
  loadItem(item: MediaQueueItem): Promise<number>;
  cancelPending(): void;
}

function clampResumeSeconds(progress: MediaPlaybackProgress | null, item: MediaQueueItem): number {
  if (!isMeaningfulResume(progress)) return 0;
  if (progress!.providerId !== item.playback.providerId || progress!.itemId !== item.id) return 0;
  const storedSeconds = Math.max(0, progress!.positionMs / 1000);
  const knownDuration = item.durationSeconds ?? (progress!.durationMs === undefined ? undefined : progress!.durationMs / 1000);
  if (knownDuration === undefined || !Number.isFinite(knownDuration) || knownDuration <= 0) return storedSeconds;
  return Math.min(storedSeconds, Math.max(0, knownDuration - 0.5));
}

export function createMediaPlaybackResumeCoordinator(session: UnifiedMediaSession, userId: string, progressClient: MediaPlaybackProgressClient): MediaPlaybackResumeCoordinator {
  let loadGeneration = 0;

  const assertCurrent = (generation: number): void => {
    if (generation !== loadGeneration) throw new Error(MEDIA_PLAYBACK_RESUME_CANCELLED);
  };

  return {
    async resolvePositionSeconds(item) {
      const progress = await progressClient.get(userId, item.playback.providerId, item.id);
      return clampResumeSeconds(progress, item);
    },
    async loadItem(item) {
      const generation = ++loadGeneration;
      const authority = session.getAuthorityGeneration();
      const progress = await progressClient.get(userId, item.playback.providerId, item.id);
      assertCurrent(generation);
      if (session.getAuthorityGeneration() !== authority) {
        throw new Error(MEDIA_PLAYBACK_RESUME_CANCELLED);
      }
      const positionSeconds = clampResumeSeconds(progress, item);
      await session.loadPlayback(item.playback, positionSeconds, item.kind);
      assertCurrent(generation);
      return positionSeconds;
    },
    cancelPending() {
      loadGeneration += 1;
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
