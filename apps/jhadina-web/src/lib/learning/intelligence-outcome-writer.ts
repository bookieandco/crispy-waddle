import type { DecisionProposal, EvidenceRef, LearningRecordRepository } from "@jhadina/core-spine"
import { createLearningRecord } from "@jhadina/core-spine"
import type { ActionRequest } from "@jhadina/action-core"
import type { MemoryCandidate } from "../storage/InMemoryStorage"

export const INTELLIGENCE_LEARNING_DOMAIN = "intelligence"

export async function recordMemoryProposalOutcome(input: {
  repository: LearningRecordRepository
  proposal: DecisionProposal
  request: ActionRequest
  candidate: MemoryCandidate
  occurredAt: string
}): Promise<void> {
  const candidateEvidence: EvidenceRef = {
    id: `memory-candidate:${input.candidate.id}`,
    source: "memory-propose-handler",
    observedAt: input.candidate.createdAt,
    summary: `Memory candidate ${input.candidate.id} was durably created from governed proposal ${input.proposal.id}.`,
    immutable: true,
  }

  const reasoningEvidence: EvidenceRef = {
    id: `reasoning-event:${input.candidate.reasoningEventId}`,
    source: "reasoning-event-repository",
    observedAt: input.candidate.createdAt,
    summary: `Reasoning event ${input.candidate.reasoningEventId} produced the governed memory candidate.`,
    immutable: true,
  }

  const record = createLearningRecord({
    id: `learning:${input.request.id}:completed`,
    occurredAt: input.occurredAt,
    domain: INTELLIGENCE_LEARNING_DOMAIN,
    decision: {
      proposalId: input.proposal.id,
      actionRequestId: input.request.id,
    },
    evidence: [...input.proposal.evidence, candidateEvidence, reasoningEvidence],
    prediction: {
      hypothesis: input.proposal.rationale,
      expectedOutcome: "Governed memory proposal produces a durable pending memory candidate.",
      confidence: input.request.action.confidence,
    },
    outcome: {
      status: "success",
      actualOutcome: `Created pending memory candidate ${input.candidate.id}.`,
      observedAt: input.candidate.createdAt,
      evidence: [candidateEvidence, reasoningEvidence],
    },
    learningUpdate: {
      kind: "create",
      target: `memory-proposal:${input.proposal.id}`,
      reason: "The governed memory-propose action completed successfully; record the observed outcome without mutating learned state.",
      resultingState: { candidateId: input.candidate.id, status: input.candidate.status },
      updateVersion: "intelligence-memory-propose-v1",
    },
    provenance: {
      source: "governed-intelligence-runtime",
      actor: "jhadina",
      correlationId: input.proposal.contextId,
    },
  })

  await input.repository.append(record)
}
