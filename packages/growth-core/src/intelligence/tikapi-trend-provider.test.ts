import { describe, expect, it } from 'vitest';
import { TikAPITrendProvider } from './tikapi-trend-provider.js';

describe('TikAPITrendProvider', () => {
  it('normalizes discover results into Growth Core trend signals', async () => {
    const provider = new TikAPITrendProvider({
      apiKey: 'test-key',
      fetcher: async () => new Response(JSON.stringify({
        itemList: [{
          id: '123',
          desc: '3 ways to improve your content #growth',
          createTime: Math.floor(Date.now() / 1000) - 3600,
          stats: { playCount: 100000, diggCount: 10000, shareCount: 2000, commentCount: 1000 },
          textExtra: [{ hashtagName: 'growth' }],
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }),
    });

    const signals = await provider.discoverTrends({ topic: 'growth', limit: 1, observedAt: new Date().toISOString() });
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      id: 'tiktok:tikapi:123',
      source: 'tikapi',
      topic: 'growth',
      views: 100000,
      format: 'short-video',
    });
    expect(signals[0].engagementRate).toBeGreaterThan(0);
    expect(signals[0].velocity).toBeGreaterThan(0);
  });

  it('requires a topic or niche', async () => {
    const provider = new TikAPITrendProvider({ apiKey: 'test-key', fetcher: async () => new Response('{}') });
    await expect(provider.discoverTrends({})).rejects.toThrow('topic or niche');
  });

  it('rejects failed provider responses', async () => {
    const provider = new TikAPITrendProvider({
      apiKey: 'test-key',
      fetcher: async () => new Response('rate limited', { status: 429, statusText: 'Too Many Requests' }),
    });
    await expect(provider.discoverTrends({ topic: 'growth' })).rejects.toThrow('429');
  });
});
