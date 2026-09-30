import { describe, expect, it } from 'vitest';
import { extractSocialPattern, mergeSocialPatterns } from './social-pattern-extractor.js';

const base = {
  id: 'obs-1' as never,
  platform: 'instagram' as const,
  sourceUrl: 'https://example.com/post',
  observedAt: new Date().toISOString(),
  mediaType: 'video' as const,
  engagement: { views: 1000, likes: 100, comments: 10 },
  audienceSignals: ['pet lovers'],
  commercialSignals: ['price'],
};

describe('social pattern extractor', () => {
  it('extracts reusable hook, structure, format and CTA signals', () => {
    const pattern = extractSocialPattern({
      ...base,
      topic: 'pet portraits',
      text: '3 things to know before you buy — shop the link',
      provenance: ['public'],
    });

    expect(pattern.hook).toBe('numbered');
    expect(pattern.structure).toBe('numbered-list');
    expect(pattern.format).toBe('short-video');
    expect(pattern.cta).toBe('buy');
    expect(pattern.topic).toBe('pet portraits');
  });

  it('merges evidence from multiple platform observations', () => {
    const a = extractSocialPattern({ ...base, provenance: ['public'] });
    const b = extractSocialPattern({ ...base, id: 'obs-2' as never, platform: 'tiktok', provenance: ['public'] });
    const merged = mergeSocialPatterns([a, b]);

    expect(merged?.sourceObservationIds).toHaveLength(2);
    expect(merged?.platforms).toEqual(expect.arrayContaining(['instagram', 'tiktok']));
    expect(merged?.confidence).toBeGreaterThan(a.confidence);
  });
});
