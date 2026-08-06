/**
 * MemoryRepository
 * 
 * Business logic layer for memory operations.
 * Enforces rules: approval workflow, status transitions, search constraints.
 * 
 * Works against InMemoryStorage.
 */

import {
  Memory,
  MemoryCandidate,
  MemoryType,
  MemoryStatus,
  InMemoryStorage,
} from "./InMemoryStorage"

export interface SearchMemoriesOptions {
  query?: string
  type?: MemoryType
  status?: MemoryStatus
  limit?: number
  offset?: number
}

export class MemoryRepository {
  constructor(private storage: InMemoryStorage) {}

  /**
   * Create a memory candidate from user input
   * Status is always PENDING initially
   */
  async createCandidate(params: {
    userId: string
    content: string
    type: MemoryType
    confidence: number
    reasoningEventId: string
  }): Promise<MemoryCandidate> {
    const candidate = this.storage.createCandidate({
      userId: params.userId,
      content: params.content,
      type: params.type,
      confidence: params.confidence,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      reasoningEventId: params.reasoningEventId,
    })

    return candidate
  }

  /**
   * Approve a pending candidate
   * Moves it from PENDING → APPROVED and stores as Memory
   */
  async approve(candidateId: string, userId: string): Promise<Memory> {
    const candidate = this.storage.getCandidate(candidateId)

    if (!candidate) {
      throw new Error(`Candidate not found: ${candidateId}`)
    }

    if (candidate.status !== "PENDING") {
      throw new Error(
        `Cannot approve non-pending candidate: ${candidateId} (status: ${candidate.status})`
      )
    }

    if (candidate.userId !== userId) {
      throw new Error(`User not authorized for candidate: ${candidateId}`)
    }

    // Create approved memory
    const memory = this.storage.createMemory({
      userId: candidate.userId,
      type: candidate.type,
      status: "APPROVED",
      content: candidate.content,
      confidence: candidate.confidence,
      createdAt: candidate.createdAt,
      approvedAt: new Date().toISOString(),
    })

    // Remove candidate (it's now a memory)
    this.storage.removeCandidate(candidateId)

    return memory
  }

  /**
   * Reject a pending candidate
   * Moves it from PENDING → REJECTED (discarded)
   */
  async reject(candidateId: string, userId: string): Promise<void> {
    const candidate = this.storage.getCandidate(candidateId)

    if (!candidate) {
      throw new Error(`Candidate not found: ${candidateId}`)
    }

    if (candidate.status !== "PENDING") {
      throw new Error(
        `Cannot reject non-pending candidate: ${candidateId} (status: ${candidate.status})`
      )
    }

    if (candidate.userId !== userId) {
      throw new Error(`User not authorized for candidate: ${candidateId}`)
    }

    // Simply remove it (rejected memories don't persist)
    this.storage.removeCandidate(candidateId)
  }

  /**
   * List all pending candidates for a user
   */
  async listPending(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<MemoryCandidate[]> {
    const candidates = this.storage
      .listCandidates(userId, "PENDING")
      .slice(offset, offset + limit)

    return candidates
  }

  /**
   * Search approved memories (full-text search on content)
   */
  async search(
    userId: string,
    options: SearchMemoriesOptions = {}
  ): Promise<Memory[]> {
    let results = this.storage
      .listMemories(userId)
      .filter(m => m.status === "APPROVED")

    // Filter by type if specified
    if (options.type) {
      results = results.filter(m => m.type === options.type)
    }

    // Search by query (case-insensitive substring)
    if (options.query) {
      const query = options.query.toLowerCase()
      results = results.filter(m =>
        m.content.toLowerCase().includes(query)
      )
    }

    // Apply pagination
    const limit = options.limit ?? 20
    const offset = options.offset ?? 0
    results = results.slice(offset, offset + limit)

    return results
  }

  /**
   * Get a specific memory by ID
   */
  async getById(userId: string, memoryId: string): Promise<Memory | null> {
    const memory = this.storage.getMemory(memoryId)

    if (!memory) {
      return null
    }

    if (memory.userId !== userId) {
      throw new Error(`User not authorized for memory: ${memoryId}`)
    }

    return memory
  }

  /**
   * Get all approved memories for a user (for context building)
   */
  async getContext(userId: string): Promise<Memory[]> {
    return this.storage
      .listMemories(userId)
      .filter(m => m.status === "APPROVED")
  }

  /**
   * Get statistics about a user's memories
   */
  async getStats(userId: string): Promise<{
    total: number
    pending: number
    byType: Record<MemoryType, number>
  }> {
    const memories = this.storage.listMemories(userId)
    const candidates = this.storage.listCandidates(userId, "PENDING")

    const byType: Record<MemoryType, number> = {
      PREFERENCE: 0,
      IDENTITY: 0,
      GOAL: 0,
      CONTEXT: 0,
    }

    memories.forEach(m => {
      if (m.status === "APPROVED") {
        byType[m.type]++
      }
    })

    return {
      total: memories.filter(m => m.status === "APPROVED").length,
      pending: candidates.length,
      byType,
    }
  }

  /**
   * Debug dump
   */
  dump(userId?: string): string {
    const lines: string[] = []
    lines.push("MemoryRepository")
    lines.push("─".repeat(40))

    const memories = this.storage
      .listMemories(userId || "user_demo")
      .filter(m => m.status === "APPROVED")
    const candidates = this.storage.listCandidates(
      userId || "user_demo",
      "PENDING"
    )

    lines.push(`Approved Memories: ${memories.length}`)
    lines.push(`Pending Candidates: ${candidates.length}`)

    return lines.join("\n")
  }
}
