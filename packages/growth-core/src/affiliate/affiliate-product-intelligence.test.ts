import { describe, expect, it } from 'vitest';
import {
  assessAffiliateProduct,
  buildAffiliateProductTestPlan,
  type AffiliateProductCandidate,
} from './affiliate-product-intelligence.js';

describe('affiliate product intelligence', () => {
  const candidate: AffiliateProductCandidate = {
    id: 'product:wallet',
    brandId: 'brand:bookie',
    name: 'Example Wallet',
    category: 'mens accessories',
    sourceSignals: [
      {
        source: 'commerce_marketplace',
        capturedAt: '2026-08-27T00:00:00Z',
        revenue30d: 120000,
        dailyRevenue: 6000,
        payout: 90,
        launchAgeDays: 30,
        momentum: 82,
        creativeAssetCount: 12,
      },
    ],
    audienceFit: 85,
    problemClarity: 90,
    creativeFit: 80,
    complianceRisk: 10,
    unitEconomicsScore: 78,
  };

  it('scores a strong candidate as a test', () => {
    const assessment = assessAffiliateProduct(candidate);
    expect(assessment.recommendation).toBe('test');
    expect(assessment.score).toBeGreaterThanOrEqual(65);
    expect(assessment.requiredChecks.length).toBeGreaterThan(0);
  });

  it('rejects high-risk candidates regardless of growth signals', () => {
    const assessment = assessAffiliateProduct({ ...candidate, complianceRisk: 90 });
    expect(assessment.recommendation).toBe('reject');
  });

  it('creates a bounded test plan only for test candidates', () => {
    const assessment = assessAffiliateProduct(candidate);
    const plan = buildAffiliateProductTestPlan(candidate, assessment);
    expect(plan?.variants).toHaveLength(4);
    expect(plan?.maxBudget).toBeGreaterThan(0);
    expect(plan?.successMetric).toBe('contribution_roas');
  });
});
