import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaQueueItem, MediaSessionState, UnifiedMediaSession } from '@jhadina/tv-core';
import {
  attachMediaPlaybackSession,
  disposeMediaPlaybackSession,
  ensureMediaPlaybackSession,
  getMediaPlaybackSnapshot,
  releaseMediaPlaybackView,
  subscribeMediaPlaybackSnapshot,
} from './media-playback-runtime';

const state = (titleId: string, positionSeconds = 0): MediaSessionState => ({
  titleId,
  kind: 'movie',
  sourceUrl: `https://example.com/${titleId}.m3u8`,
  positionSeconds,
  playing: false,
  target: { id: 'local', name: 'This device', transport: 'local' },
});

function fakeSession(initial: MediaSessionState) {
  let current = initial;
  const listeners = new Set<(next: MediaSessionState) => void>();
  const session = {
    getState: () => current,
    subscribe: (listener: (next: MediaSessionState) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: vi.fn(),
    loadPlayback: vi.fn(async () => undefined),
    play: vi.fn(async () => undefined),
    pause: vi.fn(async () => undefined),
    seek: vi.fn(async () => undefined),
    setVolume: vi.fn(async () => undefined),
    discoverTargets: vi.fn(async () => []),
    syncRemoteState: vi.fn(async () => null),
    transfer: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    isRemote: () => false,
    remotePlay: vi.fn(async () => undefined),
    remotePause: vi.fn(async () => undefined),
    remoteSeek: vi.fn(async () => undefined),
    remoteSeekTo: vi.fn(async () => undefined),
    remoteSetVolume: vi.fn(async () => undefined),
    emit(next: MediaSessionState) {
      current = next;
      listeners.forEach((listener) => listener(next));
    },
  } as unknown as UnifiedMediaSession & { emit(next: MediaSessionState): void; dispose: ReturnType<typeof vi.fn> };
  return session;
}

function item(titleId: string): MediaQueueItem {
  return {
    id: `direct:${titleId}`,
    titleId,
    title: titleId,
    kind: 'movie',
    playback: {
      providerId: 'direct',
      source: { id: `source:${titleId}`, titleId, kind: 'hls', url: `https://example.com/${titleId}.m3u8` },
      capabilities: ['playback', 'seek'],
    },
  };
}

function sessionConfig(itemToLoad: MediaQueueItem) {
  let current = state(itemToLoad.titleId);
  const local = {
    getState: () => current,
    async apply(command: { type: 'play' | 'pause' | 'seek' | 'set-volume'; value?: number }) {
      if (command.type === 'seek') current = { ...current, positionSeconds: command.value ?? 0 };
      if (command.type === 'play') current = { ...current, playing: true };
      if (command.type === 'pause') current = { ...current, playing: false };
    },
    setSource(url: string) { current = { ...current, titleId: itemToLoad.titleId, sourceUrl: url, positionSeconds: 0, playing: false }; },
  };
  const casting = {
    discover: async () => [],
    connect: async () => undefined,
    disconnect: async () => undefined,
    loadPlayback: async () => undefined,
    send: async () => undefined,
    getState: async () => null,
    subscribeState: () => () => undefined,
  };
  return { titleId: itemToLoad.titleId, kind: itemToLoad.kind, playback: itemToLoad.playback, local, casting };
}

describe('media playback runtime lifecycle', () => {
  beforeEach(() => {
    disposeMediaPlaybackSession();
  });

  it('publishes one coherent snapshot and keeps observing after view release', () => {
    const first = fakeSession(state('one', 12));
    const seen: Array<ReturnType<typeof getMediaPlaybackSnapshot>> = [];
    const unsubscribe = subscribeMediaPlaybackSnapshot((next) => seen.push(next));
    attachMediaPlaybackSession(first, item('one'));
    releaseMediaPlaybackView();
    first.emit(state('one', 20));

    const current = getMediaPlaybackSnapshot();
    expect(current.session).toBe(first);
    expect(current.current?.titleId).toBe('one');
    expect(current.playerState?.positionSeconds).toBe(20);
    expect(seen.at(-1)?.playerState?.positionSeconds).toBe(20);
    unsubscribe();
  });

  it('fences events from the previous session after replacement', () => {
    const first = fakeSession(state('one', 10));
    const second = fakeSession(state('two', 30));
    attachMediaPlaybackSession(first, item('one'));
    attachMediaPlaybackSession(second, item('two'));
    first.emit(state('one', 999));

    const current = getMediaPlaybackSnapshot();
    expect(current.session).toBe(second);
    expect(current.current?.titleId).toBe('two');
    expect(current.playerState?.positionSeconds).toBe(30);
  });

  it('does not dispose the previous session during controlled replacement', () => {
    const first = fakeSession(state('one'));
    const second = fakeSession(state('two'));
    attachMediaPlaybackSession(first, item('one'));
    attachMediaPlaybackSession(second, item('two'));
    expect(first.dispose).not.toHaveBeenCalled();
  });

  it('replaces the global executor when ensure receives a different playback item', async () => {
    const first = item('one');
    const second = item('two');
    const firstSession = await ensureMediaPlaybackSession(sessionConfig(first), first);
    const secondSession = await ensureMediaPlaybackSession(sessionConfig(second), second);

    expect(secondSession).not.toBe(firstSession);
    expect(getMediaPlaybackSnapshot().session).toBe(secondSession);
    expect(getMediaPlaybackSnapshot().current?.titleId).toBe('two');
    expect(firstSession.getState().titleId).toBe('one');
  });

  it('explicit disposal is destructive and fenced', () => {
    const first = fakeSession(state('one', 10));
    attachMediaPlaybackSession(first, item('one'));
    disposeMediaPlaybackSession();
    first.emit(state('one', 999));

    const current = getMediaPlaybackSnapshot();
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(current.session).toBeNull();
    expect(current.current?.titleId).toBe('one');
  });
});
