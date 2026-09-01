import { describe, expect, it, vi } from 'vitest';
import type { CastingManager, MediaSessionState } from './casting';
import { createUnifiedMediaSession } from './media-session';
import type { ResolvedPlaybackSource } from './playback-resolver';
import type { LocalPlaybackAdapter } from './media-session';

const targetState: MediaSessionState = {
  titleId: 'title-1',
  kind: 'movie',
  sourceUrl: 'https://example.com/video.m3u8',
  positionSeconds: 10,
  playing: false,
  target: { id: 'local', name: 'This device', transport: 'local' },
};

const playback: ResolvedPlaybackSource = {
  providerId: 'direct',
  source: {
    id: 'source-1',
    titleId: 'title-1',
    kind: 'hls',
    url: 'https://example.com/video.m3u8',
  },
  capabilities: ['playback', 'seek'],
};

function createFixture() {
  let state = { ...targetState };
  let listener: ((next: MediaSessionState) => void) | undefined;
  const unsubscribe = vi.fn(() => { listener = undefined; });
  const local: LocalPlaybackAdapter = {
    getState: () => state,
    apply: vi.fn(async (command) => {
      if (command.type === 'play') state = { ...state, playing: true };
      if (command.type === 'pause') state = { ...state, playing: false };
      if (command.type === 'seek' && typeof command.value === 'number') state = { ...state, positionSeconds: command.value };
    }),
    onStateChange: vi.fn((next) => {
      listener = next;
      return unsubscribe;
    }),
  };
  const casting: CastingManager = {
    discover: vi.fn(async () => []),
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    send: vi.fn(async () => undefined),
    getState: vi.fn(async () => null),
    subscribeState: vi.fn(() => vi.fn()),
  };
  return { local, casting, getListener: () => listener, unsubscribe };
}

describe('UnifiedMediaSession lifecycle', () => {
  it('unsubscribes the local state listener when disposed', () => {
    const fixture = createFixture();
    const session = createUnifiedMediaSession({ titleId: 'title-1', kind: 'movie', playback, local: fixture.local, casting: fixture.casting });
    const subscriber = vi.fn();
    session.subscribe(subscriber);

    fixture.getListener()?.({ ...targetState, positionSeconds: 20 });
    expect(subscriber).toHaveBeenCalledTimes(1);

    session.dispose();
    expect(fixture.unsubscribe).toHaveBeenCalledTimes(1);
    expect(fixture.getListener()).toBeUndefined();

    fixture.getListener()?.({ ...targetState, positionSeconds: 30 });
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it('makes disposal idempotent', () => {
    const fixture = createFixture();
    const session = createUnifiedMediaSession({ titleId: 'title-1', kind: 'movie', playback, local: fixture.local, casting: fixture.casting });

    session.dispose();
    session.dispose();

    expect(fixture.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('rejects new subscriptions and commands after disposal', async () => {
    const fixture = createFixture();
    const session = createUnifiedMediaSession({ titleId: 'title-1', kind: 'movie', playback, local: fixture.local, casting: fixture.casting });
    session.dispose();

    expect(() => session.subscribe(() => undefined)).toThrow('Media session is disposed.');
    await expect(session.play()).rejects.toThrow('Media session is disposed.');
    await expect(session.discoverTargets()).rejects.toThrow('Media session is disposed.');
  });
});
