import { describe, expect, it } from 'vitest';
import { scoreTrendBuyerConvergence } from './trend-buyer-convergence.js';

describe('trend buyer convergence', () => {
  it('raises convergence when an accelerating trend has strong buyer intent', () => {
    const result = scoreTrendBuyerConvergence({ clusterId: 'cluster:1' as never, stage: 'accelerating', velocity: 3, acceleration: 1.5, sourceDiversity: 0.8, confidence: 0.9 }, [
      { audienceId: 'audience:1' as never, intentScore: 0.9, evidence: ['search:buy'] },
      { audienceId: 'audience:2' as never, intentScore: 0.8, evidence: ['comment:price'] },
    ]);
    expect(result.buyerIntentScore).toBeCloseTo(0.85);
    expect(result.convergenceScore).toBeGreaterThan(0.7);
    expect(result.requiresHumanReview).toBe(true);
  });

  it('does not manufacture buyer intent when no observations exist', () => {
    const result = scoreTrendBuyerConvergence({ clusterId: 'cluster:2' as never, stage: 'breakout', velocity: 5, acceleration: 2, sourceDiversity: 1, confidence: 1 }, []);
    expect(result.buyerIntentScore).toBe(0);
    expect(result.convergenceScore).toBeCloseTo(0.55);
  });
});
