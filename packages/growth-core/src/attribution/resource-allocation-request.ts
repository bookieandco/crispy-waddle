import type { OpportunityResourceAllocationSignal } from './resource-allocation-signal.js'

export const OPPORTUNITY_ALLOCATION_REQUESTED = 'growth.opportunity.allocation_requested'

export type OpportunityAllocationRequest = {
  eventType: typeof OPPORTUNITY_ALLOCATION_REQUESTED
  requestId: string
  opportunityId: string
  recommendation: OpportunityResourceAllocationSignal['recommendation']
  confidence: OpportunityResourceAllocationSignal['confidence']
  rationale: OpportunityResourceAllocationSignal['rationale']
  realizedProfitPerHour?: number
  requestedAt: string
  source: 'opportunity-learning'
  requiresAuthorization: true
}

export function toOpportunityAllocationRequest(
  signal: OpportunityResourceAllocationSignal,
  requestedAt = new Date().toISOString(),
): OpportunityAllocationRequest {
  return {
    eventType: OPPORTUNITY_ALLOCATION_REQUESTED,
    requestId: `allocation:${signal.opportunityId}:${signal.recommendation}`,
    opportunityId: signal.opportunityId,
    recommendation: signal.recommendation,
    confidence: signal.confidence,
    rationale: signal.rationale,
    realizedProfitPerHour: signal.realizedProfitPerHour,
    requestedAt,
    source: 'opportunity-learning',
    requiresAuthorization: true,
  }
}

export interface AllocationRequestSink {
  requestAllocation(request: OpportunityAllocationRequest): Promise<void>
}
