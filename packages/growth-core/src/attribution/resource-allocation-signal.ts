import type { OpportunityPerformanceSignal } from './opportunity-performance-signal.js'

export type ResourceAllocationRecommendation = 'increase_testing' | 'maintain_testing' | 'decrease_testing'

export type OpportunityResourceAllocationSignal = {
  opportunityId: string
  recommendation: ResourceAllocationRecommendation
  confidence: OpportunityPerformanceSignal['confidence']
  realizedProfitPerHour?: number
  rationale: 'strong_positive_economics' | 'insufficient_evidence' | 'weak_economics'
}

export function createResourceAllocationSignal(
  performance: OpportunityPerformanceSignal,
  positiveProfitPerHour = 25,
  weakProfitPerHour = 10,
): OpportunityResourceAllocationSignal {
  if (performance.confidence === 'strong' && (performance.realizedProfitPerHour ?? 0) >= positiveProfitPerHour) {
    return { opportunityId: performance.opportunityId, recommendation: 'increase_testing', confidence: performance.confidence, realizedProfitPerHour: performance.realizedProfitPerHour, rationale: 'strong_positive_economics' }
  }
  if (performance.confidence === 'none' || performance.confidence === 'early') {
    return { opportunityId: performance.opportunityId, recommendation: 'maintain_testing', confidence: performance.confidence, realizedProfitPerHour: performance.realizedProfitPerHour, rationale: 'insufficient_evidence' }
  }
  if ((performance.realizedProfitPerHour ?? 0) < weakProfitPerHour) {
    return { opportunityId: performance.opportunityId, recommendation: 'decrease_testing', confidence: performance.confidence, realizedProfitPerHour: performance.realizedProfitPerHour, rationale: 'weak_economics' }
  }
  return { opportunityId: performance.opportunityId, recommendation: 'maintain_testing', confidence: performance.confidence, realizedProfitPerHour: performance.realizedProfitPerHour, rationale: 'insufficient_evidence' }
}
