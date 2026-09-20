import { describe, expect, it } from 'vitest';
import { matchSbaEligibility, normalizeOpportunity, scoreOpportunity, toOpportunityScoreDimensions, canTransitionOpportunity } from './index.js';

describe('opportunity commerce core', () => {
  it('normalizes heterogeneous source records into one canonical identity', () => {
    const opportunity = normalizeOpportunity({
      externalId: 'abc-123',
      title: '  AI bookkeeping service  ',
      summary: 'Businesses already pay for bookkeeping.',
      sourceType: 'local_business',
      class: 'ai_business',
      stage: 'service',
    }, '2026-08-28T00:00:00.000Z');
    expect(opportunity.id).toBe('local_business:abc-123');
    expect(opportunity.title).toBe('AI bookkeeping service');
    expect(opportunity.status).toBe('discovered');
  });

  it('scores opportunities deterministically and requires evidence for pursue', () => {
    const opportunity = normalizeOpportunity({ externalId: 'x', title: 'x', summary: 'x', sourceType: 'affiliate' });
    const score = scoreOpportunity(opportunity, toOpportunityScoreDimensions({
      demand: 95, buyerValue: 90, distributionPotential: 90, aiLeverage: 90,
      recurringRevenue: 80, competition: 20, startupCost: 10, operationalComplexity: 15,
      regulatoryRisk: 5, evidenceConfidence: 85, personalFit: 90,
    }), undefined, '2026-08-28T00:00:00.000Z');
    expect(score.total).toBeGreaterThanOrEqual(78);
    expect(score.recommendation).toBe('pursue');
  });

  it('separates SBA eligibility from opportunity scoring', () => {
    const result = matchSbaEligibility({
      programName: 'Example SBA program',
      requiredBusinessTypes: ['LLC'],
      requiredCertifications: ['8(a)'],
      eligibleNaicsCodes: ['541611'],
      eligibleStates: ['NV'],
      requiresSmallBusinessStatus: true,
    }, {
      businessTypes: ['LLC'], certifications: ['8(a)'], naicsCodes: ['541611'], states: ['NV'], sizeEligible: true,
    });
    expect(result.eligible).toBe(true);
    expect(result.fitScore).toBe(100);
  });

  it('rejects illegal lifecycle transitions', () => {
    expect(canTransitionOpportunity('discovered', 'validated')).toBe(true);
    expect(canTransitionOpportunity('completed', 'approved')).toBe(false);
  });
});
