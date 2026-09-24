import type { SocialKnowledgeSummary } from './social-knowledge.js';
import type { SocialOpportunityInput, SocialOpportunityScore } from './social-opportunity.js';
import { scoreSocialOpportunity } from './social-opportunity.js';

export interface HistoricalSocialOpportunityInput extends SocialOpportunityInput {
  readonly historicalKnowledge?: SocialKnowledgeSummary;
}

export function scoreHistoricalSocialOpportunity(
  input: HistoricalSocialOpportunityInput,
): SocialOpportunityScore {
  const base = scoreSocialOpportunity(input);
  const history = input.historicalKnowledge;
  if (!history) return base;

  const historicalConfidence = Math.max(0, Math.min(1, history.confidence));
  const trendBoost = history.trend === 'rising' ? 0.08 : history.trend === 'falling' ? -0.08 : 0;
  const evidenceDepth = Math.min(1, Math.log10(Math.max(1, history.observationCount)) / 3);
  const historicalSignal = Math.max(0, Math.min(1, historicalConfidence * 0.6 + evidenceDepth * 0.4));
  const score = Math.max(0, Math.min(1, base.score * 0.82 + historicalSignal * 0.18 + trendBoost));
  const risk = base.components.risk ?? 0;
  const decision = risk >= 0.8 || score < 0.35 ? 'observe' : score >= 0.7 ? 'escalate' : 'test';

  return {
    ...base,
    score,
    decision,
    components: {
      ...base.components,
      historicalConfidence,
      historicalEvidenceDepth: evidenceDepth,
      historicalSignal,
      historicalTrend: history.trend === 'rising' ? 1 : history.trend === 'falling' ? 0 : 0.5,
    },
    evidence: [...new Set([...base.evidence, ...history.evidence])],
  };
}
