import { describe, expect, it, vi } from 'vitest';
import { createDirectSourceAdapter } from './direct-source-adapter';
import { createYouTubePlaybackAdapter } from './youtube-playback-adapter';

describe('authorized playback adapters', () => {
  it('direct adapter preserves valid sources and rejects insecure sources', async () => {
    const client = {
      search: vi.fn(async () => []),
      getSources: vi.fn(async () => [
        { id: 'hls', titleId: 'title-1', kind: 'hls' as const, url: 'https://media.example/video.m3u8' },
      ]),
    };
    const adapter = createDirectSourceAdapter(client, { id: 'direct', name: 'Direct' });
    await expect(adapter.getSources('title-1')).resolves.toEqual([
      { id: 'hls', titleId: 'title-1', kind: 'hls', url: 'https://media.example/video.m3u8' },
    ]);

    client.getSources.mockResolvedValueOnce([
      { id: 'bad', titleId: 'title-1', kind: 'external', url: 'http://media.example/video' },
    ]);
    await expect(adapter.getSources('title-1')).rejects.toThrow('HTTPS');
  });

  it('YouTube adapter treats playback URLs as governed external sources', async () => {
    const client = {
      search: vi.fn(async () => []),
      sources: vi.fn(async () => [
        { id: 'youtube-video', titleId: 'title-1', kind: 'external' as const, url: 'https://www.youtube.com/watch?v=abc123' },
      ]),
    };
    const adapter = createYouTubePlaybackAdapter(client);
    await expect(adapter.getSources('title-1')).resolves.toEqual([
      { id: 'youtube-video', titleId: 'title-1', kind: 'external', url: 'https://www.youtube.com/watch?v=abc123' },
    ]);
  });

  it('both adapters fail closed for an empty title', async () => {
    const direct = createDirectSourceAdapter({ search: vi.fn(async () => []), getSources: vi.fn(async () => []) }, { id: 'direct', name: 'Direct' });
    const youtube = createYouTubePlaybackAdapter({ search: vi.fn(async () => []), sources: vi.fn(async () => []) });
    await expect(direct.getSources('')).rejects.toThrow('Invalid playback title');
    await expect(youtube.getSources('')).rejects.toThrow('Invalid playback title');
  });

  it('rejects insecure YouTube URLs before they reach the resolver', async () => {
    const youtube = createYouTubePlaybackAdapter({
      search: vi.fn(async () => []),
      sources: vi.fn(async () => [
        { id: 'youtube-video', titleId: 'title-1', kind: 'external' as const, url: 'http://www.youtube.com/watch?v=abc123' },
      ]),
    });
    await expect(youtube.getSources('title-1')).rejects.toThrow('HTTPS');
  });
});
