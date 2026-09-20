import assert from 'node:assert/strict'
import { advanceFulfillmentProviderStage, createFulfillmentProvider } from './fulfillment-provider.js'
import type { OpportunityRequirementSet } from './opportunity-requirement.js'
import { matchFulfillmentProvider, rankFulfillmentProviders } from './provider-matching.js'

function provider(id: string, capabilityName: string, naics: string, verifiedCapability = true) {
  let p = createFulfillmentProvider({
    id, legalName: id,
    identifiers: [{ type: 'uei', value: id + '-uei', verified: true, evidenceRefs: ['id'] }],
    serviceAreas: [{ country: 'US', state: 'California', evidenceRefs: ['geo'] }],
    capabilities: [{ id: id + ':cap', name: capabilityName, naicsCodes: [naics], pscCodes: [], keywords: capabilityName.toLowerCase().split(' '), confidence: 1, verified: verifiedCapability, evidenceRefs: verifiedCapability ? ['cap'] : [] }],
    credentials: [],
    pastPerformance: [],
    capacity: { status: 'available', evidenceRefs: ['capacity'] },
    evidence: [
      { id: 'id', kind: 'sam_registration', relationship: 'supports_identity', sourceId: 'sam', capturedAt: '2026-09-20T00:00:00Z', confidence: 1 },
      { id: 'geo', kind: 'official_source', relationship: 'supports_geography', sourceId: 'sam', capturedAt: '2026-09-20T00:00:00Z', confidence: 1 },
      ...(verifiedCapability ? [{ id: 'cap', kind: 'capability_record' as const, relationship: 'supports_capability' as const, sourceId: 'statement', capturedAt: '2026-09-20T00:00:00Z', confidence: 1 }] : []),
      { id: 'capacity', kind: 'capacity_record', relationship: 'supports_capacity', sourceId: 'attestation', capturedAt: '2026-09-20T00:00:00Z', confidence: 1 },
    ],
    sourceIds: ['sam'], riskFlags: [],
  })
  if (verifiedCapability) {
    p = advanceFulfillmentProviderStage(p, 'evidence_collected')
    p = advanceFulfillmentProviderStage(p, 'identity_verified')
    p = advanceFulfillmentProviderStage(p, 'capability_verified')
    p = advanceFulfillmentProviderStage(p, 'verified')
  }
  return p
}

const set: OpportunityRequirementSet = {
  opportunityId: 'sam:1',
  generatedAt: '2026-09-20T00:00:00Z',
  unresolved: [],
  requirements: [
    { id: 'r-cap', opportunityId: 'sam:1', kind: 'capability', label: 'Cloud engineering', severity: 'required', evidenceStatus: 'explicit', sourceClaimIds: [], sourceEvidenceIds: ['sam'], naicsCodes: ['541512'], pscCodes: [], keywords: ['cloud', 'engineering'], attributes: {}, confidence: 1, blockers: [] },
    { id: 'r-naics', opportunityId: 'sam:1', kind: 'naics', label: 'NAICS 541512', severity: 'important', evidenceStatus: 'explicit', sourceClaimIds: [], sourceEvidenceIds: ['sam'], naicsCodes: ['541512'], pscCodes: [], keywords: [], attributes: {}, confidence: 1, blockers: [] },
    { id: 'r-geo', opportunityId: 'sam:1', kind: 'geography', label: 'California', severity: 'required', evidenceStatus: 'explicit', sourceClaimIds: [], sourceEvidenceIds: ['sam'], naicsCodes: [], pscCodes: [], keywords: ['california'], attributes: {}, confidence: 1, blockers: [] },
  ],
}

const good = provider('provider:good', 'Cloud engineering', '541512')
const goodMatch = matchFulfillmentProvider(set, good)
assert.equal(goodMatch.disposition, 'qualified_candidate')
assert.equal(goodMatch.naicsIntelligenceScore, 100)
assert.ok(goodMatch.capabilityEvidenceScore > 0)

const naicsOnly = provider('provider:naics-only', 'Landscaping', '541512')
const naicsOnlyMatch = matchFulfillmentProvider(set, naicsOnly)
assert.equal(naicsOnlyMatch.disposition, 'blocked')
assert.ok(naicsOnlyMatch.blockers.some((b) => b.includes('capability')))
assert.ok(naicsOnlyMatch.score < goodMatch.score)

const unverified = provider('provider:unverified', 'Cloud engineering', '541512', false)
const unverifiedMatch = matchFulfillmentProvider(set, unverified)
assert.equal(unverifiedMatch.disposition, 'blocked')
assert.ok(unverifiedMatch.blockers.includes('Provider has not completed canonical verification.'))

const ranked = rankFulfillmentProviders(set, [naicsOnly, good, unverified])
assert.equal(ranked[0].providerId, good.id)
assert.equal(ranked[0].disposition, 'qualified_candidate')

console.log('provider-matching tests passed')
