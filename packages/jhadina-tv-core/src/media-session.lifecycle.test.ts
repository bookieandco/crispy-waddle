import { describe, expect, it, vi } from 'vitest';
import type { CastingManager, MediaSessionState } from './casting';
import { createUnifiedMediaSession } from './media-session';
import type { ResolvedPlaybackSource } from './playback-resolver';
import type { LocalPlaybackAdapter } from './media-session';

const targetState: MediaSessionState = {
  titleId: 'title-1', kind: 'movie', sourceUrl: 'https://example.com/video.m3u8', positionSeconds: 10, playing: false,
  target: { id: 'local', name: 'This device', transport: 'local' },
};
const playback: ResolvedPlaybackSource = { providerId: 'direct', source: { id: 'source-1', titleId: 'title-1', kind: 'hls', url: 'https://example.com/video.m3u8' }, capabilities: ['playback', 'seek'] };
const nextPlayback: ResolvedPlaybackSource = { providerId: 'direct', source: { id: 'source-2', titleId: 'title-2', kind: 'hls', url: 'https://example.com/next.m3u8' }, capabilities: ['playback', 'seek'] };

function createFixture() {
  let state = { ...targetState }; let listener: ((next: MediaSessionState) => void) | undefined;
  const unsubscribe = vi.fn(() => { listener = undefined; });
  const local: LocalPlaybackAdapter = {
    getState: () => state,
    setSource: vi.fn((url) => { state = { ...state, sourceUrl: url, titleId: url.includes('next') ? 'title-2' : 'title-1', positionSeconds: 0, playing: false }; }),
    apply: vi.fn(async (command) => { if (command.type === 'play') state = { ...state, playing: true }; if (command.type === 'pause') state = { ...state, playing: false }; if (command.type === 'seek' && typeof command.value === 'number') state = { ...state, positionSeconds: command.value }; }),
    onStateChange: vi.fn((next) => { listener = next; return unsubscribe; }),
  };
  const casting: CastingManager = { discover: vi.fn(async () => []), connect: vi.fn(async () => undefined), disconnect: vi.fn(async () => undefined), loadPlayback: vi.fn(async () => undefined), send: vi.fn(async () => undefined), getState: vi.fn(async () => null), subscribeState: vi.fn(() => vi.fn()) };
  return { local, casting, getListener: () => listener, unsubscribe };
}

describe('UnifiedMediaSession lifecycle', () => {
  it('unsubscribes the local state listener when disposed', () => {
    const f = createFixture(); const s = createUnifiedMediaSession({ titleId: 'title-1', kind: 'movie', playback, local: f.local, casting: f.casting }); const subscriber = vi.fn(); s.subscribe(subscriber); f.getListener()?.({ ...targetState, positionSeconds: 20 }); expect(subscriber).toHaveBeenCalledTimes(1); s.dispose(); expect(f.unsubscribe).toHaveBeenCalledTimes(1); });
  it('makes disposal idempotent', () => { const f = createFixture(); const s = createUnifiedMediaSession({ titleId: 'title-1', kind: 'movie', playback, local: f.local, casting: f.casting }); s.dispose(); s.dispose(); expect(f.unsubscribe).toHaveBeenCalledTimes(1); });
  it('loads a governed source for a different queue title and transitions session identity', async () => { const f = createFixture(); const s = createUnifiedMediaSession({ titleId: 'title-1', kind: 'movie', playback, local: f.local, casting: f.casting }); await s.loadPlayback(nextPlayback); expect(f.local.setSource).toHaveBeenCalledWith(nextPlayback.source.url); expect(s.getState()).toMatchObject({ titleId: 'title-2', sourceUrl: nextPlayback.source.url, positionSeconds: 0, playing: false }); });
  it('applies local resume position when loading the next queue title', async () => { const f = createFixture(); const s = createUnifiedMediaSession({ titleId: 'title-1', kind: 'movie', playback, local: f.local, casting: f.casting }); await s.loadPlayback(nextPlayback, 42.5); expect(f.local.apply).toHaveBeenCalledWith({ type: 'seek', value: 42.5 }); expect(s.getState()).toMatchObject({ titleId: 'title-2', positionSeconds: 42.5 }); });
  it('rejects external and non-HTTPS sources before touching local playback', async () => { const f = createFixture(); const s = createUnifiedMediaSession({ titleId: 'title-1', kind: 'movie', playback, local: f.local, casting: f.casting }); const external = { ...nextPlayback, source: { ...nextPlayback.source, kind: 'external' as const } }; const insecure = { ...nextPlayback, source: { ...nextPlayback.source, url: 'http://example.com/next.m3u8' } }; await expect(s.loadPlayback(external)).rejects.toThrow('External playback sources require an external playback executor.'); await expect(s.loadPlayback(insecure)).rejects.toThrow('Playback source must use HTTPS.'); expect(f.local.setSource).not.toHaveBeenCalled(); });
  it('refreshes authoritative remote state before a transfer', async () => {
    const f = createFixture();
    const remoteState: MediaSessionState = { ...targetState, positionSeconds: 137.5, playing: true, target: { id: 'tv-1', name: 'Living Room TV', transport: 'google-cast' } };
    f.casting.getState = vi.fn(async () => remoteState);
    const s = createUnifiedMediaSession({ titleId: 'title-1', kind: 'movie', playback, local: f.local, casting: f.casting });
    await f.casting.connect({ id: 'tv-1', name: 'Living Room TV', transport: 'google-cast' });
    await s.syncRemoteState();
    expect(s.getState()).toMatchObject({ positionSeconds: 137.5, playing: true, target: remoteState.target });
  });
  it('keeps a newer load authoritative when an older load resolves late', async () => {
    const f = createFixture();
    const first = { ...nextPlayback, source: { ...nextPlayback.source, id: 'first', titleId: 'title-2', url: 'https://example.com/first.m3u8' } };
    const second = { ...nextPlayback, source: { ...nextPlayback.source, id: 'second', titleId: 'title-3', url: 'https://example.com/second.m3u8' } };
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let firstLoad = true;
    f.casting.getState = vi.fn(async () => {
      if (firstLoad) {
        firstLoad = false;
        await firstGate;
      }
      return { ...targetState, sourceUrl: second.source.url, titleId: second.source.titleId };
    });
    const remote = { id: 'tv-1', name: 'Living Room TV', transport: 'google-cast' as const };
    f.casting.connect = vi.fn(async () => undefined);
    const s = createUnifiedMediaSession({ titleId: 'title-1', kind: 'movie', playback, local: f.local, casting: f.casting });
    await f.casting.connect(remote);
    const p1 = s.loadPlayback(first);
    const p2 = s.loadPlayback(second);
    releaseFirst();
    await Promise.all([p1, p2]);
    expect(s.getState().sourceUrl).toBe(second.source.url);
  });
  it('fails after disposal', async () => { const f = createFixture(); const s = createUnifiedMediaSession({ titleId: 'title-1', kind: 'movie', playback, local: f.local, casting: f.casting }); s.dispose(); await expect(s.loadPlayback(nextPlayback)).rejects.toThrow('Media session is disposed.'); });
});
