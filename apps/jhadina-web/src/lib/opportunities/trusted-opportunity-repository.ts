import type { SupabaseClient } from "@supabase/supabase-js"
import {
  applyOpportunityOutcome,
  buildOpportunityLearningSignal,
  calculateOpportunityOutcome,
  isCompleteVerification,
  type Opportunity,
  type OpportunityLearningSignal,
  type OpportunityOutcome,
  type OpportunityOutcomeObservationInput,
} from "@jhadina/opportunity-core"

/**
 * Service-role-only persistence adapter. Callers must obtain the client from
 * the existing server-only createServiceRoleClient() helper. This module never
 * reads credentials itself and must never be imported into Client Components.
 */
export async function promoteTrustedRecoveryReady(
  client: SupabaseClient,
  input: {
    userId: string
    opportunity: Opportunity
    researchCaseId: string
  },
): Promise<Opportunity> {
  if (input.opportunity.family !== "recovery") throw new Error("Trusted recovery promotion requires a recovery opportunity")
  if (input.opportunity.status !== "ready") throw new Error("Trusted recovery promotion requires ready status")
  if (!isCompleteVerification(input.opportunity.verificationDecision, input.opportunity.id)) {
    throw new Error("Trusted recovery promotion requires verification bound to this opportunity")
  }

  const { data, error } = await client.rpc("jhadina_opportunity_promote_recovery_ready_trusted", {
    p_user_id: input.userId,
    p_opportunity_id: input.opportunity.id,
    p_case_id: input.researchCaseId,
    p_opportunity: input.opportunity,
  })
  if (error || !data) throw new Error(`Unable to promote trusted recovery opportunity: ${error?.message ?? "no result returned"}`)

  const result = data as { opportunity?: Opportunity }
  if (!result.opportunity) throw new Error("Trusted recovery promotion returned no opportunity")
  return result.opportunity
}

export async function recordTrustedOpportunityOutcome(
  client: SupabaseClient,
  input: {
    userId: string
    opportunity: Opportunity
    observation: OpportunityOutcomeObservationInput
  },
): Promise<{
  opportunity: Opportunity
  outcome: OpportunityOutcome
  learningSignal: OpportunityLearningSignal
}> {
  if (input.observation.sourceOwner === "user") {
    throw new Error("Trusted outcome adapter does not accept user-reported source ownership")
  }

  const outcome = calculateOpportunityOutcome(input.observation)
  const learningSignal = buildOpportunityLearningSignal(input.opportunity, outcome)
  const closed = applyOpportunityOutcome(input.opportunity, outcome)

  const { data, error } = await client.rpc("jhadina_opportunity_record_trusted_outcome", {
    p_user_id: input.userId,
    p_opportunity_id: closed.id,
    p_opportunity: closed,
    p_outcome: outcome,
    p_learning: learningSignal,
  })
  if (error || !data) throw new Error(`Unable to record trusted opportunity outcome: ${error?.message ?? "no result returned"}`)

  const result = data as {
    opportunity?: Opportunity
    outcome?: OpportunityOutcome
    learningSignal?: OpportunityLearningSignal
  }
  if (!result.opportunity || !result.outcome || !result.learningSignal) {
    throw new Error("Trusted outcome persistence returned an incomplete receipt")
  }

  return {
    opportunity: result.opportunity,
    outcome: result.outcome,
    learningSignal: result.learningSignal,
  }
}
