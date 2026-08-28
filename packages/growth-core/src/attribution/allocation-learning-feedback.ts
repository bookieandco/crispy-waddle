import type { OpportunityAllocationRequest } from './resource-allocation-request.js'
import type { OpportunityAllocationMeasurement } from './allocation-measurement.js'

export const ALLOCATION_LEARNING_RECORDED = 'growth.opportunity.allocation_learning_recorded'

export type AllocationLearningFeedback = {
  eventType: typeof ALLOCATION_LEARNING_RECORDED
  eventId: string
  requestId: string
  opportunityId: string
  executionId?: string
  outcome: OpportunityAllocationMeasurement['status']
  plannedSpend: number
  actualSpend: number
  plannedResourceUnits: number
  actualResourceUnits: number
  spendVariance: number
  resourceVariance: number
  occurredAt: string
  source: 'opportunity-allocation'
}

export function createAllocationLearningFeedback(
  request: OpportunityAllocationRequest,
  measurement: OpportunityAllocationMeasurement,
  occurredAt = new Date().toISOString(),
): AllocationLearningFeedback {
  if (measurement.requestId !== request.requestId) throw new Error('allocation_learning_request_mismatch')
  if (measurement.opportunityId !== request.opportunityId) throw new Error('allocation_learning_opportunity_mismatch')
  return {
    eventType: ALLOCATION_LEARNING_RECORDED,
    eventId: `allocation-learning:${measurement.executionId ?? request.requestId}`,
    requestId: request.requestId,
    opportunityId: request.opportunityId,
    executionId: measurement.executionId,
    outcome: measurement.status,
    plannedSpend: measurement.plannedSpend,
    actualSpend: measurement.actualSpend,
    plannedResourceUnits: measurement.plannedResourceUnits,
    actualResourceUnits: measurement.actualResourceUnits,
    spendVariance: measurement.actualSpend - measurement.plannedSpend,
    resourceVariance: measurement.actualResourceUnits - measurement.plannedResourceUnits,
    occurredAt,
    source: 'opportunity-allocation',
  }
}

export interface AllocationLearningSink {
  recordLearning(feedback: AllocationLearningFeedback): Promise<void>
}
