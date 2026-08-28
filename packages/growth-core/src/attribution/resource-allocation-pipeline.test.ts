import { describe, expect, it, vi } from 'vitest'
import { authorizeAllocation, createAllocationPlan, executeAuthorizedAllocation, validateAllocationPlan } from './resource-allocation-pipeline.js'
import type { OpportunityAllocationRequest } from './resource-allocation-request.js'

const request: OpportunityAllocationRequest = {
  eventType: 'growth.opportunity.allocation_requested', requestId: 'allocation:opp-1:increase_testing', opportunityId: 'opp-1', recommendation: 'increase_testing', confidence: 'strong', rationale: 'strong_positive_economics', requestedAt: '2026-08-28T00:00:00Z', source: 'opportunity-learning', requiresAuthorization: true,
}

const plan = createAllocationPlan(request, { resourceUnits: 2, budget: 50 })

describe('OCE-10 allocation pipeline', () => {
  it('creates and validates a bounded allocation plan', () => {
    expect(plan.planId).toContain(request.requestId)
    expect(() => validateAllocationPlan(plan, { maxBudget: 100, maxResourceUnits: 3, currency: 'USD' })).not.toThrow()
    expect(() => validateAllocationPlan(plan, { maxBudget: 25, maxResourceUnits: 3, currency: 'USD' })).toThrow('allocation_budget_limit_exceeded')
  })

  it('delegates authorization to the Jhadina policy boundary', async () => {
    const authorize = vi.fn().mockResolvedValue({ authorized: true, authorizationId: 'auth-1' })
    const decision = await authorizeAllocation(plan, { authorize })
    expect(decision.authorized).toBe(true)
    expect(authorize).toHaveBeenCalledWith({ capability: 'opportunity.resource_allocation', requestId: request.requestId, opportunityId: 'opp-1', budget: 50, resourceUnits: 2 })
  })

  it('requires authorization before execution', async () => {
    const execute = vi.fn().mockResolvedValue({ executionId: 'exec-1' })
    await expect(executeAuthorizedAllocation(plan, { authorized: false, authorizationId: 'none', reason: 'policy_denied' }, { execute })).rejects.toThrow('allocation_not_authorized')
    expect(execute).not.toHaveBeenCalled()
    await expect(executeAuthorizedAllocation(plan, { authorized: true, authorizationId: 'auth-1' }, { execute })).resolves.toEqual({ executionId: 'exec-1' })
  })
})
