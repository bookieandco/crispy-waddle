/**
 * SupabaseMemoryStorage
 *
 * Durable MemoryStorage backend (Phase 1, Step 2) — same contract as
 * InMemoryStorage, backed by the four tables in
 * supabase/migrations/20260822000000_create_jhadina_memory_core.sql
 * instead of process memory. No business logic lives here: approval
 * governance (candidate -> explicit approve/reject -> durable memory or
 * discard) stays entirely in MemoryRepository, exactly as it does today.
 * This class only translates that repository's calls into rows.
 *
 * Requires a service-role client (see ../supabase/service-role.ts) — the
 * tables this reads and writes have no anon/authenticated grants at all.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { MemoryStorage } from "./MemoryStorage"
import type {
  Memory,
  MemoryCandidate,
  ReasoningEvent,
  TimelineEvent,
  Observation,
  Classification,
  MemoryType,
} from "./InMemoryStorage"

type MemoryRow = {
  id: string
  user_id: string
  type: MemoryType
  status: "APPROVED" | "REJECTED" | "RETIRED"
  content: string
  confidence: number
  created_at: string
  approved_at: string | null
  rejected_at: string | null
  reasoning_event_id: string | null
  revoked_at: string | null
  revocation_reason: "corrected" | "forgotten" | "retired" | null
  supersedes_memory_id: string | null
}

type CandidateRow = {
  id: string
  user_id: string
  type: MemoryType
  status: "PENDING"
  content: string
  confidence: number
  reasoning_event_id: string
  created_at: string
}

type ReasoningEventRow = {
  id: string
  user_id: string
  occurred_at: string
  user_message: string
  observation: Observation
  classification: Classification
  system_response: string
  confidence: number
  candidate_id: string | null
  actor: "user" | "jhadina" | "system" | "external"
  outcome: string | null
  correlation_id: string | null
  causation_id: string | null
  metadata: Record<string, unknown>
}

type TimelineEventRow = {
  id: string
  user_id: string
  occurred_at: string
  type: TimelineEvent["type"]
  reasoning_event_id: string | null
  memory_id: string | null
  memory_type: MemoryType | null
  memory_content: string | null
  decision: "APPROVED" | "REJECTED" | "RETIRED" | null
}

function memoryFromRow(row: MemoryRow): Memory {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    status: row.status,
    content: row.content,
    confidence: row.confidence,
    createdAt: row.created_at,
    approvedAt: row.approved_at ?? undefined,
    rejectedAt: row.rejected_at ?? undefined,
    reasoningEventId: row.reasoning_event_id ?? undefined,
    revokedAt: row.revoked_at ?? undefined,
    revocationReason: row.revocation_reason ?? undefined,
    supersedesMemoryId: row.supersedes_memory_id ?? undefined,
  }
}

function candidateFromRow(row: CandidateRow): MemoryCandidate {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    content: row.content,
    confidence: row.confidence,
    status: row.status,
    createdAt: row.created_at,
    reasoningEventId: row.reasoning_event_id,
  }
}

function reasoningEventFromRow(row: ReasoningEventRow): ReasoningEvent {
  return {
    id: row.id,
    userId: row.user_id,
    timestamp: row.occurred_at,
    userMessage: row.user_message,
    observation: row.observation,
    classification: row.classification,
    systemResponse: row.system_response,
    confidence: row.confidence,
    candidateId: row.candidate_id ?? undefined,
    actor: row.actor,
    outcome: row.outcome ?? undefined,
    correlationId: row.correlation_id ?? undefined,
    causationId: row.causation_id ?? undefined,
    metadata: row.metadata,
  }
}

function timelineEventFromRow(row: TimelineEventRow): TimelineEvent {
  return {
    id: row.id,
    userId: row.user_id,
    timestamp: row.occurred_at,
    type: row.type,
    reasoningEventId: row.reasoning_event_id ?? undefined,
    memoryId: row.memory_id ?? undefined,
    memoryType: row.memory_type ?? undefined,
    memoryContent: row.memory_content ?? undefined,
    decision: row.decision ?? undefined,
  }
}

function nextId(prefix: string): string {
  // crypto.randomUUID is available in every runtime this app targets
  // (Node 22, Edge). A short prefix keeps ids readable in logs/dumps the
  // same way InMemoryStorage's counters did, without needing a shared
  // counter across server instances.
  return `${prefix}_${crypto.randomUUID()}`
}

function assertNoError(error: { message: string } | null, context: string): void {
  if (error) throw new Error(`JHADINA_MEMORY_STORAGE_FAILED:${context}:${error.message}`)
}

export class SupabaseMemoryStorage implements MemoryStorage {
  constructor(private readonly client: SupabaseClient) {}

  async createMemory(data: Omit<Memory, "id">): Promise<Memory> {
    const row: MemoryRow = {
      id: nextId("mem"),
      user_id: data.userId,
      type: data.type,
      status: data.status as "APPROVED" | "REJECTED" | "RETIRED",
      content: data.content,
      confidence: data.confidence,
      created_at: data.createdAt,
      approved_at: data.approvedAt ?? null,
      rejected_at: data.rejectedAt ?? null,
      reasoning_event_id: data.reasoningEventId ?? null,
      revoked_at: data.revokedAt ?? null,
      revocation_reason: data.revocationReason ?? null,
      supersedes_memory_id: data.supersedesMemoryId ?? null,
    }
    const { error } = await this.client.from("jhadina_memories").insert(row)
    assertNoError(error, "createMemory")
    return memoryFromRow(row)
  }

  async getMemory(id: string): Promise<Memory | undefined> {
    const { data, error } = await this.client
      .from("jhadina_memories")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    assertNoError(error, "getMemory")
    return data ? memoryFromRow(data as MemoryRow) : undefined
  }

  async listMemories(userId: string): Promise<Memory[]> {
    const { data, error } = await this.client
      .from("jhadina_memories")
      .select("*")
      .eq("user_id", userId)
    assertNoError(error, "listMemories")
    return (data ?? []).map((row) => memoryFromRow(row as MemoryRow))
  }

  async retireMemory(
    id: string,
    userId: string,
    reason: "corrected" | "forgotten" | "retired",
    revokedAt: string,
  ): Promise<Memory | undefined> {
    const { data, error } = await this.client.rpc("jhadina_retire_memory", {
      p_memory_id: id,
      p_user_id: userId,
      p_reason: reason,
      p_revoked_at: revokedAt,
    })
    assertNoError(error, "retireMemory")
    const row = Array.isArray(data) ? data[0] : data
    return row ? memoryFromRow(row as MemoryRow) : undefined
  }

  async correctMemory(params: {
    memoryId: string
    userId: string
    content: string
    confidence: number
    reasoningEventId: string
    correctedAt: string
  }): Promise<{ retired: Memory; replacement: Memory }> {
    const newMemoryId = nextId("mem")
    const { data, error } = await this.client.rpc("jhadina_correct_memory", {
      p_memory_id: params.memoryId,
      p_user_id: params.userId,
      p_new_memory_id: newMemoryId,
      p_content: params.content,
      p_confidence: params.confidence,
      p_reasoning_event_id: params.reasoningEventId,
      p_corrected_at: params.correctedAt,
    })
    assertNoError(error, "correctMemory")
    const row = Array.isArray(data) ? data[0] : data
    if (!row || typeof row !== "object") {
      throw new Error("JHADINA_MEMORY_STORAGE_FAILED:correctMemory:empty result")
    }
    const result = row as { retired?: MemoryRow; replacement?: MemoryRow }
    if (!result.retired || !result.replacement) {
      throw new Error("JHADINA_MEMORY_STORAGE_FAILED:correctMemory:invalid result")
    }
    return {
      retired: memoryFromRow(result.retired),
      replacement: memoryFromRow(result.replacement),
    }
  }

  async createCandidate(data: Omit<MemoryCandidate, "id">): Promise<MemoryCandidate> {
    const row: CandidateRow = {
      id: nextId("cand"),
      user_id: data.userId,
      type: data.type,
      status: data.status,
      content: data.content,
      confidence: data.confidence,
      reasoning_event_id: data.reasoningEventId,
      created_at: data.createdAt,
    }
    const { error } = await this.client.from("jhadina_memory_candidates").insert(row)
    assertNoError(error, "createCandidate")
    return candidateFromRow(row)
  }

  async getCandidate(id: string): Promise<MemoryCandidate | undefined> {
    const { data, error } = await this.client
      .from("jhadina_memory_candidates")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    assertNoError(error, "getCandidate")
    return data ? candidateFromRow(data as CandidateRow) : undefined
  }

  async listCandidates(userId: string, status?: "PENDING"): Promise<MemoryCandidate[]> {
    let query = this.client.from("jhadina_memory_candidates").select("*").eq("user_id", userId)
    if (status) query = query.eq("status", status)
    const { data, error } = await query
    assertNoError(error, "listCandidates")
    return (data ?? []).map((row) => candidateFromRow(row as CandidateRow))
  }

  async removeCandidate(id: string): Promise<void> {
    const { error } = await this.client.from("jhadina_memory_candidates").delete().eq("id", id)
    assertNoError(error, "removeCandidate")
  }

  async createReasoningEvent(data: Omit<ReasoningEvent, "id"> & { id?: string }): Promise<ReasoningEvent> {
    const row: ReasoningEventRow = {
      id: data.id ?? nextId("reason"),
      user_id: data.userId,
      occurred_at: data.timestamp,
      user_message: data.userMessage,
      observation: data.observation,
      classification: data.classification,
      system_response: data.systemResponse,
      confidence: data.confidence,
      candidate_id: data.candidateId ?? null,
      actor: data.actor ?? "user",
      outcome: data.outcome ?? null,
      correlation_id: data.correlationId ?? null,
      causation_id: data.causationId ?? null,
      metadata: data.metadata ?? {},
    }
    const { error } = await this.client.from("jhadina_reasoning_events").insert(row)
    assertNoError(error, "createReasoningEvent")
    return reasoningEventFromRow(row)
  }

  async getReasoningEvent(id: string): Promise<ReasoningEvent | undefined> {
    const { data, error } = await this.client
      .from("jhadina_reasoning_events")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    assertNoError(error, "getReasoningEvent")
    return data ? reasoningEventFromRow(data as ReasoningEventRow) : undefined
  }

  async updateReasoningEvent(id: string, userId: string, updates: Partial<ReasoningEvent>): Promise<ReasoningEvent | undefined> {
    const patch: Record<string, unknown> = {}
    if (updates.classification !== undefined) patch.classification = updates.classification
    if (updates.systemResponse !== undefined) patch.system_response = updates.systemResponse
    if (updates.confidence !== undefined) patch.confidence = updates.confidence
    if (updates.candidateId !== undefined) patch.candidate_id = updates.candidateId
    if (updates.actor !== undefined) patch.actor = updates.actor
    if (updates.outcome !== undefined) patch.outcome = updates.outcome
    if (updates.correlationId !== undefined) patch.correlation_id = updates.correlationId
    if (updates.causationId !== undefined) patch.causation_id = updates.causationId
    if (updates.metadata !== undefined) patch.metadata = updates.metadata

    const { data, error } = await this.client
      .from("jhadina_reasoning_events")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle()
    assertNoError(error, "updateReasoningEvent")
    return data ? reasoningEventFromRow(data as ReasoningEventRow) : undefined
  }

  async listReasoningEvents(userId: string, limit: number = 50): Promise<ReasoningEvent[]> {
    const { data, error } = await this.client
      .from("jhadina_reasoning_events")
      .select("*")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(limit)
    assertNoError(error, "listReasoningEvents")
    return (data ?? []).map((row) => reasoningEventFromRow(row as ReasoningEventRow))
  }

  async appendTimelineEvent(data: Omit<TimelineEvent, "id">): Promise<TimelineEvent> {
    const row: TimelineEventRow = {
      id: nextId("timeline"),
      user_id: data.userId,
      occurred_at: data.timestamp,
      type: data.type,
      reasoning_event_id: data.reasoningEventId ?? null,
      memory_id: data.memoryId ?? null,
      memory_type: data.memoryType ?? null,
      memory_content: data.memoryContent ?? null,
      decision: data.decision ?? null,
    }
    const { error } = await this.client.from("jhadina_timeline_events").insert(row)
    assertNoError(error, "appendTimelineEvent")
    return timelineEventFromRow(row)
  }

  async listTimeline(userId: string, limit: number = 50): Promise<TimelineEvent[]> {
    const { data, error } = await this.client
      .from("jhadina_timeline_events")
      .select("*")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(limit)
    assertNoError(error, "listTimeline")
    return (data ?? []).map((row) => timelineEventFromRow(row as TimelineEventRow))
  }
}
