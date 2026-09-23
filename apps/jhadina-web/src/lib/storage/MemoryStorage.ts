import type {
  Memory,
  MemoryCandidate,
  ReasoningEvent,
  TimelineEvent,
} from "./InMemoryStorage"

/**
 * Storage contract shared by InMemoryStorage (dev/test fallback) and
 * SupabaseMemoryStorage (durable backend). Repositories depend on this
 * interface, never on a concrete implementation, so the backend can change
 * without touching the approval-governance logic that lives in the
 * repository layer.
 */
export interface MemoryStorage {
  /** Read-only durable connectivity probe used by production health. */
  probe(): Promise<void>
  createMemory(data: Omit<Memory, "id">): Promise<Memory>
  getMemory(id: string): Promise<Memory | undefined>
  listMemories(userId: string): Promise<Memory[]>
  retireMemory(
    id: string,
    userId: string,
    reason: "corrected" | "forgotten" | "retired",
    revokedAt: string,
  ): Promise<Memory | undefined>
  correctMemory(params: {
    memoryId: string
    userId: string
    content: string
    confidence: number
    reasoningEventId: string
    correctedAt: string
  }): Promise<{ retired: Memory; replacement: Memory }>

  createCandidate(data: Omit<MemoryCandidate, "id">): Promise<MemoryCandidate>
  getCandidate(id: string): Promise<MemoryCandidate | undefined>
  listCandidates(userId: string, status?: "PENDING"): Promise<MemoryCandidate[]>
  removeCandidate(id: string): Promise<void>

  createReasoningEvent(data: Omit<ReasoningEvent, "id"> & { id?: string }): Promise<ReasoningEvent>
  getReasoningEvent(id: string): Promise<ReasoningEvent | undefined>
  updateReasoningEvent?(id: string, userId: string, updates: Partial<ReasoningEvent>): Promise<ReasoningEvent | undefined>
  listReasoningEvents(userId: string, limit?: number): Promise<ReasoningEvent[]>

  appendTimelineEvent(data: Omit<TimelineEvent, "id">): Promise<TimelineEvent>
  listTimeline(userId: string, limit?: number): Promise<TimelineEvent[]>
}
