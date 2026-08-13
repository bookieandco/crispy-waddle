import { describe, expect, it } from 'vitest';
import { calculateCustomerValue } from './customer-value.js';

describe('calculateCustomerValue', () => {
  it('aggregates revenue, refunds, costs and margin across a customer lifetime', () => {
    const result = calculateCustomerValue('customer-1', [
      { orderId: 'order-1', customerId: 'customer-1', occurredAt: '2026-08-01T10:00:00Z', revenue: 100, refunds: 10, variableCosts: 30, currency: 'USD' },
      { orderId: 'order-2', customerId: 'customer-1', occurredAt: '2026-08-10T10:00:00Z', revenue: 150, refunds: 0, variableCosts: 50, currency: 'USD' },
      { orderId: 'order-3', customerId: 'customer-2', occurredAt: '2026-08-11T10:00:00Z', revenue: 999, refunds: 0, variableCosts: 1, currency: 'USD' },
    ]);

    expect(result.orderCount).toBe(2);
    expect(result.grossRevenue).toBe(250);
    expect(result.refunds).toBe(10);
    expect(result.variableCosts).toBe(80);
    expect(result.contributionMargin).toBe(160);
    expect(result.averageOrderValue).toBe(125);
    expect(result.firstOrderAt).toBe('2026-08-01T10:00:00Z');
    expect(result.lastOrderAt).toBe('2026-08-10T10:00:00Z');
  });

  it('returns zero economics for an unknown customer', () => {
    const result = calculateCustomerValue('missing', []);
    expect(result.orderCount).toBe(0);
    expect(result.contributionMargin).toBe(0);
    expect(result.averageOrderValue).toBe(0);
  });
});
