import { describe, expect, it } from 'vitest';
import { reconcileDelivery } from './delivery-reconciliation.js';

describe('delivery reconciliation', () => {
  it('marks matching platform and internal records as matched', () => {
    const result = reconcileDelivery(
      { campaignId: 'c1', impressions: 1000, clicks: 50, spend: 100, currency: 'USD' },
      { campaignId: 'c1', impressions: 1000, clicks: 50, spend: 100, currency: 'USD' },
    );
    expect(result.status).toBe('matched');
    expect(result.spendVarianceRate).toBe(0);
  });

  it('flags spend and delivery discrepancies', () => {
    const result = reconcileDelivery(
      { campaignId: 'c1', impressions: 1200, clicks: 60, spend: 120, currency: 'USD' },
      { campaignId: 'c1', impressions: 1000, clicks: 50, spend: 100, currency: 'USD' },
    );
    expect(result.status).toBe('variance');
    expect(result.impressionsDelta).toBe(200);
    expect(result.clicksDelta).toBe(10);
    expect(result.spendDelta).toBe(20);
    expect(result.spendVarianceRate).toBe(0.2);
  });

  it('rejects currency mismatches', () => {
    expect(() => reconcileDelivery(
      { campaignId: 'c1', impressions: 1, clicks: 1, spend: 1, currency: 'USD' },
      { campaignId: 'c1', impressions: 1, clicks: 1, spend: 1, currency: 'MXN' },
    )).toThrow('Currency mismatch');
  });
});
