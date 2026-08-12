import { describe, expect, it } from 'vitest';
import { aggregatePerformance } from './performance-aggregator.js';
import type { AttributionCredit } from './attribution-model.js';

const credit: AttributionCredit = {
  customerId: 'customer-1', touchpointEventId: 'ad-1', campaignId: 'campaign-1',
  assetId: 'asset-1', creativeConceptId: 'creative-1', audienceId: 'audience-1', offerId: 'offer-1',
  attributedRevenue: 300, model: 'last_touch',
};

describe('performance aggregation', () => {
  it('aggregates revenue, margin, spend and unit economics by creative', () => {
    const result = aggregatePerformance([
      { credit, spend: 100, contributionMargin: 180, customerLtv: 500 },
      { credit: { ...credit, customerId: 'customer-2', touchpointEventId: 'ad-2', attributedRevenue: 200 }, spend: 50, contributionMargin: 120, customerLtv: 350 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ revenue: 500, contributionMargin: 300, spend: 150, customers: 2, ltv: 850 });
    expect(result[0].roas).toBeCloseTo(500 / 150);
    expect(result[0].contributionRoas).toBeCloseTo(2);
    expect(result[0].cac).toBe(75);
  });

  it('supports audience and offer dimensions', () => {
    const input = [{ credit, spend: 100, contributionMargin: 180, customerLtv: 500 }];
    expect(aggregatePerformance(input, 'audience')[0].key).toBe('audience-1');
    expect(aggregatePerformance(input, 'offer')[0].key).toBe('offer-1');
  });
});
