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

  it("corrects and forgets approved owner notes without exposing retired content in fresh Context reads", async () => {
    const storage = new InMemoryStorage()
    const memories = new MemoryRepository(storage)
    const reasons = new ReasoningEventRepository(storage)
    const timeline = new TimelineRepository(storage)
    const original = "Owner-reviewed Facebook writing note: I prefer big paragraphs in social captions."
    const observedAt = "2026-10-17T18:00:00Z"
    const initial = await reasons.create({
      userId: "owner-a", userMessage: original,
      observation: { raw: original, extracted: original, timestamp: observedAt },
      classification: { type: "CONTEXT", confidence: 0.5 },
      systemResponse: "Proposed.", confidence: 0.5,
    })
    const candidate = await memories.createCandidate({
      userId: "owner-a", content: original, type: "CONTEXT",
      confidence: 0.5, reasoningEventId: initial.id,
    })
    const approved = await memories.approve(candidate.id, "owner-a")
    const correctionText = "Owner-reviewed Facebook writing note: I prefer shorter captions with questions."
    const correction = await reasons.create({
      userId: "owner-a", userMessage: correctionText,
      observation: { raw: correctionText, extracted: correctionText, timestamp: observedAt },
      classification: { type: "CONTEXT", confidence: 1 },
      systemResponse: "Corrected.", confidence: 1,
    })
    await expect(memories.correct({
      memoryId: approved.id, userId: "owner-b", content: "foreign update",
      confidence: 1, reasoningEventId: correction.id,
    })).rejects.toThrow(/not authorized/)
    const updated = await memories.correct({
      memoryId: approved.id, userId: "owner-a", content: correctionText,
      confidence: 1, reasoningEventId: correction.id,
    })
    expect(updated.retired.status).toBe("RETIRED")
    const query = async (userId: string) => buildContext({
      memoryRepo: new MemoryRepository(storage), timelineRepo: new TimelineRepository(storage),
    }, { userId, activeTask: "Facebook writing captions questions" })
    const active = await query("owner-a")
    expect(active.contextPacket.relevantMemories.some((ref) => ref.summary.includes("shorter captions"))).toBe(true)
    expect(active.contextPacket.relevantMemories.some((ref) => ref.summary.includes("big paragraphs"))).toBe(false)
    expect((await query("owner-b")).contextPacket.relevantMemories).toEqual([])
    await memories.forget(updated.replacement.id, "owner-a")
    expect((await query("owner-a")).contextPacket.relevantMemories).toEqual([])
    expect((await memories.listApproved("owner-a"))).toEqual([])
  })


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
