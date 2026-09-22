import {
  validateSideHustleEvidenceReceipt,
  type SideHustleEvidenceReceipt,
} from '@jhadina/opportunity-core'
import type { OpportunityAllocationMeasurement } from '../attribution/allocation-measurement.js'

export type GrowthSideHustleEvidenceInput = {
  measurement: OpportunityAllocationMeasurement
  experimentId?: string
  sourceRecordId?: string
  metrics: Record<string, number>
  hours: number
  evidenceRefs: string[]
  observedAt: string
  actionRef?: string
  executionRef?: string
  notes?: string
}

/**
 * Emits an Opportunity-compatible evidence receipt from Growth.
 *
 * Growth contributes correlation and authoritative spend from the allocation
 * measurement. Business semantics remain explicit: callers must provide the
 * exact validation metric claims rather than this adapter inferring them.
 */
export function buildGrowthSideHustleEvidenceReceipt(
  input: GrowthSideHustleEvidenceInput,
): SideHustleEvidenceReceipt {
  const sourceRecordId = input.sourceRecordId?.trim() || input.measurement.requestId

  return validateSideHustleEvidenceReceipt({
    id: `growth-side-hustle-evidence:${sourceRecordId}`,
    opportunityId: input.measurement.opportunityId,
    experimentId: input.experimentId,
    sourceOwner: 'growth',
    sourceRecordType: 'allocation_measurement',
    sourceRecordId,
    observedAt: input.observedAt,
    metrics: { ...input.metrics },
    spend: input.measurement.actualSpend,
    hours: input.hours,
    evidenceRefs: [...input.evidenceRefs],
    actionRef: input.actionRef,
    executionRef: input.executionRef ?? input.measurement.executionId,
    notes: input.notes,
  })
}
