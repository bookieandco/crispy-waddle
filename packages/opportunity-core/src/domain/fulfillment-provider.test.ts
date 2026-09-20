import assert from 'node:assert/strict'
import {
  advanceFulfillmentProviderEngagement,
  advanceFulfillmentProviderStage,
  createFulfillmentProvider,
  createFulfillmentProviderEngagement,
  isFulfillmentProviderEngagementAuthorized,
  isFulfillmentProviderVerified,
  type FulfillmentProvider,
} from './fulfillment-provider.js'

function providerFixture(): FulfillmentProvider {
  return createFulfillmentProvider({
    id: 'provider:acme',
    legalName: 'Acme Technical Services LLC',
    identifiers: [{
      type: 'uei',
      value: 'ABC123EXAMPLE',
      verified: true,
      evidenceRefs: ['ev-entity'],
    }],
    serviceAreas: [{
      country: 'US',
      state: 'CA',
      evidenceRefs: ['ev-entity'],
    }],
    capabilities: [{
      id: 'cap:cloud',
      name: 'Cloud engineering',
      naicsCodes: ['541512'],
      pscCodes: ['DA01'],
      keywords: ['cloud', 'infrastructure'],
      confidence: 0.95,
      verified: true,
      evidenceRefs: ['ev-capability'],
    }],
    credentials: [{
      id: 'credential:sam',
      kind: 'registration',
      name: 'SAM registration',
      issuer: 'SAM.gov',
      verified: true,
      evidenceRefs: ['ev-entity'],
    }],
    pastPerformance: [{
      id: 'performance:1',
      role: 'subcontractor',
      customer: 'Example Prime',
      agency: 'Example Agency',
      amount: 100000,
      currency: 'USD',
      capabilityIds: ['cap:cloud'],
      verified: true,
      evidenceRefs: ['ev-award'],
    }],
    capacity: {
      status: 'available',
      workforceSize: 12,
      maxConcurrentProjects: 2,
      evidenceRefs: ['ev-capacity'],
    },
    evidence: [
      { id: 'ev-entity', kind: 'sam_registration', relationship: 'supports_identity', sourceId: 'sam.gov', capturedAt: '2026-09-19T00:00:00Z', confidence: 1 },
      { id: 'ev-capability', kind: 'capability_record', relationship: 'supports_capability', sourceId: 'official-capability-statement', capturedAt: '2026-09-19T00:00:00Z', confidence: 0.9 },
      { id: 'ev-award', kind: 'award_record', relationship: 'supports_past_performance', sourceId: 'usaspending', capturedAt: '2026-09-19T00:00:00Z', confidence: 1 },
      { id: 'ev-capacity', kind: 'capacity_record', relationship: 'supports_capacity', sourceId: 'provider-attestation', capturedAt: '2026-09-19T00:00:00Z', confidence: 0.6 },
    ],
    sourceIds: ['sam.gov', 'usaspending'],
    riskFlags: [],
  }, '2026-09-19T00:00:00Z')
}

{
  const discovered = providerFixture()
  assert.equal(discovered.stage, 'discovered')
  assert.equal(discovered.verificationStatus, 'unverified')
  assert.equal(isFulfillmentProviderVerified(discovered), false)

  const evidenceCollected = advanceFulfillmentProviderStage(discovered, 'evidence_collected')
  const identityVerified = advanceFulfillmentProviderStage(evidenceCollected, 'identity_verified')
  const capabilityVerified = advanceFulfillmentProviderStage(identityVerified, 'capability_verified')
  const verified = advanceFulfillmentProviderStage(capabilityVerified, 'verified')

  assert.equal(verified.verificationStatus, 'verified')
  assert.equal(isFulfillmentProviderVerified(verified), true)
}

{
  const provider = providerFixture()
  provider.identifiers[0] = { ...provider.identifiers[0], verified: false }
  const evidenceCollected = advanceFulfillmentProviderStage(provider, 'evidence_collected')
  assert.throws(
    () => advanceFulfillmentProviderStage(evidenceCollected, 'identity_verified'),
    /Evidence-backed verified provider identity is required/,
  )
}

{
  const provider = providerFixture()
  provider.capabilities[0] = {
    ...provider.capabilities[0],
    verified: false,
    naicsCodes: ['541512'],
  }
  const evidenceCollected = advanceFulfillmentProviderStage(provider, 'evidence_collected')
  const identityVerified = advanceFulfillmentProviderStage(evidenceCollected, 'identity_verified')

  assert.throws(
    () => advanceFulfillmentProviderStage(identityVerified, 'capability_verified'),
    /Evidence-backed verified capability is required/,
  )
}

{
  let provider = providerFixture()
  provider = advanceFulfillmentProviderStage(provider, 'evidence_collected')
  provider = advanceFulfillmentProviderStage(provider, 'identity_verified')
  provider = advanceFulfillmentProviderStage(provider, 'capability_verified')
  provider = advanceFulfillmentProviderStage(provider, 'verified')

  let engagement = createFulfillmentProviderEngagement({
    id: 'engagement:1',
    opportunityId: 'sam:opp-1',
    providerId: provider.id,
    structure: 'subcontractor',
    eligibilityEvidenceRefs: [],
    commercialEvidenceRefs: [],
    reasons: [],
    blockers: [],
  })

  assert.throws(
    () => advanceFulfillmentProviderEngagement(engagement, provider, 'eligibility_checked'),
    /Eligibility evidence is required/,
  )

  engagement = advanceFulfillmentProviderEngagement(engagement, provider, 'eligibility_checked', {
    eligibilityEvidenceRefs: ['eligibility-review:1'],
  })
  engagement = advanceFulfillmentProviderEngagement(engagement, provider, 'commercial_review', {
    commercialEvidenceRefs: ['commercial-review:1'],
  })

  assert.throws(
    () => advanceFulfillmentProviderEngagement(engagement, provider, 'human_approved'),
    /Human approval reference is required/,
  )

  engagement = advanceFulfillmentProviderEngagement(engagement, provider, 'human_approved', {
    approvalRef: 'approval:human:1',
  })
  engagement = advanceFulfillmentProviderEngagement(engagement, provider, 'engagement_authorized')

  assert.equal(isFulfillmentProviderEngagementAuthorized(engagement, provider), true)
}

{
  const provider = providerFixture()
  let engagement = createFulfillmentProviderEngagement({
    id: 'engagement:2',
    opportunityId: 'sam:opp-2',
    providerId: provider.id,
    structure: 'teaming_partner',
    eligibilityEvidenceRefs: ['eligibility-review:2'],
    commercialEvidenceRefs: ['commercial-review:2'],
    approvalRef: 'approval:human:2',
    reasons: [],
    blockers: [],
  })

  engagement = advanceFulfillmentProviderEngagement(engagement, provider, 'eligibility_checked')
  engagement = advanceFulfillmentProviderEngagement(engagement, provider, 'commercial_review')
  engagement = advanceFulfillmentProviderEngagement(engagement, provider, 'human_approved')

  assert.throws(
    () => advanceFulfillmentProviderEngagement(engagement, provider, 'engagement_authorized'),
    /Provider must be verified/,
  )
}

{
  const provider = advanceFulfillmentProviderStage(providerFixture(), 'rejected')
  assert.equal(provider.verificationStatus, 'rejected')
  assert.throws(
    () => advanceFulfillmentProviderStage(provider, 'evidence_collected'),
    /Invalid fulfillment provider transition/,
  )
}

console.log('fulfillment-provider tests passed')
