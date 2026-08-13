import { describe, expect, it } from 'vitest';
import { buildGrowthDecisionFeed } from './growth-decision-feed.js';
import type { PerformanceAggregate } from '../attribution/performance-aggregator.js';

const base: PerformanceAggregate = {
  key: 'creative-1', revenue: 1000, contributionMargin: 500, spend: 200,
  customers: 4, ltv: 1200, roas: 5, contributionRoas: 2.5, cac: 50,
};

describe('growth decision feed', () => {
  it('recommends scale for strong contribution economics', () => {
    const result = buildGrowthDecisionFeed([base]);
    expect(result[0].action).toBe('scale');
    expect(result[0].evidence.contributionRoas).toBe(2.5);
  });

  it('requires more evidence when customer volume is low', () => {
    const result = buildGrowthDecisionFeed([{ ...base, customers: 1 }]);
    expect(result[0].action).toBe('test');
    expect(result[0].confidence).toBe(0.125);
  });

  it('recommends stop when contribution economics are non-positive', () => {
    const result = buildGrowthDecisionFeed([{ ...base, contributionMargin: 0, contributionRoas: 0 }]);
    expect(result[0].action).toBe('stop');
  });
});
