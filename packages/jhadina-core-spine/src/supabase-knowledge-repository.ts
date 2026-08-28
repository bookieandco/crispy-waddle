import type { KnowledgePort, KnowledgeQuery, KnowledgeRecord } from './knowledge.js'
import { assertKnowledgeConfidence, assertKnowledgeId } from './knowledge.js'

type QueryBuilder<T> = Promise<{ data: T | null; error: { message: string } | null }>

export interface KnowledgeSupabaseClient {
  from(table: string): {
    upsert(values: Record<string, unknown>, options?: { onConflict?: string }): { select(): { single(): QueryBuilder<Record<string, unknown>> } }
    select(columns?: string): {
      eq(column: string, value: unknown): {
        order(column: string, options?: { ascending?: boolean }): { limit(count: number): QueryBuilder<Record<string, unknown>[]> }
        ilike(column: string, pattern: string): { order(column: string, options?: { ascending?: boolean }): { limit(count: number): QueryBuilder<Record<string, unknown>[]> }
      }
    }
    update(values: Record<string, unknown>): { eq(column: string, value: unknown): { select(): { single(): QueryBuilder<Record<string, unknown>> } } }
  }
}

const TABLE = 'jhadina_knowledge_records'

function toRecord(row: Record<string, unknown>): KnowledgeRecord {
  const id = String(row.id)
  assertKnowledgeId(id)
  const record = { id, subject: String(row.subject), claim: String(row.claim), confidence: Number(row.confidence), evidence: Array.isArray(row.evidence) ? row.evidence : [], createdAt: String(row.created_at), updatedAt: String(row.updated_at) } as KnowledgeRecord
  assertKnowledgeConfidence(record.confidence)
  return record
}

export class SupabaseKnowledgeRepository implements KnowledgePort {
  constructor(private readonly client: KnowledgeSupabaseClient) {}

  async ingest(record: KnowledgeRecord): Promise<KnowledgeRecord> {
    assertKnowledgeId(record.id)
    assertKnowledgeConfidence(record.confidence)
    const { data, error } = await this.client.from(TABLE).upsert({ id: record.id, subject: record.subject, claim: record.claim, confidence: record.confidence, status: 'ACTIVE', invalidation_reason: null, evidence: record.evidence, created_at: record.createdAt, updated_at: record.updatedAt }, { onConflict: 'id' }).select().single()
    if (error) throw new Error(`KNOWLEDGE_INGEST_FAILED:${error.message}`)
    if (!data) throw new Error('KNOWLEDGE_INGEST_FAILED:no row returned')
    return toRecord(data)
  }

  async retrieve(query: KnowledgeQuery): Promise<readonly KnowledgeRecord[]> {
    const limit = Math.max(0, query.limit ?? 20)
    if (limit === 0) return []
    const subject = query.subject?.trim()
    const text = query.text?.trim()
    let request = this.client.from(TABLE).select('*').eq('status', 'ACTIVE')
    if (subject) request = request.ilike('subject', `%${subject}%`) as typeof request
    if (text && !subject) request = request.ilike('claim', `%${text}%`) as typeof request
    const { data, error } = await request.order('updated_at', { ascending: false }).limit(limit)
    if (error) throw new Error(`KNOWLEDGE_RETRIEVE_FAILED:${error.message}`)
    return (data ?? []).map(toRecord)
  }

  async revise(id: string, record: KnowledgeRecord): Promise<KnowledgeRecord> {
    assertKnowledgeId(id)
    assertKnowledgeId(record.id)
    if (record.id !== id) throw new Error('Revised knowledge record id must match the existing id')
    assertKnowledgeConfidence(record.confidence)
    const { data, error } = await this.client.from(TABLE).update({ subject: record.subject, claim: record.claim, confidence: record.confidence, status: 'ACTIVE', invalidation_reason: null, evidence: record.evidence }).eq('id', id).select().single()
    if (error) throw new Error(`KNOWLEDGE_REVISE_FAILED:${error.message}`)
    if (!data) throw new Error(`Knowledge record not found: ${id}`)
    return toRecord(data)
  }

  async invalidate(id: string, reason: string): Promise<void> {
    assertKnowledgeId(id)
    if (!reason.trim()) throw new Error('Knowledge invalidation reason is required')
    const { data, error } = await this.client.from(TABLE).update({ status: 'INVALIDATED', invalidation_reason: reason }).eq('id', id).select().single()
    if (error) throw new Error(`KNOWLEDGE_INVALIDATE_FAILED:${error.message}`)
    if (!data) throw new Error(`Knowledge record not found: ${id}`)
  }
}
