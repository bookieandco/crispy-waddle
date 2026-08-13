/**
 * InMemoryStorage
 * 
 * Pure storage layer. No business logic.
 * Collections for memories, candidates, reasoning events, and timeline.
 * 
 * This is the foundation that Repositories will build on.
 * All data is lost on application restart (by design for MVP).
 */

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

export interface Observation {
  raw: string
  extracted: string
  timestamp: string
}

export interface Classification {
  type: MemoryType
  confidence: number
  reasoning?: string
}

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

/**
 * InMemoryStorage class
 */
export class InMemoryStorage {
  private memories: Map<string, Memory> = new Map()
  private candidates: Map<string, MemoryCandidate> = new Map()
  private reasoningEvents: Map<string, ReasoningEvent> = new Map()
  private timeline: TimelineEvent[] = []
  private idCounters = {
    memory: 0,
    candidate: 0,
    reasoning: 0,
    timeline: 0,
  }

  /**
   * Memory operations
   */
  createMemory(data: Omit<Memory, "id">): Memory {
    const id = `mem_${++this.idCounters.memory}`
    const memory: Memory = { id, ...data }
    this.memories.set(id, memory)
    return memory
  }

  getMemory(id: string): Memory | undefined {
    return this.memories.get(id)
  }

  listMemories(userId: string): Memory[] {
    return Array.from(this.memories.values()).filter(m => m.userId === userId)
  }

  updateMemory(id: string, updates: Partial<Memory>): Memory | undefined {
    const memory = this.memories.get(id)
    if (!memory) return undefined
    const updated = { ...memory, ...updates }
    this.memories.set(id, updated)
    return updated
  }

  /**
   * Candidate operations
   */
  createCandidate(data: Omit<MemoryCandidate, "id">): MemoryCandidate {
    const id = `cand_${++this.idCounters.candidate}`
    const candidate: MemoryCandidate = { id, ...data }
    this.candidates.set(id, candidate)
    return candidate
  }

  getCandidate(id: string): MemoryCandidate | undefined {
    return this.candidates.get(id)
  }

  listCandidates(userId: string, status?: "PENDING"): MemoryCandidate[] {
    return Array.from(this.candidates.values()).filter(
      c => c.userId === userId && (!status || c.status === status)
    )
  }

  removeCandidate(id: string): void {
    this.candidates.delete(id)
  }

  /**
   * Reasoning event operations
   */
  createReasoningEvent(data: Omit<ReasoningEvent, "id">): ReasoningEvent {
    const id = `reason_${++this.idCounters.reasoning}`
    const event: ReasoningEvent = { id, ...data }
    this.reasoningEvents.set(id, event)
    return event
  }

  getReasoningEvent(id: string): ReasoningEvent | undefined {
    return this.reasoningEvents.get(id)
  }

  listReasoningEvents(userId: string, limit: number = 50): ReasoningEvent[] {
    // Reverse insertion order rather than sorting by timestamp: events
    // created within the same millisecond (common in tests and fast
    // request handling) compare equal, which makes a timestamp sort
    // unstable and can leave older events ahead of newer ones.
    // Insertion order is always correctly chronological.
    return Array.from(this.reasoningEvents.values())
      .filter(e => e.userId === userId)
      .reverse()
      .slice(0, limit)
  }

  /**
   * Timeline operations
   */
  appendTimelineEvent(data: Omit<TimelineEvent, "id">): TimelineEvent {
    const id = `timeline_${++this.idCounters.timeline}`
    const event: TimelineEvent = { id, ...data }
    this.timeline.push(event)
    return event
  }

  listTimeline(userId: string, limit: number = 50): TimelineEvent[] {
    // See listReasoningEvents: reverse insertion order instead of sorting
    // by timestamp, since same-millisecond events make a timestamp sort
    // unstable.
    return this.timeline
      .filter(e => e.userId === userId)
      .reverse()
      .slice(0, limit)
  }

  /**
   * Debug dump - visibility into entire state
   */
  dump(userId?: string): string {
    const lines: string[] = []

    lines.push("═══════════════════════════════════════")
    lines.push("InMemoryStorage Debug Dump")
    lines.push("═══════════════════════════════════════")
    lines.push("")

    // Filter by user if specified
    const filterUser = (item: { userId: string }) =>
      !userId || item.userId === userId

    // Candidates
    const candidateList = Array.from(this.candidates.values()).filter(filterUser)
    lines.push(`Candidates (PENDING): ${candidateList.length}`)
    if (candidateList.length > 0) {
      for (const cand of candidateList) {
        lines.push(
          `  ${cand.id} | ${cand.type} | "${cand.content.slice(0, 40)}..." | conf=${cand.confidence.toFixed(2)}`
        )
      }
    }
    lines.push("")

    // Approved Memories
    const memoryList = Array.from(this.memories.values()).filter(filterUser)
    const approved = memoryList.filter(m => m.status === "APPROVED")
    lines.push(`Approved Memories: ${approved.length}`)
    if (approved.length > 0) {
      for (const mem of approved) {
        lines.push(
          `  ${mem.id} | ${mem.type} | "${mem.content.slice(0, 40)}..." | approved ${mem.approvedAt?.slice(0, 10) || "?"}`
        )
      }
    }
    lines.push("")

    // Reasoning Events
    const reasoningList = Array.from(this.reasoningEvents.values()).filter(
      filterUser
    )
    lines.push(`Reasoning Events: ${reasoningList.length}`)
    if (reasoningList.length > 0 && reasoningList.length <= 5) {
      for (const event of reasoningList) {
        lines.push(`  ${event.id} | ${event.timestamp.slice(11, 19)}`)
      }
    }
    lines.push("")

    // Timeline
    const timelineList = this.timeline.filter(filterUser)
    lines.push(`Timeline Events: ${timelineList.length}`)
    if (timelineList.length > 0 && timelineList.length <= 10) {
      for (const event of timelineList) {
        const time = event.timestamp.slice(11, 19)
        let desc: string = event.type
        if (event.type === "APPROVAL") {
          desc = `APPROVAL | ${event.decision}`
        } else if (event.type === "REASONING") {
          desc = `REASONING | Candidate: ${event.reasoningEventId}`
        }
        lines.push(`  ${time} | ${desc}`)
      }
    }
    lines.push("")

    lines.push("═══════════════════════════════════════")

    return lines.join("\n")
  }

  /**
   * Reset all data (useful for testing)
   */
  clear(): void {
    this.memories.clear()
    this.candidates.clear()
    this.reasoningEvents.clear()
    this.timeline = []
    this.idCounters = { memory: 0, candidate: 0, reasoning: 0, timeline: 0 }
  }
}

/**
 * Global singleton instance
 */
export const storage = new InMemoryStorage()
