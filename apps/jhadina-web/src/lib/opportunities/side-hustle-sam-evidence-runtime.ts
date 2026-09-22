import {
  buildSamSideHustleEvidenceReceipt,
  type SamPursuitSnapshot,
} from "@jhadina/opportunity-core"
import {
  ingestSideHustleEvidenceReceipt,
  type SideHustleEvidenceIngestionRepository,
  type SideHustleEvidenceIngestionResult,
} from "./side-hustle-evidence-ingestion"
import { loadSessionSamPursuitSnapshot } from "./sam-pursuit-snapshot-runtime"

export type SamSideHustleEvidenceRuntimeInput = {
  opportunityId: string
  experimentId?: string
  spend: number
  hours: number
  observedAt?: string
  notes?: string
}

export async function ingestSamPursuitSnapshotAsSideHustleEvidence(
  input: Omit<SamSideHustleEvidenceRuntimeInput, "opportunityId"> & {
    snapshot: SamPursuitSnapshot
  },
  repository?: SideHustleEvidenceIngestionRepository,
): Promise<SideHustleEvidenceIngestionResult> {
  const receipt = buildSamSideHustleEvidenceReceipt({
    snapshot: input.snapshot,
    experimentId: input.experimentId,
    spend: input.spend,
    hours: input.hours,
    observedAt: input.observedAt,
    notes: input.notes,
  })

  return ingestSideHustleEvidenceReceipt(receipt, repository)
}

/**
 * Loads the authenticated user's canonical SAM pursuit snapshot and ingests
 * it into the active Side Hustle procurement experiment.
 */
export async function ingestSessionSamPursuitEvidence(
  input: SamSideHustleEvidenceRuntimeInput,
): Promise<SideHustleEvidenceIngestionResult> {
  const snapshot = await loadSessionSamPursuitSnapshot(input.opportunityId)
  if (!snapshot) throw new Error("SAM pursuit snapshot not found")

  return ingestSamPursuitSnapshotAsSideHustleEvidence({
    snapshot,
    experimentId: input.experimentId,
    spend: input.spend,
    hours: input.hours,
    observedAt: input.observedAt,
    notes: input.notes,
  })
}
