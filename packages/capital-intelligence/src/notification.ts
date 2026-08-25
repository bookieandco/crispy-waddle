import type { CapitalNotification, Opportunity, TreasuryRecommendation } from './domain.js';

export function opportunityNotification(opportunity: Opportunity, now = new Date().toISOString()): CapitalNotification {
  const severity = opportunity.riskScore >= 0.8 ? 'watch' : (opportunity.expectedValue ?? 0) > 0 ? 'action' : 'info';
  return {
    id: `opportunity-${opportunity.id}`,
    severity,
    title: `${opportunity.domain.toUpperCase()}: ${opportunity.instrument}`,
    body: `${opportunity.strategy} | expected value: ${opportunity.expectedValue ?? 'n/a'} | confidence: ${opportunity.confidence}`,
    opportunityId: opportunity.id,
    createdAt: now,
    expiresAt: opportunity.expiresAt,
  };
}

export function treasuryNotification(recommendation: TreasuryRecommendation): CapitalNotification {
  return {
    id: `treasury-${recommendation.id}`,
    severity: recommendation.priority === 'required' ? 'critical' : recommendation.priority === 'high' ? 'action' : 'info',
    title: `Treasury ${recommendation.kind}`,
    body: recommendation.rationale,
    recommendationId: recommendation.id,
    createdAt: recommendation.createdAt,
    expiresAt: recommendation.expiresAt,
  };
}
