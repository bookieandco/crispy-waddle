import { describe, expect, it } from "vitest"
import { InMemoryStorage } from "../storage/InMemoryStorage"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { PersistedExperiencePatternAdapter } from "../hippocampus/persisted-experience-pattern-adapter"
import { ProductionPersonalityContextProvider } from "./production-personality-context-provider"
import { recordPersonalityOutcomeFeedback } from "./personality-outcome-feedback"

async function target(storage: InMemoryStorage, userId = "user-feedback") {
  return new ReasoningEventRepository(storage).create({
    userId,
    timestamp: "2026-09-20T22:00:00.000Z",
    userMessage: "Give me the short version",
    observation: {
      raw: "Give me the short version",
      extracted: "Give me the short version",
      timestamp: "2026-09-20T22:00:00.000Z",
    },
    classification: { type: "CONTEXT", confidence: 0.9 },
    systemResponse: "Here is the short version.",
    confidence: 0.9,
    actor: "user",
    correlationId: "conversation-1",
  })
}

describe("PERSONALITY-V2.PROD.2-PROD.4 outcome feedback", () => {
  it("records explicit feedback as a causally linked Hippocampal episode without creating durable Memory", async () => {
    const storage = new InMemoryStorage()
    const original = await target(storage)

    const result = await recordPersonalityOutcomeFeedback(storage, {
      userId: original.userId,
      targetReasoningEventId: original.id,
      feedbackId: "feedback-1",
      kind: "reinforced",
      observedAt: "2026-09-20T22:01:00.000Z",
    })

    expect(result.replayed).toBe(false)
    expect(result.event.actor).toBe("user")
    expect(result.event.outcome).toBe("feedback:reinforced")
    expect(result.event.causationId).toBe(original.id)
    expect(result.event.correlationId).toBe("conversation-1")
    expect(result.event.metadata).toMatchObject({
      kind: "personality-outcome-feedback",
      personalityFeedbackId: "feedback-1",
      targetReasoningEventId: original.id,
      authority: "learning-only",
      canMutatePersonality: false,
      canAuthorizeAction: false,
    })

    expect(await new MemoryRepository(storage).listApproved(original.userId)).toEqual([])
    expect(await new MemoryRepository(storage).listPending(original.userId)).toEqual([])

    const detected = await new PersistedExperiencePatternAdapter(storage).detectExperience({
      userId: original.userId,
      experience: {
        id: "next-turn",
        occurredAt: "2026-09-20T22:02:00.000Z",
        source: "ask-jhadina",
        actor: "user",
        content: "Feedback: that response worked again.",
        evidence: [],
      },
    })
    expect(detected.relatedEpisodes.some((episode) => episode.episodeId === result.event.id)).toBe(true)
    expect(detected.relatedEpisodes.find((episode) => episode.episodeId === result.event.id)?.outcome)
      .toBe("feedback:reinforced")
    expect(detected.patterns.filter((pattern) => pattern.id.startsWith("episodic-recurrence:"))
      .every((pattern) => pattern.personalityEligible === false)).toBe(true)
  })

  it("is idempotent by application-owned feedback id and rejects conflicting replay", async () => {
    const storage = new InMemoryStorage()
    const original = await target(storage)
    const input = {
      userId: original.userId,
      targetReasoningEventId: original.id,
      feedbackId: "stable-feedback-id",
      kind: "rejected" as const,
      observedAt: "2026-09-20T22:01:00.000Z",
    }

    const first = await recordPersonalityOutcomeFeedback(storage, input)
    const replay = await recordPersonalityOutcomeFeedback(storage, input)
    expect(replay.replayed).toBe(true)
    expect(replay.event.id).toBe(first.event.id)
    expect(await new ReasoningEventRepository(storage).count(original.userId)).toBe(2)

    await expect(recordPersonalityOutcomeFeedback(storage, {
      ...input,
      kind: "abandoned",
    })).rejects.toThrow("PERSONALITY_FEEDBACK_IDEMPOTENCY_CONFLICT")
  })

  it("fails closed across users and requires an explicit correction when kind is corrected", async () => {
    const storage = new InMemoryStorage()
    const original = await target(storage, "owner")

    await expect(recordPersonalityOutcomeFeedback(storage, {
      userId: "attacker",
      targetReasoningEventId: original.id,
      feedbackId: "cross-user",
      kind: "rejected",
    })).rejects.toThrow("PERSONALITY_FEEDBACK_TARGET_USER_MISMATCH")

    await expect(recordPersonalityOutcomeFeedback(storage, {
      userId: original.userId,
      targetReasoningEventId: original.id,
      feedbackId: "missing-correction",
      kind: "corrected",
    })).rejects.toThrow("PERSONALITY_FEEDBACK_CORRECTION_REQUIRED")

    await expect(recordPersonalityOutcomeFeedback(storage, {
      userId: original.userId,
      targetReasoningEventId: original.id,
      feedbackId: "before-target",
      kind: "rejected",
      observedAt: "2026-09-20T21:59:59.000Z",
    })).rejects.toThrow("PERSONALITY_FEEDBACK_BEFORE_TARGET")
  })

  it("does not permit feedback-on-feedback chains to masquerade as fresh outcome evidence", async () => {
    const storage = new InMemoryStorage()
    const original = await target(storage)
    const first = await recordPersonalityOutcomeFeedback(storage, {
      userId: original.userId,
      targetReasoningEventId: original.id,
      feedbackId: "feedback-parent",
      kind: "reinforced",
      observedAt: "2026-09-20T22:01:00.000Z",
    })

    await expect(recordPersonalityOutcomeFeedback(storage, {
      userId: original.userId,
      targetReasoningEventId: first.event.id,
      feedbackId: "feedback-child",
      kind: "reinforced",
      observedAt: "2026-09-20T22:02:00.000Z",
    })).rejects.toThrow("PERSONALITY_FEEDBACK_TARGET_INVALID")
  })

  it("cannot turn outcome feedback alone into durable Personality", async () => {
    const storage = new InMemoryStorage()
    const original = await target(storage)
    await recordPersonalityOutcomeFeedback(storage, {
      userId: original.userId,
      targetReasoningEventId: original.id,
      feedbackId: "feedback-direct",
      kind: "rejected",
      note: "Keep it direct next time",
      observedAt: "2026-09-20T22:01:00.000Z",
    })

    const provider = new ProductionPersonalityContextProvider(storage, { repository: null })
    const contribution = await provider.getContext({
      userId: original.userId,
      activeTask: "Keep it direct",
      occurredAt: "2026-09-20T22:02:00.000Z",
    })

    expect(contribution.personality.version).toBe(0)
    expect(contribution.personality.traits).toEqual([])
    expect(contribution.patterns.every((pattern) =>
      !pattern.id.startsWith("episodic-recurrence:") || pattern.personalityEligible === false,
    )).toBe(true)
  })
})
