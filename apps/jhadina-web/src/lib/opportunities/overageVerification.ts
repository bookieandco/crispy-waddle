export type OverageVerificationRequest = {
  opportunityId: string
  sourceKey: string
  externalRecordId: string
  sourceName: string
  sourceUrl: string
  propertyReference?: string
  amount: number
  currency: string
  claimantName: string
  evidenceSummary?: string
  status: "human_required"
  checks: readonly [
    "confirm_source_record",
    "confirm_property_reference",
    "confirm_claimant_identity",
    "confirm_ownership_or_entitlement",
  ]
}

/**
 * Creates a verification checklist only. It does not perform identity lookup,
 * skip-tracing, contact, filing, payment, or recovery actions.
 */
export function buildOverageVerificationRequest(input: {
  opportunityId: string
  sourceKey: string
  externalRecordId: string
  sourceName: string
  sourceUrl: string
  propertyReference?: string
  amount: number
  currency: string
  claimantName: string
  evidenceSummary?: string
}): OverageVerificationRequest {
  if (!input.opportunityId) throw new Error("opportunityId is required.")
  if (!input.sourceKey || !input.externalRecordId) {
    throw new Error("sourceKey and externalRecordId are required.")
  }
  if (!input.claimantName) throw new Error("claimantName is required.")
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new Error("amount must be a finite non-negative number.")
  }

  return {
    ...input,
    status: "human_required",
    checks: [
      "confirm_source_record",
      "confirm_property_reference",
      "confirm_claimant_identity",
      "confirm_ownership_or_entitlement",
    ],
  }
}
