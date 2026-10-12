import { describe, it, expect } from 'vitest';
import { assertPrivateAccess, buildPrivateNowGuide, importOwnerApprovedM3u, safePrivateStreamUrl } from './private-sources';

const fixture = `#EXTM3U
#EXTINF:-1 tvg-id="News.US" tvg-country="US" tvg-language="en" group-title="News",Public Network
https://media.example.test/news.m3u8
#EXTINF:-1 tvg-id="News.US",Duplicate
https://media.example.test/news.m3u8
#EXTINF:-1 tvg-id="Unsafe",Unsafe
http://192.168.1.4/video
#EXTINF:-1,Other
https://media.example.test/other.mp4`;
describe('private viewing only', () => {
  it('does not treat external provider discovery as playable media', () => {
    expect(() => assertPrivateAccess('subscription-link', 'play')).toThrow();
    expect(() => assertPrivateAccess('discovery-only', 'play')).toThrow();
    expect(() => assertPrivateAccess('owner-approved-playlist', 'play')).not.toThrow();
    expect(() => assertPrivateAccess('official-player', 'open-link')).not.toThrow();
  });
  it('requires an owner acknowledgement and rejects insecure/credential-bearing urls', () => {
    expect(() => importOwnerApprovedM3u(fixture, false)).toThrow();
    expect(safePrivateStreamUrl('http://media.example.test/a')).toBeNull();
    expect(safePrivateStreamUrl('https://user:pass@media.example.test/a')).toBeNull();
    expect(safePrivateStreamUrl('javascript:alert(1)')).toBeNull();
    expect(safePrivateStreamUrl('https://media.example.test/a.m3u8')).toBe('https://media.example.test/a.m3u8');
  });
  it('deduplicates, skips insecure entries, and retains channel provenance', () => {
    const result = importOwnerApprovedM3u(fixture, true, new Date('2026-10-11T12:00:00Z'));
    expect(result.channels).toHaveLength(2);
    expect(result.skipped).toBe(2);
    expect(result.channels[0]).toMatchObject({ name: 'Public Network', country: 'US', language: 'en', tvgId: 'News.US', access: 'owner-approved-playlist', reviewedAt: '2026-10-11T12:00:00.000Z' });
    expect(importOwnerApprovedM3u(fixture, true).channels[0].id).toBe(result.channels[0].id);
  });
  it('joins XMLTV only by exact tvg-id with UTC/offset-aware timing', () => {
    const channels = importOwnerApprovedM3u(fixture, true).channels;
    const xml = `<tv><programme channel="News.US" start="20261011100000 +0000" stop="20261011130000 +0000"><title>Morning News</title></programme>
    <programme channel="Other.US" start="20261011100000 +0000" stop="20261011130000 +0000"><title>Wrong Channel</title></programme></tv>`;
    const guide = buildPrivateNowGuide(channels, xml, new Date('2026-10-11T12:00:00Z'));
    expect(guide.get(channels[0].id)?.title).toBe('Morning News');
    expect(guide.has(channels[1].id)).toBe(false);
    expect(buildPrivateNowGuide(channels, xml, new Date('2026-10-11T14:00:00Z')).size).toBe(0);
  });
});
