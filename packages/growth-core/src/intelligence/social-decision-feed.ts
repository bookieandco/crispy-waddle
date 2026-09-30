import type { GrowthId } from '../domain/types.js';
import type { SocialOpportunityScore } from './social-opportunity.js';

export interface SocialDecisionFeedItem {
  readonly id: GrowthId;
  readonly opportunityId: GrowthId;
  readonly topic: string;
  readonly decision: SocialOpportunityScore['decision'];
  readonly score: number;
  readonly evidence: readonly GrowthId[];
  readonly recommendedCapability: 'observe_social' | 'create_experiment' | 'request_governed_action';
  readonly requiresPolicyGate: boolean;
}

export function toSocialDecisionFeedItem(
  opportunity: SocialOpportunityScore,
): SocialDecisionFeedItem {
  const recommendedCapability = opportunity.decision === 'observe'
    ? 'observe_social'
    : opportunity.decision === 'test'
      ? 'create_experiment'
      : 'request_governed_action';

  return {
    id: `social-decision:${opportunity.id}` as GrowthId,
    opportunityId: opportunity.id,
    topic: opportunity.topic,
    decision: opportunity.decision,
    score: opportunity.score,
    evidence: opportunity.evidence,
    recommendedCapability,
    requiresPolicyGate: opportunity.decision === 'escalate',
  };
}

export function rankSocialDecisionFeed(
  opportunities: readonly SocialOpportunityScore[],
): readonly SocialDecisionFeedItem[] {
  return opportunities
    .map(toSocialDecisionFeedItem)
    .sort((a, b) => b.score - a.score);
}
