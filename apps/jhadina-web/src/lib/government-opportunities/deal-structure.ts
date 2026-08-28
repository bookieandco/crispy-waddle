export type DealStructureKind =
  | 'REFERRAL'
  | 'LEAD_GENERATION'
  | 'SUBCONTRACT'
  | 'PRIME_WITH_SUBCONTRACTOR'
  | 'JOINT_VENTURE'
  | 'DIRECT_FULFILLMENT'

export type DealStructureInput = {
  opportunityId: string
  contractValue: number
  providerCost: number
  acquisitionCost?: number
  fulfillmentCost?: number
  structure: DealStructureKind
  feePct?: number
  complianceApproved: boolean
}

export type DealStructureEconomics = {
  opportunityId: string
  structure: DealStructureKind
  grossRevenue: number
  providerPayout: number
  operatingCost: number
  grossProfit: number
  marginPct: number
  requiresHumanReview: boolean
  status: 'MODELED' | 'BLOCKED'
  rationale: string
}

function nonNegative(value: number | undefined): number {
  return Math.max(0, value ?? 0)
}

function clampPct(value: number | undefined): number {
  return Math.max(0, Math.min(100, value ?? 0))
}

/**
 * Models commercial economics only. It does not determine whether a referral,
 * brokerage, subcontract, JV, or prime arrangement is legally permitted.
 * Procurement and jurisdiction-specific rules must be verified separately.
 */
export function modelDealStructure(input: DealStructureInput): DealStructureEconomics {
  const revenue = nonNegative(input.contractValue)
  const providerPayout = nonNegative(input.providerCost)
  const operatingCost = nonNegative(input.acquisitionCost) + nonNegative(input.fulfillmentCost)
  const feePct = clampPct(input.feePct)
  const feeRevenue = revenue * (feePct / 100)

  const grossRevenue =
    input.structure === 'REFERRAL' || input.structure === 'LEAD_GENERATION'
      ? feeRevenue
      : revenue
  const grossProfit = grossRevenue - providerPayout - operatingCost
  const marginPct = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0

  const requiresHumanReview =
    input.structure === 'JOINT_VENTURE' ||
    input.structure === 'PRIME_WITH_SUBCONTRACTOR' ||
    input.structure === 'SUBCONTRACT'

  if (!input.complianceApproved) {
    return {
      opportunityId: input.opportunityId,
      structure: input.structure,
      grossRevenue,
      providerPayout,
      operatingCost,
      grossProfit,
      marginPct: Math.round(marginPct * 100) / 100,
      requiresHumanReview: true,
      status: 'BLOCKED',
      rationale: 'commercial economics are modeled, but compliance/procurement approval is not established',
    }
  }

  return {
    opportunityId: input.opportunityId,
    structure: input.structure,
    grossRevenue,
    providerPayout,
    operatingCost,
    grossProfit,
    marginPct: Math.round(marginPct * 100) / 100,
    requiresHumanReview,
    status: 'MODELED',
    rationale: 'commercial structure modeled from supplied revenue and cost assumptions',
  }
}
