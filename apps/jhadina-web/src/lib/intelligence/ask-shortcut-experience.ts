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


export interface FinalizeAskShortcutExperienceInput {
  userId: string
  reasoningEventId: string
  proposal: DecisionProposal
  shortcut: AskShortcutKind
  metadata?: Record<string, unknown>
}

/**
 * Finalizes the mutable outcome fields of a previously persisted shortcut
 * Experience without creating a second user turn.
 *
 * This is used when a governed subsystem action (for example Director job
 * submission) can change the final user-visible proposal after the initial
 * Experience was durably recorded. Original user text/observation/timestamp
 * remain immutable.
 */
export async function finalizeAskShortcutExperience(
  input: FinalizeAskShortcutExperienceInput,
  overrides: RecordAskShortcutExperienceOverrides = {},
): Promise<string> {
  const storage = overrides.storage ?? getStorage()
  const repository = new ReasoningEventRepository(storage)
  const existing = await repository.get(input.reasoningEventId)
  if (!existing || existing.userId !== input.userId) {
    throw new Error("ASK_SHORTCUT_EXPERIENCE_NOT_FOUND")
  }

  const confidence = confidenceFor(input.proposal)
  const updated = await repository.update(input.reasoningEventId, input.userId, {
    classification: {
      type: "CONTEXT",
      confidence,
      reasoning: `deterministic Ask shortcut=${input.shortcut}; disposition=${input.proposal.disposition}; ${input.proposal.rationale}`,
    },
    systemResponse: input.proposal.recommendation,
    confidence,
    outcome: `ask-shortcut:${input.shortcut}:${input.proposal.disposition.toLowerCase()}`,
    correlationId: input.proposal.contextId,
    metadata: {
      ...(existing.metadata ?? {}),
      shortcut: input.shortcut,
      proposalId: input.proposal.id,
      disposition: input.proposal.disposition,
      authority: "experience-only",
      evidenceIds: input.proposal.evidence.map((ref) => ref.id),
      ...(input.metadata ?? {}),
    },
  })
  if (!updated) throw new Error("ASK_SHORTCUT_EXPERIENCE_UPDATE_FAILED")
  return updated.id
}
