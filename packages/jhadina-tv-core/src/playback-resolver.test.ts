import { describe, expect, it, vi } from 'vitest';
import { createPlaybackResolver } from './playback-resolver';
import type { MediaSourceAdapter } from './source-adapter';

function adapter(sources: Awaited<ReturnType<MediaSourceAdapter['getSources']>>, id = 'direct'): MediaSourceAdapter {
  return {
    id,
    name: 'Direct',
    search: vi.fn(async () => []),
    getSources: vi.fn(async () => sources),
  };
}

describe('createPlaybackResolver', () => {
  it('resolves an authorized source and preserves capabilities', async () => {
    const getSources = vi.fn(async () => [
      { id: 'source-a', titleId: 'title-1', kind: 'hls' as const, url: 'https://media.example/a.m3u8' },
    ]);
    const resolver = createPlaybackResolver([{ id: 'direct', adapter: { ...adapter([]), getSources }, authorized: true, capabilities: ['playback', 'seek', 'captions'] }]);

    await expect(resolver.resolve({ providerId: 'direct', titleId: 'title-1' })).resolves.toEqual({
      providerId: 'direct',
      source: { id: 'source-a', titleId: 'title-1', kind: 'hls', url: 'https://media.example/a.m3u8' },
      capabilities: ['playback', 'seek', 'captions'],
    });
    expect(getSources).toHaveBeenCalledTimes(1);
  });

  it('uses the default playback capabilities when none are declared', async () => {
    const resolver = createPlaybackResolver([{ id: 'direct', adapter: adapter([
      { id: 'source', titleId: 'title-1', kind: 'external', url: 'https://media.example/a' },
    ]), authorized: true }]);
    await expect(resolver.resolve({ providerId: 'direct', titleId: 'title-1' })).resolves.toMatchObject({ capabilities: ['playback', 'seek'] });
  });

  it('rejects unknown and unauthorized providers', async () => {
    const resolver = createPlaybackResolver([{ id: 'blocked', adapter: adapter([], 'blocked'), authorized: false }]);
    await expect(resolver.resolve({ providerId: 'missing', titleId: 'title-1' })).rejects.toThrow('Unknown playback provider');
    await expect(resolver.resolve({ providerId: 'blocked', titleId: 'title-1' })).rejects.toThrow('not authorized');
  });

  it('rejects duplicate providers and adapter identity mismatches', () => {
    expect(() => createPlaybackResolver([
      { id: 'direct', adapter: adapter([], 'direct'), authorized: true },
      { id: 'direct', adapter: adapter([], 'direct'), authorized: true },
    ])).toThrow('Duplicate playback provider');

    expect(() => createPlaybackResolver([{ id: 'direct', adapter: adapter([], 'other'), authorized: true }])).not.toThrow();
  });

  it('fails closed on an adapter identity mismatch during resolution', async () => {
    const resolver = createPlaybackResolver([{ id: 'direct', adapter: adapter([], 'other'), authorized: true }]);
    await expect(resolver.resolve({ providerId: 'direct', titleId: 'title-1' })).rejects.toThrow('adapter identity mismatch');
  });

  it('filters by requested source id and fails closed when absent', async () => {
    const resolver = createPlaybackResolver([{ id: 'direct', adapter: adapter([
      { id: 'source-a', titleId: 'title-1', kind: 'hls', url: 'https://media.example/a.m3u8' },
      { id: 'source-b', titleId: 'title-1', kind: 'dash', url: 'https://media.example/b.mpd' },
    ]), authorized: true }]);

    await expect(resolver.resolve({ providerId: 'direct', titleId: 'title-1', sourceId: 'source-b' })).resolves.toMatchObject({ source: { id: 'source-b' } });
    await expect(resolver.resolve({ providerId: 'direct', titleId: 'title-1', sourceId: 'missing' })).rejects.toThrow('No authorized playback source');
  });

  it('rejects insecure and mismatched sources', async () => {
    const insecure = createPlaybackResolver([{ id: 'direct', adapter: adapter([{ id: 'source', titleId: 'title-1', kind: 'external', url: 'http://media.example/a' }]), authorized: true }]);
    await expect(insecure.resolve({ providerId: 'direct', titleId: 'title-1' })).rejects.toThrow('HTTPS');

    const mismatched = createPlaybackResolver([{ id: 'direct', adapter: adapter([{ id: 'source', titleId: 'other-title', kind: 'external', url: 'https://media.example/a' }]), authorized: true }]);
    await expect(mismatched.resolve({ providerId: 'direct', titleId: 'title-1' })).rejects.toThrow('title');
  });

  it('rejects insecure subtitle sources', async () => {
    const resolver = createPlaybackResolver([{ id: 'direct', adapter: adapter([{
      id: 'source', titleId: 'title-1', kind: 'hls', url: 'https://media.example/a.m3u8',
      subtitles: [{ label: 'English', language: 'en', url: 'http://media.example/en.vtt' }],
    }]), authorized: true }]);
    await expect(resolver.resolve({ providerId: 'direct', titleId: 'title-1' })).rejects.toThrow('subtitle');
  });

  it('rejects empty titles before calling the adapter', async () => {
    const getSources = vi.fn(async () => []);
    const resolver = createPlaybackResolver([{ id: 'direct', adapter: { ...adapter([]), getSources }, authorized: true }]);
    await expect(resolver.resolve({ providerId: 'direct', titleId: '' })).rejects.toThrow('Invalid playback title');
    expect(getSources).not.toHaveBeenCalled();
  });
});
