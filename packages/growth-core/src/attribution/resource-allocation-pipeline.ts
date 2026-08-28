import type { OpportunityAllocationRequest } from './resource-allocation-request.js'

export type AllocationPlan = {
  planId: string
  requestId: string
  opportunityId: string
  recommendation: OpportunityAllocationRequest['recommendation']
  resourceUnits: number
  budget: number
  currency: string
  rationale: string
}

export type AllocationConstraint = {
  maxBudget: number
  maxResourceUnits: number
  currency: string
}

export type AuthorizationDecision = {
  authorized: boolean
  authorizationId: string
  reason?: string
}

export interface JhadinaPolicyBoundary {
  authorize(input: {
    capability: 'opportunity.resource_allocation'
    requestId: string
    opportunityId: string
    budget: number
    resourceUnits: number
  }): Promise<AuthorizationDecision>
}

export interface JhadinaActionExecutor {
  execute(input: {
    capability: 'opportunity.resource_allocation'
    authorizationId: string
    plan: AllocationPlan
  }): Promise<{ executionId: string }>
}

export function createAllocationPlan(
  request: OpportunityAllocationRequest,
  input: { resourceUnits: number; budget: number; currency?: string; rationale?: string },
): AllocationPlan {
  if (input.resourceUnits < 0 || input.budget < 0) throw new Error('allocation_values_must_be_non_negative')
  return {
    planId: `allocation-plan:${request.requestId}`,
    requestId: request.requestId,
    opportunityId: request.opportunityId,
    recommendation: request.recommendation,
    resourceUnits: input.resourceUnits,
    budget: input.budget,
    currency: input.currency ?? 'USD',
    rationale: input.rationale ?? request.rationale,
  }
}

export function validateAllocationPlan(plan: AllocationPlan, constraint: AllocationConstraint): void {
  if (plan.currency !== constraint.currency) throw new Error('allocation_currency_mismatch')
  if (plan.budget > constraint.maxBudget) throw new Error('allocation_budget_limit_exceeded')
  if (plan.resourceUnits > constraint.maxResourceUnits) throw new Error('allocation_resource_limit_exceeded')
}

export async function authorizeAllocation(
  plan: AllocationPlan,
  policy: JhadinaPolicyBoundary,
): Promise<AuthorizationDecision> {
  return policy.authorize({
    capability: 'opportunity.resource_allocation',
    requestId: plan.requestId,
    opportunityId: plan.opportunityId,
    budget: plan.budget,
    resourceUnits: plan.resourceUnits,
  })
}

export async function executeAuthorizedAllocation(
  plan: AllocationPlan,
  decision: AuthorizationDecision,
  executor: JhadinaActionExecutor,
): Promise<{ executionId: string }> {
  if (!decision.authorized) throw new Error(`allocation_not_authorized:${decision.reason ?? 'policy_denied'}`)
  return executor.execute({
    capability: 'opportunity.resource_allocation',
    authorizationId: decision.authorizationId,
    plan,
  })
}
