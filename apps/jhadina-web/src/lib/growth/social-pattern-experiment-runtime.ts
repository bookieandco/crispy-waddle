import type {
  GrowthId,
  PatternExperiment,
  PatternExperimentEvidenceStore,
  PatternExperimentExecutionReport,
  PatternHypothesis,
  PatternExperimentPromotionPipelineResult,
  SocialPatternPromotionStore,
} from "@jhadina/growth-core"
import {
  StoreBackedPatternExperimentExecutionAdapter,
  evaluateAndPromoteRecordedExperiment,
} from "@jhadina/growth-core"
import { createServiceRoleClient } from "../supabase/service-role"
import { SupabasePatternExperimentEvidenceStore } from "./social-pattern-experiment-evidence-repository"
import { SupabaseSocialPatternPromotionStore } from "./social-pattern-promotion-repository"

type ExperimentRuntimeDependencies = {
  evidenceStore: PatternExperimentEvidenceStore
  promotionStore: SocialPatternPromotionStore
}

export function createSocialPatternExperimentRuntime(
  dependencies?: Partial<ExperimentRuntimeDependencies>,
): ExperimentRuntimeDependencies {
  if (dependencies?.evidenceStore && dependencies?.promotionStore) return dependencies as ExperimentRuntimeDependencies

  const client = createServiceRoleClient()
  if (!client) {
    throw new Error("social pattern experiment runtime requires SUPABASE_SERVICE_ROLE_KEY")
  }

  return {
    evidenceStore: dependencies?.evidenceStore ?? new SupabasePatternExperimentEvidenceStore(client),
    promotionStore: dependencies?.promotionStore ?? new SupabaseSocialPatternPromotionStore(client),
  }
}

/**
 * Server-only execution composition root. Raw execution reports are first
 * bound to the canonical planned experiment, persisted as immutable evidence,
 * and only then evaluated/promoted from the durable evidence record.
 */
export async function runSocialPatternExperiment(
  experiment: PatternExperiment,
  hypothesis: PatternHypothesis,
  report: PatternExperimentExecutionReport,
  dependencies?: Partial<ExperimentRuntimeDependencies>,
): Promise<PatternExperimentPromotionPipelineResult | null> {
  const runtime = createSocialPatternExperimentRuntime(dependencies)
  const execution = new StoreBackedPatternExperimentExecutionAdapter(runtime.evidenceStore)

  const evidence = await execution.record(experiment, report)
  return evaluateAndPromoteRecordedExperiment(
    experiment,
    hypothesis,
    evidence.executionId as GrowthId,
    runtime.evidenceStore,
    runtime.promotionStore,
  )
}
