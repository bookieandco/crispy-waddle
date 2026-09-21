import { describe, expect, it } from 'vitest';
import { assertBudgetWithinCeiling, buildPaidCampaignOutbox, fingerprintPaidCampaign, type PaidCampaignPlan } from './paid-media.js';

const plan: PaidCampaignPlan = {
  id: 'campaign:1',
  brandId: 'brand:pupsonstuff',
  name: 'PupsonStuff prospecting',
  objective: 'sales',
  channel: 'meta',
  audienceIds: ['audience:high-ltv-lookalike'],
  creativeIds: ['creative:1'],
  currency: 'USD',
  dailyBudgetMinor: 2500,
  lifetimeBudgetMinor: 25000,
  providerAccountId: 'acct:meta:test',
};

describe('paid media governance contracts', () => {
  it('requires consumed exact paid-ad approval before an outbox job exists', () => {
    const fingerprint = fingerprintPaidCampaign(plan);
    const job = buildPaidCampaignOutbox(plan, {
      capability: 'paid-ad.publish',
      status: 'consumed',
      fingerprint,
      receiptId: 'receipt:1',
    });
    expect(job.requestFingerprint).toBe(fingerprint);
    expect(job.idempotencyKey).toBe('campaign:1:meta:acct:meta:test');
  });

  it('rejects an approval bound to a different campaign snapshot', () => {
    expect(() => buildPaidCampaignOutbox(plan, {
      capability: 'paid-ad.publish',
      status: 'consumed',
      fingerprint: 'different',
      receiptId: 'receipt:1',
    })).toThrow('GROWTH_PAID_APPROVAL_FINGERPRINT_MISMATCH');
  });

  it('rejects unsafe budgets', () => {
    expect(() => fingerprintPaidCampaign({ ...plan, dailyBudgetMinor: 0 })).toThrow('GROWTH_PAID_DAILY_BUDGET_INVALID');
  });

  it('fails closed when spend exceeds a configured ceiling', () => {
    expect(() => assertBudgetWithinCeiling(10_001, 10_000)).toThrow('GROWTH_PAID_AD_BUDGET_EXCEEDS_CEILING');
    expect(() => assertBudgetWithinCeiling(100, 0)).toThrow('GROWTH_PAID_AD_BUDGET_CEILING_NOT_CONFIGURED');
  });
});
