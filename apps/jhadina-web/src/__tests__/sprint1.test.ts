/**
 * Unit Tests for Sprint 1 Backend
 * 
 * Tests each layer independently:
 * - InMemoryStorage
 * - MemoryRepository
 * - ReasoningEventRepository
 * - TimelineRepository
 * - Classifier
 * - JanetService
 */

import { describe, it, expect, beforeEach } from "vitest"
import { InMemoryStorage, Memory } from "../lib/storage/InMemoryStorage"
import { MemoryRepository } from "../lib/repositories/MemoryRepository"
import { ReasoningEventRepository } from "../lib/repositories/ReasoningEventRepository"
import { TimelineRepository } from "../lib/repositories/TimelineRepository"
import { Classifier } from "../lib/services/Classifier"
import { JanetService } from "../lib/services/JanetService"

// ═══════════════════════════════════════════════════════════════
// InMemoryStorage Tests
// ═══════════════════════════════════════════════════════════════

describe("InMemoryStorage", () => {
  let storage: InMemoryStorage

  beforeEach(() => {
    storage = new InMemoryStorage()
  })

  describe("Memory Operations", () => {
    it("should create a memory", () => {
      const memory = storage.createMemory({
        userId: "user_1",
        type: "PREFERENCE",
        status: "PENDING",
        content: "I prefer cinematic visuals",
        confidence: 0.95,
        createdAt: new Date().toISOString(),
      })

      expect(memory.id).toMatch(/^mem_/)
      expect(memory.content).toBe("I prefer cinematic visuals")
      expect(memory.status).toBe("PENDING")
    })

    it("should retrieve a memory by ID", () => {
      const created = storage.createMemory({
        userId: "user_1",
        type: "PREFERENCE",
        status: "PENDING",
        content: "Test content",
        confidence: 0.9,
        createdAt: new Date().toISOString(),
      })

      const retrieved = storage.getMemory(created.id)
      expect(retrieved).toBeDefined()
      expect(retrieved?.content).toBe("Test content")
    })

    it("should list memories by user", () => {
      storage.createMemory({
        userId: "user_1",
        type: "PREFERENCE",
        status: "APPROVED",
        content: "Memory 1",
        confidence: 0.9,
        createdAt: new Date().toISOString(),
      })

      storage.createMemory({
        userId: "user_1",
        type: "IDENTITY",
        status: "APPROVED",
        content: "Memory 2",
        confidence: 0.85,
        createdAt: new Date().toISOString(),
      })

      storage.createMemory({
        userId: "user_2",
        type: "GOAL",
        status: "APPROVED",
        content: "Memory 3",
        confidence: 0.8,
        createdAt: new Date().toISOString(),
      })

      const user1Memories = storage.listMemories("user_1")
      expect(user1Memories).toHaveLength(2)
      expect(user1Memories.every((m: Memory) => m.userId === "user_1")).toBe(true)
    })

    it("should update a memory", () => {
      const created = storage.createMemory({
        userId: "user_1",
        type: "PREFERENCE",
        status: "PENDING",
        content: "Original",
        confidence: 0.9,
        createdAt: new Date().toISOString(),
      })

      const updated = storage.updateMemory(created.id, {
        status: "APPROVED",
        approvedAt: new Date().toISOString(),
      })

      expect(updated?.status).toBe("APPROVED")
      expect(updated?.approvedAt).toBeDefined()
    })
  })

  describe("Candidate Operations", () => {
    it("should create a candidate", () => {
      const candidate = storage.createCandidate({
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
    })

    it("should list pending candidates", () => {
      storage.createCandidate({
        userId: "user_1",
        content: "Candidate 1",
        type: "PREFERENCE",
        confidence: 0.9,
        status: "PENDING",
        createdAt: new Date().toISOString(),
        reasoningEventId: "reason_1",
      })

      const candidates = storage.listCandidates("user_1", "PENDING")
      expect(candidates).toHaveLength(1)
    })

    it("should remove a candidate", () => {
      const candidate = storage.createCandidate({
        userId: "user_1",
        content: "Test",
        type: "PREFERENCE",
        confidence: 0.9,
        status: "PENDING",
        createdAt: new Date().toISOString(),
        reasoningEventId: "reason_1",
      })

      storage.removeCandidate(candidate.id)
      const retrieved = storage.getCandidate(candidate.id)
      expect(retrieved).toBeUndefined()
    })
  })

  describe("ReasoningEvent Operations", () => {
    it("should create a reasoning event", () => {
      const event = storage.createReasoningEvent({
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
      expect(event.userMessage).toBe("I prefer cinematic visuals")
    })

    it("should list reasoning events", () => {
      storage.createReasoningEvent({
        userId: "user_1",
        timestamp: new Date().toISOString(),
        userMessage: "Message 1",
        observation: {
          raw: "Message 1",
          extracted: "Message 1",
          timestamp: new Date().toISOString(),
        },
        classification: { type: "PREFERENCE", confidence: 0.95 },
        systemResponse: "Response 1",
        confidence: 0.95,
      })

      const events = storage.listReasoningEvents("user_1", 10)
      expect(events).toHaveLength(1)
    })
  })

  describe("Timeline Operations", () => {
    it("should append a timeline event", () => {
      const event = storage.appendTimelineEvent({
        userId: "user_1",
        timestamp: new Date().toISOString(),
        type: "REASONING",
        reasoningEventId: "reason_1",
      })

      expect(event.id).toMatch(/^timeline_/)
      expect(event.type).toBe("REASONING")
    })

    it("should list timeline events in reverse chronological order", () => {
      const now = new Date()
      const earlier = new Date(now.getTime() - 10000)

      storage.appendTimelineEvent({
        userId: "user_1",
        timestamp: earlier.toISOString(),
        type: "REASONING",
        reasoningEventId: "reason_1",
      })

      storage.appendTimelineEvent({
        userId: "user_1",
        timestamp: now.toISOString(),
        type: "APPROVAL",
        memoryId: "mem_1",
        memoryType: "PREFERENCE",
        memoryContent: "test",
        decision: "APPROVED",
      })

      const timeline = storage.listTimeline("user_1")
      expect(timeline[0].timestamp).toBe(now.toISOString())
      expect(timeline[1].timestamp).toBe(earlier.toISOString())
    })
  })

  describe("Debug Dump", () => {
    it("should generate a debug dump", () => {
      storage.createMemory({
        userId: "user_1",
        type: "PREFERENCE",
        status: "APPROVED",
        content: "Test memory",
        confidence: 0.9,
        createdAt: new Date().toISOString(),
      })

      const dump = storage.dump("user_1")
      expect(dump).toContain("InMemoryStorage Debug Dump")
      expect(dump).toContain("Approved Memories: 1")
    })
  })
})

// ═══════════════════════════════════════════════════════════════
// MemoryRepository Tests
// ═══════════════════════════════════════════════════════════════

describe("MemoryRepository", () => {
  let storage: InMemoryStorage
  let repo: MemoryRepository

  beforeEach(() => {
    storage = new InMemoryStorage()
    repo = new MemoryRepository(storage)
  })

  it("should create a candidate", async () => {
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

  it("should approve a candidate", async () => {
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
  })

  it("should reject a candidate", async () => {
    const candidate = await repo.createCandidate({
      userId: "user_1",
      content: "I prefer cinematic visuals",
      type: "PREFERENCE",
      confidence: 0.95,
      reasoningEventId: "reason_1",
    })

    await repo.reject(candidate.id, "user_1")
    const pending = await repo.listPending("user_1")
    expect(pending).toHaveLength(0)
  })

  it("should list pending candidates", async () => {
    await repo.createCandidate({
      userId: "user_1",
      content: "Candidate 1",
      type: "PREFERENCE",
      confidence: 0.95,
      reasoningEventId: "reason_1",
    })

    await repo.createCandidate({
      userId: "user_1",
      content: "Candidate 2",
      type: "IDENTITY",
      confidence: 0.9,
      reasoningEventId: "reason_2",
    })

    const pending = await repo.listPending("user_1")
    expect(pending).toHaveLength(2)
  })

  it("should search approved memories", async () => {
    const candidate = await repo.createCandidate({
      userId: "user_1",
      content: "I prefer cinematic visuals",
      type: "PREFERENCE",
      confidence: 0.95,
      reasoningEventId: "reason_1",
    })

    await repo.approve(candidate.id, "user_1")

    const results = await repo.search("user_1", {
      query: "cinematic",
    })

    expect(results).toHaveLength(1)
    expect(results[0].content).toContain("cinematic")
  })

  it("should get memory stats", async () => {
    await repo.createCandidate({
      userId: "user_1",
      content: "Test 1",
      type: "PREFERENCE",
      confidence: 0.95,
      reasoningEventId: "reason_1",
    })

    const candidate2 = await repo.createCandidate({
      userId: "user_1",
      content: "Test 2",
      type: "IDENTITY",
      confidence: 0.9,
      reasoningEventId: "reason_2",
    })

    await repo.approve(candidate2.id, "user_1")

    const stats = await repo.getStats("user_1")
    expect(stats.total).toBe(1)
    expect(stats.pending).toBe(1)
    expect(stats.byType.IDENTITY).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════
// Classifier Tests
// ═══════════════════════════════════════════════════════════════

describe("Classifier", () => {
  let classifier: Classifier

  beforeEach(() => {
    classifier = new Classifier()
  })

  it("should classify PREFERENCE", () => {
    const result = classifier.classify("I prefer cinematic visuals")
    expect(result.type).toBe("PREFERENCE")
    expect(result.confidence).toBeGreaterThan(0.9)
  })

  it("should classify IDENTITY", () => {
    const result = classifier.classify("I'm a designer")
    expect(result.type).toBe("IDENTITY")
    expect(result.confidence).toBeGreaterThan(0.85)
  })

  it("should classify GOAL", () => {
    const result = classifier.classify("I want to build systems")
    expect(result.type).toBe("GOAL")
    expect(result.confidence).toBeGreaterThan(0.85)
  })

  it("should classify CONTEXT", () => {
    const result = classifier.classify("Remember I live in SF")
    expect(result.type).toBe("CONTEXT")
    expect(result.confidence).toBeGreaterThan(0.8)
  })

  it("should default to CONTEXT with low confidence", () => {
    const result = classifier.classify("Random text with no patterns")
    expect(result.type).toBe("CONTEXT")
    expect(result.confidence).toBeLessThan(0.6)
  })

  it("should provide explanation with patterns", () => {
    const result = classifier.classifyWithExplanation("I prefer cinematic visuals")
    expect(result.patterns).toContain("'I prefer'")
  })
})

// ═══════════════════════════════════════════════════════════════
// JanetService Tests
// ═══════════════════════════════════════════════════════════════

describe("JanetService", () => {
  let storage: InMemoryStorage
  let memoryRepo: MemoryRepository
  let reasoningRepo: ReasoningEventRepository
  let timelineRepo: TimelineRepository
  let classifier: Classifier
  let service: JanetService

  beforeEach(() => {
    storage = new InMemoryStorage()
    memoryRepo = new MemoryRepository(storage)
    reasoningRepo = new ReasoningEventRepository(storage)
    timelineRepo = new TimelineRepository(storage)
    classifier = new Classifier()
    service = new JanetService(classifier, memoryRepo, reasoningRepo, timelineRepo)
  })

  it("should process a message end-to-end", async () => {
    const response = await service.processMessage({
      userId: "user_1",
      message: "I prefer cinematic visuals",
    })

    expect(response.response).toBeDefined()
    expect(response.reasoningEventId).toMatch(/^reason_/)
    expect(response.memoryCandidate.status).toBe("PENDING")
    expect(response.classification.type).toBe("PREFERENCE")
  })

  it("should approve a memory", async () => {
    const response = await service.processMessage({
      userId: "user_1",
      message: "I prefer cinematic visuals",
    })

    const approval = await service.approveMemory("user_1", response.memoryCandidate.id)
    expect(approval.status).toBe("APPROVED")
    expect(approval.memoryId).toBeDefined()
  })

  it("should create reasoning event", async () => {
    await service.processMessage({
      userId: "user_1",
      message: "I prefer cinematic visuals",
    })

    const events = await reasoningRepo.list("user_1")
    expect(events).toHaveLength(1)
    expect(events[0].userMessage).toBe("I prefer cinematic visuals")
  })

  it("should create timeline event", async () => {
    await service.processMessage({
      userId: "user_1",
      message: "I prefer cinematic visuals",
    })

    const timeline = await timelineRepo.list("user_1")
    expect(timeline).toHaveLength(1)
    expect(timeline[0].type).toBe("REASONING")
  })

  it("should get user context", async () => {
    const response = await service.processMessage({
      userId: "user_1",
      message: "I prefer cinematic visuals",
    })

    await service.approveMemory("user_1", response.memoryCandidate.id)

    const context = await service.getContext("user_1")
    expect(context).toHaveLength(1)
  })

  it("should pass health check", async () => {
    const health = await service.health()
    expect(health.status).toBe("ok")
  })
})
