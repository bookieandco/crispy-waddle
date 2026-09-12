import type { SupabaseClient } from "@supabase/supabase-js"
import type { EvidenceRef } from "@jhadina/core-spine"
import type {
  RegretMemoryRecord,
  RegretMemoryQuery,
  RegretRecallEvaluation,
  RegretRecallResult,
} from "@jhadina/core-spine"

/** Async durable contract. Authoritative verified/learned regrets must use appendAuthoritative. */
export interface DurableRegretMemory {
  /** Non-authoritative compatibility append for historical/non-materialized records only. */
  append(record: RegretMemoryRecord): Promise<RegretMemoryRecord>
  /** Authoritative materialization path; recurrence is allocated atomically by Postgres. */
  appendAuthoritative(record: RegretMemoryRecord): Promise<RegretMemoryRecord>
  getById(userId: string, memoryId: string): Promise<RegretMemoryRecord | null>
  retrieve(query: RegretMemoryQuery): Promise<readonly RegretRecallResult[]>
  listRelated(userId: string, memoryId: string): Promise<readonly RegretMemoryRecord[]>
  findRecurrences(userId: string, rootCause: string): Promise<readonly RegretMemoryRecord[]>
  supersede(userId: string, memoryId: string, replacementMemoryId: string): Promise<void>
  getProvenance(userId: string, memoryId: string): Promise<readonly EvidenceRef[]>
  evaluateRecall(query: RegretMemoryQuery, relevantMemoryIds: readonly string[], k?: number): Promise<RegretRecallEvaluation>
}

type Row = {
  memory_id: string
  user_id: string
  regret: RegretMemoryRecord["regret"]
  created_at: string
  provenance: EvidenceRef[]
  tags: string[]
  salience: number
  supersedes: string | null
  superseded_by: string | null
}

const MAX_LIMIT = 50

function normalize(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

function lexicalScore(text: string, record: RegretMemoryRecord): number {
  const query = new Set(normalize(text))
  if (!query.size) return 0
  const body = normalize([
    record.regret.subjectType,
    record.regret.subjectId,
    record.regret.originalBelief,
    record.regret.expectedOutcome,
    record.regret.actualOutcome,
    record.regret.discrepancy,
    record.regret.rootCause ?? "",
    ...record.tags,
  ].join(" "))
  return body.reduce((n, term) => n + (query.has(term) ? 1 : 0), 0) / query.size
}

function fromRow(row: Row): RegretMemoryRecord {
  return Object.freeze({
    memoryId: row.memory_id,
    userId: row.user_id,
    regret: row.regret,
    createdAt: row.created_at,
    provenance: Object.freeze([...(row.provenance ?? [])]),
    tags: Object.freeze([...(row.tags ?? [])]),
    salience: row.salience,
    ...(row.supersedes ? { supersedes: row.supersedes } : {}),
    ...(row.superseded_by ? { supersededBy: row.superseded_by } : {}),
  })
}

function assertError(error: { message: string } | null, operation: string): void {
  if (error) throw new Error(`JHADINA_REGRET_STORAGE_FAILED:${operation}:${error.message}`)
}

function validateAppend(record: RegretMemoryRecord): void {
  if (!record.userId) throw new Error("regret memory userId is required")
  if (!Number.isFinite(record.salience) || record.salience < 0 || record.salience > 1) {
    throw new Error("regret memory salience must be between 0 and 1")
  }
}

function toRow(record: RegretMemoryRecord) {
  return {
    memory_id: record.memoryId,
    user_id: record.userId,
    regret: record.regret,
    created_at: record.createdAt,
    provenance: record.provenance,
    tags: record.tags,
    salience: record.salience,
    supersedes: record.supersedes ?? null,
    superseded_by: record.supersededBy ?? null,
  }
}

export class SupabaseRegretMemory implements DurableRegretMemory {
  constructor(private readonly client: SupabaseClient) {}

  async append(record: RegretMemoryRecord): Promise<RegretMemoryRecord> {
    validateAppend(record)
    if (record.regret.status === "verified" || record.regret.status === "learned") {
      throw new Error("authoritative verified or learned regret must use appendAuthoritative")
    }
    const { error } = await this.client.from("jhadina_regret_memory").insert(toRow(record))
    assertError(error, "append")
    return Object.freeze({ ...record, provenance: Object.freeze([...record.provenance]), tags: Object.freeze([...record.tags]) })
  }

  /**
   * Authoritative durable append. Recurrence is allocated inside the same
   * Postgres transaction as the insert; the caller's recurrenceCount is not
   * trusted. This is the only durable path for newly materialized regrets.
   */
  async appendAuthoritative(record: RegretMemoryRecord): Promise<RegretMemoryRecord> {
    validateAppend(record)
    if (record.regret.status !== "verified" && record.regret.status !== "learned") {
      throw new Error("regret memory authoritative append requires a verified or learned regret")
    }

    const { data, error } = await this.client
      .rpc("jhadina_materialize_regret_atomic", {
        p_user_id: record.userId,
        p_record: {
          memoryId: record.memoryId,
          userId: record.userId,
          regret: record.regret,
          createdAt: record.createdAt,
          provenance: record.provenance,
          tags: record.tags,
          salience: record.salience,
          ...(record.supersedes ? { supersedes: record.supersedes } : {}),
          ...(record.supersededBy ? { supersededBy: record.supersededBy } : {}),
        },
      })
      .single()

    assertError(error, "appendAuthoritative")
    if (!data) throw new Error("JHADINA_REGRET_STORAGE_FAILED:appendAuthoritative:no_inserted_record")
    return fromRow(data as Row)
  }

  async getById(userId: string, memoryId: string): Promise<RegretMemoryRecord | null> {
    const { data, error } = await this.client.from("jhadina_regret_memory").select("*").eq("user_id", userId).eq("memory_id", memoryId).maybeSingle()
    assertError(error, "getById")
    return data ? fromRow(data as Row) : null
  }

  async retrieve(query: RegretMemoryQuery): Promise<readonly RegretRecallResult[]> {
    if (!query.userId) throw new Error("regret memory query userId is required")
    const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit ?? 10))
    let request = this.client.from("jhadina_regret_memory").select("*").eq("user_id", query.userId)
    if (!query.includeSuperseded) request = request.is("superseded_by", null)
    if (query.tags?.length) request = request.contains("tags", query.tags)
    const { data, error } = await request
    assertError(error, "retrieve")

    return (data ?? [])
      .map((raw) => fromRow(raw as Row))
      .filter((record) => !query.subjectType || record.regret.subjectType === query.subjectType)
      .filter((record) => !query.status || record.regret.status === query.status)
      .map((record) => {
        const lexical = query.text ? lexicalScore(query.text, record) : 0
        const recurrence = Math.min(1, record.regret.recurrenceCount / 5)
        return { memoryId: record.memoryId, score: lexical * 0.65 + record.salience * 0.2 + recurrence * 0.15, record }
      })
      .sort((a, b) => b.score - a.score || b.record.createdAt.localeCompare(a.record.createdAt) || a.memoryId.localeCompare(b.memoryId))
      .slice(0, limit)
  }

  async listRelated(userId: string, memoryId: string): Promise<readonly RegretMemoryRecord[]> {
    const target = await this.getById(userId, memoryId)
    if (!target) return []
    const { data, error } = await this.client.from("jhadina_regret_memory").select("*").eq("user_id", userId)
    assertError(error, "listRelated")
    return (data ?? []).map((raw) => fromRow(raw as Row)).filter((record) =>
      record.memoryId !== memoryId &&
      (record.regret.subjectId === target.regret.subjectId ||
        (!!target.regret.rootCause && record.regret.rootCause === target.regret.rootCause) ||
        (!!target.regret.counterfactualId && record.regret.counterfactualId === target.regret.counterfactualId)),
    )
  }

  async findRecurrences(userId: string, rootCause: string): Promise<readonly RegretMemoryRecord[]> {
    const { data, error } = await this.client.from("jhadina_regret_memory").select("*").eq("user_id", userId)
    assertError(error, "findRecurrences")
    return (data ?? []).map((raw) => fromRow(raw as Row)).filter((record) => record.regret.rootCause === rootCause)
  }

  async supersede(userId: string, memoryId: string, replacementMemoryId: string): Promise<void> {
    const current = await this.getById(userId, memoryId)
    const replacement = await this.getById(userId, replacementMemoryId)
    if (!current || !replacement) throw new Error("both regret memories must exist for this user before supersession")
    if (current.supersededBy) throw new Error(`regret memory already superseded: ${memoryId}`)
    if (replacement.supersedes !== memoryId) throw new Error("replacement must declare the memory it supersedes")
    const { error } = await this.client.from("jhadina_regret_memory").update({ superseded_by: replacementMemoryId }).eq("user_id", userId).eq("memory_id", memoryId)
    assertError(error, "supersede")
  }

  async getProvenance(userId: string, memoryId: string): Promise<readonly EvidenceRef[]> {
    return (await this.getById(userId, memoryId))?.provenance ?? []
  }

  async evaluateRecall(query: RegretMemoryQuery, relevantMemoryIds: readonly string[], k = 10): Promise<RegretRecallEvaluation> {
    const boundedK = Math.max(1, Math.min(MAX_LIMIT, k))
    const returned = (await this.retrieve({ ...query, limit: boundedK })).map((result) => result.memoryId)
    const relevant = new Set(relevantMemoryIds)
    const hits = returned.filter((id) => relevant.has(id)).length
    return Object.freeze({
      relevantMemoryIds: Object.freeze([...relevantMemoryIds]),
      returnedMemoryIds: Object.freeze(returned),
      k: boundedK,
      recallAtK: relevant.size === 0 ? 0 : hits / relevant.size,
    })
  }
}
