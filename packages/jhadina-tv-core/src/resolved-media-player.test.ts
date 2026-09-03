import { describe, expect, it, vi } from 'vitest';
import type { MediaSessionState } from './casting';
import type { ResolvedPlaybackSource } from './playback-resolver';
import { createResolvedMediaPlayer } from './resolved-media-player';

const state: MediaSessionState = {
  titleId: 'title-1',
  kind: 'movie',
  sourceUrl: 'https://cdn.example/title-1.m3u8',
  positionSeconds: 0,
  playing: false,
  volume: 1,
  target: { id: 'local', name: 'This device', transport: 'local' },
};

function playback(overrides: Partial<ResolvedPlaybackSource> = {}): ResolvedPlaybackSource {
  return {
    providerId: 'direct',
    source: { id: 'source-1', titleId: 'title-1', kind: 'hls', url: 'https://cdn.example/title-1.m3u8' },
    capabilities: ['playback', 'seek'],
    ...overrides,
  };
}

describe('createResolvedMediaPlayer', () => {
  it('sets the runtime source only from the resolved source', () => {
    const setSource = vi.fn();
    const runtime = { getState: () => state, apply: vi.fn(async () => {}), setSource };
    const player = createResolvedMediaPlayer(playback(), runtime);
    expect(setSource).toHaveBeenCalledWith('https://cdn.example/title-1.m3u8');
    expect(player.playback.providerId).toBe('direct');
  });

  it('rejects insecure sources at the execution boundary', () => {
    const runtime = { getState: () => state, apply: vi.fn(async () => {}), setSource: vi.fn() };
    expect(() => createResolvedMediaPlayer(playback({ source: { ...playback().source, url: 'http://cdn.example/title-1.m3u8' } }), runtime)).toThrow('HTTPS');
    expect(runtime.setSource).not.toHaveBeenCalled();
  });

  it('rejects external sources from the native executor', () => {
    const runtime = { getState: () => state, apply: vi.fn(async () => {}), setSource: vi.fn() };
    expect(() => createResolvedMediaPlayer(playback({ source: { ...playback().source, kind: 'external' } }), runtime)).toThrow('external playback executor');
    expect(runtime.setSource).not.toHaveBeenCalled();
  });

  it('rejects a source whose title identity does not match the resolved session', () => {
    const runtime = { getState: () => state, apply: vi.fn(async () => {}), setSource: vi.fn() };
    expect(() => createResolvedMediaPlayer(playback({ source: { ...playback().source, titleId: 'other-title' } }), runtime)).toThrow();
    expect(runtime.setSource).not.toHaveBeenCalled();
  });
});
