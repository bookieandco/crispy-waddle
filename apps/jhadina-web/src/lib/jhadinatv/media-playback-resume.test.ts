import { describe, expect, it } from 'vitest';
import type { MediaPlaybackProgress, MediaQueueItem, UnifiedMediaSession } from '@jhadina/tv-core';
import { createMediaPlaybackResumeCoordinator, MEDIA_PLAYBACK_RESUME_CANCELLED } from './media-playback-resume';

function item(id: string, kind: MediaQueueItem['kind'] = 'movie'): MediaQueueItem {
  return {
    id,
    titleId: id,
    title: id,
    kind,
    playback: {
      providerId: 'direct',
      source: { id: `${id}-source`, titleId: id, kind: 'hls', url: `https://media.example/${id}.m3u8` },
      capabilities: ['playback', 'seek'],
    },
  };
}

function progress(id: string, positionMs: number): MediaPlaybackProgress {
  return {
    userId: 'user-1', providerId: 'direct', itemId: id,
    positionMs, durationMs: 120_000, completed: false, updatedAt: '2026-09-01T12:00:00.000Z',
  };
}

describe('media playback resume coordinator', () => {
  it('cancels a late resume fetch before session.loadPlayback', async () => {
    let resolveB: ((value: MediaPlaybackProgress | null) => void) | undefined;
    const loads: string[] = [];
    const session = {
      getAuthorityGeneration: () => 0,
      loadPlayback: async (playback: MediaQueueItem['playback'], _position: number, kind: MediaQueueItem['kind']) => {
        loads.push(`${playback.source.titleId}:${kind}`);
      },
    } as UnifiedMediaSession;
    const client = {
      get: (_userId: string, _providerId: string, id: string) => id === 'B'
        ? new Promise<MediaPlaybackProgress | null>((resolve) => { resolveB = resolve; })
        : Promise.resolve(progress(id, 7_000)),
    };
    const coordinator = createMediaPlaybackResumeCoordinator(session, 'user-1', client);

    const pendingB = coordinator.loadItem(item('B'));
    coordinator.cancelPending();
    resolveB!(progress('B', 9_000));

    await expect(pendingB).rejects.toThrow(MEDIA_PLAYBACK_RESUME_CANCELLED);
    expect(loads).toEqual([]);
  });

  it('fences an older load after a newer load becomes authoritative', async () => {
    let resolveB: ((value: MediaPlaybackProgress | null) => void) | undefined;
    const loads: string[] = [];
    const session = {
      getAuthorityGeneration: () => 0,
      loadPlayback: async (playback: MediaQueueItem['playback'], _position: number, kind: MediaQueueItem['kind']) => {
        loads.push(`${playback.source.titleId}:${kind}`);
      },
    } as UnifiedMediaSession;
    const client = {
      get: (_userId: string, _providerId: string, id: string) => id === 'B'
        ? new Promise<MediaPlaybackProgress | null>((resolve) => { resolveB = resolve; })
        : Promise.resolve(progress(id, 7_000)),
    };
    const coordinator = createMediaPlaybackResumeCoordinator(session, 'user-1', client);

    const pendingB = coordinator.loadItem(item('B'));
    const loadC = coordinator.loadItem(item('C', 'episode'));
    await expect(loadC).resolves.toBe(7);
    resolveB!(progress('B', 9_000));

    await expect(pendingB).rejects.toThrow(MEDIA_PLAYBACK_RESUME_CANCELLED);
    expect(loads).toEqual(['C:episode']);
  });

  it('cancels a resume when session authority changes while progress is loading', async () => {
    let authority = 11;
    let resolveB: ((value: MediaPlaybackProgress | null) => void) | undefined;
    const loads: string[] = [];
    const session = {
      getAuthorityGeneration: () => authority,
      loadPlayback: async (playback: MediaQueueItem['playback']) => {
        loads.push(playback.source.titleId);
      },
    } as UnifiedMediaSession;
    const client = {
      get: () => new Promise<MediaPlaybackProgress | null>((resolve) => { resolveB = resolve; }),
    };
    const coordinator = createMediaPlaybackResumeCoordinator(session, 'user-1', client);

    const pendingB = coordinator.loadItem(item('B'));
    authority = 12;
    resolveB!(progress('B', 9_000));

    await expect(pendingB).rejects.toThrow(MEDIA_PLAYBACK_RESUME_CANCELLED);
    expect(loads).toEqual([]);
  });

  it('allows a legitimate resume when session authority remains unchanged', async () => {
    const loads: Array<{ id: string; position: number }> = [];
    const session = {
      getAuthorityGeneration: () => 7,
      loadPlayback: async (playback: MediaQueueItem['playback'], position: number) => {
        loads.push({ id: playback.source.titleId, position });
      },
    } as UnifiedMediaSession;
    const coordinator = createMediaPlaybackResumeCoordinator(session, 'user-1', {
      get: async () => progress('A', 8_000),
    });

    await expect(coordinator.loadItem(item('A'))).resolves.toBe(8);
    expect(loads).toEqual([{ id: 'A', position: 8 }]);
  });
});
