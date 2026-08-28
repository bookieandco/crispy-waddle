import type { KnowledgePort, KnowledgeQuery, KnowledgeRecord } from './knowledge.js'
import { assertKnowledgeConfidence } from './knowledge.js'

/** Deterministic repository implementation for local use and tests. */
export class InMemoryKnowledgeRepository implements KnowledgePort {
  private readonly records = new Map<string, KnowledgeRecord>()

  async ingest(record: KnowledgeRecord): Promise<KnowledgeRecord> {
    assertKnowledgeConfidence(record.confidence)
    this.records.set(record.id, record)
    return record
  }

  async retrieve(query: KnowledgeQuery): Promise<readonly KnowledgeRecord[]> {
    const text = query.text?.trim().toLowerCase()
    const subject = query.subject?.trim().toLowerCase()
    const limit = Math.max(0, query.limit ?? 20)
    return [...this.records.values()]
      .filter((record) => {
        const subjectMatch = !subject || record.subject.toLowerCase().includes(subject)
        const textMatch = !text || record.claim.toLowerCase().includes(text) || record.subject.toLowerCase().includes(text)
        return subjectMatch && textMatch
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit)
  }

  async revise(id: string, record: KnowledgeRecord): Promise<KnowledgeRecord> {
    if (!this.records.has(id)) throw new Error(`Knowledge record not found: ${id}`)
    if (record.id !== id) throw new Error('Revised knowledge record id must match the existing id')
    return this.ingest(record)
  }

  async invalidate(id: string, reason: string): Promise<void> {
    if (!this.records.has(id)) throw new Error(`Knowledge record not found: ${id}`)
    if (!reason.trim()) throw new Error('Knowledge invalidation reason is required')
    this.records.delete(id)
  }
}
