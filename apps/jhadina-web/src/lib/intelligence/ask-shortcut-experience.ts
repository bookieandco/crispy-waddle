import type { DecisionProposal } from "@jhadina/core-spine"
import type { MemoryStorage } from "../storage/MemoryStorage"
import { getStorage } from "../routes/handlers"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"

export type AskShortcutKind =
  | "doctor"
  | "growth"
  | "social"
  | "director"
  | "reference-character"
  | "reference-product"

export interface RecordAskShortcutExperienceInput {
  userId: string
  activeTask: string
  proposal: DecisionProposal
  shortcut: AskShortcutKind
  metadata?: Record<string, unknown>
}

export interface RecordAskShortcutExperienceOverrides {
  storage?: MemoryStorage
}

function confidenceFor(proposal: DecisionProposal): number {
  return proposal.uncertainty.length === 0 ? 0.75 : 0.5
}

/**
 * Persists one specialized Ask Jhadina turn into the same ReasoningEvent store
 * that feeds Hippocampus on the next turn.
 *
 * This is experience-only persistence:
 * - no MemoryCandidate is created
 * - no approved Memory is written
 * - no Personality/Values/Policy state is mutated here
 * - no capability or approval is granted
 *
 * Specialized deterministic shortcuts can therefore stay outside model-driven
 * routing while still participating in Jhadina's canonical learning loop.
 */
export async function recordAskShortcutExperience(
  input: RecordAskShortcutExperienceInput,
  overrides: RecordAskShortcutExperienceOverrides = {},
): Promise<string> {
  const storage = overrides.storage ?? getStorage()
  const repository = new ReasoningEventRepository(storage)
  const now = new Date().toISOString()
  const confidence = confidenceFor(input.proposal)

  const event = await repository.create({
    userId: input.userId,
    userMessage: input.activeTask,
    observation: {
      raw: input.activeTask,
      extracted: input.activeTask,
      timestamp: now,
    },
    classification: {
      type: "CONTEXT",
      confidence,
      reasoning: `deterministic Ask shortcut=${input.shortcut}; disposition=${input.proposal.disposition}; ${input.proposal.rationale}`,
    },
    systemResponse: input.proposal.recommendation,
    confidence,
    actor: "user",
    outcome: `ask-shortcut:${input.shortcut}:${input.proposal.disposition.toLowerCase()}`,
    correlationId: input.proposal.contextId,
    metadata: {
      kind: "conversation-turn",
      source: "ask-jhadina-shortcut",
      shortcut: input.shortcut,
      proposalId: input.proposal.id,
      disposition: input.proposal.disposition,
      authority: "experience-only",
      evidenceIds: input.proposal.evidence.map((ref) => ref.id),
      ...(input.metadata ?? {}),
    },
  })

  return event.id
}
