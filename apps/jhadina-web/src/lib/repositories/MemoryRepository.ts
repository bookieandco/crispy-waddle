import { Memory, MemoryCandidate, MemoryType, MemoryStatus } from "../storage/InMemoryStorage"
import type { MemoryStorage } from "../storage/MemoryStorage"

export interface SearchMemoriesOptions { query?: string; type?: MemoryType; status?: MemoryStatus; limit?: number; offset?: number }

export class MemoryRepository {
  constructor(private storage: MemoryStorage) {}

  async createCandidate(params: { userId: string; content: string; type: MemoryType; confidence: number; reasoningEventId: string }): Promise<MemoryCandidate> {
    if (!params.userId) throw new Error("Memory userId is required")
    return this.storage.createCandidate({ ...params, status: "PENDING", createdAt: new Date().toISOString() })
  }

  async approve(candidateId: string, userId: string): Promise<Memory> {
    if (!userId) throw new Error("Authenticated userId is required")
    const candidate = await this.storage.getCandidate(userId, candidateId)
    if (!candidate) throw new Error(`Candidate not found: ${candidateId}`)
    if (candidate.status !== "PENDING") throw new Error(`Cannot approve non-pending candidate: ${candidateId} (status: ${candidate.status})`)
    const memory = await this.storage.createMemory({ userId: candidate.userId, type: candidate.type, status: "APPROVED", content: candidate.content, confidence: candidate.confidence, createdAt: candidate.createdAt, approvedAt: new Date().toISOString() })
    await this.storage.removeCandidate(userId, candidateId)
    return memory
  }

  async reject(candidateId: string, userId: string): Promise<void> {
    if (!userId) throw new Error("Authenticated userId is required")
    const candidate = await this.storage.getCandidate(userId, candidateId)
    if (!candidate) throw new Error(`Candidate not found: ${candidateId}`)
    if (candidate.status !== "PENDING") throw new Error(`Cannot reject non-pending candidate: ${candidateId} (status: ${candidate.status})`)
    await this.storage.removeCandidate(userId, candidateId)
  }

  async listPending(userId: string, limit = 20, offset = 0): Promise<MemoryCandidate[]> {
    if (!userId) throw new Error("Authenticated userId is required")
    return (await this.storage.listCandidates(userId, "PENDING")).slice(offset, offset + limit)
  }
  async listApproved(userId: string): Promise<Memory[]> {
    if (!userId) throw new Error("Authenticated userId is required")
    return (await this.storage.listMemories(userId)).filter(m => m.status === "APPROVED")
  }
  async search(userId: string, options: SearchMemoriesOptions = {}): Promise<Memory[]> {
    if (!userId) throw new Error("Authenticated userId is required")
    let results = (await this.storage.listMemories(userId)).filter(m => m.status === "APPROVED")
    if (options.type) results = results.filter(m => m.type === options.type)
    if (options.query) { const q = options.query.toLowerCase(); results = results.filter(m => m.content.toLowerCase().includes(q)) }
    return results.slice(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? 20))
  }
  async getById(userId: string, memoryId: string): Promise<Memory | null> {
    if (!userId) throw new Error("Authenticated userId is required")
    return (await this.storage.getMemory(userId, memoryId)) ?? null
  }
  async getContext(userId: string): Promise<Memory[]> { return this.listApproved(userId) }
  async getStats(userId: string): Promise<{ total: number; pending: number; byType: Record<MemoryType, number> }> {
    if (!userId) throw new Error("Authenticated userId is required")
    const memories = await this.storage.listMemories(userId), candidates = await this.storage.listCandidates(userId, "PENDING")
    const byType: Record<MemoryType, number> = { PREFERENCE: 0, IDENTITY: 0, GOAL: 0, CONTEXT: 0 }
    memories.filter(m => m.status === "APPROVED").forEach(m => byType[m.type]++)
    return { total: memories.filter(m => m.status === "APPROVED").length, pending: candidates.length, byType }
  }
  async dump(userId: string): Promise<string> {
    if (!userId) throw new Error("Authenticated userId is required")
    const memories = (await this.storage.listMemories(userId)).filter(m => m.status === "APPROVED")
    const candidates = await this.storage.listCandidates(userId, "PENDING")
    return ["MemoryRepository", "─".repeat(40), `Approved Memories: ${memories.length}`, `Pending Candidates: ${candidates.length}`].join("\n")
  }
}
