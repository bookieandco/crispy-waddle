import assert from 'node:assert/strict'
import type { CommercialDealGate } from './commercial-deal-gate.js'
import type { EngagementReadinessGate } from './engagement-readiness.js'
import type { FulfillmentPlan } from './fulfillment-plan.js'
import { buildNegotiationPacket, buildProviderOutreachPacket } from './provider-outreach.js'

const plan: FulfillmentPlan = {
  opportunityId: 'sam:packet',
  structure: 'prime_with_subcontractor',
  assignments: [{ providerId: 'provider:sub', role: 'subcontractor', requirementIds: ['r-security'], evidenceRefs: ['e-cap'], score: 90 }],
  coveredRequirementIds: ['r-security'], uncoveredRequirementIds: [], blockers: [], rationale: [],
  requiresHumanApproval: true, engagementAuthorized: false,
}
const commercial: CommercialDealGate = {
  opportunityId: 'sam:packet', structure: 'subcontract_margin',
  economics: { grossRevenue: 100000, providerCost: 50000, directCost: 5000, overhead: 5000, contingency: 5000, acquisitionCost: 1000, estimatedGrossProfit: 34000, estimatedMarginPercent: 34 },
  status: 'commercially_viable', blockers: [], warnings: ['Confirm workshare.'], assumptions: [],
  complianceReviewRequired: true, humanApprovalRequired: true, engagementAuthorized: false,
}
const readiness: EngagementReadinessGate = {
  opportunityId: 'sam:packet', status: 'human_approved', requiredCheckKinds: [], checks: [], blockers: [], warnings: [],
  approvalRef: 'approval:1', outreachDraftAllowed: true, negotiationPrepAllowed: true,
  outboundSendAuthorized: false, contractExecutionAuthorized: false,
}

const packet = buildProviderOutreachPacket(plan, commercial, readiness, plan.assignments[0], { providerName: 'Acme LLC', opportunityTitle: 'Cloud Security', providerCost: 50000 })
assert.equal(packet.providerId, 'provider:sub')
assert.equal(packet.draftOnly, true)
assert.equal(packet.sendAuthorized, false)
assert.equal(packet.contractAuthorized, false)
assert.ok(packet.draftBody.includes('exploratory discussion only'))
assert.ok(packet.negotiationPoints.some((item) => item.includes('r-security')))

const negotiation = buildNegotiationPacket(plan, commercial, readiness, { providerNames: { 'provider:sub': 'Acme LLC' }, providerCosts: { 'provider:sub': 50000 }, opportunityTitle: 'Cloud Security' })
assert.equal(negotiation.providerPackets.length, 1)
assert.equal(negotiation.sendAuthorized, false)
assert.equal(negotiation.signatureAuthorized, false)
assert.ok(negotiation.protectedAssertions.some((item) => item.includes('separate authorization')))

assert.throws(() => buildProviderOutreachPacket(plan, commercial, { ...readiness, status: 'ready_for_human_approval', approvalRef: undefined }, plan.assignments[0]), /Human-approved/)
console.log('provider-outreach tests passed')
