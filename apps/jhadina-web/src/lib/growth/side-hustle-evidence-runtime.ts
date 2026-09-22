import {
  buildGrowthSideHustleEvidenceReceipt,
  type OpportunityAllocationMeasurement,
} from "@jhadina/growth-core"
import {
  ingestSideHustleEvidenceReceipt,
  type SideHustleEvidenceIngestionRepository,
  type SideHustleEvidenceIngestionResult,
} from "@/lib/opportunities/side-hustle-evidence-ingestion"

export type GrowthSideHustleEvidenceRuntimeInput = {
  measurement: OpportunityAllocationMeasurement
  experimentId?: string
  sourceRecordId?: string
  metrics: Record<string, number>
  hours: number
  evidenceRefs: string[]
  observedAt: string
  actionRef?: string
  notes?: string
}

/**
 * Server-only Growth -> Business Factory evidence bridge.
 *
 * Growth owns the allocation measurement; Opportunity Core owns validation
 * semantics and persistence. This function does not execute a Growth action.
 */
export async function ingestGrowthMeasurementAsSideHustleEvidence(
  input: GrowthSideHustleEvidenceRuntimeInput,
  repository?: SideHustleEvidenceIngestionRepository,
): Promise<SideHustleEvidenceIngestionResult> {
  const receipt = buildGrowthSideHustleEvidenceReceipt({
    measurement: input.measurement,
    experimentId: input.experimentId,
    sourceRecordId: input.sourceRecordId,
    metrics: input.metrics,
    hours: input.hours,
    evidenceRefs: input.evidenceRefs,
    observedAt: input.observedAt,
    actionRef: input.actionRef,
    notes: input.notes,
  })

  return ingestSideHustleEvidenceReceipt(receipt, repository)
}
