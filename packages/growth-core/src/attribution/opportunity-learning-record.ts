import type { OpportunityPerformanceSignal } from './opportunity-performance-signal.js'

export type OpportunityLearningRecord = {
  opportunityId: string
  recordedAt: string
  predictedScore?: number
  predictedConfidence?: number
  realizedRevenue: number
  realizedProfit: number
  realizedProfitPerHour?: number
  conversionCount: number
  performanceConfidence: OpportunityPerformanceSignal['confidence']
  currency: string
}

export function createOpportunityLearningRecord(input: {
  opportunityId: string
  predictedScore?: number
  predictedConfidence?: number
  performance: OpportunityPerformanceSignal
  currency?: string
  recordedAt?: string
}): OpportunityLearningRecord {
  if (input.performance.opportunityId !== input.opportunityId) {
    throw new Error('opportunity_learning_lineage_mismatch')
  }
  if (input.predictedScore !== undefined && (input.predictedScore < 0 || input.predictedScore > 100)) {
    throw new Error('opportunity_predicted_score_out_of_range')
  }
  if (input.predictedConfidence !== undefined && (input.predictedConfidence < 0 || input.predictedConfidence > 1)) {
    throw new Error('opportunity_predicted_confidence_out_of_range')
  }
  return {
    opportunityId: input.opportunityId,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
    predictedScore: input.predictedScore,
    predictedConfidence: input.predictedConfidence,
    realizedRevenue: input.performance.realizedRevenue,
    realizedProfit: input.performance.realizedProfit,
    realizedProfitPerHour: input.performance.realizedProfitPerHour,
    conversionCount: input.performance.conversionCount,
    performanceConfidence: input.performance.confidence,
    currency: input.currency ?? 'USD',
  }
}
