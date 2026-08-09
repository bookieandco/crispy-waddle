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
} from "../storage/InMemoryStorage"

export interface SearchMemoriesOptions {
  query?: string
  type?: MemoryType
  status?: MemoryStatus
  limit?: number
  offset?: number
}

export class MemoryRepository {
  constructor(private storage: InMemoryStorage) {}

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

  async approve(candidateId: string, userId: string): Promise<Memory> {
    const candidate = this.storage.getCandidate(candidateId)
    if (!candidate) throw new Error(`Candidate not found: ${candidateId}`)
    if (candidate.status !== "PENDING") {
      throw new Error(`Cannot approve non-pending candidate: ${candidateId} (status: ${candidate.status})`)
    }
    if (candidate.userId !== userId) throw new Error(`User not authorized for candidate: ${candidateId}`)

    const memory = this.storage.createMemory({
      userId: candidate.userId,
      type: candidate.type,
      status: "APPROVED",
      content: candidate.content,
      confidence: candidate.confidence,
      createdAt: candidate.createdAt,
      approvedAt: new Date().toISOString(),
    })
    this.storage.removeCandidate(candidateId)
    return memory
  }

  async reject(candidateId: string, userId: string): Promise<void> {
    const candidate = this.storage.getCandidate(candidateId)
    if (!candidate) throw new Error(`Candidate not found: ${candidateId}`)
    if (candidate.status !== "PENDING") {
      throw new Error(`Cannot reject non-pending candidate: ${candidateId} (status: ${candidate.status})`)
    }
    if (candidate.userId !== userId) throw new Error(`User not authorized for candidate: ${candidateId}`)
    this.storage.removeCandidate(candidateId)
  }

  async listPending(userId: string, limit: number = 20, offset: number = 0): Promise<MemoryCandidate[]> {
    return this.storage.listCandidates(userId, "PENDING").slice(offset, offset + limit)
  }

  async search(userId: string, options: SearchMemoriesOptions = {}): Promise<Memory[]> {
    let results = this.storage.listMemories(userId).filter(m => m.status === "APPROVED")
    if (options.type) results = results.filter(m => m.type === options.type)
    if (options.query) {
      const query = options.query.toLowerCase()
      results = results.filter(m => m.content.toLowerCase().includes(query))
    }
    const limit = options.limit ?? 20
    const offset = options.offset ?? 0
    return results.slice(offset, offset + limit)
  }

  async getById(userId: string, memoryId: string): Promise<Memory | null> {
    const memory = this.storage.getMemory(memoryId)
    if (!memory) return null
    if (memory.userId !== userId) throw new Error(`User not authorized for memory: ${memoryId}`)
    return memory
  }

  async getContext(userId: string): Promise<Memory[]> {
    return this.storage.listMemories(userId).filter(m => m.status === "APPROVED")
  }

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
      if (m.status === "APPROVED") byType[m.type]++
    })
    return {
      total: memories.filter(m => m.status === "APPROVED").length,
      pending: candidates.length,
      byType,
    }
  }

  dump(userId?: string): string {
    const lines: string[] = []
    lines.push("MemoryRepository")
    lines.push("─".repeat(40))
    const user = userId || "user_demo"
    const memories = this.storage.listMemories(user).filter(m => m.status === "APPROVED")
    const candidates = this.storage.listCandidates(user, "PENDING")
    lines.push(`Approved Memories: ${memories.length}`)
    lines.push(`Pending Candidates: ${candidates.length}`)
    return lines.join("\n")
  }
}
