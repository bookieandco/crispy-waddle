import type {
  Memory,
  MemoryCandidate,
  ReasoningEvent,
  TimelineEvent,
} from "./InMemoryStorage"

/**
 * Storage contract shared by InMemoryStorage and SupabaseMemoryStorage.
 * Ownership-sensitive object operations require the authenticated userId so
 * persistence cannot accidentally become an ID-only authorization surface.
 */
export interface MemoryStorage {
  createMemory(data: Omit<Memory, "id">): Promise<Memory>
  getMemory(userId: string, id: string): Promise<Memory | undefined>
  listMemories(userId: string): Promise<Memory[]>
  updateMemory(userId: string, id: string, updates: Partial<Memory>): Promise<Memory | undefined>

  createCandidate(data: Omit<MemoryCandidate, "id">): Promise<MemoryCandidate>
  getCandidate(userId: string, id: string): Promise<MemoryCandidate | undefined>
  listCandidates(userId: string, status?: "PENDING"): Promise<MemoryCandidate[]>
  removeCandidate(userId: string, id: string): Promise<void>

  createReasoningEvent(data: Omit<ReasoningEvent, "id">): Promise<ReasoningEvent>
  getReasoningEvent(id: string): Promise<ReasoningEvent | undefined>
  listReasoningEvents(userId: string, limit?: number): Promise<ReasoningEvent[]>

  appendTimelineEvent(data: Omit<TimelineEvent, "id">): Promise<TimelineEvent>
  listTimeline(userId: string, limit?: number): Promise<TimelineEvent[]>
}
