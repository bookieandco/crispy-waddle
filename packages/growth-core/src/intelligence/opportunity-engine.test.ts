import { describe, expect, it } from 'vitest';
import { rankGrowthOpportunities } from './opportunity-engine.js';
import type { GrowthDecision } from './growth-decision-feed.js';

const decision = (key: string, contributionMargin: number, contributionRoas: number, confidence: number): GrowthDecision => ({
  id: `decision:${key}`, key, action: contributionRoas >= 2 ? 'scale' : 'test',
  rationale: 'evidence', confidence,
  evidence: { revenue: contributionMargin * 2, contributionMargin, spend: 100, roas: 2, contributionRoas, cac: 50, customers: 4 },
});

describe('opportunity engine', () => {
  it('ranks the strongest economic opportunity first', () => {
    const result = rankGrowthOpportunities([
      decision('creative-a', 500, 3, 1),
      decision('creative-b', 200, 2, 1),
    ]);
    expect(result[0].key).toBe('creative-a');
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(2);
  });

  it('discounts opportunities with low confidence', () => {
    const result = rankGrowthOpportunities([
      decision('high-confidence', 300, 2, 1),
      decision('low-confidence', 500, 2, 0.1),
    ]);
    expect(result[0].key).toBe('high-confidence');
  });
});
