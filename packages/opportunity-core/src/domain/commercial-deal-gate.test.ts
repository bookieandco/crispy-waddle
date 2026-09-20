import assert from 'node:assert/strict'
import type { FulfillmentPlan } from './fulfillment-plan.js'
import { canAdvanceToCommercialReview, evaluateCommercialDeal } from './commercial-deal-gate.js'

const plan: FulfillmentPlan = {
  opportunityId: 'sam:deal',
  structure: 'prime_with_subcontractor',
  assignments: [
    { providerId: 'provider:lead', role: 'lead', requirementIds: ['r1'], evidenceRefs: ['e1'], score: 90 },
    { providerId: 'provider:sub', role: 'subcontractor', requirementIds: ['r2'], evidenceRefs: ['e2'], score: 85 },
  ],
  coveredRequirementIds: ['r1', 'r2'],
  uncoveredRequirementIds: [],
  blockers: [],
  rationale: [],
  requiresHumanApproval: true,
  engagementAuthorized: false,
}

const viable = evaluateCommercialDeal(plan, {
  contractValue: 100000,
  providerCosts: { 'provider:lead': 20000, 'provider:sub': 30000 },
  directCost: 5000,
  overhead: 5000,
  contingency: 5000,
  acquisitionCost: 1000,
})
assert.equal(viable.status, 'commercially_viable')
assert.equal(viable.economics.estimatedGrossProfit, 34000)
assert.equal(viable.economics.estimatedMarginPercent, 34)
assert.equal(viable.engagementAuthorized, false)
assert.equal(canAdvanceToCommercialReview(viable), true)

const fee = evaluateCommercialDeal(plan, { contractValue: 100000, feePercent: 10 }, 'success_fee')
assert.equal(fee.status, 'blocked')
assert.ok(fee.blockers.some((b) => b.includes('compliance review')))
assert.equal(fee.engagementAuthorized, false)

const unknownCosts = evaluateCommercialDeal(plan, { contractValue: 100000 })
assert.ok(unknownCosts.warnings.some((w) => w.includes('Provider cost is unknown')))
assert.equal(unknownCosts.status, 'blocked')
assert.equal(unknownCosts.humanApprovalRequired, true)

const gapPlan: FulfillmentPlan = { ...plan, structure: 'unresolved', uncoveredRequirementIds: ['r3'] }
const gap = evaluateCommercialDeal(gapPlan, { contractValue: 100000 })
assert.equal(gap.status, 'blocked')
assert.equal(canAdvanceToCommercialReview(gap), false)

console.log('commercial-deal-gate tests passed')
