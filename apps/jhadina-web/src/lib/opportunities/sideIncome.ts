import type { OpportunityHubCategory } from "@jhadina/opportunity-core"

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

export type AutomationLevel = "ai_can_do_it" | "ai_plus_user" | "user_led" | "do_not_pursue"

export type OpportunityVerificationStatus = "not_required" | "human_required" | "verified" | "rejected"

// Compatibility projection for the web UI only. Canonical lifecycle,
// ranking, persistence, research, action, and outcome authority live in
// @jhadina/opportunity-core plus the authenticated Supabase repository.
// "approved" here means the user authorized research; it is not execution.
export type OpportunityStatus = "new" | "approved"
export type OpportunityTriageState = "review" | "saved" | "dismissed"

export type Opportunity = {
  id: string
  userId: string
  title: string
  kind: OpportunityKind
  hubCategory: OpportunityHubCategory
  sourceUrl: string
  sourceName: string
  summary: string
  estimatedPay?: { min?: number; max?: number; currency: string; cadence?: "hourly" | "per_task" | "per_project" | "monthly" | "unknown" }
  startupCost?: number
  estimatedHours?: number
  automationLevel: AutomationLevel
  fitScore: number
  opportunityScore?: number
  riskFlags: string[]
  deadline?: string
  requiresUserApproval: boolean
  verificationStatus?: OpportunityVerificationStatus
  sourceConfidence?: number
  status: OpportunityStatus
  triageState?: OpportunityTriageState
  createdAt: string
  approvedAt?: string
  researchCaseId?: string
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
  "overage",
]
