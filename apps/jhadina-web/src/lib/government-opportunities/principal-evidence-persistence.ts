import type { CorporatePrincipalCandidate } from './principal-enrichment-provider'

export interface PrincipalEvidenceRecord {
  id: string
  principalId: string
  entityId: string
  sourceId: string
  evidenceId: string
  sourceRecordId?: string
  sourceUrl?: string
  observedAt: string
  confidence: CorporatePrincipalCandidate['confidence']
}

export interface PrincipalEvidencePersistence {
  upsert(candidate: CorporatePrincipalCandidate): Promise<PrincipalEvidenceRecord>
  listForPrincipal(principalId: string): Promise<PrincipalEvidenceRecord[]>
}

export class InMemoryPrincipalEvidencePersistence implements PrincipalEvidencePersistence {
  private readonly records = new Map<string, PrincipalEvidenceRecord>()

  async upsert(candidate: CorporatePrincipalCandidate): Promise<PrincipalEvidenceRecord> {
    if (!candidate.id || !candidate.entityId || !candidate.sourceId || !candidate.evidenceId) {
      throw new Error('principal, entity, source, and evidence identifiers are required')
    }

    const record: PrincipalEvidenceRecord = {
      id: candidate.evidenceId,
      principalId: candidate.id,
      entityId: candidate.entityId,
      sourceId: candidate.sourceId,
      evidenceId: candidate.evidenceId,
      sourceRecordId: candidate.sourceRecordId,
      sourceUrl: candidate.sourceUrl,
      observedAt: candidate.observedAt,
      confidence: candidate.confidence,
    }

    this.records.set(record.id, record)
    return record
  }

  async listForPrincipal(principalId: string): Promise<PrincipalEvidenceRecord[]> {
    return [...this.records.values()].filter((record) => record.principalId === principalId)
  }
}
