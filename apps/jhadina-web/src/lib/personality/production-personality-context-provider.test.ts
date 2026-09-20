import { describe, expect, it } from "vitest"
import {
  emptyPersonalityState,
  type PatternPort,
  type PersonalityState,
  type PersonalityStateRepository,
} from "@jhadina/core-spine"
import { InMemoryStorage } from "../storage/InMemoryStorage"
import { ProductionPersonalityContextProvider } from "./production-personality-context-provider"

async function seedDirectHistory(storage: InMemoryStorage, userId: string) {
  await storage.createReasoningEvent({
    userId,
    timestamp: "2026-09-19T12:00:00.000Z",
    userMessage: "I prefer direct answers when we plan.",
    observation: {
      raw: "I prefer direct answers when we plan.",
      extracted: "prefer direct answers",
      timestamp: "2026-09-19T12:00:00.000Z",
    },
    classification: { type: "PREFERENCE", confidence: 0.95 },
    systemResponse: "Understood.",
    confidence: 0.95,
  })
  await storage.createMemory({
    userId,
    type: "PREFERENCE",
    status: "APPROVED",
    content: "I prefer direct answers when we plan.",
    confidence: 0.95,
    createdAt: "2026-09-19T12:00:00.000Z",
    approvedAt: "2026-09-19T12:01:00.000Z",
  })
}

describe("ProductionPersonalityContextProvider", () => {
  it("detects patterns but fails closed to canonical empty personality when durable personality storage is unavailable", async () => {
    const storage = new InMemoryStorage()
    await seedDirectHistory(storage, "user-1")

    const provider = new ProductionPersonalityContextProvider(storage)
    const contribution = await provider.getContext({
      userId: "user-1",
      activeTask: "Please keep this answer direct while we plan.",
      occurredAt: "2026-09-20T12:00:00.000Z",
    })

    expect(
      contribution.patterns.some((pattern) => pattern.id === "recurrence:direct"),
    ).toBe(true)
    expect(
      contribution.patterns.every((pattern) => pattern.personalityEligible === false),
    ).toBe(true)
    expect(contribution.personality.version).toBe(0)
    expect(contribution.personality.traits).toEqual([])
    expect(contribution.expressionDirective.mode).toBe("direct")
    expect(contribution.expressionDirective.callback).toBeUndefined()
    expect(contribution.expressionDirective.culturalReference).toBeUndefined()
    expect(contribution.limitations).toContain(
      "personality persistence unavailable — canonical empty state used; no personality mutation performed",
    )
  })

  it("loads durable personality and derives expression without allowing Pattern confidence to mutate it", async () => {
    const storage = new InMemoryStorage()
    await seedDirectHistory(storage, "user-2")

    const durable: PersonalityState = {
      ...emptyPersonalityState("2026-09-19T00:00:00.000Z"),
      version: 4,
      voice: {
        directness: 0.3,
        warmth: 0.8,
        humor: 0.4,
        profanityTolerance: 0.2,
        quipFrequency: 0.1,
        verbosity: 0.7,
        disagreementDirectness: 0.6,
      },
      independentAssessmentRequired: false,
    }
    let saves = 0
    const repository: PersonalityStateRepository = {
      load: async () => structuredClone(durable),
      save: async () => {
        saves += 1
      },
    }

    const provider = new ProductionPersonalityContextProvider(storage, {
      repository,
    })
    const contribution = await provider.getContext({
      userId: "user-2",
      activeTask: "Please keep this answer direct while we plan.",
      occurredAt: "2026-09-20T12:00:00.000Z",
    })

    expect(contribution.personality).toEqual(durable)
    expect(contribution.personality.version).toBe(4)
    expect(contribution.expressionDirective.mode).toBe("explanatory")
    expect(saves).toBe(0)
  })

  it("retains the prior durable personality if a governed update cannot be persisted", async () => {
    const storage = new InMemoryStorage()
    const durable = emptyPersonalityState("2026-09-19T00:00:00.000Z")
    const attemptedVersions: number[] = []
    const repository: PersonalityStateRepository = {
      load: async () => structuredClone(durable),
      save: async (_expectedVersion, next) => {
        attemptedVersions.push(next.version)
        throw new Error("persistence unavailable")
      },
    }
    const observedAt = "2026-09-20T12:00:00.000Z"
    const patternPort: PatternPort = {
      detect: async () => [{
        id: "personality-signal:communication:direct",
        pattern: "prefers direct communication",
        evidence: [1, 2, 3].map((n) => ({
          id: `semantic-direct-${n}`,
          source: "semantic-detector",
          observedAt,
          summary: "repeated evidence of direct communication preference",
          immutable: true,
        })),
        confidence: 0.95,
        occurrences: 3,
        contradictions: [],
        lastObservedAt: observedAt,
        personalityDimension: "communication",
      }],
    }

    const provider = new ProductionPersonalityContextProvider(storage, {
      repository,
      patternPort,
      eligibilityRules: [{
        ruleId: "test-communication-v1",
        patternIdPrefix: "personality-signal:communication:",
        dimension: "communication",
        minimumObservations: 3,
        minimumEvidence: 3,
        maximumContradictions: 0,
        requireImmutableEvidence: true,
      }],
    })

    const contribution = await provider.getContext({
      userId: "user-3",
      activeTask: "Use direct communication.",
      occurredAt: observedAt,
    })

    expect(contribution.patterns).toHaveLength(1)
    expect(contribution.patterns[0].personalityEligible).toBe(true)
    expect(attemptedVersions).toEqual([1])
    expect(contribution.personality).toEqual(durable)
    expect(contribution.personality.version).toBe(0)
    expect(contribution.limitations).toContain(
      "personality update was not persisted — prior durable state retained",
    )
  })
  it("persists a governed semantic trait and reloads it idempotently across provider restart", async () => {
    const storage = new InMemoryStorage()
    for (let index = 1; index <= 3; index += 1) {
      await storage.createMemory({
        userId: "user-restart",
        type: "PREFERENCE",
        status: "APPROVED",
        content: index === 1
          ? "I prefer direct answers."
          : index === 2
            ? "Be direct when we plan."
            : "Keep it direct.",
        confidence: 0.95,
        createdAt: `2026-09-1${index}T12:00:00.000Z`,
        approvedAt: `2026-09-1${index}T12:01:00.000Z`,
      })
    }

    let durable = emptyPersonalityState("2026-09-10T00:00:00.000Z")
    const savedVersions: number[] = []
    const repository: PersonalityStateRepository = {
      load: async () => structuredClone(durable),
      save: async (expectedVersion, next) => {
        expect(expectedVersion).toBe(durable.version)
        durable = structuredClone(next)
        savedVersions.push(next.version)
      },
    }

    const firstProvider = new ProductionPersonalityContextProvider(storage, { repository })
    const first = await firstProvider.getContext({
      userId: "user-restart",
      activeTask: "Keep this direct.",
      occurredAt: "2026-09-20T12:00:00.000Z",
    })

    expect(first.patterns.find(
      (pattern) => pattern.id === "personality-signal:communication:directness",
    )?.personalityEligible).toBe(true)
    expect(first.personality.version).toBe(1)
    expect(first.personality.traits[0]?.status).toBe("candidate")
    expect(savedVersions).toEqual([1])

    const restartedProvider = new ProductionPersonalityContextProvider(storage, { repository })
    const replay = await restartedProvider.getContext({
      userId: "user-restart",
      activeTask: "Keep this direct.",
      occurredAt: "2026-09-20T12:05:00.000Z",
    })

    expect(replay.personality).toEqual(durable)
    expect(replay.personality.version).toBe(1)
    expect(savedVersions).toEqual([1])
  })

})
