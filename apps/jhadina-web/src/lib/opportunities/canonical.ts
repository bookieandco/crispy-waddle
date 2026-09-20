import { classifyOpportunityHubCategory, type Opportunity as CanonicalOpportunity, type OpportunityFamily, type OpportunityType } from "@jhadina/opportunity-core"
import type { AutomationLevel, Opportunity as OpportunityView, OpportunityKind, OpportunityTriageState, OpportunityVerificationStatus } from "./sideIncome"

export type OpportunityCreateInput = {
  title: string
  kind: OpportunityKind
  sourceUrl: string
  sourceName: string
  summary: string
  estimatedPay?: OpportunityView["estimatedPay"]
  startupCost?: number
  estimatedHours?: number
  automationLevel: AutomationLevel
  fitScore?: number
  riskFlags?: string[]
  deadline?: string
  requiresUserApproval?: boolean
  sourceConfidence?: number
}


export type StoredCanonicalOpportunity = {
  userId: string
  opportunity: CanonicalOpportunity
  triageState: OpportunityTriageState
  approvedAt?: string
  researchCaseId?: string
}

const FAMILY_TYPE: Record<OpportunityKind, { family: OpportunityFamily; type: OpportunityType }> = {
  pod: { family: "commerce", type: "commercial" },
  dropshipping: { family: "business", type: "commercial" },
  ai_job: { family: "employment", type: "job" },
  remote_gig: { family: "employment", type: "gig" },
  freelance: { family: "employment", type: "gig" },
  creator: { family: "creator", type: "commercial" },
  affiliate: { family: "business", type: "commercial" },
  automation: { family: "business", type: "commercial" },
  overage: { family: "recovery", type: "recovery" },
}

export function canonicalFromSideIncome(
  input: OpportunityCreateInput,
  id: string,
  now = new Date().toISOString(),
): CanonicalOpportunity {
  const mapped = FAMILY_TYPE[input.kind]
  const confidence = clamp01(input.sourceConfidence ?? 0.5)
  const sourceId = `source:${id}`
  return {
    id,
    title: input.title,
    family: mapped.family,
    type: mapped.type,
    description: input.summary,
    sourceUrl: input.sourceUrl,
    sourceName: input.sourceName,
    sourceId,
    amount: input.estimatedPay ? {
      min: input.estimatedPay.min,
      max: input.estimatedPay.max,
      currency: input.estimatedPay.currency,
    } : undefined,
    deadline: input.deadline,
    claims: [{
      id: `${id}:discovery`,
      field: "discovery",
      value: input.summary,
      sourceId,
      sourceType: "user",
      confidence,
      verified: false,
    }],
    evidence: [{
      id: `${id}:source`,
      sourceId,
      sourceUrl: input.sourceUrl,
      sourceName: input.sourceName,
      sourceType: "user",
      capturedAt: now,
      confidence,
    }],
    verificationStatus: "unverified",
    sourceConfidence: confidence,
    fitScore: clamp100(input.fitScore ?? 50),
    riskFlags: input.riskFlags ?? [],
    status: "discovered",
    metadata: {
      opportunityKind: input.kind,
      automationLevel: input.automationLevel,
      startupCost: input.startupCost ?? null,
      estimatedHours: input.estimatedHours ?? null,
      payCadence: input.estimatedPay?.cadence ?? "unknown",
      requiresUserApproval: input.requiresUserApproval ?? true,
    },
    createdAt: now,
    updatedAt: now,
  }
}

export function toOpportunityView(stored: StoredCanonicalOpportunity): OpportunityView {
  const opportunity = stored.opportunity
  const metadata = opportunity.metadata ?? {}
  const kind = isOpportunityKind(metadata.opportunityKind) ? metadata.opportunityKind : inferKind(opportunity)
  const automationLevel = isAutomationLevel(metadata.automationLevel) ? metadata.automationLevel : "user_led"
  const startupCost = typeof metadata.startupCost === "number" ? metadata.startupCost : undefined
  const estimatedHours = typeof metadata.estimatedHours === "number" ? metadata.estimatedHours : undefined
  const payCadence = isPayCadence(metadata.payCadence) ? metadata.payCadence : "unknown"
  const verificationStatus: OpportunityVerificationStatus =
    opportunity.verificationStatus === "verified" ? "verified" :
    opportunity.verificationStatus === "rejected" ? "rejected" :
    opportunity.family === "recovery" ? "human_required" : "not_required"

  return {
    id: opportunity.id,
    userId: stored.userId,
    title: opportunity.title,
    kind,
    hubCategory: classifyOpportunityHubCategory(opportunity),
    sourceUrl: opportunity.sourceUrl,
    sourceName: opportunity.sourceName,
    summary: opportunity.description ?? opportunity.title,
    estimatedPay: opportunity.amount ? { ...opportunity.amount, cadence: payCadence } : undefined,
    startupCost,
    estimatedHours,
    automationLevel,
    fitScore: opportunity.fitScore ?? 50,
    opportunityScore: opportunity.opportunityScore,
    riskFlags: opportunity.riskFlags,
    deadline: opportunity.deadline,
    requiresUserApproval: metadata.requiresUserApproval !== false,
    verificationStatus,
    sourceConfidence: opportunity.sourceConfidence,
    status: stored.approvedAt || ["approved", "pursuing", "won", "lost"].includes(opportunity.status) ? "approved" : "new",
    triageState: stored.triageState,
    createdAt: opportunity.createdAt,
    approvedAt: stored.approvedAt,
    researchCaseId: stored.researchCaseId,
  }
}

function inferKind(opportunity: CanonicalOpportunity): OpportunityKind {
  if (opportunity.family === "recovery") return "overage"
  if (opportunity.type === "job") return "ai_job"
  if (opportunity.type === "gig") return "remote_gig"
  if (opportunity.family === "creator") return "creator"
  if (opportunity.family === "commerce") return "pod"
  return "automation"
}

function isOpportunityKind(value: unknown): value is OpportunityKind {
  return typeof value === "string" && ["pod","dropshipping","ai_job","remote_gig","freelance","creator","affiliate","automation","overage"].includes(value)
}

function isAutomationLevel(value: unknown): value is AutomationLevel {
  return typeof value === "string" && ["ai_can_do_it","ai_plus_user","user_led","do_not_pursue"].includes(value)
}

function isPayCadence(value: unknown): value is NonNullable<OpportunityView["estimatedPay"]>["cadence"] {
  return typeof value === "string" && ["hourly","per_task","per_project","monthly","unknown"].includes(value)
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
}
