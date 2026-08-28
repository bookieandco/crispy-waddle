export type KnowledgeSourceKind = 'conversation' | 'document' | 'repository' | 'web' | 'domain' | 'system'

export interface KnowledgeProvenance {
  readonly sourceKind: KnowledgeSourceKind
  readonly sourceId: string
  readonly capturedAt: string
  readonly locator?: string
}

export interface KnowledgeEvidence {
  readonly id: string
  readonly claim: string
  readonly confidence: number
  readonly provenance: readonly KnowledgeProvenance[]
}

export interface KnowledgeRecord {
  readonly id: string
  readonly subject: string
  readonly claim: string
  readonly confidence: number
  readonly evidence: readonly KnowledgeEvidence[]
  readonly createdAt: string
  readonly updatedAt: string
}

export interface KnowledgeQuery {
  readonly subject?: string
  readonly text?: string
  readonly limit?: number
}

export interface KnowledgePort {
  ingest(record: KnowledgeRecord): Promise<KnowledgeRecord>
  retrieve(query: KnowledgeQuery): Promise<readonly KnowledgeRecord[]>
  revise(id: string, record: KnowledgeRecord): Promise<KnowledgeRecord>
  invalidate(id: string, reason: string): Promise<void>
}

export function assertKnowledgeConfidence(confidence: number): void {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error('Knowledge confidence must be between 0 and 1')
  }
}

export function assertKnowledgeId(id: string): void {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuid.test(id)) throw new Error('Knowledge id must be a valid UUID')
}
