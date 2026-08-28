import { adaptSamOpportunity } from '../adapters/sam.js'
import { adaptOverageOpportunity } from '../adapters/overage.js'
import type { Opportunity } from '../domain/opportunity.js'

export const samFixture: Opportunity = adaptSamOpportunity({
  noticeId: 'FIXTURE-SAM-001',
  title: 'Small Business Technology Services',
  noticeType: 'Solicitation',
  solicitationNumber: 'FIXTURE-001',
  department: 'Department of Example',
  naicsCode: '541512',
  setAside: 'Small Business',
  responseDeadline: '2026-12-31T17:00:00Z',
  estimatedValue: 500000,
  placeOfPerformance: 'United States',
  sourceUrl: 'https://sam.gov/content/opportunities',
  description: 'Canonical SAM fixture.',
  fetchedAt: '2026-08-28T00:00:00Z',
})

export const verifiedOverageFixture: Opportunity = adaptOverageOpportunity({
  id: 'FIXTURE-OVERAGE-001',
  title: 'Verified Excess Proceeds Claim',
  amount: 12500,
  currency: 'USD',
  sourceUrl: 'https://example.gov/overage/fixture-001',
  sourceName: 'Example County',
  jurisdiction: { country: 'US', region: 'NV', locality: 'Example County' },
  propertyReference: 'PARCEL-FIXTURE-001',
  claimantVerified: true,
  saleVerified: true,
  entitlementVerified: true,
  sourceRecordVerified: true,
  capturedAt: '2026-08-28T00:00:00Z',
})

export const pendingOverageFixture: Opportunity = adaptOverageOpportunity({
  id: 'FIXTURE-OVERAGE-002',
  title: 'Unresolved Excess Proceeds Candidate',
  amount: 9000,
  sourceUrl: 'https://example.gov/overage/fixture-002',
  sourceName: 'Example County',
  propertyReference: 'PARCEL-FIXTURE-002',
  claimantVerified: false,
  saleVerified: true,
  entitlementVerified: false,
  sourceRecordVerified: true,
  capturedAt: '2026-08-28T00:00:00Z',
})

export const ripplingGrantFixture: Opportunity = {
  id: 'grant:rippling:fixture-001',
  title: 'Rippling Small Business Grant',
  family: 'funding',
  type: 'grant',
  description: 'Fixture derived from a secondary transcript claim; official terms must be verified before use.',
  sourceUrl: 'https://helloskip.com/',
  sourceName: 'Hello Skip / transcript fixture',
  sourceId: 'us.helloskip',
  amount: { max: 50000, currency: 'USD' },
  deadline: '2026-09-30',
  jurisdiction: { country: 'US' },
  eligibility: { employeeRange: { min: 10, max: 50 } },
  requirements: ['Stage 1 eligibility check', 'Stage 2 business case'],
  scoringRubric: { impact: 0, purpose: 0, story: 0, timeline: 0 },
  claims: [
    { id: 'rippling:amount', field: 'amount.max', value: 50000, sourceId: 'transcript:rippling', sourceType: 'transcript', confidence: 0.8, verified: false },
    { id: 'rippling:employees', field: 'eligibility.employeeRange', value: { min: 10, max: 50 }, sourceId: 'transcript:rippling', sourceType: 'transcript', confidence: 0.8, verified: false },
    { id: 'rippling:deadline', field: 'deadline', value: '2026-09-30', sourceId: 'transcript:rippling', sourceType: 'transcript', confidence: 0.8, verified: false },
  ],
  evidence: [{
    id: 'transcript:rippling',
    sourceId: 'transcript:rippling',
    sourceUrl: 'https://helloskip.com/',
    sourceName: 'Hello Skip / transcript fixture',
    sourceType: 'transcript',
    capturedAt: '2026-08-28T00:00:00Z',
    confidence: 0.8,
  }],
  verificationStatus: 'unverified',
  sourceConfidence: 0.8,
  riskFlags: ['official_source_not_verified'],
  brokerability: 'unknown',
  status: 'research_pending',
  createdAt: '2026-08-28T00:00:00Z',
  updatedAt: '2026-08-28T00:00:00Z',
}
