import type {
  JusticeAuthorityLevel,
  JusticeEvidenceRecord,
  JusticeVerificationState,
} from "./JusticeEvidenceStore"

export interface JusticeEvidencePacketItem {
  evidenceId: string
  sourceId: string
  title: string
  citation?: string
  jurisdiction: string
  authorityLevel: JusticeAuthorityLevel
  verificationState: JusticeVerificationState
  content: string
  contentHash: string
  sourceUrl?: string
  effectiveFrom?: string
  effectiveTo?: string
  provenance: Record<string, unknown>
}

export interface JusticeEvidencePacket {
  packetId: string
  query: string
  jurisdiction: string
  asOf: string
  status: "READY" | "INSUFFICIENT_EVIDENCE"
  evidence: JusticeEvidencePacketItem[]
  limitations: string[]
  generatedAt: string
}

export function buildVerifiedJusticeEvidencePacket(input: {
  packetId: string
  query: string
  jurisdiction: string
  asOf: string
  records: JusticeEvidenceRecord[]
  generatedAt?: string
}): JusticeEvidencePacket {
  const limitations: string[] = []
  const evidence = input.records
    .filter((record) => record.verificationState === "VERIFIED")
    .filter((record) => record.jurisdiction === input.jurisdiction)
    .filter((record) => coversDate(record, input.asOf))
    .map(toPacketItem)

  if (evidence.length === 0) {
    limitations.push("No verified, jurisdiction-matching, date-valid evidence was available.")
  }

  return {
    packetId: input.packetId,
    query: input.query,
    jurisdiction: input.jurisdiction,
    asOf: input.asOf,
    status: evidence.length > 0 ? "READY" : "INSUFFICIENT_EVIDENCE",
    evidence,
    limitations,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  }
}

function coversDate(record: JusticeEvidenceRecord, asOf: string): boolean {
  if (record.effectiveFrom && asOf < record.effectiveFrom) return false
  if (record.effectiveTo && asOf > record.effectiveTo) return false
  return true
}

function toPacketItem(record: JusticeEvidenceRecord): JusticeEvidencePacketItem {
  return {
    evidenceId: record.id,
    sourceId: record.sourceId,
    title: record.title,
    citation: record.citation,
    jurisdiction: record.jurisdiction,
    authorityLevel: record.authorityLevel,
    verificationState: record.verificationState,
    content: record.content,
    contentHash: record.contentHash,
    sourceUrl: record.sourceUrl,
    effectiveFrom: record.effectiveFrom,
    effectiveTo: record.effectiveTo,
    provenance: record.provenance,
  }
}
