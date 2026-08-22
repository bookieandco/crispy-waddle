import type { AutomationLevel, Opportunity, OpportunityVerificationStatus } from "./sideIncome"

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
  verificationStatus?: OpportunityVerificationStatus
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
 * Converts an OverageOS candidate into the existing Jhadina opportunity shape.
 * This is an adapter only: it does not verify identity, rank the opportunity,
 * contact the claimant, or execute any external action.
 */
export function buildOverageOpportunity(
  candidate: OverageOpportunityCandidate,
  userId: string,
): Omit<Opportunity, "id" | "createdAt" | "status"> {
  if (!candidate.sourceKey || !candidate.externalRecordId) {
    throw new Error("sourceKey and externalRecordId are required.")
  }
  if (!candidate.claimantName) throw new Error("claimantName is required.")
  if (!Number.isFinite(candidate.amount) || candidate.amount < 0) {
    throw new Error("amount must be a finite non-negative number.")
  }

  const sourceConfidence = assertUnitInterval(candidate.sourceConfidence, "sourceConfidence")
  const verificationStatus = candidate.verificationStatus ?? "human_required"
  const automationLevel: AutomationLevel = "user_led"
  const propertyReference = candidate.propertyReference ? ` Property reference: ${candidate.propertyReference}.` : ""
  const family = candidate.recoveryFamily ? ` Recovery family: ${candidate.recoveryFamily}.` : ""
  const evidence = candidate.evidenceSummary ? ` Evidence: ${candidate.evidenceSummary}` : ""

  return {
    userId,
    title: `Unclaimed property opportunity — ${candidate.claimantName}`,
    kind: "overage",
    sourceUrl: candidate.sourceUrl,
    sourceName: candidate.sourceName,
    summary: `Potential ${candidate.currency} ${candidate.amount.toFixed(2)} overage for ${candidate.claimantName}. Source confidence: ${sourceConfidence.toFixed(2)}.${family}${propertyReference}${evidence}`,
    estimatedPay: { min: candidate.amount, max: candidate.amount, currency: candidate.currency, cadence: "unknown" },
    automationLevel,
    // OverageOS currently supplies source/evidence confidence, not user-fit.
    // Keep fit neutral until a separate fit signal exists; never derive it from source confidence.
    fitScore: 50,
    riskFlags: candidate.riskFlags ?? [],
    requiresUserApproval: true,
    verificationStatus,
    sourceConfidence,
  }
}
