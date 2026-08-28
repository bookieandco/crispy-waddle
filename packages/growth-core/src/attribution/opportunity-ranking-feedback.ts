import type { OpportunityLearningAggregate } from './opportunity-learning-aggregation.js'

export type OpportunityRankingFeedback = {
  key: string
  adjustment: number
  sampleCount: number
  rationale: 'insufficient_evidence' | 'historically_overestimated' | 'historically_underestimated' | 'historically_aligned'
}

export function createOpportunityRankingFeedback(
  aggregate: OpportunityLearningAggregate,
  minimumSamples = 3,
  maxAdjustment = 15,
): OpportunityRankingFeedback {
  if (aggregate.sampleCount < minimumSamples || aggregate.averageScoreError === undefined) {
    return { key: aggregate.key, adjustment: 0, sampleCount: aggregate.sampleCount, rationale: 'insufficient_evidence' }
  }

  const rawAdjustment = aggregate.averageScoreError
  const adjustment = Math.max(-maxAdjustment, Math.min(maxAdjustment, rawAdjustment))
  const rationale = Math.abs(rawAdjustment) <= 10
    ? 'historically_aligned'
    : rawAdjustment > 0
      ? 'historically_underestimated'
      : 'historically_overestimated'

  return { key: aggregate.key, adjustment, sampleCount: aggregate.sampleCount, rationale }
}

export function applyOpportunityRankingFeedback(baseScore: number, feedback: OpportunityRankingFeedback): number {
  return Math.max(0, Math.min(100, baseScore + feedback.adjustment))
}
