import { adaptOverageOpportunity, type Opportunity } from "@jhadina/opportunity-core"

export type OverageOpportunityCandidate = {
  sourceKey: string
  externalRecordId: string
  sourceName: string
  sourceUrl: string
  recoveryFamily?: string
  amount: number
  currency: string
  claimantName: string
  propertyReference?: string
  sourceConfidence: number
  verificationStatus?: "not_required" | "human_required" | "verified" | "rejected"
  evidenceSummary?: string
  riskFlags?: string[]
}

function assertUnitInterval(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${field} must be a finite number between 0 and 1.`)
  }
  return value
}

/**
 * Canonical OverageOS -> Opportunity Core boundary.
 * Source confidence is preserved as evidence quality but never promoted into
 * claimant identity/entitlement verification. External recovery execution
 * remains owned by OverageOS.
 */
export function buildOverageOpportunity(candidate: OverageOpportunityCandidate): Opportunity {
  if (!candidate.sourceKey || !candidate.externalRecordId) {
    throw new Error("sourceKey and externalRecordId are required.")
  }
  if (!candidate.claimantName) throw new Error("claimantName is required.")
  if (!Number.isFinite(candidate.amount) || candidate.amount < 0) {
    throw new Error("amount must be a finite non-negative number.")
  }

  const sourceConfidence = assertUnitInterval(candidate.sourceConfidence, "sourceConfidence")
  const propertyReference = candidate.propertyReference ? ` Property reference: ${candidate.propertyReference}.` : ""
  const family = candidate.recoveryFamily ? ` Recovery family: ${candidate.recoveryFamily}.` : ""
  const evidence = candidate.evidenceSummary ? ` Evidence: ${candidate.evidenceSummary}` : ""

  const opportunity = adaptOverageOpportunity({
    id: `${candidate.sourceKey}:${candidate.externalRecordId}`,
    title: `Unclaimed property opportunity — ${candidate.claimantName}`,
    amount: candidate.amount,
    currency: candidate.currency,
    sourceUrl: candidate.sourceUrl,
    sourceName: candidate.sourceName,
    propertyReference: candidate.propertyReference,
    sourceConfidence,
    riskFlags: candidate.riskFlags,
    description: `Potential ${candidate.currency} ${candidate.amount.toFixed(2)} overage for ${candidate.claimantName}.${family}${propertyReference}${evidence}`,
  })

  return { ...opportunity, fitScore: 50 }
}


export type RecoveryOpportunityHandoff = {
  kind: "RecoveryOpportunityCandidate"
  candidate: {
    recoveryRecordId: string
    sourceId: string | null
    externalRecordId?: string | null
    owner?: string | null
    amount: number | null
    currency?: string | null
    assetType?: string | null
    jurisdiction?: string | null
    propertyReference?: string | null
    sourceUrl?: string | null
    evidence?: {
      sourceName?: string | null
      sourceUrl?: string | null
      capturedAt?: string | null
      rawRecordId?: string | null
    }
    verificationLevel?: string | null
    sourceConfidence?: number | null
  }
}

export function buildOverageOpportunityFromHandoff(handoff: RecoveryOpportunityHandoff): Opportunity {
  if (handoff.kind !== "RecoveryOpportunityCandidate") throw new Error("unsupported recovery handoff kind")
  const candidate = handoff.candidate
  if (!candidate.sourceId) throw new Error("recovery sourceId is required")
  if (!candidate.recoveryRecordId) throw new Error("recoveryRecordId is required")
  if (!candidate.owner) throw new Error("recovery owner is required")
  if (candidate.amount === null || !Number.isFinite(candidate.amount) || candidate.amount < 0) {
    throw new Error("recovery amount must be a finite non-negative number")
  }

  const sourceUrl = candidate.sourceUrl ?? candidate.evidence?.sourceUrl
  if (!sourceUrl) throw new Error("recovery sourceUrl is required")

  const sourceConfidence = candidate.sourceConfidence == null
    ? 0.5
    : assertUnitInterval(candidate.sourceConfidence, "sourceConfidence")

  const opportunity = buildOverageOpportunity({
    sourceKey: candidate.sourceId,
    externalRecordId: candidate.recoveryRecordId,
    sourceName: candidate.evidence?.sourceName ?? candidate.sourceId,
    sourceUrl,
    amount: candidate.amount,
    currency: candidate.currency ?? "USD",
    claimantName: candidate.owner,
    propertyReference: candidate.propertyReference ?? undefined,
    sourceConfidence,
    evidenceSummary: candidate.evidence?.rawRecordId
      ? `OverageOS recovery record ${candidate.evidence.rawRecordId}.`
      : undefined,
    riskFlags: [
      ...(candidate.sourceConfidence == null ? ["source_confidence_not_supplied"] : []),
      ...(candidate.verificationLevel && candidate.verificationLevel !== "VERIFIED"
        ? [`overage_verification_level:${candidate.verificationLevel}`]
        : []),
    ],
  })

  return {
    ...opportunity,
    metadata: {
      ...opportunity.metadata,
      recoveryRecordId: candidate.recoveryRecordId,
      externalRecordId: candidate.externalRecordId ?? null,
      overageVerificationLevel: candidate.verificationLevel ?? "V0_UNVERIFIED",
      assetType: candidate.assetType ?? null,
      jurisdictionLabel: candidate.jurisdiction ?? null,
      rawRecordId: candidate.evidence?.rawRecordId ?? null,
    },
  }
}
