export type OpportunityKind =
  | "pod"
  | "dropshipping"
  | "ai_job"
  | "remote_gig"
  | "freelance"
  | "creator"
  | "affiliate"
  | "automation"
  | "overage"
  | "government_contract"
  | "subcontract"
  | "digital_product"
  | "software"

export type OpportunitySource =
  | "manual"
  | "sam_gov"
  | "sba"
  | "affiliate_network"
  | "marketplace"
  | "social"
  | "web"
  | "overageos"
  | "internal"

export type AutomationLevel = "ai_can_do_it" | "ai_plus_user" | "user_led" | "do_not_pursue"

export type OpportunityVerificationStatus = "not_required" | "human_required" | "verified" | "rejected"

export type OpportunityStatus = "new" | "approved"

export type Opportunity = {
  id: string
  userId: string
  title: string
  kind: OpportunityKind
  source: OpportunitySource
  sourceUrl: string
  sourceName: string
  summary: string
  estimatedPay?: { min?: number; max?: number; currency: string; cadence?: "hourly" | "per_task" | "per_project" | "monthly" | "unknown" }
  startupCost?: number
  estimatedHours?: number
  automationLevel: AutomationLevel
  fitScore: number
  riskFlags: string[]
  deadline?: string
  requiresUserApproval: boolean
  verificationStatus?: OpportunityVerificationStatus
  sourceConfidence?: number
  status: OpportunityStatus
  createdAt: string
  approvedAt?: string
  metadata?: Record<string, string | number | boolean | null>
}

export const SIDE_INCOME_KINDS: OpportunityKind[] = [
  "pod",
  "dropshipping",
  "ai_job",
  "remote_gig",
  "freelance",
  "creator",
  "affiliate",
  "automation",
  "digital_product",
  "software",
]

export const GOVERNMENT_OPPORTUNITY_KINDS: OpportunityKind[] = ["government_contract", "subcontract"]

export function rankSideIncomeOpportunities(items: Opportunity[]): Opportunity[] {
  return [...items]
    .filter((item) => item.automationLevel !== "do_not_pursue")
    .sort((a, b) => {
      const aRisk = a.riskFlags.length
      const bRisk = b.riskFlags.length
      const aPay = a.estimatedPay?.max ?? a.estimatedPay?.min ?? 0
      const bPay = b.estimatedPay?.max ?? b.estimatedPay?.min ?? 0
      const aCost = a.startupCost ?? 0
      const bCost = b.startupCost ?? 0
      const aTime = a.estimatedHours ?? 1
      const bTime = b.estimatedHours ?? 1

      const aValue = a.fitScore + Math.min(aPay / Math.max(aTime, 1), 100) - aRisk * 8 - Math.min(aCost / 10, 25)
      const bValue = b.fitScore + Math.min(bPay / Math.max(bTime, 1), 100) - bRisk * 8 - Math.min(bCost / 10, 25)
      return bValue - aValue
    })
}
