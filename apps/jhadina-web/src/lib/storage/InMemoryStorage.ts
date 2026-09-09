import type { MemoryStorage } from "./MemoryStorage"

export interface Memory {
  id: string
  userId: string
  type: MemoryType
  status: MemoryStatus
  content: string
  confidence: number
  createdAt: string
  approvedAt?: string
  rejectedAt?: string
}
export interface MemoryCandidate {
  id: string
  userId: string
  type: MemoryType
  content: string
  confidence: number
  status: "PENDING"
  createdAt: string
  reasoningEventId: string
}
export interface ReasoningEvent {
  id: string
  userId: string
  timestamp: string
  userMessage: string
  observation: Observation
  classification: Classification
  systemResponse: string
  confidence: number
  candidateId?: string
}
export interface Observation { raw: string; extracted: string; timestamp: string }
export interface Classification { type: MemoryType; confidence: number; reasoning?: string }
export interface TimelineEvent {
  id: string
  userId: string
  timestamp: string
  type: "REASONING" | "APPROVAL" | "REJECTION"
  reasoningEventId?: string
  memoryId?: string
  memoryContent?: string
  memoryType?: MemoryType
  decision?: "APPROVED" | "REJECTED"
}
export type MemoryType = "PREFERENCE" | "IDENTITY" | "GOAL" | "CONTEXT"
export type MemoryStatus = "PENDING" | "APPROVED" | "REJECTED"

/** Dev/test persistence. Object reads and mutations are explicitly user-scoped. */
export class InMemoryStorage implements MemoryStorage {
  private memories = new Map<string, Memory>()
  private candidates = new Map<string, MemoryCandidate>()
  private reasoningEvents = new Map<string, ReasoningEvent>()
  private timeline: TimelineEvent[] = []
  private idCounters = { memory: 0, candidate: 0, reasoning: 0, timeline: 0 }

  async createMemory(data: Omit<Memory, "id">): Promise<Memory> {
    const memory = { id: `mem_${++this.idCounters.memory}`, ...data }
    this.memories.set(memory.id, memory)
    return memory
  }
  async getMemory(userId: string, id: string): Promise<Memory | undefined> {
    const memory = this.memories.get(id)
    return memory?.userId === userId ? memory : undefined
  }
  async listMemories(userId: string): Promise<Memory[]> {
    return Array.from(this.memories.values()).filter(m => m.userId === userId)
  }
  async updateMemory(userId: string, id: string, updates: Partial<Memory>): Promise<Memory | undefined> {
    const memory = this.memories.get(id)
    if (!memory || memory.userId !== userId) return undefined
    const updated = { ...memory, ...updates, id: memory.id, userId: memory.userId }
    this.memories.set(id, updated)
    return updated
  }

  async createCandidate(data: Omit<MemoryCandidate, "id">): Promise<MemoryCandidate> {
    const candidate = { id: `cand_${++this.idCounters.candidate}`, ...data }
    this.candidates.set(candidate.id, candidate)
    return candidate
  }
  async getCandidate(userId: string, id: string): Promise<MemoryCandidate | undefined> {
    const candidate = this.candidates.get(id)
    return candidate?.userId === userId ? candidate : undefined
  }
  async listCandidates(userId: string, status?: "PENDING"): Promise<MemoryCandidate[]> {
    return Array.from(this.candidates.values()).filter(c => c.userId === userId && (!status || c.status === status))
  }
  async removeCandidate(userId: string, id: string): Promise<void> {
    const candidate = this.candidates.get(id)
    if (candidate?.userId === userId) this.candidates.delete(id)
  }

  async createReasoningEvent(data: Omit<ReasoningEvent, "id">): Promise<ReasoningEvent> {
    const event = { id: `reason_${++this.idCounters.reasoning}`, ...data }
    this.reasoningEvents.set(event.id, event)
    return event
  }
  async getReasoningEvent(id: string): Promise<ReasoningEvent | undefined> { return this.reasoningEvents.get(id) }
  async listReasoningEvents(userId: string, limit = 50): Promise<ReasoningEvent[]> {
    return Array.from(this.reasoningEvents.values()).filter(e => e.userId === userId).reverse().slice(0, limit)
  }

  async appendTimelineEvent(data: Omit<TimelineEvent, "id">): Promise<TimelineEvent> {
    const event = { id: `timeline_${++this.idCounters.timeline}`, ...data }
    this.timeline.push(event)
    return event
  }
  async listTimeline(userId: string, limit = 50): Promise<TimelineEvent[]> {
    return this.timeline.filter(e => e.userId === userId).reverse().slice(0, limit)
  }

  dump(userId: string): string {
    if (!userId) throw new Error("Authenticated userId is required")
    const memories = this.memoriesFor(userId).filter(m => m.status === "APPROVED")
    const candidates = Array.from(this.candidates.values()).filter(c => c.userId === userId)
    return ["InMemoryStorage Debug Dump", `Approved Memories: ${memories.length}`, `Pending Candidates: ${candidates.length}`].join("\n")
  }
  private memoriesFor(userId: string) { return Array.from(this.memories.values()).filter(m => m.userId === userId) }
  clear(): void {
    this.memories.clear(); this.candidates.clear(); this.reasoningEvents.clear(); this.timeline = []
    this.idCounters = { memory: 0, candidate: 0, reasoning: 0, timeline: 0 }
  }
}
export const storage = new InMemoryStorage()
