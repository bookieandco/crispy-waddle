import { describe, expect, it } from 'vitest';
import { learnFromSocialExperiment } from './social-learning.js';

const pattern = { id: 'pattern-1' as never, sourceObservationIds: ['obs-1' as never], platforms: ['instagram'] as const, confidence: 0.6, audienceSignals: [] };

describe('social learning', () => {
  it('raises confidence only with sufficiently weighted positive evidence', () => {
    const result = learnFromSocialExperiment(pattern, {
      patternId: pattern.id,
      experimentId: 'experiment-1' as never,
      observations: 10_000,
      conversions: 100,
      spend: 100,
      revenue: 300,
      contributionMargin: 200,
      contributionRoas: 2,
      attributionConfidence: 0.9,
    });
    expect(result.direction).toBe('positive');
    expect(result.updatedConfidence).toBeGreaterThan(pattern.confidence);
  });

  it('penalizes weak economics but does not erase the pattern', () => {
    const result = learnFromSocialExperiment(pattern, {
      patternId: pattern.id,
      experimentId: 'experiment-2' as never,
      observations: 10_000,
      conversions: 5,
      spend: 100,
      revenue: 50,
      contributionMargin: 20,
      contributionRoas: 0.2,
      attributionConfidence: 0.9,
    });
    expect(result.direction).toBe('negative');
    expect(result.updatedConfidence).toBeGreaterThan(0);
  });

  it('stays neutral when commercial evidence is unavailable', () => {
    const result = learnFromSocialExperiment(pattern, {
      patternId: pattern.id,
      experimentId: 'experiment-3' as never,
      observations: 10_000,
      conversions: 0,
      spend: 0,
      revenue: 0,
      attributionConfidence: 0.8,
    });
    expect(result.direction).toBe('neutral');
    expect(result.updatedConfidence).toBe(pattern.confidence);
  });
});
