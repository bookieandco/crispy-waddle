import { describe, expect, it } from 'vitest';
import { trendToOpportunitySignal } from './trend-opportunity-bridge.js';

describe('trend opportunity bridge', () => {
  it('turns acceleration into a reviewable opportunity', () => {
    const result = trendToOpportunitySignal({ clusterId: 'cluster:1' as never, stage: 'accelerating', velocity: 2, acceleration: 1, sourceDiversity: 0.8, confidence: 0.9 });
    expect(result?.kind).toBe('emerging_trend');
    expect(result?.requiresHumanReview).toBe(true);
  });

  it('marks breakout momentum as commercial momentum', () => {
    const result = trendToOpportunitySignal({ clusterId: 'cluster:2' as never, stage: 'breakout', velocity: 4, acceleration: 2, sourceDiversity: 1, confidence: 0.95 });
    expect(result?.kind).toBe('commercial_momentum');
    expect(result?.score).toBe(1);
  });

  it('does not create opportunities for stable or declining trends', () => {
    expect(trendToOpportunitySignal({ clusterId: 'cluster:3' as never, stage: 'stable', velocity: 0, acceleration: 0, sourceDiversity: 0.5, confidence: 1 })).toBeNull();
    expect(trendToOpportunitySignal({ clusterId: 'cluster:4' as never, stage: 'declining', velocity: 0, acceleration: 0, sourceDiversity: 0.5, confidence: 1 })).toBeNull();
  });
});
