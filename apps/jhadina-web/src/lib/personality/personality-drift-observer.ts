import {
  decideBehavior,
  evaluateBehaviorDrift,
  expectedBehaviorFromDecision,
  planExpression,
  type BehaviorAttribution,
  type BehavioralKernelContext,
  type DriftAssessment,
  type ExpectedBehavior,
  type ObservedBehavior,
  type PersonalityState,
} from "@jhadina/core-spine"
import type { GovernedExpressionRealization } from "@jhadina/intelligence-core"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "../supabase/service-role"

export interface PersonalityDriftObservationResult {
  recorded: boolean
  assessment?: DriftAssessment
  limitation?: string
}

type PersistedPair = {
  expected: ExpectedBehavior
  observed: ObservedBehavior
}

function observedFromRealization(
  expected: ExpectedBehavior,
  realization: GovernedExpressionRealization,
  attribution: BehaviorAttribution,
): ObservedBehavior {
  const presentation = realization.presentation
  return {
    requestId: expected.requestId,
    observedAt: new Date().toISOString(),
    // Numeric posture is a governed target, not inferred psychology. The live
    // observer currently verifies categorical presentation realization and
    // attribution while retaining the target vector for longitudinal pairing.
    vector: { ...expected.vector },
    expression: {
      mode: presentation.mode,
      responseLength: presentation.responseLength,
      tone: presentation.tone,
      reasoningDepth: presentation.reasoningDepth,
      interactionStyle: presentation.interactionStyle,
      creativeStyle: presentation.creativeStyle,
      explanationStyle: presentation.explanationStyle,
      decisionPresentation: presentation.decisionPresentation,
    },
    attribution: { ...attribution },
  }
}

function validPair(value: unknown): value is PersistedPair {
  if (!value || typeof value !== "object") return false
  const pair = value as Partial<PersistedPair>
  return Boolean(pair.expected?.requestId && pair.observed?.requestId)
}

/**
 * Observation-only production drift monitor.
 *
 * This records no Personality mutation authority. It compares the governed
 * expected posture/expression with the actually realized presentation and
 * evaluates a rolling window. Semantic prose scoring is intentionally not
 * guessed from sentiment or style heuristics.
 */
export async function recordPersonalityDriftObservation(input: {
  userId: string
  requestId: string
  personality: PersonalityState
  behaviorContext: BehavioralKernelContext
  realization: GovernedExpressionRealization
  attribution?: Partial<BehaviorAttribution>
}, clientOverride?: SupabaseClient | null): Promise<PersonalityDriftObservationResult> {
  const client = clientOverride === undefined ? createServiceRoleClient() : clientOverride
  if (!client) {
    return { recorded: false, limitation: "personality drift persistence unavailable" }
  }

  try {
    const attribution: BehaviorAttribution = {
      personalityVersion: input.personality.version,
      runtimeVersion: "PERSONALITY-MEMORY.FINAL",
      expressionKernelVersion: "v2",
      ...input.attribution,
    }
    const decision = decideBehavior(input.personality, input.behaviorContext)
    const expression = planExpression(decision)
    const expected = expectedBehaviorFromDecision(
      input.requestId,
      decision,
      expression,
      attribution,
      input.behaviorContext,
    )
    const observed = observedFromRealization(expected, input.realization, attribution)

    const { data: history, error: historyError } = await client
      .from("jhadina_personality_drift_receipts")
      .select("expected,observed")
      .eq("user_id", input.userId)
      .order("evaluated_at", { ascending: false })
      .limit(19)
    if (historyError) throw new Error(historyError.message)

    const priorPairs = (history ?? [])
      .map((row) => ({ expected: row.expected, observed: row.observed }))
      .filter(validPair)
      .reverse()
    const pairs = [...priorPairs, { expected, observed }]
    const evaluatedAt = new Date().toISOString()
    const receiptId = `drift:${input.requestId}:${crypto.randomUUID()}`
    const assessment = evaluateBehaviorDrift(pairs, undefined, evaluatedAt, receiptId)

    const { error } = await client
      .from("jhadina_personality_drift_receipts")
      .upsert({
        id: receiptId,
        user_id: input.userId,
        request_id: input.requestId,
        evaluated_at: evaluatedAt,
        expected,
        observed,
        assessment,
        authority: "observation_only",
      }, { onConflict: "user_id,request_id" })
    if (error) throw new Error(error.message)

    return { recorded: true, assessment }
  } catch (error) {
    return {
      recorded: false,
      limitation: error instanceof Error ? `personality drift observation failed: ${error.message}` : "personality drift observation failed",
    }
  }
}
