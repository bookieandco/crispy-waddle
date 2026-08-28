import type { OpportunityLearningRecord } from './opportunity-learning-record.js'

export type OpportunityLearningDelta = {
  opportunityId: string
  predictedScore?: number
  realizedProfit: number
  realizedRevenue: number
  scoreError?: number
  profitVariance?: number
  revenueVariance?: number
  predictionDirection?: 'overestimated' | 'underestimated' | 'aligned' | 'not_measurable'
}

export function evaluateOpportunityLearning(record: OpportunityLearningRecord): OpportunityLearningDelta {
  const realizedSignal = record.realizedProfit > 0 ? 100 : record.realizedProfit < 0 ? 0 : 50
  const scoreError = record.predictedScore === undefined ? undefined : realizedSignal - record.predictedScore
  const direction = scoreError === undefined
    ? 'not_measurable'
    : Math.abs(scoreError) <= 10
      ? 'aligned'
      : scoreError > 0
        ? 'underestimated'
        : 'overestimated'

  return {
    opportunityId: record.opportunityId,
    predictedScore: record.predictedScore,
    realizedProfit: record.realizedProfit,
    realizedRevenue: record.realizedRevenue,
    scoreError,
    profitVariance: record.realizedProfit - 0,
    revenueVariance: record.realizedRevenue - 0,
    predictionDirection: direction,
  }
}
