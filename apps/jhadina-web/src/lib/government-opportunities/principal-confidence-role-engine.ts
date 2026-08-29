export type PrincipalRoleStatus = 'CURRENT' | 'FORMER' | 'UNKNOWN'
export type PrincipalDisposition =
  | 'QUALIFIED'
  | 'PROVISIONAL'
  | 'INSUFFICIENT_EVIDENCE'
  | 'CONFLICTED'
  | 'STALE'
  | 'REVIEW_REQUIRED'

export interface PrincipalEvidence {
  id: string
  providerId: string
  sourceRecordId?: string
  sourceType?: 'official_registry' | 'government' | 'public_record' | 'commercial' | 'user'
  confidence?: number
  observedAt?: string
  retrievedAt?: string
  role?: string
  roleStatus?: PrincipalRoleStatus
  identifier?: string
  ownershipClaim?: boolean
  controlClaim?: boolean
  independentSourceKey?: string
  conflict?: boolean
}

export interface ResolvedPrincipalForScoring {
  canonicalPrincipalId: string
  identityConfidence: number
  roleStatus: PrincipalRoleStatus
  roleConfidence: number
  evidence: PrincipalEvidence[]
}

export interface PrincipalConfidenceRoleResult {
  canonicalPrincipalId: string
  identityConfidence: number
  roleConfidence: number
  ownershipConfidence: number
  controlConfidence: number
  evidenceQuality: number
  freshnessScore: number
  corroborationScore: number
  roleStatus: PrincipalRoleStatus
  disposition: PrincipalDisposition
  supportingEvidenceIds: string[]
  conflictingEvidenceIds: string[]
  reasons: string[]
  engineVersion: string
  evaluatedAt: string
}

const ENGINE_VERSION = '6.69.0'
const DAY_MS = 86_400_000

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function freshnessScore(evidence: PrincipalEvidence[], now: number): number {
  const dates = evidence
    .map((item) => item.observedAt ?? item.retrievedAt)
    .filter(Boolean)
    .map((value) => Date.parse(value as string))
    .filter(Number.isFinite)

  if (dates.length === 0) return 50

  const ageDays = Math.max(0, (now - Math.max(...dates)) / DAY_MS)
  if (ageDays <= 30) return 100
  if (ageDays <= 90) return 90
  if (ageDays <= 180) return 75
  if (ageDays <= 365) return 55
  if (ageDays <= 730) return 30
  return 10
}

function corroborationScore(evidence: PrincipalEvidence[]): number {
  const independent = new Set(
    evidence.map((item) => item.independentSourceKey ?? item.providerId),
  ).size

  if (independent >= 4) return 100
  if (independent === 3) return 90
  if (independent === 2) return 75
  if (independent === 1) return 45
  return 0
}

function evidenceQuality(evidence: PrincipalEvidence[]): number {
  if (evidence.length === 0) return 0
  const values = evidence.map((item) => item.confidence ?? 50)
  return clamp(values.reduce((sum, value) => sum + value, 0) / values.length)
}

/**
 * Scores an already-resolved principal. This layer does not infer ownership or
 * control from officer/director status; those claims require explicit evidence.
 */
export function evaluatePrincipalConfidenceAndRole(
  principal: ResolvedPrincipalForScoring,
  now = Date.now(),
): PrincipalConfidenceRoleResult {
  if (!principal.canonicalPrincipalId.trim()) {
    throw new Error('canonicalPrincipalId is required')
  }

  const evidence = principal.evidence
  const supporting = evidence.filter((item) => !item.conflict)
  const conflicting = evidence.filter((item) => item.conflict)
  const freshness = freshnessScore(evidence, now)
  const corroboration = corroborationScore(supporting)
  const quality = evidenceQuality(supporting)

  const identity = clamp(
    principal.identityConfidence * 0.55 + quality * 0.2 + corroboration * 0.15 + freshness * 0.1,
  )
  const role = clamp(
    principal.roleConfidence * 0.5 + quality * 0.2 + corroboration * 0.15 + freshness * 0.15,
  )

  const explicitOwnership = supporting.filter((item) => item.ownershipClaim).length > 0
  const explicitControl = supporting.filter((item) => item.controlClaim).length > 0
  const ownership = explicitOwnership ? clamp(quality * 0.6 + corroboration * 0.4) : 0
  const control = explicitControl ? clamp(quality * 0.6 + corroboration * 0.4) : 0

  const reasons: string[] = []
  if (corroboration >= 75) reasons.push('Independent sources corroborate the principal.')
  if (freshness < 55) reasons.push('The strongest available evidence is stale.')
  if (conflicting.length > 0) reasons.push('Conflicting evidence was retained and reduces disposition confidence.')
  if (!explicitOwnership) reasons.push('No explicit ownership evidence was supplied; ownership was not inferred from role.')
  if (!explicitControl) reasons.push('No explicit control evidence was supplied; control was not inferred from role.')

  let disposition: PrincipalDisposition = 'PROVISIONAL'
  if (conflicting.length > 0) disposition = 'CONFLICTED'
  else if (freshness < 30) disposition = 'STALE'
  else if (identity < 50 || role < 50) disposition = 'INSUFFICIENT_EVIDENCE'
  else if (identity >= 85 && role >= 80 && corroboration >= 75 && freshness >= 55) disposition = 'QUALIFIED'
  else if (identity >= 70 && role >= 65) disposition = 'PROVISIONAL'
  else disposition = 'REVIEW_REQUIRED'

  return {
    canonicalPrincipalId: principal.canonicalPrincipalId,
    identityConfidence: identity,
    roleConfidence: role,
    ownershipConfidence: ownership,
    controlConfidence: control,
    evidenceQuality: quality,
    freshnessScore: freshness,
    corroborationScore: corroboration,
    roleStatus: principal.roleStatus,
    disposition,
    supportingEvidenceIds: supporting.map((item) => item.id),
    conflictingEvidenceIds: conflicting.map((item) => item.id),
    reasons,
    engineVersion: ENGINE_VERSION,
    evaluatedAt: new Date(now).toISOString(),
  }
}
