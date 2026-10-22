import type { ContextPacket, DecisionProposal } from "@jhadina/core-spine"
import type { ModelProvider } from "@jhadina/intelligence-core"
import { Classifier } from "../services/Classifier"

/**
 * Adapts the pre-existing regex Classifier into a `ModelProvider`, so it
 * can be IntelligenceRouter's fallback instead of the permanent
 * intelligence layer — exactly the demotion Phase 1 Step 3 calls for.
 * Classifier.ts itself is unchanged: this wraps its existing
 * classify(text) output into a DecisionProposal, it doesn't touch its
 * pattern-matching logic.
 *
 * Deliberately never throws (classify() has an unconditional low-
 * confidence CONTEXT default for anything it can't otherwise match) —
 * a fallback provider that can itself fail defeats the point of a
 * fallback, so this is IntelligenceRouter's one provider guaranteed to
 * resolve.
 */
export class LegacyClassifierProvider implements ModelProvider {
  readonly name = "legacy-classifier"

  constructor(private readonly classifier: Classifier = new Classifier()) {}

  async propose(context: ContextPacket): Promise<DecisionProposal> {
    const message = context.userGoal ?? context.purpose
    const classification = this.classifier.classify(message)

    return {
      id: `proposal_${context.id}_legacy_${crypto.randomUUID()}`,
      contextId: context.id,
      disposition: "DEFER",
      recommendation: "JLLM's primary reasoning model is unavailable, so I cannot produce a reliable general answer to that request. Existing specialist tools may still be available through their own verified routes. Check the reasoning connection or retry after it is restored.",
      rationale: "Only the non-generative legacy classifier was available. It classified the request but did not answer or verify it; no action was authorized.",

      evidence: [],
      uncertainty: [
        "Primary model reasoning and source-grounded general answers were unavailable.",
        `Non-generative request classification confidence: ${classification.confidence.toFixed(2)}`,
      ],
      alternatives: [],
    }
  }
}
