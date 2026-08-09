import type { Opportunity, OpportunityKind, AutomationLevel } from "./sideIncome"

const opportunities = new Map<string, Opportunity>()
let opportunityCounter = 0

export function createOpportunity(input: {
  userId: string
  title: string
  kind: OpportunityKind
  sourceUrl: string
  sourceName: string
  summary: string
  estimatedPay?: Opportunity["estimatedPay"]
  startupCost?: number
  estimatedHours?: number
  automationLevel: AutomationLevel
  fitScore: number
  riskFlags?: string[]
  deadline?: string
  requiresUserApproval?: boolean
}): Opportunity {
  const opportunity: Opportunity = {
    ...input,
    id: `opp_${++opportunityCounter}`,
    riskFlags: input.riskFlags ?? [],
    requiresUserApproval: input.requiresUserApproval ?? true,
    status: "new",
    createdAt: new Date().toISOString(),
  }
  opportunities.set(opportunity.id, opportunity)
  return opportunity
}

export function listOpportunities(userId: string): Opportunity[] {
  return Array.from(opportunities.values()).filter((o) => o.userId === userId)
}

/**
 * Approve an opportunity. This is the one action in this domain that has to
 * go through a server-tracked decision: it never applies for a job, spends
 * money, or publishes anything - it only records that the user chose to
 * pursue this opportunity, with a timestamp for the audit trail.
 */
export function approveOpportunity(userId: string, opportunityId: string): Opportunity | null {
  const opportunity = opportunities.get(opportunityId)
  if (!opportunity || opportunity.userId !== userId || opportunity.status !== "new") return null
  const approved: Opportunity = { ...opportunity, status: "approved", approvedAt: new Date().toISOString() }
  opportunities.set(opportunityId, approved)
  return approved
}
