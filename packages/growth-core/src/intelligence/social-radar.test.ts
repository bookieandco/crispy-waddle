import { describe, expect, it } from 'vitest';
import {
  buildSocialRadar,
  type SocialRadarObservation,
  type SocialRadarSourceHealth,
} from './social-radar.js';

const health: SocialRadarSourceHealth[] = [
  {
    id: 'health:x',
    source: 'x',
    state: 'working',
    checkedAt: '2026-10-07T18:00:00.000Z',
    evidenceRefs: ['probe:x:ok'],
  },
  {
    id: 'health:tiktok',
    source: 'tiktok',
    state: 'working',
    checkedAt: '2026-10-07T18:00:00.000Z',
    evidenceRefs: ['probe:tiktok:ok'],
  },
  {
    id: 'health:reddit',
    source: 'reddit',
    state: 'not_working',
    checkedAt: '2026-10-07T18:00:00.000Z',
    reason: 'rate limited',
    evidenceRefs: ['probe:reddit:429'],
  },
];

function obs(input: Partial<SocialRadarObservation> = {}): SocialRadarObservation {
  return {
    id: 'obs:x:1',
    source: 'x',
    sourceItemId: 'x-1',
    canonicalStoryKey: 'story:bookie-song-a',
    topic: 'Bookie song clip',
    text: 'People are sharing the hook.',
    url: 'https://example.com/x/1',
    publishedAt: '2026-10-06T18:00:00.000Z',
    observedAt: '2026-10-07T18:00:00.000Z',
    relevance: 90,
    engagement: 80,
    freshness: 95,
    brandFit: 90,
    commercialIntent: 70,
    audienceSignals: ['rap', 'Detroit'],
    evidenceRefs: ['x:post:1'],
    sourceHealthId: 'health:x',
    ...input,
  };
}

describe('Social cross-platform research radar', () => {
  it('clusters the same story across independent platforms and keeps evidence lineage', () => {
    const report = buildSocialRadar({
      sourceHealth: health,
      observations: [
        obs(),
        obs({
          id: 'obs:tiktok:1',
          source: 'tiktok',
          sourceItemId: 'tt-1',
          url: 'https://example.com/tiktok/1',
          engagement: 92,
          sourceHealthId: 'health:tiktok',
          evidenceRefs: ['tiktok:post:1'],
        }),
      ],
      generatedAt: '2026-10-07T18:05:00.000Z',
    });

    expect(report.clusters).toHaveLength(1);
    expect(new Set(report.clusters[0]?.sources)).toEqual(new Set(['x', 'tiktok']));
    expect(report.clusters[0]?.corroboration).toBeGreaterThan(0.6);
    expect(report.clusters[0]?.evidenceRefs).toContain('x:post:1');
    expect(report.clusters[0]?.evidenceRefs).toContain('tiktok:post:1');
  });

  it('deduplicates repeated copies from the same source before corroboration', () => {
    const report = buildSocialRadar({
      sourceHealth: health,
      observations: [
        obs({ engagement: 40 }),
        obs({ id: 'obs:x:duplicate', engagement: 95, evidenceRefs: ['x:post:1:enriched'] }),
      ],
    });

    expect(report.observations).toHaveLength(1);
    expect(report.clusters[0]?.sources).toEqual(['x']);
    expect(report.clusters[0]?.observationIds).toEqual(['obs:x:duplicate']);
  });

  it('preserves source failure as coverage state instead of treating it as zero demand', () => {
    const report = buildSocialRadar({
      sourceHealth: health,
      observations: [obs()],
    });

    expect(report.coverage.notWorking).toContain('reddit');
    expect(report.policy.absenceLaw).toBe('SOURCE_FAILURE_IS_NOT_ZERO_DEMAND');
  });

  it('rejects evidence claimed from a source that is known unavailable', () => {
    expect(() => buildSocialRadar({
      sourceHealth: health,
      observations: [
        obs({
          id: 'obs:reddit:1',
          source: 'reddit',
          sourceHealthId: 'health:reddit',
          evidenceRefs: ['reddit:post:1'],
        }),
      ],
    })).toThrow(/OBSERVATION_FROM_UNAVAILABLE_SOURCE/);
  });

  it('keeps competitor/public content as reference-only and extracts mechanics instead of identity', () => {
    const report = buildSocialRadar({
      sourceHealth: health,
      observations: [obs()],
    });

    expect(report.policy.publicMediaReuseAuthority).toBe('NONE');
    expect(report.policy.stylePolicy).toBe('EXTRACT_MECHANICS_NOT_IDENTITY');
    expect(report.authority).toBe('RESEARCH_ONLY');
    expect(report.externalActionAuthorized).toBe(false);
  });

  it('prioritizes business relevance and fit alongside engagement', () => {
    const report = buildSocialRadar({
      sourceHealth: health,
      observations: [
        obs({
          id: 'obs:x:viral-mismatch',
          sourceItemId: 'x-mismatch',
          canonicalStoryKey: 'story:viral-mismatch',
          topic: 'Huge unrelated meme',
          relevance: 20,
          brandFit: 10,
          engagement: 100,
          commercialIntent: 5,
          evidenceRefs: ['x:mismatch'],
        }),
        obs({
          id: 'obs:x:qualified',
          sourceItemId: 'x-qualified',
          canonicalStoryKey: 'story:qualified',
          topic: 'Qualified Bookie audience signal',
          relevance: 95,
          brandFit: 95,
          engagement: 65,
          commercialIntent: 85,
          evidenceRefs: ['x:qualified'],
        }),
      ],
    });

    expect(report.observations[0]?.id).toBe('obs:x:qualified');
  });
});
