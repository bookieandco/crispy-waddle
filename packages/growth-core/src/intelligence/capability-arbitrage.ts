export type CapabilityStatus = "owned" | "partner" | "missing" | "unknown"

export interface CapabilityRequirement {
  name: string
  status: CapabilityStatus
  estimatedCost?: number
  confidence?: number
  evidence?: string[]
}

export type DeliveryPath =
  | "direct"
  | "partner_assembled"
  | "subcontract"
  | "teaming"
  | "blocked"

export interface CapabilityArbitrageInput {
  opportunityId: string
  estimatedRevenue: number
  estimatedDirectCost: number
  estimatedHours: number
  requirements: CapabilityRequirement[]
  setAside?: string
  approvalRequired?: boolean
}

export interface CapabilityArbitragePlan {
  opportunityId: string
  path: DeliveryPath
  missingCapabilities: string[]
  partnerCapabilities: string[]
  estimatedPartnerCost: number
  estimatedGrossProfit: number
  profitPerHour: number
  readinessScore: number
  approvalRequired: boolean
  blocked: boolean
  rationale: string
}

/**
 * Decision support only. Approval is surfaced separately from analysis so the
 * engine can evaluate an opportunity and prepare a plan without executing it.
 */
export function planCapabilityArbitrage(input: CapabilityArbitrageInput): CapabilityArbitragePlan {
  const missingCapabilities = input.requirements
    .filter((r) => r.status === "missing")
    .map((r) => r.name)
  const partnerCapabilities = input.requirements
    .filter((r) => r.status === "partner")
    .map((r) => r.name)
  const estimatedPartnerCost = input.requirements
    .filter((r) => r.status === "partner" || r.status === "missing")
    .reduce((sum, r) => sum + (r.estimatedCost ?? 0), 0)

  const unknownRequirements = input.requirements.filter((r) => r.status === "unknown")
  const blockedByEvidence = unknownRequirements.length > 0
  const blockedByMissingCost = missingCapabilities.length > 0 && estimatedPartnerCost === 0
  const blocked = blockedByEvidence || blockedByMissingCost
  const approvalRequired = Boolean(input.approvalRequired)

  const path: DeliveryPath = blocked
    ? "blocked"
    : missingCapabilities.length === 0
      ? "direct"
      : input.setAside
        ? "teaming"
        : "partner_assembled"

  const estimatedGrossProfit = Math.max(
    input.estimatedRevenue - input.estimatedDirectCost - estimatedPartnerCost,
    0,
  )
  const profitPerHour = estimatedGrossProfit / Math.max(input.estimatedHours, 1)
  const known = input.requirements.filter((r) => r.status !== "unknown").length
  const readinessScore = input.requirements.length === 0
    ? 0
    : Math.round((known / input.requirements.length) * 100)

  return {
    opportunityId: input.opportunityId,
    path,
    missingCapabilities,
    partnerCapabilities,
    estimatedPartnerCost,
    estimatedGrossProfit,
    profitPerHour,
    readinessScore,
    approvalRequired,
    blocked,
    rationale: blocked
      ? "Blocked pending missing evidence or capability validation."
      : approvalRequired
        ? "Analyzed successfully; human approval is required before consequential action."
        : path === "direct"
          ? "All required capabilities are currently represented as owned."
          : "Opportunity may be fulfilled through qualified external capability, subject to solicitation terms and human review.",
  }
}
