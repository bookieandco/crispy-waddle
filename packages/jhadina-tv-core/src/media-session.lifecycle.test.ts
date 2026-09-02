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

const nextPlayback: ResolvedPlaybackSource = {
  providerId: 'direct',
  source: {
    id: 'source-2',
    titleId: 'title-1',
    kind: 'hls',
    url: 'https://example.com/next.m3u8',
  },
  capabilities: ['playback', 'seek'],
};

function createFixture() {
  let state = { ...targetState };
  let listener: ((next: MediaSessionState) => void) | undefined;
  const unsubscribe = vi.fn(() => { listener = undefined; });
  const local: LocalPlaybackAdapter = {
    getState: () => state,
    setSource: vi.fn((url) => {
      state = { ...state, sourceUrl: url, positionSeconds: 0, playing: false };
    }),
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
    loadPlayback: vi.fn(async () => undefined),
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

  it('loads the next governed playback source locally and resets position', async () => {
    const fixture = createFixture();
    const session = createUnifiedMediaSession({ titleId: 'title-1', kind: 'movie', playback, local: fixture.local, casting: fixture.casting });

    await session.loadPlayback(nextPlayback);

    expect(fixture.local.setSource).toHaveBeenCalledWith('https://example.com/next.m3u8');
    expect(session.getState()).toMatchObject({ sourceUrl: 'https://example.com/next.m3u8', positionSeconds: 0, playing: false });
  });

  it('rejects a source belonging to another title without mutating local playback', async () => {
    const fixture = createFixture();
    const session = createUnifiedMediaSession({ titleId: 'title-1', kind: 'movie', playback, local: fixture.local, casting: fixture.casting });
    const invalid = { ...nextPlayback, source: { ...nextPlayback.source, titleId: 'title-2' } };

    await expect(session.loadPlayback(invalid)).rejects.toThrow('Playback source title does not match the media session.');
    expect(fixture.local.setSource).not.toHaveBeenCalledWith('https://example.com/next.m3u8');
  });

  it('rejects external and non-HTTPS sources before touching the local runtime', async () => {
    const fixture = createFixture();
    const session = createUnifiedMediaSession({ titleId: 'title-1', kind: 'movie', playback, local: fixture.local, casting: fixture.casting });
    const external = { ...nextPlayback, source: { ...nextPlayback.source, kind: 'external' as const } };
    const insecure = { ...nextPlayback, source: { ...nextPlayback.source, url: 'http://example.com/next.m3u8' } };

    await expect(session.loadPlayback(external)).rejects.toThrow('External playback sources require an external playback executor.');
    await expect(session.loadPlayback(insecure)).rejects.toThrow('Playback source must use HTTPS.');
    expect(fixture.local.setSource).not.toHaveBeenCalledWith('http://example.com/next.m3u8');
  });

  it('loads governed source switching while a remote target owns the session', async () => {
    const fixture = createFixture();
    const remoteTarget = { id: 'tv-1', name: 'TV', transport: 'google-cast' as const };
    const casting: CastingManager = {
      ...fixture.casting,
      connect: vi.fn(async () => undefined),
      loadPlayback: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined),
      getState: vi.fn(async () => ({ ...targetState, target: remoteTarget })),
    };
    const session = createUnifiedMediaSession({ titleId: 'title-1', kind: 'movie', playback, local: fixture.local, casting });
    await session.transfer(remoteTarget);

    await session.loadPlayback(nextPlayback);

    expect(casting.loadPlayback).toHaveBeenCalledWith(nextPlayback, 0);
    expect(fixture.local.setSource).not.toHaveBeenCalledWith('https://example.com/next.m3u8');
    expect(session.getState()).toMatchObject({ sourceUrl: 'https://example.com/next.m3u8', positionSeconds: 0, playing: false, target: remoteTarget });
  });

  it('fails closed when a remote controller cannot load a new source', async () => {
    const fixture = createFixture();
    const remoteTarget = { id: 'tv-1', name: 'TV', transport: 'google-cast' as const };
    const casting = {
      ...fixture.casting,
      connect: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined),
      getState: vi.fn(async () => ({ ...targetState, target: remoteTarget })),
      loadPlayback: vi.fn(async () => { throw new Error('Active remote playback controller cannot load a new source.'); }),
    } satisfies CastingManager;
    const session = createUnifiedMediaSession({ titleId: 'title-1', kind: 'movie', playback, local: fixture.local, casting });
    await session.transfer(remoteTarget);

    await expect(session.loadPlayback(nextPlayback)).rejects.toThrow('Active remote playback controller cannot load a new source.');
    expect(session.getState().sourceUrl).toBe(playback.source.url);
  });

  it('makes loadPlayback fail after disposal', async () => {
    const fixture = createFixture();
    const session = createUnifiedMediaSession({ titleId: 'title-1', kind: 'movie', playback, local: fixture.local, casting: fixture.casting });
    session.dispose();

    await expect(session.loadPlayback(nextPlayback)).rejects.toThrow('Media session is disposed.');
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
