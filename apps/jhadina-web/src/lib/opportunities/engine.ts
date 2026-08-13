import type { Opportunity, OpportunityKind, AutomationLevel } from "./sideIncome"

// Anchored to globalThis rather than plain module-level state: Next.js
// compiles each route handler file (route.ts, approve/route.ts, ...) as its
// own module graph, so a bare `const`/`let` here would give every route
// file its own independent, empty copy instead of one shared store -
// confirmed via runtime verification (an opportunity created through POST
// /api/opportunities was invisible to POST /api/opportunities/approve
// until this was anchored to globalThis). Same fix as handlers.ts uses for
// JANET's storage singleton.
interface OpportunitiesGlobal {
  __jhadinaOpportunities?: Map<string, Opportunity>
  __jhadinaOpportunityCounter?: number
}
const opportunitiesGlobal = globalThis as unknown as OpportunitiesGlobal

function getOpportunities(): Map<string, Opportunity> {
  if (!opportunitiesGlobal.__jhadinaOpportunities) {
    opportunitiesGlobal.__jhadinaOpportunities = new Map<string, Opportunity>()
  }
  return opportunitiesGlobal.__jhadinaOpportunities
}

function nextOpportunityId(): string {
  opportunitiesGlobal.__jhadinaOpportunityCounter = (opportunitiesGlobal.__jhadinaOpportunityCounter ?? 0) + 1
  return `opp_${opportunitiesGlobal.__jhadinaOpportunityCounter}`
}

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
    id: nextOpportunityId(),
    riskFlags: input.riskFlags ?? [],
    requiresUserApproval: input.requiresUserApproval ?? true,
    status: "new",
    createdAt: new Date().toISOString(),
  }
  getOpportunities().set(opportunity.id, opportunity)
  return opportunity
}

export function listOpportunities(userId: string): Opportunity[] {
  return Array.from(getOpportunities().values()).filter((o) => o.userId === userId)
}

/**
 * Approve an opportunity. This is the one action in this domain that has to
 * go through a server-tracked decision: it never applies for a job, spends
 * money, or publishes anything - it only records that the user chose to
 * pursue this opportunity, with a timestamp for the audit trail.
 */
export function approveOpportunity(userId: string, opportunityId: string): Opportunity | null {
  const opportunities = getOpportunities()
  const opportunity = opportunities.get(opportunityId)
  if (!opportunity || opportunity.userId !== userId || opportunity.status !== "new") return null
  const approved: Opportunity = { ...opportunity, status: "approved", approvedAt: new Date().toISOString() }
  opportunities.set(opportunityId, approved)
  return approved
}
