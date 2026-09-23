import { describe, expect, it } from "vitest"
import {
  emptyPersonalityState,
  type PersonalityState,
  type PersonalityStateRepository,
} from "@jhadina/core-spine"
import { InMemoryStorage } from "../storage/InMemoryStorage"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { ProductionPersonalityContextProvider } from "./production-personality-context-provider"

async function approvedPreference(
  storage: InMemoryStorage,
  userId: string,
  content: string,
  suffix: string,
) {
  const reasoningRepo = new ReasoningEventRepository(storage)
  const memoryRepo = new MemoryRepository(storage)
  const timestamp = `2026-09-22T20:0${suffix}:00.000Z`
  const reasoning = await reasoningRepo.create({
    id: `reason-${suffix}`,
    userId,
    timestamp,
    userMessage: content,
    observation: { raw: content, extracted: content, timestamp },
    classification: { type: "PREFERENCE", confidence: 1 },
    systemResponse: "Candidate recorded.",
    confidence: 1,
  })
  const candidate = await memoryRepo.createCandidate({
    userId,
    content,
    type: "PREFERENCE",
    confidence: 1,
    reasoningEventId: reasoning.id,
  })
  return memoryRepo.approve(candidate.id, userId)
}

describe("PERSONALITY-MEMORY.FINAL lifecycle", () => {
  it("corrects by appending a revision and retiring the immutable prior memory", async () => {
    const storage = new InMemoryStorage()
    const memoryRepo = new MemoryRepository(storage)
    const reasoningRepo = new ReasoningEventRepository(storage)
    const original = await approvedPreference(storage, "owner", "I prefer direct answers.", "1")

    const correction = await reasoningRepo.create({
      id: "reason-correction",
      userId: "owner",
      timestamp: "2026-09-22T20:10:00.000Z",
      userMessage: "Actually, keep answers concise.",
      observation: {
        raw: "Actually, keep answers concise.",
        extracted: "Actually, keep answers concise.",
        timestamp: "2026-09-22T20:10:00.000Z",
      },
      classification: { type: "PREFERENCE", confidence: 1 },
      systemResponse: "Correction recorded.",
      confidence: 1,
      actor: "user",
      outcome: "memory:corrected",
      causationId: original.reasoningEventId,
    })

    const result = await memoryRepo.correct({
      memoryId: original.id,
      userId: "owner",
      content: "I prefer concise answers.",
      reasoningEventId: correction.id,
      confidence: 1,
    })

    expect(result.retired).toMatchObject({
      id: original.id,
      status: "RETIRED",
      content: "I prefer direct answers.",
      revocationReason: "corrected",
    })
    expect(result.replacement).toMatchObject({
      status: "APPROVED",
      content: "I prefer concise answers.",
      supersedesMemoryId: original.id,
      reasoningEventId: correction.id,
    })
    expect(await memoryRepo.listApproved("owner")).toEqual([result.replacement])
  })

  it("forgets by retiring active recall without deleting historical content", async () => {
    const storage = new InMemoryStorage()
    const memoryRepo = new MemoryRepository(storage)
    const original = await approvedPreference(storage, "owner", "Use cinematic visuals.", "2")

    const retired = await memoryRepo.forget(original.id, "owner")

    expect(retired.status).toBe("RETIRED")
    expect(retired.content).toBe("Use cinematic visuals.")
    expect(retired.revocationReason).toBe("forgotten")
    expect(await memoryRepo.listApproved("owner")).toEqual([])
    expect((await memoryRepo.getById("owner", original.id))?.content).toBe("Use cinematic visuals.")
  })

  it("fails closed when another user tries to correct or forget memory", async () => {
    const storage = new InMemoryStorage()
    const memoryRepo = new MemoryRepository(storage)
    const reasoningRepo = new ReasoningEventRepository(storage)
    const original = await approvedPreference(storage, "owner", "Keep it direct.", "3")
    const correction = await reasoningRepo.create({
      id: "reason-other",
      userId: "other",
      timestamp: "2026-09-22T20:20:00.000Z",
      userMessage: "Change it.",
      observation: { raw: "Change it.", extracted: "Change it.", timestamp: "2026-09-22T20:20:00.000Z" },
      classification: { type: "PREFERENCE", confidence: 1 },
      systemResponse: "No.",
      confidence: 1,
    })

    await expect(memoryRepo.correct({
      memoryId: original.id,
      userId: "other",
      content: "Change it.",
      reasoningEventId: correction.id,
    })).rejects.toThrow("not authorized")
    await expect(memoryRepo.forget(original.id, "other")).rejects.toThrow("not authorized")
    expect((await memoryRepo.getById("owner", original.id))?.status).toBe("APPROVED")
  })

  it("reconciles Personality when approved Memory evidence is forgotten", async () => {
    const storage = new InMemoryStorage()
    const memories = [
      await approvedPreference(storage, "owner", "I prefer direct answers.", "4"),
      await approvedPreference(storage, "owner", "Be direct when we plan.", "5"),
      await approvedPreference(storage, "owner", "Keep it direct.", "6"),
    ]

    let durable: PersonalityState = emptyPersonalityState("2026-09-22T19:00:00.000Z")
    const repository: PersonalityStateRepository = {
      load: async () => structuredClone(durable),
      save: async (expectedVersion, next) => {
        expect(expectedVersion).toBe(durable.version)
        durable = structuredClone(next)
      },
    }

    const first = await new ProductionPersonalityContextProvider(storage, { repository }).getContext({
      userId: "owner",
      activeTask: "Keep this direct.",
      occurredAt: "2026-09-22T20:30:00.000Z",
    })
    expect(first.personality.traits.some((trait) =>
      trait.sourcePatternId === "personality-signal:communication:directness"
    )).toBe(true)

    const memoryRepo = new MemoryRepository(storage)
    for (const memory of memories) await memoryRepo.forget(memory.id, "owner")

    const afterForget = await new ProductionPersonalityContextProvider(storage, { repository }).getContext({
      userId: "owner",
      activeTask: "Keep this direct.",
      occurredAt: "2026-09-22T20:31:00.000Z",
    })
    const direct = afterForget.personality.traits.find((trait) =>
      trait.sourcePatternId === "personality-signal:communication:directness"
    )
    expect(direct?.status).toBe("retired")
    expect(direct?.evidence).toEqual([])
    expect(afterForget.personality.version).toBeGreaterThan(first.personality.version)
  })
})
