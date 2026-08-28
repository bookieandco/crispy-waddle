import type { OpportunityAllocationRequest } from './resource-allocation-request.js'

export type AllocationMeasurementStatus = 'planned' | 'executed' | 'partially_executed' | 'rejected' | 'cancelled'

export type OpportunityAllocationMeasurement = {
  measurementId: string
  requestId: string
  opportunityId: string
  status: AllocationMeasurementStatus
  plannedResourceUnits: number
  actualResourceUnits: number
  plannedSpend?: number
  actualSpend?: number
  currency?: string
  startedAt?: string
  completedAt?: string
  reason?: string
}

export function createAllocationMeasurement(
  request: OpportunityAllocationRequest,
  input: Omit<OpportunityAllocationMeasurement, 'measurementId' | 'requestId' | 'opportunityId'>,
): OpportunityAllocationMeasurement {
  if (input.plannedResourceUnits < 0 || input.actualResourceUnits < 0) throw new Error('allocation_resource_units_must_be_non_negative')
  if (input.plannedSpend !== undefined && input.plannedSpend < 0) throw new Error('allocation_planned_spend_must_be_non_negative')
  if (input.actualSpend !== undefined && input.actualSpend < 0) throw new Error('allocation_actual_spend_must_be_non_negative')
  return {
    ...input,
    measurementId: `allocation-measurement:${request.requestId}`,
    requestId: request.requestId,
    opportunityId: request.opportunityId,
  }
}

export interface AllocationMeasurementSink {
  record(measurement: OpportunityAllocationMeasurement): Promise<void>
}
