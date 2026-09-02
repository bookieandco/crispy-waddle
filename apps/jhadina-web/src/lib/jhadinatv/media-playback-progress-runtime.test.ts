import { describe, expect, it, vi } from 'vitest';
import type { MediaPlaybackProgress, MediaQueueItem, MediaSessionState, UnifiedMediaSession } from '@jhadina/tv-core';
import { attachRuntimeProgressPersistence } from './media-playback-progress-runtime';

const listeners = new Map<string, Set<() => void>>();
const fakeWindow = {
  addEventListener(type: string, listener: () => void) {
    const bucket = listeners.get(type) ?? new Set<() => void>();
    bucket.add(listener);
    listeners.set(type, bucket);
  },
  removeEventListener(type: string, listener: () => void) { listeners.get(type)?.delete(listener); },
};
const fakeDocument = {
  visibilityState: 'visible',
  addEventListener(type: string, listener: () => void) {
    const bucket = listeners.get(`document:${type}`) ?? new Set<() => void>();
    bucket.add(listener);
    listeners.set(`document:${type}`, bucket);
  },
  removeEventListener(type: string, listener: () => void) { listeners.get(`document:${type}`)?.delete(listener); },
};

globalThis.window = fakeWindow as unknown as Window & typeof globalThis;
globalThis.document = fakeDocument as unknown as Document;

const item = (id: string): MediaQueueItem => ({
  id,
  titleId: id,
  title: id,
  kind: 'movie',
  playback: {
    providerId: 'direct',
    source: { id: `source:${id}`, titleId: id, kind: 'hls', url: `https://example.com/${id}.m3u8` },
    capabilities: ['playback', 'seek'],
  },
});

function fakeSession(initial: MediaSessionState) {
  let state = initial;
  const subscriptions = new Set<(next: MediaSessionState) => void>();
  const session = {
    getState: () => state,
    subscribe: (listener: (next: MediaSessionState) => void) => { subscriptions.add(listener); return () => subscriptions.delete(listener); },
    emit: (next: MediaSessionState) => { state = next; subscriptions.forEach((listener) => listener(next)); },
  } as unknown as UnifiedMediaSession & { emit(next: MediaSessionState): void };
  return session;
}

describe('runtime-owned media playback progress', () => {
  it('persists on pause without a video element', async () => {
    const session = fakeSession({ titleId: 'one', kind: 'movie', sourceUrl: 'https://example.com/one.m3u8', positionSeconds: 18, durationSeconds: 120, playing: true });
    const writes: MediaPlaybackProgress[] = [];
    const client = { upsert: vi.fn(async (progress: MediaPlaybackProgress) => { writes.push(progress); return progress; }) };
    const persistence = attachRuntimeProgressPersistence({ session, getCurrentItem: () => item('one'), userId: 'user-a', client });

    session.emit({ titleId: 'one', kind: 'movie', sourceUrl: 'https://example.com/one.m3u8', positionSeconds: 19, durationSeconds: 120, playing: false });
    await persistence.flush();

    expect(client.upsert).toHaveBeenCalledTimes(1);
    expect(writes[0]).toMatchObject({ userId: 'user-a', providerId: 'direct', itemId: 'one', positionMs: 19000, completed: false });
    persistence.dispose();
  });

  it('marks a stopped state at the end of duration as completed', async () => {
    const session = fakeSession({ titleId: 'one', kind: 'movie', sourceUrl: 'https://example.com/one.m3u8', positionSeconds: 119.8, durationSeconds: 120, playing: true });
    const client = { upsert: vi.fn(async (progress: MediaPlaybackProgress) => progress) };
    const persistence = attachRuntimeProgressPersistence({ session, getCurrentItem: () => item('one'), userId: 'user-a', client });

    session.emit({ titleId: 'one', kind: 'movie', sourceUrl: 'https://example.com/one.m3u8', positionSeconds: 120, durationSeconds: 120, playing: false });
    await persistence.flush();

    expect(client.upsert).toHaveBeenCalledWith(expect.objectContaining({ completed: true, positionMs: 120000 }));
    persistence.dispose();
  });

  it('keeps the persistence observer alive independently of route/view lifetime', async () => {
    const session = fakeSession({ titleId: 'one', kind: 'movie', sourceUrl: 'https://example.com/one.m3u8', positionSeconds: 10, durationSeconds: 120, playing: true });
    const client = { upsert: vi.fn(async (progress: MediaPlaybackProgress) => progress) };
    const persistence = attachRuntimeProgressPersistence({ session, getCurrentItem: () => item('one'), userId: 'user-a', client });

    session.emit({ titleId: 'one', kind: 'movie', sourceUrl: 'https://example.com/one.m3u8', positionSeconds: 11, durationSeconds: 120, playing: true });
    session.emit({ titleId: 'one', kind: 'movie', sourceUrl: 'https://example.com/one.m3u8', positionSeconds: 12, durationSeconds: 120, playing: false });
    await persistence.flush();

    expect(client.upsert).toHaveBeenCalled();
    persistence.dispose();
  });

  it('does not persist an old item snapshot under the next queue item during navigation', async () => {
    const session = fakeSession({ titleId: 'one', kind: 'movie', sourceUrl: 'https://example.com/one.m3u8', positionSeconds: 30, durationSeconds: 120, playing: true });
    let current = item('one');
    let releaseFirstWrite: (() => void) | undefined;
    const firstWrite = new Promise<void>((resolve) => { releaseFirstWrite = resolve; });
    const writes: MediaPlaybackProgress[] = [];
    const client = {
      upsert: vi.fn(async (progress: MediaPlaybackProgress) => {
        writes.push(progress);
        if (writes.length === 1) await firstWrite;
        return progress;
      }),
    };
    const persistence = attachRuntimeProgressPersistence({ session, getCurrentItem: () => current, userId: 'user-a', client });

    session.emit({ titleId: 'one', kind: 'movie', sourceUrl: 'https://example.com/one.m3u8', positionSeconds: 31, durationSeconds: 120, playing: false });
    current = item('two');
    session.emit({ titleId: 'two', kind: 'movie', sourceUrl: 'https://example.com/two.m3u8', positionSeconds: 7, durationSeconds: 90, playing: false });

    releaseFirstWrite!();
    await persistence.flush();

    expect(writes).toHaveLength(2);
    expect(writes[0]).toMatchObject({ itemId: 'one', positionMs: 31000 });
    expect(writes[1]).toMatchObject({ itemId: 'two', positionMs: 7000 });
    persistence.dispose();
  });
});
