import { describe, expect, it } from "vitest"
import { buildContext } from "../context/context-builder"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import { InMemoryStorage } from "../storage/InMemoryStorage"

/**
 * End-to-end source-only proof: Facebook owner-style summaries do not bypass
 * Memory approval and do not turn into Jhadina's own PersonalityState.
 */
describe("Facebook owner review → governed Memory → Context", () => {
  it("hides pending/rejected claims, scopes users and admits approved notes as memory context only", async () => {
    const storage = new InMemoryStorage()
    const memoryRepo = new MemoryRepository(storage)
    const reasoningRepo = new ReasoningEventRepository(storage)
    const timelineRepo = new TimelineRepository(storage)
    const content = "Owner-reviewed Facebook writing observation: I frequently use brief comments and questions."
    const now = "2026-10-17T18:00:00Z"
    const reasoning = await reasoningRepo.create({
      userId: "owner-a",
      userMessage: content,
      observation: { raw: content, extracted: content, timestamp: now },
      classification: { type: "CONTEXT", confidence: 0.5 },
      systemResponse: "Facebook owner writing observation proposed.",
      confidence: 0.5,
    })
    const candidate = await memoryRepo.createCandidate({
      userId: "owner-a", content, type: "CONTEXT", confidence: 0.5,
      reasoningEventId: reasoning.id,
    })
    const ask = async (userId: string) => buildContext({ memoryRepo, timelineRepo }, {
      userId, activeTask: "Help me understand my Facebook writing style and questions",
    })
    const pending = await ask("owner-a")
    expect(pending.contextPacket.relevantMemories).toEqual([])
    expect(pending.contextPacket.personality.traits).toEqual([])

    await expect(memoryRepo.approve(candidate.id, "owner-b")).rejects.toThrow(/not authorized/)
    await memoryRepo.approve(candidate.id, "owner-a")
    const other = await ask("owner-b")
    expect(other.contextPacket.relevantMemories).toEqual([])

    const admitted = await ask("owner-a")
    expect(admitted.contextPacket.relevantMemories.some((x) => x.summary.includes("brief comments"))).toBe(true)
    expect(admitted.contextPacket.personality.traits).toEqual([])
    expect(admitted.contextPacket.personality.independentAssessmentRequired).toBe(true)
  })

  it("does not admit a rejected Facebook note into owner context", async () => {
    const storage = new InMemoryStorage()
    const memoryRepo = new MemoryRepository(storage)
    const reasoningRepo = new ReasoningEventRepository(storage)
    const timelineRepo = new TimelineRepository(storage)
    const content = "Owner-reviewed Facebook writing note that I no longer endorse."
    const now = new Date().toISOString()
    const reasoning = await reasoningRepo.create({
      userId: "owner-a", userMessage: content,
      observation: { raw: content, extracted: content, timestamp: now },
      classification: { type: "CONTEXT", confidence: 0.5 },
      systemResponse: "Proposed.", confidence: 0.5,
    })
    const candidate = await memoryRepo.createCandidate({
      userId: "owner-a", content, type: "CONTEXT",
      confidence: 0.5, reasoningEventId: reasoning.id,
    })
    await memoryRepo.reject(candidate.id, "owner-a")
    const context = await buildContext({ memoryRepo, timelineRepo }, {
      userId: "owner-a", activeTask: "Facebook writing style",
    })
    expect(context.contextPacket.relevantMemories).toEqual([])
  })
})
