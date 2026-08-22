import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  Memory,
  MemoryCandidate,
  MemoryStatus,
  MemoryType,
} from "../storage/InMemoryStorage"
import type { SearchMemoriesOptions } from "./MemoryRepository"

type Row = {
  id: string
  user_id: string
  content: string
  type: MemoryType
  status: MemoryStatus
  confidence: number
  evidence: unknown
  source: string
  created_at: string
  updated_at: string
  approved_at: string | null
  rejected_at: string | null
}

type CandidateRow = {
  id: string
  user_id: string
  content: string
  type: MemoryType
  status: "PENDING" | "APPROVED" | "REJECTED"
  confidence: number
  reasoning_event_id: string | null
  created_at: string
}

/**
 * Durable implementation of the existing MemoryRepository contract.
 *
 * This class deliberately contains no classification, confidence, or approval
 * policy. It persists the decisions made by higher layers and scopes every
 * operation to the authenticated user's id.
 */
export class SupabaseMemoryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async createCandidate(params: {
    userId: string
    content: string
    type: MemoryType
    confidence: number
    reasoningEventId: string
  }): Promise<MemoryCandidate> {
    const { data, error } = await this.client
      .from("jhadina_memory_candidates")
      .insert({
        user_id: params.userId,
        content: params.content,
        type: params.type,
        confidence: params.confidence,
        reasoning_event_id: params.reasoningEventId,
      })
      .select("id,user_id,content,type,status,confidence,reasoning_event_id,created_at")
      .single()

    if (error || !data) throw new Error(error?.message ?? "Failed to create memory candidate")
    return this.mapCandidate(data as CandidateRow)
  }

  async approve(candidateId: string, userId: string): Promise<Memory> {
    const { data: candidate, error: candidateError } = await this.client
      .from("jhadina_memory_candidates")
      .select("id,user_id,content,type,status,confidence,created_at")
      .eq("id", candidateId)
      .eq("user_id", userId)
      .eq("status", "PENDING")
      .single()

    if (candidateError || !candidate) {
      throw new Error(candidateError?.message ?? `Candidate not found or not pending: ${candidateId}`)
    }

    const { data: memory, error: memoryError } = await this.client
      .from("jhadina_memories")
      .insert({
        user_id: userId,
        content: candidate.content,
        type: candidate.type,
        status: "APPROVED",
        confidence: candidate.confidence,
        approved_at: new Date().toISOString(),
      })
      .select("id,user_id,content,type,status,confidence,evidence,source,created_at,updated_at,approved_at,rejected_at")
      .single()

    if (memoryError || !memory) {
      throw new Error(memoryError?.message ?? "Failed to persist approved memory")
    }

    const { error: candidateUpdateError } = await this.client
      .from("jhadina_memory_candidates")
      .update({ status: "APPROVED", reviewed_at: new Date().toISOString() })
      .eq("id", candidateId)
      .eq("user_id", userId)
      .eq("status", "PENDING")

    if (candidateUpdateError) {
      throw new Error(candidateUpdateError.message)
    }

    const { error: approvalError } = await this.client
      .from("jhadina_memory_approvals")
      .insert({
        user_id: userId,
        candidate_id: candidateId,
        decision: "APPROVED",
      })

    if (approvalError) throw new Error(approvalError.message)

    return this.mapMemory(memory as Row)
  }

  async reject(candidateId: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from("jhadina_memory_candidates")
      .update({ status: "REJECTED", reviewed_at: new Date().toISOString() })
      .eq("id", candidateId)
      .eq("user_id", userId)
      .eq("status", "PENDING")

    if (error) throw new Error(error.message)

    const { error: approvalError } = await this.client
      .from("jhadina_memory_approvals")
      .insert({
        user_id: userId,
        candidate_id: candidateId,
        decision: "REJECTED",
      })

    if (approvalError) throw new Error(approvalError.message)
  }

  async listPending(userId: string, limit = 20, offset = 0): Promise<MemoryCandidate[]> {
    const { data, error } = await this.client
      .from("jhadina_memory_candidates")
      .select("id,user_id,content,type,status,confidence,reasoning_event_id,created_at")
      .eq("user_id", userId)
      .eq("status", "PENDING")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => this.mapCandidate(row as CandidateRow))
  }

  async listApproved(userId: string): Promise<Memory[]> {
    const { data, error } = await this.client
      .from("jhadina_memories")
      .select("id,user_id,content,type,status,confidence,evidence,source,created_at,updated_at,approved_at,rejected_at")
      .eq("user_id", userId)
      .eq("status", "APPROVED")
      .is("archived_at", null)
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => this.mapMemory(row as Row))
  }

  async search(userId: string, options: SearchMemoriesOptions = {}): Promise<Memory[]> {
    let query = this.client
      .from("jhadina_memories")
      .select("id,user_id,content,type,status,confidence,evidence,source,created_at,updated_at,approved_at,rejected_at")
      .eq("user_id", userId)
      .eq("status", "APPROVED")
      .is("archived_at", null)

    if (options.type) query = query.eq("type", options.type)
    if (options.query) query = query.ilike("content", `%${options.query}%`)

    const limit = options.limit ?? 20
    const offset = options.offset ?? 0
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => this.mapMemory(row as Row))
  }

  async getById(userId: string, memoryId: string): Promise<Memory | null> {
    const { data, error } = await this.client
      .from("jhadina_memories")
      .select("id,user_id,content,type,status,confidence,evidence,source,created_at,updated_at,approved_at,rejected_at")
      .eq("id", memoryId)
      .eq("user_id", userId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data ? this.mapMemory(data as Row) : null
  }

  async getContext(userId: string): Promise<Memory[]> {
    return this.listApproved(userId)
  }

  private mapMemory(row: Row): Memory {
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
    }
  }

  private mapCandidate(row: CandidateRow): MemoryCandidate {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      content: row.content,
      confidence: row.confidence,
      status: "PENDING",
      createdAt: row.created_at,
      reasoningEventId: row.reasoning_event_id ?? "",
    }
  }
}
