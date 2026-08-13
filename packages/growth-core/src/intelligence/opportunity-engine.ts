import type { GrowthId } from '../domain/types.js';
import type { GrowthDecision } from './growth-decision-feed.js';

export interface GrowthOpportunity {
  id: GrowthId;
  key: string;
  rank: number;
  action: GrowthDecision['action'];
  score: number;
  expectedValue: number;
  confidence: number;
  rationale: string;
}

export function rankGrowthOpportunities(decisions: readonly GrowthDecision[]): GrowthOpportunity[] {
  const ranked = decisions.map((decision) => {
    const upside = Math.max(decision.evidence.contributionMargin, 0);
    const efficiency = Math.max(decision.evidence.contributionRoas, 0);
    const actionWeight = { scale: 1.25, test: 1, hold: 0.65, reduce: 0.35, stop: 0.1 }[decision.action];
    const score = (upside * efficiency * actionWeight) * Math.max(decision.confidence, 0.1);
    return {
      id: `opportunity:${decision.key}`,
      key: decision.key,
      rank: 0,
      action: decision.action,
      score,
      expectedValue: upside * Math.max(decision.confidence, 0.1),
      confidence: decision.confidence,
      rationale: decision.rationale,
    };
  }).sort((a, b) => b.score - a.score);

  return ranked.map((item, index) => ({ ...item, rank: index + 1 }));
}
