export type AuthorityLevel = "PRIMARY" | "OFFICIAL_GUIDANCE" | "PUBLIC_RECORD" | "SECONDARY" | "DISCOVERY"
export type VerificationStatus = "UNVERIFIED" | "VERIFIED" | "REJECTED" | "STALE"

export type JusticeSource = {
  id: string
  name: string
  url: string
  jurisdiction?: string
  authorityLevel: AuthorityLevel
}

export type JusticeEvidence = {
  id: string
  sourceId: string
  jurisdiction: string
  title: string
  citation?: string
  effectiveFrom?: string
  effectiveTo?: string
  retrievedAt: string
  contentHash: string
  content: string
  verification: VerificationStatus
  provenance: { sourceUrl: string; retrievedAt: string; contentHash: string }
}

export type JusticeVerification = {
  evidenceId: string
  status: VerificationStatus
  checkedAt: string
  checks: string[]
  notes?: string
}

export interface JusticeEvidenceStore {
  saveEvidence(evidence: JusticeEvidence): Promise<void>
  getEvidence(id: string): Promise<JusticeEvidence | null>
  saveVerification(verification: JusticeVerification): Promise<void>
  getVerification(evidenceId: string): Promise<JusticeVerification | null>
}

export class InMemoryJusticeEvidenceStore implements JusticeEvidenceStore {
  private evidence = new Map<string, JusticeEvidence>()
  private verifications = new Map<string, JusticeVerification>()

  async saveEvidence(value: JusticeEvidence) { this.evidence.set(value.id, structuredClone(value)) }
  async getEvidence(id: string) { const value = this.evidence.get(id); return value ? structuredClone(value) : null }
  async saveVerification(value: JusticeVerification) { this.verifications.set(value.evidenceId, structuredClone(value)) }
  async getVerification(evidenceId: string) { const value = this.verifications.get(evidenceId); return value ? structuredClone(value) : null }
}

export class JusticeEvidenceVerifier {
  constructor(private readonly store: JusticeEvidenceStore) {}

  async verify(evidenceId: string, checks: string[], notes?: string): Promise<JusticeVerification> {
    const evidence = await this.store.getEvidence(evidenceId)
    if (!evidence) throw new Error(`Justice evidence not found: ${evidenceId}`)
    if (!evidence.content.trim()) throw new Error(`Justice evidence has no content: ${evidenceId}`)

    const verification: JusticeVerification = {
      evidenceId,
      status: checks.length > 0 ? "VERIFIED" : "UNVERIFIED",
      checkedAt: new Date().toISOString(),
      checks: [...checks],
      notes,
    }

    await this.store.saveVerification(verification)
    await this.store.saveEvidence({
      ...evidence,
      verification: verification.status,
    })
    return verification
  }
}
