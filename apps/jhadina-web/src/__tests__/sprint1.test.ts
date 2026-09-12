/**
 * Sprint 1 backend tests.
 *
 * MA-2 note: storage may create only APPROVED memories. Candidate creation
 * and approval remain repository responsibilities; tests must not bypass that
 * boundary by calling removed generic memory mutators.
 */

import { describe, it, expect, beforeEach } from "vitest"
import { InMemoryStorage } from "../lib/storage/InMemoryStorage"
import { MemoryRepository } from "../lib/repositories/MemoryRepository"
import { ReasoningEventRepository } from "../lib/repositories/ReasoningEventRepository"
import { TimelineRepository } from "../lib/repositories/TimelineRepository"
import { Classifier } from "../lib/services/Classifier"
import { JanetService } from "../lib/services/JanetService"

describe("InMemoryStorage", () => {
  let storage: InMemoryStorage

  beforeEach(() => {
    storage = new InMemoryStorage()
  })

  it("does not expose generic memory mutation", () => {
    const rawStorage = storage as unknown as Record<string, unknown>
    expect(rawStorage.createMemory).toBeUndefined()
    expect(rawStorage.updateMemory).toBeUndefined()
  })

  it("creates only approved memories through the constrained primitive", async () => {
    const approvedAt = new Date().toISOString()
    const memory = await storage.createApprovedMemory({
      userId: "user_1",
      type: "PREFERENCE",
      status: "APPROVED",
      content: "I prefer cinematic visuals",
      confidence: 0.95,
      createdAt: new Date().toISOString(),
      approvedAt,
    })

    expect(memory.id).toMatch(/^mem_/)
    expect(memory.status).toBe("APPROVED")
    expect(memory.approvedAt).toBe(approvedAt)
  })

  it("lists approved memories by user", async () => {
    await storage.createApprovedMemory({
      userId: "user_1",
      type: "PREFERENCE",
      status: "APPROVED",
      content: "Memory 1",
      confidence: 0.9,
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
    })
    await storage.createApprovedMemory({
      userId: "user_2",
      type: "GOAL",
      status: "APPROVED",
      content: "Memory 2",
      confidence: 0.8,
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
    })

    const memories = await storage.listMemories("user_1")
    expect(memories).toHaveLength(1)
    expect(memories[0].status).toBe("APPROVED")
  })

  it("creates and removes pending candidates", async () => {
    const candidate = await storage.createCandidate({
      userId: "user_1",
      content: "I prefer cinematic visuals",
      type: "PREFERENCE",
      confidence: 0.95,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      reasoningEventId: "reason_1",
    })

    expect(candidate.id).toMatch(/^cand_/)
    expect(candidate.status).toBe("PENDING")
    expect(await storage.listCandidates("user_1", "PENDING")).toHaveLength(1)

    await storage.removeCandidate(candidate.id)
    expect(await storage.getCandidate(candidate.id)).toBeUndefined()
  })

  it("records reasoning events and timeline events", async () => {
    const event = await storage.createReasoningEvent({
      userId: "user_1",
      timestamp: new Date().toISOString(),
      userMessage: "I prefer cinematic visuals",
      observation: {
        raw: "I prefer cinematic visuals",
        extracted: "I prefer cinematic visuals",
        timestamp: new Date().toISOString(),
      },
      classification: { type: "PREFERENCE", confidence: 0.95 },
      systemResponse: "Noted",
      confidence: 0.95,
    })

    expect(event.id).toMatch(/^reason_/)

    const timeline = await storage.appendTimelineEvent({
      userId: "user_1",
      timestamp: new Date().toISOString(),
      type: "REASONING",
      reasoningEventId: event.id,
    })

    expect(timeline.id).toMatch(/^timeline_/)
    expect(await storage.listReasoningEvents("user_1")).toHaveLength(1)
    expect(await storage.listTimeline("user_1")).toHaveLength(1)
  })

  it("produces a debug dump without exposing mutation methods", async () => {
    await storage.createApprovedMemory({
      userId: "user_1",
      type: "PREFERENCE",
      status: "APPROVED",
      content: "Test memory",
      confidence: 0.9,
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
    })

    const dump = storage.dump("user_1")
    expect(dump).toContain("InMemoryStorage Debug Dump")
    expect(dump).toContain("Approved Memories: 1")
  })
})

describe("MemoryRepository", () => {
  let storage: InMemoryStorage
  let repo: MemoryRepository

  beforeEach(() => {
    storage = new InMemoryStorage()
    repo = new MemoryRepository(storage)
  })

  it("creates pending candidates", async () => {
    const candidate = await repo.createCandidate({
      userId: "user_1",
      content: "I prefer cinematic visuals",
      type: "PREFERENCE",
      confidence: 0.95,
      reasoningEventId: "reason_1",
    })

    expect(candidate.status).toBe("PENDING")
    expect(candidate.content).toBe("I prefer cinematic visuals")
  })

  it("approves through the repository and creates an approved memory", async () => {
    const candidate = await repo.createCandidate({
      userId: "user_1",
      content: "I prefer cinematic visuals",
      type: "PREFERENCE",
      confidence: 0.95,
      reasoningEventId: "reason_1",
    })

    const memory = await repo.approve(candidate.id, "user_1")
    expect(memory.status).toBe("APPROVED")
    expect(memory.approvedAt).toBeDefined()
    expect(await repo.listPending("user_1")).toHaveLength(0)
    expect(await storage.listMemories("user_1")).toHaveLength(1)
  })

  it("rejects a candidate without creating a memory", async () => {
    const candidate = await repo.createCandidate({
      userId: "user_1",
      content: "Reject me",
      type: "CONTEXT",
      confidence: 0.7,
      reasoningEventId: "reason_1",
    })

    await repo.reject(candidate.id, "user_1")
    expect(await repo.listPending("user_1")).toHaveLength(0)
    expect(await storage.listMemories("user_1")).toHaveLength(0)
  })

  it("does not allow another user to approve a candidate", async () => {
    const candidate = await repo.createCandidate({
      userId: "user_1",
      content: "Private preference",
      type: "PREFERENCE",
      confidence: 0.9,
      reasoningEventId: "reason_1",
    })

    await expect(repo.approve(candidate.id, "user_2")).rejects.toThrow()
    expect(await repo.listPending("user_1")).toHaveLength(1)
    expect(await storage.listMemories("user_1")).toHaveLength(0)
  })

  it("searches only approved memory", async () => {
    const candidate = await repo.createCandidate({
      userId: "user_1",
      content: "I prefer cinematic visuals",
      type: "PREFERENCE",
      confidence: 0.95,
      reasoningEventId: "reason_1",
    })

    expect(await repo.search("user_1", { query: "cinematic" })).toHaveLength(0)
    await repo.approve(candidate.id, "user_1")
    const results = await repo.search("user_1", { query: "cinematic" })
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe("APPROVED")
  })
})

describe("Classifier", () => {
  let classifier: Classifier

  beforeEach(() => {
    classifier = new Classifier()
  })

  it("classifies common memory types", () => {
    expect(classifier.classify("I prefer cinematic visuals").type).toBe("PREFERENCE")
    expect(classifier.classify("I'm a designer").type).toBe("IDENTITY")
    expect(classifier.classify("I want to build systems").type).toBe("GOAL")
    expect(classifier.classify("Remember I live in SF").type).toBe("CONTEXT")
  })

  it("provides pattern explanations", () => {
    const result = classifier.classifyWithExplanation("I prefer cinematic visuals")
    expect(result.patterns).toContain("'I prefer'")
  })
})

describe("JanetService", () => {
  let service: JanetService
  let storage: InMemoryStorage

  beforeEach(() => {
    storage = new InMemoryStorage()
    const memoryRepo = new MemoryRepository(storage)
    const reasoningRepo = new ReasoningEventRepository(storage)
    const timelineRepo = new TimelineRepository(storage)
    service = new JanetService(
      new Classifier(),
      memoryRepo,
      reasoningRepo,
      timelineRepo,
    )
  })

  it("processes a message into a pending candidate", async () => {
    const response = await service.processMessage({
      userId: "user_1",
      message: "I prefer cinematic visuals",
    })

    expect(response.response).toBeDefined()
    expect(response.reasoningEventId).toMatch(/^reason_/)
    expect(response.memoryCandidate.status).toBe("PENDING")
    expect(response.classification.type).toBe("PREFERENCE")
    expect(await storage.listMemories("user_1")).toHaveLength(0)
  })

  it("approves a candidate through the repository boundary", async () => {
    const response = await service.processMessage({
      userId: "user_1",
      message: "I prefer cinematic visuals",
    })

    const result = await service.approveMemory("user_1", response.memoryCandidate.id)
    expect(result.status).toBe("APPROVED")
    expect(result.memoryId).toMatch(/^mem_/)
    expect(await storage.listMemories("user_1")).toHaveLength(1)
  })

  it("reports healthy", async () => {
    await expect(service.health()).resolves.toEqual({ status: "ok" })
  })
})
