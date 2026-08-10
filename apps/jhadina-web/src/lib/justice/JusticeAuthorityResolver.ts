import type { JusticeAuthorityLevel, JusticeEvidenceRecord } from "./JusticeEvidenceStore"

export interface JusticeResolution {
  controllingEvidence: JusticeEvidenceRecord[]
  supportingEvidence: JusticeEvidenceRecord[]
  conflictingEvidence: JusticeEvidenceRecord[]
  supersededEvidence: JusticeEvidenceRecord[]
  staleEvidence: JusticeEvidenceRecord[]
  unresolvedConflicts: string[]
  reasoningTrace: string[]
  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNRESOLVED"
}

export interface JusticeAuthorityResolverInput {
  records: JusticeEvidenceRecord[]
  jurisdiction: string
  asOf: string
}

const AUTHORITY_RANK: Record<JusticeAuthorityLevel, number> = {
  PRIMARY: 5,
  OFFICIAL_GUIDANCE: 4,
  PUBLIC_RECORD: 3,
  SECONDARY: 2,
  DISCOVERY: 1,
}

export function resolveJusticeAuthorities(input: JusticeAuthorityResolverInput): JusticeResolution {
  const reasoningTrace: string[] = []
  const staleEvidence: JusticeEvidenceRecord[] = []
  const supersededEvidence: JusticeEvidenceRecord[] = []
  const eligible: JusticeEvidenceRecord[] = []

  for (const record of input.records) {
    if (record.jurisdiction !== input.jurisdiction) continue
    if (record.verificationState !== "VERIFIED") continue

    if (!coversDate(record, input.asOf)) {
      staleEvidence.push(record)
      reasoningTrace.push(`${record.id}: outside effective date window`)
      continue
    }

    eligible.push(record)
  }

  if (eligible.length === 0) {
    return {
      controllingEvidence: [],
      supportingEvidence: [],
      conflictingEvidence: [],
      supersededEvidence,
      staleEvidence,
      unresolvedConflicts: ["No verified evidence is both jurisdiction- and date-valid."],
      reasoningTrace,
      confidence: "UNRESOLVED",
    }
  }

  const sorted = [...eligible].sort((a, b) => authorityRank(b) - authorityRank(a))
  const highestRank = authorityRank(sorted[0])
  const controlling = sorted.filter((record) => authorityRank(record) === highestRank)
  const supporting = sorted.filter((record) => authorityRank(record) < highestRank)
  const unresolvedConflicts: string[] = []
  const conflictingEvidence: JusticeEvidenceRecord[] = []

  // Evidence records do not yet carry a machine-verifiable holding/proposition model.
  // Never infer a legal conflict from arbitrary text. Flag multiple same-rank authorities
  // for explicit downstream resolution instead.
  if (controlling.length > 1) {
    conflictingEvidence.push(...controlling.slice(1))
    unresolvedConflicts.push(
      `Multiple verified authorities share the highest authority level (${controlling[0].authorityLevel}); proposition-level conflict resolution is required.`,
    )
    reasoningTrace.push("Same-rank authority collision preserved instead of silently selecting a winner.")
  }

  reasoningTrace.push(`Highest verified authority level: ${controlling[0].authorityLevel}`)

  return {
    controllingEvidence: unresolvedConflicts.length ? [] : [controlling[0]],
    supportingEvidence: supporting,
    conflictingEvidence,
    supersededEvidence,
    staleEvidence,
    unresolvedConflicts,
    reasoningTrace,
    confidence: unresolvedConflicts.length ? "UNRESOLVED" : highestRank >= 4 ? "HIGH" : "MEDIUM",
  }
}

function authorityRank(record: JusticeEvidenceRecord): number {
  return AUTHORITY_RANK[record.authorityLevel]
}

function coversDate(record: JusticeEvidenceRecord, asOf: string): boolean {
  if (record.effectiveFrom && asOf < record.effectiveFrom) return false
  if (record.effectiveTo && asOf > record.effectiveTo) return false
  return true
}
