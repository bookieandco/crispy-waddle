import { describe, expect, it, vi } from 'vitest';
import type { MediaPlaybackStore, MediaQueueItem, UnifiedMediaSession } from '@jhadina/tv-core';
import { attachMediaPlaybackAutoAdvance } from './media-playback-auto-advance';

class FakeVideo extends EventTarget {}

const item = (id: string): MediaQueueItem => ({
  id,
  titleId: id,
  title: id,
  kind: 'movie',
  playback: {
    providerId: 'direct',
    source: { id: `${id}-source`, titleId: id, kind: 'hls', url: `https://media.example/${id}.m3u8` },
    capabilities: ['playback', 'seek'],
  },
});

function storeFixture(nextItem: MediaQueueItem | null): MediaPlaybackStore {
  const current = item('current');
  const queue = [current, ...(nextItem ? [nextItem] : [])];
  const state = { current, queue, queueIndex: 0, playerState: null, repeat: 'off' as const, shuffle: false };
  return {
    getState: () => state,
    subscribe: vi.fn(() => vi.fn()),
    setCurrent: vi.fn((nextCurrent, queueIndex = nextCurrent ? 0 : -1) => {
      state.current = nextCurrent;
      state.queueIndex = queueIndex;
    }),
    setQueue: vi.fn(),
    addToQueue: vi.fn(),
    removeFromQueue: vi.fn(),
    clearQueue: vi.fn(),
    updatePlayerState: vi.fn(),
    setRepeat: vi.fn(),
    setShuffle: vi.fn(),
    next: vi.fn(() => {
      if (!nextItem) return null;
      state.current = nextItem;
      state.queueIndex = 1;
      return nextItem;
    }),
    previous: vi.fn(() => null),
    reset: vi.fn(),
  };
}

function sessionFixture(remote = false): UnifiedMediaSession {
  return {
    getState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    dispose: vi.fn(),
    loadPlayback: vi.fn(async () => undefined),
    play: vi.fn(async () => undefined),
    pause: vi.fn(async () => undefined),
    seek: vi.fn(async () => undefined),
    setVolume: vi.fn(async () => undefined),
    discoverTargets: vi.fn(async () => []),
    transfer: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    isRemote: vi.fn(() => remote),
    remotePlay: vi.fn(async () => undefined),
    remotePause: vi.fn(async () => undefined),
    remoteSeek: vi.fn(async () => undefined),
    remoteSeekTo: vi.fn(async () => undefined),
    remoteSetVolume: vi.fn(async () => undefined),
  };
}

describe('media playback automatic queue advancement', () => {
  it('loads and starts the next governed queue item when local playback ends', async () => {
    const video = new FakeVideo() as unknown as HTMLVideoElement;
    const next = item('next');
    const store = storeFixture(next);
    const session = sessionFixture();
    const onError = vi.fn();
    const detach = attachMediaPlaybackAutoAdvance({ video, store, session, onError });

    video.dispatchEvent(new Event('ended'));
    await Promise.resolve();

    expect(store.next).toHaveBeenCalledTimes(1);
    expect(session.loadPlayback).toHaveBeenCalledWith(next.playback);
    expect(session.play).toHaveBeenCalledTimes(1);
    expect(store.getState().current?.id).toBe('next');
    expect(onError).not.toHaveBeenCalled();

    detach();
    video.dispatchEvent(new Event('ended'));
    expect(store.next).toHaveBeenCalledTimes(1);
  });

  it('does not advance when there is no next queue item', async () => {
    const video = new FakeVideo() as unknown as HTMLVideoElement;
    const store = storeFixture(null);
    const session = sessionFixture();
    attachMediaPlaybackAutoAdvance({ video, store, session });

    video.dispatchEvent(new Event('ended'));
    await Promise.resolve();

    expect(store.next).toHaveBeenCalledTimes(1);
    expect(session.loadPlayback).not.toHaveBeenCalled();
    expect(session.play).not.toHaveBeenCalled();
  });

  it('does not advance while remote playback owns the session', async () => {
    const video = new FakeVideo() as unknown as HTMLVideoElement;
    const store = storeFixture(item('next'));
    const session = sessionFixture(true);
    attachMediaPlaybackAutoAdvance({ video, store, session });

    video.dispatchEvent(new Event('ended'));
    await Promise.resolve();

    expect(store.next).not.toHaveBeenCalled();
    expect(session.loadPlayback).not.toHaveBeenCalled();
  });

  it('serializes duplicate ended events while an advance is in flight', async () => {
    const video = new FakeVideo() as unknown as HTMLVideoElement;
    const next = item('next');
    const store = storeFixture(next);
    let resolveLoad: (() => void) | undefined;
    const session = sessionFixture();
    session.loadPlayback = vi.fn(() => new Promise<void>((resolve) => { resolveLoad = resolve; }));
    attachMediaPlaybackAutoAdvance({ video, store, session });

    video.dispatchEvent(new Event('ended'));
    video.dispatchEvent(new Event('ended'));
    expect(store.next).toHaveBeenCalledTimes(1);

    resolveLoad?.();
    await Promise.resolve();
    expect(session.play).toHaveBeenCalledTimes(1);
  });

  it('rolls the queue back when loading the next item fails', async () => {
    const video = new FakeVideo() as unknown as HTMLVideoElement;
    const next = item('next');
    const store = storeFixture(next);
    const session = sessionFixture();
    const failure = new Error('advance failed');
    session.loadPlayback = vi.fn(async () => { throw failure; });
    const onError = vi.fn();
    attachMediaPlaybackAutoAdvance({ video, store, session, onError });

    video.dispatchEvent(new Event('ended'));
    await Promise.resolve();

    expect(store.getState().current?.id).toBe('current');
    expect(store.getState().queueIndex).toBe(0);
    expect(onError).toHaveBeenCalledWith(failure);
  });
});
