export type JusticeAuthorityLevel =
  | "PRIMARY"
  | "OFFICIAL_GUIDANCE"
  | "PUBLIC_RECORD"
  | "SECONDARY"
  | "DISCOVERY"

export type JusticeVerificationState =
  | "UNVERIFIED"
  | "VERIFIED"
  | "REJECTED"
  | "STALE"

export interface JusticeEvidenceRecord {
  id: string
  sourceId: string
  jurisdiction: string
  title: string
  citation?: string
  authorityLevel: JusticeAuthorityLevel
  verificationState: JusticeVerificationState
  content: string
  contentHash: string
  sourceUrl?: string
  publishedAt?: string
  effectiveFrom?: string
  effectiveTo?: string
  retrievedAt: string
  provenance: Record<string, unknown>
}

export interface JusticeEvidenceQuery {
  jurisdiction?: string
  sourceId?: string
  authorityLevels?: JusticeAuthorityLevel[]
  verificationStates?: JusticeVerificationState[]
  citation?: string
  text?: string
  limit?: number
}

export interface JusticeEvidenceStore {
  saveEvidence(record: JusticeEvidenceRecord): Promise<void>
  getEvidence(id: string): Promise<JusticeEvidenceRecord | null>
  searchEvidence(query: JusticeEvidenceQuery): Promise<JusticeEvidenceRecord[]>
}

export interface JusticeSourceDocument {
  sourceId: string
  jurisdiction: string
  title: string
  content: string
  sourceUrl?: string
  citation?: string
  authorityLevel: JusticeAuthorityLevel
  publishedAt?: string
  effectiveFrom?: string
  effectiveTo?: string
  provenance?: Record<string, unknown>
}

export function buildJusticeEvidenceRecord(
  document: JusticeSourceDocument,
  id: string,
  contentHash: string,
  retrievedAt = new Date().toISOString(),
): JusticeEvidenceRecord {
  return {
    id,
    sourceId: document.sourceId,
    jurisdiction: document.jurisdiction,
    title: document.title,
    citation: document.citation,
    authorityLevel: document.authorityLevel,
    verificationState: "UNVERIFIED",
    content: document.content,
    contentHash,
    sourceUrl: document.sourceUrl,
    publishedAt: document.publishedAt,
    effectiveFrom: document.effectiveFrom,
    effectiveTo: document.effectiveTo,
    retrievedAt,
    provenance: document.provenance ?? {},
  }
}

export interface JusticeIngestionAdapter {
  ingest(document: JusticeSourceDocument): Promise<JusticeEvidenceRecord>
}

export class JusticeEvidenceIngestionAdapter implements JusticeIngestionAdapter {
  constructor(
    private readonly store: JusticeEvidenceStore,
    private readonly hash: (content: string) => string,
    private readonly id: (document: JusticeSourceDocument) => string,
  ) {}

  async ingest(document: JusticeSourceDocument): Promise<JusticeEvidenceRecord> {
    if (!document.content.trim()) {
      throw new Error("justice_evidence_content_required")
    }

    const record = buildJusticeEvidenceRecord(
      document,
      this.id(document),
      this.hash(document.content),
    )

    await this.store.saveEvidence(record)
    return record
  }
}
