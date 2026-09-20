import assert from 'node:assert/strict'
import { advanceFulfillmentProviderStage, createFulfillmentProvider } from './fulfillment-provider.js'
import type { OpportunityRequirementSet } from './opportunity-requirement.js'
import { buildFulfillmentPlan, buildProviderShortlist } from './fulfillment-plan.js'

function verifiedProvider(id: string, capability: string, socioeconomic?: string) {
  let p = createFulfillmentProvider({
    id, legalName: id,
    identifiers: [{ type: 'uei', value: id + '-uei', verified: true, evidenceRefs: ['id'] }],
    serviceAreas: [{ country: 'US', state: 'California', evidenceRefs: ['geo'] }],
    capabilities: [{ id: id + ':cap', name: capability, naicsCodes: [], pscCodes: [], keywords: capability.toLowerCase().split(' '), confidence: 1, verified: true, evidenceRefs: ['cap'] }],
    credentials: socioeconomic ? [{ id: id + ':socio', kind: 'socioeconomic', name: socioeconomic, verified: true, evidenceRefs: ['socio'] }] : [], pastPerformance: [], capacity: { status: 'available', evidenceRefs: ['capacity'] },
    evidence: [
      { id: 'id', kind: 'sam_registration', relationship: 'supports_identity', sourceId: 'sam', capturedAt: '2026-09-20T00:00:00Z', confidence: 1 },
      { id: 'geo', kind: 'official_source', relationship: 'supports_geography', sourceId: 'sam', capturedAt: '2026-09-20T00:00:00Z', confidence: 1 },
      { id: 'cap', kind: 'capability_record', relationship: 'supports_capability', sourceId: 'statement', capturedAt: '2026-09-20T00:00:00Z', confidence: 1 },
      { id: 'capacity', kind: 'capacity_record', relationship: 'supports_capacity', sourceId: 'attestation', capturedAt: '2026-09-20T00:00:00Z', confidence: 1 },
      ...(socioeconomic ? [{ id: 'socio', kind: 'certification_record' as const, relationship: 'supports_credential' as const, sourceId: 'sam', capturedAt: '2026-09-20T00:00:00Z', confidence: 1 }] : []),
    ], sourceIds: ['sam'], riskFlags: [],
  })
  p = advanceFulfillmentProviderStage(p, 'evidence_collected')
  p = advanceFulfillmentProviderStage(p, 'identity_verified')
  p = advanceFulfillmentProviderStage(p, 'capability_verified')
  return advanceFulfillmentProviderStage(p, 'verified')
}

const set: OpportunityRequirementSet = {
  opportunityId: 'sam:plan',
  generatedAt: '2026-09-20T00:00:00Z',
  unresolved: [],
  requirements: [
    { id: 'cloud', opportunityId: 'sam:plan', kind: 'capability', label: 'Cloud', severity: 'required', evidenceStatus: 'explicit', sourceClaimIds: [], sourceEvidenceIds: [], naicsCodes: [], pscCodes: [], keywords: ['cloud'], attributes: {}, confidence: 1, blockers: [] },
    { id: 'security', opportunityId: 'sam:plan', kind: 'capability', label: 'Security', severity: 'required', evidenceStatus: 'explicit', sourceClaimIds: [], sourceEvidenceIds: [], naicsCodes: [], pscCodes: [], keywords: ['security'], attributes: {}, confidence: 1, blockers: [] },
  ],
}

const both = verifiedProvider('provider:both', 'Cloud security')
const direct = buildFulfillmentPlan(set, [both])
assert.equal(direct.structure, 'direct_fulfillment')
assert.equal(direct.assignments.length, 1)
assert.equal(direct.engagementAuthorized, false)

const cloud = verifiedProvider('provider:cloud', 'Cloud')
const security = verifiedProvider('provider:security', 'Security')
const team = buildFulfillmentPlan(set, [cloud, security])
assert.equal(team.structure, 'prime_with_subcontractor')
assert.equal(team.assignments.length, 2)
assert.equal(team.uncoveredRequirementIds.length, 0)
assert.equal(team.engagementAuthorized, false)

const gap = buildFulfillmentPlan(set, [cloud])
assert.equal(gap.structure, 'unresolved')
assert.deepEqual(gap.uncoveredRequirementIds, ['security'])
assert.ok(gap.blockers.some((b) => b.includes('Uncovered required requirements')))

const shortlist = buildProviderShortlist(set, [cloud, security, both], 2)
assert.equal(shortlist.length, 2)
assert.ok(shortlist.every((match) => match.disposition !== 'blocked'))

console.log('fulfillment-plan tests passed')

const scheduleOnly: OpportunityRequirementSet = {
  opportunityId: 'sam:schedule',
  generatedAt: '2026-09-20T00:00:00Z',
  unresolved: [],
  requirements: [
    { id: 'schedule', opportunityId: 'sam:schedule', kind: 'schedule', label: 'Deadline', severity: 'required', evidenceStatus: 'explicit', sourceClaimIds: [], sourceEvidenceIds: [], naicsCodes: [], pscCodes: [], keywords: ['deadline'], attributes: {}, confidence: 1, blockers: [] },
    { id: 'cloud2', opportunityId: 'sam:schedule', kind: 'capability', label: 'Cloud', severity: 'required', evidenceStatus: 'explicit', sourceClaimIds: [], sourceEvidenceIds: [], naicsCodes: [], pscCodes: [], keywords: ['cloud'], attributes: {}, confidence: 1, blockers: [] },
  ],
}
const schedulePlan = buildFulfillmentPlan(scheduleOnly, [cloud])
assert.equal(schedulePlan.structure, 'direct_fulfillment')
assert.deepEqual(schedulePlan.uncoveredRequirementIds, [])


const setAsideTeam: OpportunityRequirementSet = {
  opportunityId: 'sam:set-aside-team',
  generatedAt: '2026-09-20T00:00:00Z',
  unresolved: [],
  requirements: [
    { id: 'sb', opportunityId: 'sam:set-aside-team', kind: 'socioeconomic', label: 'Small Business', severity: 'required', evidenceStatus: 'explicit', sourceClaimIds: [], sourceEvidenceIds: [], naicsCodes: [], pscCodes: [], keywords: ['small', 'business'], attributes: {}, confidence: 1, blockers: [] },
    { id: 'cloud3', opportunityId: 'sam:set-aside-team', kind: 'capability', label: 'Cloud', severity: 'required', evidenceStatus: 'explicit', sourceClaimIds: [], sourceEvidenceIds: [], naicsCodes: [], pscCodes: [], keywords: ['cloud'], attributes: {}, confidence: 1, blockers: [] },
  ],
}
const eligibleLead = verifiedProvider('provider:eligible-lead', 'General services', 'Small Business')
const cloudSub = verifiedProvider('provider:cloud-sub', 'Cloud')
const setAsideTeamPlan = buildFulfillmentPlan(setAsideTeam, [cloudSub, eligibleLead])
assert.equal(setAsideTeamPlan.structure, 'prime_with_subcontractor')
assert.equal(setAsideTeamPlan.assignments[0].providerId, eligibleLead.id)
assert.ok(setAsideTeamPlan.assignments[0].requirementIds.includes('sb'))
assert.ok(!setAsideTeamPlan.assignments.slice(1).some((assignment) => assignment.requirementIds.includes('sb')))
