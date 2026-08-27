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
  blocked: boolean
  rationale: string
}

/**
 * Decision support only. It does not contact vendors, submit bids, negotiate,
 * represent a contractor, or determine legal eligibility.
 */
export function planCapabilityArbitrage(input: CapabilityArbitrageInput): CapabilityArbitragePlan {
  const missingCapabilities = input.requirements
    .filter((r) => r.status === "missing")
    .map((r) => r.name)
  const partnerCapabilities = input.requirements
    .filter((r) => r.status === "partner" || r.status === "teaming" as CapabilityStatus)
    .map((r) => r.name)
  const estimatedPartnerCost = input.requirements
    .filter((r) => r.status === "partner" || r.status === "missing")
    .reduce((sum, r) => sum + (r.estimatedCost ?? 0), 0)

  const hardBlock = Boolean(input.approvalRequired) || input.requirements.some((r) => r.status === "unknown")
  const blocked = hardBlock || (missingCapabilities.length > 0 && estimatedPartnerCost === 0)
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
    blocked,
    rationale: blocked
      ? "Blocked pending missing evidence, capability validation, or required human/legal review."
      : path === "direct"
        ? "All required capabilities are currently represented as owned."
        : "Opportunity may be fulfilled through qualified external capability, subject to solicitation terms and human review.",
  }
}
