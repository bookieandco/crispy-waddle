import type { GrowthId } from '../domain/types.js';
import type { ActiveBuyerCluster } from './active-buyer-intelligence.js';
import type { SocialCluster } from './market-pulse.js';

export interface SocialOpportunityInput {
  readonly buyerCluster: ActiveBuyerCluster;
  readonly marketCluster?: SocialCluster;
  readonly brandFit: number;
  readonly offerFit: number;
  readonly policyRisk: number;
  readonly executionReadiness: number;
}

export interface SocialOpportunityScore {
  readonly id: GrowthId;
  readonly topic: string;
  readonly score: number;
  readonly components: Readonly<Record<string, number>>;
  readonly decision: 'observe' | 'test' | 'escalate';
  readonly evidence: readonly GrowthId[];
}

const bounded = (value: number) => Math.max(0, Math.min(1, value));

export function scoreSocialOpportunity(input: SocialOpportunityInput): SocialOpportunityScore {
  const buyer = bounded(input.buyerCluster.confidence);
  const recency = bounded(input.buyerCluster.recencyScore);
  const crossPlatform = bounded(input.buyerCluster.platforms.length / 3);
  const market = bounded(input.marketCluster?.averageEngagementRate ? input.marketCluster.averageEngagementRate * 10 : 0);
  const brandFit = bounded(input.brandFit);
  const offerFit = bounded(input.offerFit);
  const readiness = bounded(input.executionReadiness);
  const risk = bounded(input.policyRisk);

  const score = bounded(
    buyer * 0.25 + recency * 0.15 + crossPlatform * 0.10 + market * 0.10 +
    brandFit * 0.15 + offerFit * 0.15 + readiness * 0.10 - risk * 0.25,
  );

  const decision = risk >= 0.8 || score < 0.35 ? 'observe' : score >= 0.7 ? 'escalate' : 'test';

  return {
    id: `social-opportunity:${input.buyerCluster.id}` as GrowthId,
    topic: input.buyerCluster.topic,
    score,
    components: { buyer, recency, crossPlatform, market, brandFit, offerFit, readiness, risk },
    decision,
    evidence: [input.buyerCluster.id, ...(input.marketCluster ? [input.marketCluster.id] : [])],
  };
}
