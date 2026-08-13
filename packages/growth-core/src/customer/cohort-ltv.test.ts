import { describe, expect, it } from 'vitest';
import { calculateCohortLtv, monthCohort } from './cohort-ltv.js';

describe('cohort LTV intelligence', () => {
  it('creates monthly acquisition cohorts', () => {
    expect(monthCohort('2026-08-12T10:00:00Z')).toBe('2026-08');
  });

  it('calculates contribution-margin LTV by creative cohort', () => {
    const result = calculateCohortLtv(
      [
        { customerId: 'c1', acquisitionAt: '2026-08-01T00:00:00Z', creativeId: 'creative-a' },
        { customerId: 'c2', acquisitionAt: '2026-08-02T00:00:00Z', creativeId: 'creative-a' },
        { customerId: 'c3', acquisitionAt: '2026-08-03T00:00:00Z', creativeId: 'creative-b' },
      ],
      [
        { orderId: 'o1', customerId: 'c1', occurredAt: '2026-08-01T01:00:00Z', revenue: 100, refunds: 0, variableCosts: 40, currency: 'USD' },
        { orderId: 'o2', customerId: 'c2', occurredAt: '2026-08-02T01:00:00Z', revenue: 200, refunds: 20, variableCosts: 80, currency: 'USD' },
        { orderId: 'o3', customerId: 'c3', occurredAt: '2026-08-03T01:00:00Z', revenue: 50, refunds: 0, variableCosts: 60, currency: 'USD' },
      ],
      'creativeId',
    );

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ cohortKey: 'creative-a', customerCount: 2, contributionMargin: 160, ltvPerCustomer: 80 }),
      expect.objectContaining({ cohortKey: 'creative-b', customerCount: 1, contributionMargin: -10, ltvPerCustomer: -10 }),
    ]));
  });
});
