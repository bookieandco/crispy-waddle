import { describe, expect, it } from 'vitest';
import { calculateRfm } from './customer-graph.js';
import { decideLifecycleAction } from './lifecycle.js';
import { calculateCustomerEconomics } from '../economics/customer-economics.js';

describe('Growth customer economics and lifecycle', () => {
  it('computes RFM and proposes repeat-customer lifecycle action without executing outreach', () => {
    const now = new Date('2026-09-21T20:00:00Z');
    const rfm = calculateRfm('c1', [
      { id: 'o1', customerId: 'c1', type: 'purchase', occurredAt: '2026-09-01T00:00:00Z', source: 'commerce', value: 120 },
      { id: 'o2', customerId: 'c1', type: 'purchase', occurredAt: '2026-09-20T00:00:00Z', source: 'commerce', value: 180 },
    ], now);
    expect(rfm.frequency).toBe(2);
    const decision = decideLifecycleAction(rfm, 0.4);
    expect(decision.stage).toBe('repeat_customer');
    expect(decision.proposedAction).toBe('cross_sell');
    expect(decision.requiresExternalCommunicationApproval).toBe(true);
  });

  it('uses contribution economics instead of revenue-only optimization', () => {
    const economics = calculateCustomerEconomics({
      spend: 200,
      newCustomers: 4,
      revenue: 800,
      repeatRevenue: 200,
      refunds: 50,
      variableCosts: 250,
    });
    expect(economics.cac).toBe(50);
    expect(economics.contributionMargin).toBe(700);
    expect(economics.netLtvPerCustomer).toBe(175);
    expect(economics.ltvToCac).toBe(3.5);
  });
});
