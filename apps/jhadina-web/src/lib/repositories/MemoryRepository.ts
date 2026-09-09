/**
 * MemoryRepository
 *
 * Business logic layer for memory operations.
 * Enforces user ownership and approval workflow.
 *
 * Storage remains a persistence mechanism; callers must provide the
 * authenticated user explicitly. No demo/default identity is permitted.
 */

import {
  Memory,
  MemoryCandidate,
  MemoryType,
  MemoryStatus,
} from "../storage/InMemoryStorage"
import type { MemoryStorage } from "../storage/MemoryStorage"

export interface SearchMemoriesOptions {
  query?: string
  type?: MemoryType
  status?: MemoryStatus
  limit?: number
  offset?: number
}

export class MemoryRepository {
  constructor(private storage: MemoryStorage) {}

  async createCandidate(params: {
    userId: string
    content: string
    type: MemoryType
    confidence: number
    reasoningEventId: string
  }): Promise<MemoryCandidate> {
    if (!params.userId) throw new Error("Memory userId is required")
    const candidate = await this.storage.createCandidate({
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

  async approve(candidateId: string, userId: string): Promise<Memory> {
    if (!userId) throw new Error("Authenticated userId is required")
    const candidate = await this.storage.getCandidate(candidateId)
    if (!candidate) throw new Error(`Candidate not found: ${candidateId}`)
    if (candidate.status !== "PENDING") {
      throw new Error(
        `Cannot approve non-pending candidate: ${candidateId} (status: ${candidate.status})`
      )
    }
    if (candidate.userId !== userId) {
      throw new Error(`User not authorized for candidate: ${candidateId}`)
    }

    const memory = await this.storage.createMemory({
      userId: candidate.userId,
      type: candidate.type,
      status: "APPROVED",
      content: candidate.content,
      confidence: candidate.confidence,
      createdAt: candidate.createdAt,
      approvedAt: new Date().toISOString(),
    })
    await this.storage.removeCandidate(candidateId)
    return memory
  }

  async reject(candidateId: string, userId: string): Promise<void> {
    if (!userId) throw new Error("Authenticated userId is required")
    const candidate = await this.storage.getCandidate(candidateId)
    if (!candidate) throw new Error(`Candidate not found: ${candidateId}`)
    if (candidate.status !== "PENDING") {
      throw new Error(
        `Cannot reject non-pending candidate: ${candidateId} (status: ${candidate.status})`
      )
    }
    if (candidate.userId !== userId) {
      throw new Error(`User not authorized for candidate: ${candidateId}`)
    }
    await this.storage.removeCandidate(candidateId)
  }

  async listPending(userId: string, limit = 20, offset = 0): Promise<MemoryCandidate[]> {
    if (!userId) throw new Error("Authenticated userId is required")
    const all = await this.storage.listCandidates(userId, "PENDING")
    return all.slice(offset, offset + limit)
  }

  async listApproved(userId: string): Promise<Memory[]> {
    if (!userId) throw new Error("Authenticated userId is required")
    const memories = await this.storage.listMemories(userId)
    return memories.filter((m: Memory) => m.status === "APPROVED")
  }

  async search(userId: string, options: SearchMemoriesOptions = {}): Promise<Memory[]> {
    if (!userId) throw new Error("Authenticated userId is required")
    const allMemories = await this.storage.listMemories(userId)
    let results = allMemories.filter((m: Memory) => m.status === "APPROVED")
    if (options.type) results = results.filter((m: Memory) => m.type === options.type)
    if (options.query) {
      const query = options.query.toLowerCase()
      results = results.filter((m: Memory) => m.content.toLowerCase().includes(query))
    }
    const limit = options.limit ?? 20
    const offset = options.offset ?? 0
    return results.slice(offset, offset + limit)
  }

  async getById(userId: string, memoryId: string): Promise<Memory | null> {
    if (!userId) throw new Error("Authenticated userId is required")
    const memory = await this.storage.getMemory(memoryId)
    if (!memory) return null
    if (memory.userId !== userId) throw new Error(`User not authorized for memory: ${memoryId}`)
    return memory
  }

  async getContext(userId: string): Promise<Memory[]> {
    return this.listApproved(userId)
  }

  async getStats(userId: string): Promise<{
    total: number
    pending: number
    byType: Record<MemoryType, number>
  }> {
    if (!userId) throw new Error("Authenticated userId is required")
    const memories = await this.storage.listMemories(userId)
    const candidates = await this.storage.listCandidates(userId, "PENDING")
    const byType: Record<MemoryType, number> = {
      PREFERENCE: 0,
      IDENTITY: 0,
      GOAL: 0,
      CONTEXT: 0,
    }
    memories.forEach((m: Memory) => {
      if (m.status === "APPROVED") byType[m.type]++
    })
    return {
      total: memories.filter((m: Memory) => m.status === "APPROVED").length,
      pending: candidates.length,
      byType,
    }
  }

  /** Debug dump. Explicit user scope is mandatory; never fall back to a demo identity. */
  async dump(userId: string): Promise<string> {
    if (!userId) throw new Error("Authenticated userId is required")
    const lines: string[] = ["MemoryRepository", "─".repeat(40)]
    const allMemories = await this.storage.listMemories(userId)
    const memories = allMemories.filter((m: Memory) => m.status === "APPROVED")
    const candidates = await this.storage.listCandidates(userId, "PENDING")
    lines.push(`Approved Memories: ${memories.length}`)
    lines.push(`Pending Candidates: ${candidates.length}`)
    return lines.join("\n")
  }
}
