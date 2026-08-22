import type { ActionHandler } from "@jhadina/action-core"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import type { MemoryCandidate } from "../storage/InMemoryStorage"

/**
 * Phase 1 Step 3's one reference capability: the Intelligence Router's
 * only current effect is proposing a PENDING memory candidate through
 * the exact same durable path Step 2 already built (MemoryRepository /
 * ReasoningEventRepository). Nothing about Step 2's own governance
 * changes — a candidate is still PENDING until an explicit human
 * approve/reject call turns it into a durable memory or discards it.
 * What's new is that *creating* the candidate now passes through
 * identity -> policy -> ActionExecutor -> audit first, instead of being
 * called directly the way JanetService.processMessage() still does for
 * the legacy Classifier path.
 *
 * `memory.propose` is already allow-listed (not approval-gated) in
 * security-core's JHADINA_BASE_SECURITY_POLICY (added for exactly this
 * purpose before this Phase existed) — no policy-data change was needed
 * for this proof.
 */
export const MEMORY_PROPOSE_CAPABILITY = "memory.propose"

export interface MemoryProposeAction {
  /** The model's recommendation text — becomes the candidate's content. */
  content: string
  /** The model's rationale — recorded on the reasoning event for provenance. */
  rationale: string
  confidence: number
}

export function createMemoryProposeHandler(
  memoryRepo: MemoryRepository,
  reasoningRepo: ReasoningEventRepository,
): ActionHandler<MemoryProposeAction, MemoryCandidate> {
  return {
    supports: (type) => type === MEMORY_PROPOSE_CAPABILITY,
    async execute(action, request) {
      // Every model-originated candidate is recorded as CONTEXT.
      // core-spine's DecisionProposal carries no PREFERENCE/IDENTITY/GOAL
      // taxonomy field, and inventing one here would be exactly the kind
      // of extra classification this proof exists to avoid smuggling in.
      // Classifying memory type from model output is Context Builder
      // (Step 4) territory, not this capability's.
      const reasoningEvent = await reasoningRepo.create({
        userId: request.userId,
        userMessage: action.content,
        observation: {
          raw: action.content,
          extracted: action.content,
          timestamp: request.requestedAt,
        },
        classification: {
          type: "CONTEXT",
          confidence: action.confidence,
          reasoning: action.rationale,
        },
        systemResponse: action.rationale,
        confidence: action.confidence,
      })

      return memoryRepo.createCandidate({
        userId: request.userId,
        content: action.content,
        type: "CONTEXT",
        confidence: action.confidence,
        reasoningEventId: reasoningEvent.id,
      })
    },
  }
}
