import {
  compileSideHustleObservationFromReceipt,
  type SideHustleEvidenceReceipt,
  type SideHustleExperimentObservation,
} from "@jhadina/opportunity-core"
import {
  createSupabaseOpportunityRepository,
  type StoredSideHustleExperiment,
} from "./supabase-opportunity-repository"

export type SideHustleEvidenceIngestionRepository = {
  listSideHustleExperiments(opportunityId: string): Promise<StoredSideHustleExperiment[]>
  recordSideHustleExperimentObservation(
    observation: SideHustleExperimentObservation,
  ): Promise<SideHustleExperimentObservation>
}

export type SideHustleEvidenceIngestionResult = {
  status: "recorded" | "duplicate"
  experimentId: string
  observation: SideHustleExperimentObservation
  ignoredMetrics: string[]
}

/**
 * Trusted server-side bridge for evidence emitted by owning subsystems.
 *
 * There is deliberately no public API route for arbitrary clients to claim
 * Growth/Commerce/SAM/Media evidence. Owning server workflows construct a
 * typed SideHustleEvidenceReceipt and call this function directly.
 */
export async function ingestSideHustleEvidenceReceipt(
  receipt: SideHustleEvidenceReceipt,
  repository: SideHustleEvidenceIngestionRepository = createSupabaseOpportunityRepository(),
): Promise<SideHustleEvidenceIngestionResult> {
  const records = await repository.listSideHustleExperiments(receipt.opportunityId)
  const running = records.filter(({ experiment }) => experiment.status === "running")

  const target = receipt.experimentId
    ? running.find(({ experiment }) => experiment.id === receipt.experimentId)
    : running.length === 1
      ? running[0]
      : undefined

  if (!target) {
    if (receipt.experimentId) {
      throw new Error("No matching running Side Hustle experiment exists for evidence receipt")
    }
    if (running.length === 0) {
      throw new Error("No running Side Hustle experiment exists for evidence receipt")
    }
    throw new Error("Evidence receipt is ambiguous across multiple running experiments")
  }

  const compiled = compileSideHustleObservationFromReceipt({
    experiment: target.experiment,
    receipt,
  })

  const existing = target.observations.find(
    (observation) => observation.id === compiled.observation.id,
  )
  if (existing) {
    return {
      status: "duplicate",
      experimentId: target.experiment.id,
      observation: existing,
      ignoredMetrics: compiled.ignoredMetrics,
    }
  }

  const observation = await repository.recordSideHustleExperimentObservation(
    compiled.observation,
  )

  return {
    status: "recorded",
    experimentId: target.experiment.id,
    observation,
    ignoredMetrics: compiled.ignoredMetrics,
  }
}
