/**
 * Integration Test: Full API Flow
 * 
 * Tests the complete journey:
 *   1. Send message via POST /api/message
 *   2. Get candidates via GET /api/candidates
 *   3. Approve via POST /api/memory/approve
 *   4. Search memories via GET /api/memories/search
 *   5. Get stats
 * 
 * Run: npm test -- integration.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest"
import { InMemoryStorage } from "../src/lib/storage/InMemoryStorage"
import { MemoryRepository } from "../src/lib/repositories/MemoryRepository"
import { ReasoningEventRepository } from "../src/lib/repositories/ReasoningEventRepository"
import { TimelineRepository } from "../src/lib/repositories/TimelineRepository"
import { Classifier } from "../src/lib/services/Classifier"
import { JanetService } from "../src/lib/services/JanetService"

describe("Integration: Full API Flow", () => {
  let storage: InMemoryStorage
  let memoryRepo: MemoryRepository
  let reasoningRepo: ReasoningEventRepository
  let timelineRepo: TimelineRepository
  let classifier: Classifier
  let janet: JanetService
  const userId = "user_integration_test"

  beforeEach(() => {
    storage = new InMemoryStorage()
    memoryRepo = new MemoryRepository(storage)
    reasoningRepo = new ReasoningEventRepository(storage)
    timelineRepo = new TimelineRepository(storage)
    classifier = new Classifier()
    janet = new JanetService(classifier, memoryRepo, reasoningRepo, timelineRepo)
  })

  describe("Message → Candidate → Approve → Memory", () => {
    it("should complete full workflow", async () => {
      // 1. Send message
      const messageResponse = await janet.processMessage({
        userId,
        message: "I prefer cinematic visuals",
      })

      expect(messageResponse.reasoningEventId).toMatch(/^reason_/)
      expect(messageResponse.memoryCandidate.id).toMatch(/^cand_/)
      expect(messageResponse.memoryCandidate.status).toBe("PENDING")
      expect(messageResponse.classification.type).toBe("PREFERENCE")

      // 2. List candidates (should have 1)
      const candidates = await memoryRepo.listPending(userId)
      expect(candidates).toHaveLength(1)
      expect(candidates[0].id).toBe(messageResponse.memoryCandidate.id)

      // 3. Approve the candidate
      const approval = await janet.approveMemory(
        userId,
        messageResponse.memoryCandidate.id
      )
      expect(approval.status).toBe("APPROVED")
      expect(approval.memoryId).toBeDefined()

      // 4. Search should find it now
      const searchResults = await memoryRepo.search(userId, {
        query: "cinematic",
      })
      expect(searchResults).toHaveLength(1)
      expect(searchResults[0].content).toContain("cinematic")
      expect(searchResults[0].status).toBe("APPROVED")

      // 5. List candidates should be empty
      const pendingAfter = await memoryRepo.listPending(userId)
      expect(pendingAfter).toHaveLength(0)

      // 6. Stats should reflect approval
      const stats = await memoryRepo.getStats(userId)
      expect(stats.total).toBe(1)
      expect(stats.pending).toBe(0)
      expect(stats.byType.PREFERENCE).toBe(1)
    })
  })

  describe("Multiple Messages", () => {
    it("should handle multiple messages from same user", async () => {
      // Message 1: PREFERENCE
      const msg1 = await janet.processMessage({
        userId,
        message: "I prefer cinematic visuals",
      })

      // Message 2: IDENTITY
      const msg2 = await janet.processMessage({
        userId,
        message: "I'm a software engineer",
      })

      // Message 3: GOAL
      const msg3 = await janet.processMessage({
        userId,
        message: "I want to build systems",
      })

      // Should have 3 pending candidates
      const candidates = await memoryRepo.listPending(userId)
      expect(candidates).toHaveLength(3)

      // Approve all
      await janet.approveMemory(userId, msg1.memoryCandidate.id)
      await janet.approveMemory(userId, msg2.memoryCandidate.id)
      await janet.approveMemory(userId, msg3.memoryCandidate.id)

      // Stats should show all approved
      const stats = await memoryRepo.getStats(userId)
      expect(stats.total).toBe(3)
      expect(stats.byType.PREFERENCE).toBe(1)
      expect(stats.byType.IDENTITY).toBe(1)
      expect(stats.byType.GOAL).toBe(1)
    })
  })

  describe("Rejection Workflow", () => {
    it("should handle rejection", async () => {
      // Create a message
      const response = await janet.processMessage({
        userId,
        message: "Random context",
      })

      // Should be PENDING
      let candidates = await memoryRepo.listPending(userId)
      expect(candidates).toHaveLength(1)

      // Reject it
      await janet.rejectMemory(userId, response.memoryCandidate.id)

      // Should be gone
      candidates = await memoryRepo.listPending(userId)
      expect(candidates).toHaveLength(0)

      // Should not appear in search
      const approved = await memoryRepo.listApproved(userId)
      expect(approved).toHaveLength(0)
    })
  })

  describe("Timeline Events", () => {
    it("should record all events", async () => {
      // Message creates reasoning event + timeline
      const msg = await janet.processMessage({
        userId,
        message: "I prefer cinematic visuals",
      })

      let timeline = await timelineRepo.list(userId)
      expect(timeline).toHaveLength(1)
      expect(timeline[0].type).toBe("REASONING")

      // Approval creates approval event + timeline
      await janet.approveMemory(userId, msg.memoryCandidate.id)

      timeline = await timelineRepo.list(userId)
      expect(timeline).toHaveLength(2)
      expect(timeline[0].type).toBe("APPROVAL") // Most recent first
      expect(timeline[1].type).toBe("REASONING")
    })
  })

  describe("Search Functionality", () => {
    it("should search only approved memories", async () => {
      // Create 2 messages
      const msg1 = await janet.processMessage({
        userId,
        message: "I prefer cinematic visuals",
      })

      const msg2 = await janet.processMessage({
        userId,
        message: "I prefer minimalist design",
      })

      // Approve only msg1
      await janet.approveMemory(userId, msg1.memoryCandidate.id)

      // Search for "prefer"
      const results = await memoryRepo.search(userId, { query: "prefer" })

      // Should only find msg1 (msg2 is still pending)
      expect(results).toHaveLength(1)
      expect(results[0].content).toContain("cinematic")
    })

    it("should search multiple matches", async () => {
      // Create and approve 2 similar messages
      const msg1 = await janet.processMessage({
        userId,
        message: "I prefer cinematic visuals",
      })

      const msg2 = await janet.processMessage({
        userId,
        message: "I prefer minimalist design",
      })

      await janet.approveMemory(userId, msg1.memoryCandidate.id)
      await janet.approveMemory(userId, msg2.memoryCandidate.id)

      // Search for "prefer"
      const results = await memoryRepo.search(userId, { query: "prefer" })

      expect(results).toHaveLength(2)
    })

    it("should return empty for no matches", async () => {
      const msg = await janet.processMessage({
        userId,
        message: "I prefer cinematic visuals",
      })

      await janet.approveMemory(userId, msg.memoryCandidate.id)

      const results = await memoryRepo.search(userId, { query: "xyz" })
      expect(results).toHaveLength(0)
    })
  })

  describe("Classification Confidence", () => {
    it("should track confidence through workflow", async () => {
      const response = await janet.processMessage({
        userId,
        message: "I prefer cinematic visuals",
      })

      // Check candidate has confidence
      expect(response.memoryCandidate.confidence).toBeGreaterThan(0.8)

      // Approve it
      const approval = await janet.approveMemory(
        userId,
        response.memoryCandidate.id
      )

      // Search and verify confidence is preserved
      const results = await memoryRepo.search(userId, { query: "cinematic" })
      expect(results[0].confidence).toBe(response.memoryCandidate.confidence)
    })
  })

  describe("User Isolation", () => {
    it("should isolate memories between users", async () => {
      // User 1 creates memory
      const user1Response = await janet.processMessage({
        userId: "user_1",
        message: "I prefer cinematic visuals",
      })

      await janet.approveMemory("user_1", user1Response.memoryCandidate.id)

      // User 2 creates different memory
      const user2Response = await janet.processMessage({
        userId: "user_2",
        message: "I prefer minimalist design",
      })

      await janet.approveMemory("user_2", user2Response.memoryCandidate.id)

      // User 1 should only see their memory
      const user1Memories = await memoryRepo.listApproved("user_1")
      expect(user1Memories).toHaveLength(1)
      expect(user1Memories[0].content).toContain("cinematic")

      // User 2 should only see their memory
      const user2Memories = await memoryRepo.listApproved("user_2")
      expect(user2Memories).toHaveLength(1)
      expect(user2Memories[0].content).toContain("minimalist")
    })
  })

  describe("Reasoning Event Recording", () => {
    it("should record all reasoning events", async () => {
      await janet.processMessage({
        userId,
        message: "I prefer cinematic visuals",
      })

      await janet.processMessage({
        userId,
        message: "I'm a designer",
      })

      const events = await reasoningRepo.list(userId)
      expect(events).toHaveLength(2)
      expect(events[0].userMessage).toBe("I'm a designer") // Most recent first
      expect(events[1].userMessage).toBe("I prefer cinematic visuals")
    })

    it("should include classification in event", async () => {
      await janet.processMessage({
        userId,
        message: "I prefer cinematic visuals",
      })

      const events = await reasoningRepo.list(userId)
      expect(events[0].classification.type).toBe("PREFERENCE")
      expect(events[0].classification.confidence).toBeGreaterThan(0.8)
    })
  })
})
