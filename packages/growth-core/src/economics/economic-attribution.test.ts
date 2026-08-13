import { describe, expect, it } from 'vitest';
import { calculateEconomicAttribution } from './economic-attribution.js';
import type { AttributionResult } from '../attribution/attribution-engine.js';

const attribution: AttributionResult = {
  conversionId: 'conversion-1',
  model: 'linear',
  confidence: 0.8,
  sourceTouchpointIds: ['tp-1', 'tp-2'],
  credits: [
    { touchpointId: 'tp-1', creativeId: 'creative-a', credit: 0.5 },
    { touchpointId: 'tp-2', creativeId: 'creative-b', credit: 0.5 },
  ],
};

describe('calculateEconomicAttribution', () => {
  it('allocates revenue and contribution margin according to attribution credit', () => {
    const result = calculateEconomicAttribution(attribution, {
      orderId: 'order-1',
      revenue: 200,
      refunds: 20,
      variableCosts: 80,
      currency: 'USD',
    });

    expect(result.contributionMargin).toBe(100);
    expect(result.credits[0].attributedRevenue).toBe(100);
    expect(result.credits[0].attributedContributionMargin).toBe(50);
    expect(result.credits[1].attributedContributionMargin).toBe(50);
  });

  it('preserves negative contribution margin instead of hiding the loss', () => {
    const result = calculateEconomicAttribution(attribution, {
      orderId: 'order-2',
      revenue: 50,
      refunds: 10,
      variableCosts: 60,
      currency: 'USD',
    });

    expect(result.contributionMargin).toBe(-20);
    expect(result.credits[0].attributedContributionMargin).toBe(-10);
  });
});
