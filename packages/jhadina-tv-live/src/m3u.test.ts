import { describe, expect, it } from 'vitest';
import { createM3uProvider, parseM3u } from './index';

describe('M3U Live TV', () => {
  it('parses channel metadata and maps it to IPTV channels', async () => {
    const text = '#EXTM3U\n#EXTINF:-1 tvg-id="abc" tvg-name="ABC" group-title="News" tvg-logo="https://example.com/logo.png",ABC News\nhttps://example.com/live.m3u8';
    expect(parseM3u(text)).toEqual([expect.objectContaining({ name: 'ABC News', tvgId: 'abc' })]);
    const provider = createM3uProvider(text);
    expect(await provider.listChannels()).toEqual([expect.objectContaining({ kind: 'iptv', provenance: 'public-free', source: 'https://example.com/live.m3u8' })]);
  });
});
