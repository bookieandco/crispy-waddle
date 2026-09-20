import assert from 'node:assert/strict'
import type { CommercialDealGate } from './commercial-deal-gate.js'
import type { FulfillmentPlan } from './fulfillment-plan.js'
import { canPrepareProviderOutreach, evaluateEngagementReadiness, type ComplianceCheck } from './engagement-readiness.js'

const plan: FulfillmentPlan = {
  opportunityId: 'sam:ready',
  structure: 'prime_with_subcontractor',
  assignments: [
    { providerId: 'provider:prime', role: 'lead', requirementIds: ['r1'], evidenceRefs: ['p1'], score: 92 },
    { providerId: 'provider:sub', role: 'subcontractor', requirementIds: ['r2'], evidenceRefs: ['p2'], score: 86 },
  ],
  coveredRequirementIds: ['r1', 'r2'],
  uncoveredRequirementIds: [],
  blockers: [],
  rationale: [],
  requiresHumanApproval: true,
  engagementAuthorized: false,
}

const commercial: CommercialDealGate = {
  opportunityId: 'sam:ready',
  structure: 'subcontract_margin',
  economics: {
    grossRevenue: 100000,
    providerCost: 60000,
    directCost: 5000,
    overhead: 5000,
    contingency: 5000,
    acquisitionCost: 1000,
    estimatedGrossProfit: 24000,
    estimatedMarginPercent: 24,
  },
  status: 'commercially_viable',
  blockers: [],
  warnings: [],
  assumptions: [],
  complianceReviewRequired: true,
  humanApprovalRequired: true,
  engagementAuthorized: false,
}

const checks: ComplianceCheck[] = [
  { id: 'terms', kind: 'solicitation_terms', status: 'passed', required: true, evidenceRefs: ['e-terms'], sourceRefs: ['sam-sol'], notes: [] },
  { id: 'reps', kind: 'representations_certifications', status: 'passed', required: true, evidenceRefs: ['e-reps'], sourceRefs: ['sam-entity'], notes: [] },
  { id: 'oci', kind: 'organizational_conflict', status: 'passed', required: true, evidenceRefs: ['e-oci'], sourceRefs: ['review'], notes: [] },
  { id: 'sub', kind: 'subcontracting_limitations', status: 'passed', required: true, evidenceRefs: ['e-sub'], sourceRefs: ['solicitation'], notes: [] },
  { id: 'team', kind: 'teaming_rules', status: 'passed', required: true, evidenceRefs: ['e-team'], sourceRefs: ['solicitation'], notes: [] },
]

const ready = evaluateEngagementReadiness(plan, commercial, checks)
assert.equal(ready.status, 'ready_for_human_approval')
assert.equal(ready.outboundSendAuthorized, false)
assert.equal(canPrepareProviderOutreach(ready), false)

const approved = evaluateEngagementReadiness(plan, commercial, checks, { approvalRef: 'approval:human-1' })
assert.equal(approved.status, 'human_approved')
assert.equal(approved.outreachDraftAllowed, true)
assert.equal(approved.negotiationPrepAllowed, true)
assert.equal(approved.outboundSendAuthorized, false)
assert.equal(approved.contractExecutionAuthorized, false)
assert.equal(canPrepareProviderOutreach(approved), true)

const missingEvidence = evaluateEngagementReadiness(plan, commercial, [
  ...checks.filter((check) => check.kind !== 'teaming_rules'),
  { id: 'team', kind: 'teaming_rules', status: 'passed', required: true, evidenceRefs: [], sourceRefs: ['solicitation'], notes: [] },
])
assert.equal(missingEvidence.status, 'blocked')
assert.ok(missingEvidence.blockers.some((item) => item.includes('lacks evidence')))

const failed = evaluateEngagementReadiness(plan, commercial, [
  ...checks.filter((check) => check.kind !== 'subcontracting_limitations'),
  { id: 'sub-fail', kind: 'subcontracting_limitations', status: 'failed', required: true, evidenceRefs: ['e-sub'], sourceRefs: ['solicitation'], notes: [] },
])
assert.equal(failed.status, 'blocked')

console.log('engagement-readiness tests passed')
