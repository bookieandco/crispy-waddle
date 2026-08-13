import { describe, expect, it } from 'vitest';
import { runGrowthIntelligenceLoop } from './growth-loop.js';
import type { PerformanceAggregate } from '../attribution/performance-aggregator.js';

const aggregate: PerformanceAggregate = {
  key: 'creative-1', revenue: 1000, contributionMargin: 600, spend: 200,
  customers: 8, ltv: 1800, roas: 5, contributionRoas: 3, cac: 25,
};

describe('growth intelligence loop', () => {
  it('composes economics into decisions, opportunities and bounded experiments', () => {
    const result = runGrowthIntelligenceLoop([aggregate]);
    expect(result.decisions[0].action).toBe('scale');
    expect(result.opportunities[0].rank).toBe(1);
    expect(result.experiments[0].opportunityId).toBe(result.opportunities[0].id);
  });
});
