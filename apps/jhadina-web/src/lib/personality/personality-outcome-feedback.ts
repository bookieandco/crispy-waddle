import { createHash } from "node:crypto"
import type { MemoryStorage } from "../storage/MemoryStorage"
import type { ReasoningEvent } from "../storage/InMemoryStorage"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"

export type PersonalityOutcomeFeedbackKind =
  | "reinforced"
  | "corrected"
  | "rejected"
  | "abandoned"

export interface PersonalityOutcomeFeedbackInput {
  userId: string
  targetReasoningEventId: string
  feedbackId: string
  kind: PersonalityOutcomeFeedbackKind
  note?: string
  observedAt?: string
}

export interface PersonalityOutcomeFeedbackResult {
  event: ReasoningEvent
  replayed: boolean
}

function normalizedNote(note: string | undefined): string | undefined {
  const value = note?.trim()
  return value ? value : undefined
}

function feedbackContent(kind: PersonalityOutcomeFeedbackKind, note?: string): string {
  if (kind === "reinforced") return note ? `Feedback: that response worked. ${note}` : "Feedback: that response worked."
  if (kind === "corrected") return `Feedback correction: ${note}`
  if (kind === "rejected") return note ? `Feedback: that response did not work. ${note}` : "Feedback: that response did not work."
  return note ? `Feedback: abandon that approach. ${note}` : "Feedback: abandon that approach."
}

function feedbackMetadata(event: ReasoningEvent): Record<string, unknown> {
  return event.metadata ?? {}
}

function deterministicFeedbackEventId(userId: string, feedbackId: string): string {
  const digest = createHash("sha256")
    .update(`jhadina-personality-feedback:v1:\0${userId}\0${feedbackId}`, "utf8")
    .digest("hex")
  return `personality_feedback_${digest}`
}

function assertReplayMatches(
  event: ReasoningEvent,
  targetId: string,
  kind: PersonalityOutcomeFeedbackKind,
  note: string | undefined,
): void {
  const metadata = feedbackMetadata(event)
  if (
    metadata.targetReasoningEventId !== targetId ||
    metadata.feedbackKind !== kind ||
    metadata.note !== note
  ) {
    throw new Error("PERSONALITY_FEEDBACK_IDEMPOTENCY_CONFLICT")
  }
}

/**
 * PROD.2-PROD.4 — append-only outcome feedback for a completed conversation.
 *
 * Feedback is another canonical reasoning-event/Hippocampal episode linked to
 * the response it evaluates. It never creates or approves a Memory candidate
 * and therefore cannot mutate durable Personality by itself.
 */
export async function recordPersonalityOutcomeFeedback(
  storage: MemoryStorage,
  input: PersonalityOutcomeFeedbackInput,
): Promise<PersonalityOutcomeFeedbackResult> {
  const userId = input.userId.trim()
  const targetId = input.targetReasoningEventId.trim()
  const feedbackId = input.feedbackId.trim()
  const note = normalizedNote(input.note)

  if (!userId) throw new Error("PERSONALITY_FEEDBACK_USER_REQUIRED")
  if (!targetId) throw new Error("PERSONALITY_FEEDBACK_TARGET_REQUIRED")
  if (!feedbackId) throw new Error("PERSONALITY_FEEDBACK_ID_REQUIRED")
  if (input.kind === "corrected" && !note) {
    throw new Error("PERSONALITY_FEEDBACK_CORRECTION_REQUIRED")
  }

  const target = await storage.getReasoningEvent(targetId)
  if (!target) throw new Error("PERSONALITY_FEEDBACK_TARGET_NOT_FOUND")
  if (target.userId !== userId) throw new Error("PERSONALITY_FEEDBACK_TARGET_USER_MISMATCH")
  if (feedbackMetadata(target).kind === "personality-outcome-feedback") {
    throw new Error("PERSONALITY_FEEDBACK_TARGET_INVALID")
  }

  const eventId = deterministicFeedbackEventId(userId, feedbackId)
  const replay = await storage.getReasoningEvent(eventId)
  if (replay) {
    assertReplayMatches(replay, targetId, input.kind, note)
    return { event: replay, replayed: true }
  }

  const observedAt = input.observedAt ?? new Date().toISOString()
  if (!Number.isFinite(Date.parse(observedAt))) {
    throw new Error("PERSONALITY_FEEDBACK_OBSERVED_AT_INVALID")
  }
  if (Date.parse(observedAt) < Date.parse(target.timestamp)) {
    throw new Error("PERSONALITY_FEEDBACK_BEFORE_TARGET")
  }
  const content = feedbackContent(input.kind, note)
  const repository = new ReasoningEventRepository(storage)
  let event: ReasoningEvent
  try {
    event = await repository.create({
      id: eventId,
      userId,
    timestamp: observedAt,
    userMessage: content,
    observation: { raw: content, extracted: content, timestamp: observedAt },
    classification: {
      type: "CONTEXT",
      confidence: 1,
      reasoning: "explicit user outcome feedback",
    },
    systemResponse: "Outcome feedback recorded for Hippocampal learning.",
    confidence: 1,
    actor: "user",
    outcome: `feedback:${input.kind}`,
    causationId: target.id,
    correlationId: target.correlationId ?? target.id,
    metadata: {
      kind: "personality-outcome-feedback",
      personalityFeedbackId: feedbackId,
      targetReasoningEventId: target.id,
      feedbackKind: input.kind,
      note,
      authority: "learning-only",
      canMutatePersonality: false,
      canAuthorizeAction: false,
    },
    })
  } catch (error) {
    // A concurrent retry can win the deterministic primary-key race after the
    // read above. Re-read the canonical id and accept only an exact semantic
    // replay; otherwise preserve the original storage failure.
    const concurrent = await storage.getReasoningEvent(eventId)
    if (!concurrent) throw error
    assertReplayMatches(concurrent, targetId, input.kind, note)
    return { event: concurrent, replayed: true }
  }

  return { event, replayed: false }
}
