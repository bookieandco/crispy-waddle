import assert from 'node:assert/strict'
import {
  assessProofSprint,
  assessRecurringOffer,
  createCommercialValidationTest,
  createMarketLearning,
  createOfferCanvas,
  createProofSprint,
} from './commercial-learning.js'

const now = '2026-09-28T18:30:00.000Z'

const canvas = createOfferCanvas({
  id: 'offer:1',
  opportunityId: 'opportunity:1',
  customer: { value: 'local service businesses', state: 'observed', evidenceRefs: ['customer-interviews'] },
  problem: { value: 'slow content production', state: 'observed', evidenceRefs: ['workflow-audit'] },
  desiredOutcome: { value: 'consistent approved content', state: 'hypothesis', evidenceRefs: [] },
  offer: { value: 'weekly content operating system', state: 'hypothesis', evidenceRefs: [] },
  deliveryModel: { value: 'productized service', state: 'hypothesis', evidenceRefs: [] },
  acquisitionChannel: { value: 'local workshops', state: 'hypothesis', evidenceRefs: [] },
  price: { value: { amount: 500, currency: 'usd' }, state: 'hypothesis', evidenceRefs: [] },
  assumptions: ['buyer will value turnaround time'],
  createdAt: now,
})

assert.equal(canvas.authority, 'ANALYSIS_ONLY')
assert.equal(canvas.price?.value.currency, 'USD')

const test = createCommercialValidationTest({
  id: 'validation:1',
  opportunityId: 'opportunity:1',
  hypothesis: 'a qualified buyer will pay for a bounded pilot',
  targetCustomer: 'local service businesses',
  offer: 'one-week content pilot',
  channel: 'direct outreach',
  ask: 'pay for pilot',
  expectedCommitment: 'paid',
  maxSpend: 50,
  currency: 'usd',
  maxHours: 5,
  minimumObservations: 3,
  successMetric: 'paid_commitments',
  successThreshold: 1,
  evidenceRefs: ['offer-canvas:1'],
  createdAt: now,
})

assert.equal(test.status, 'planned')
assert.equal(test.authority, 'ANALYSIS_ONLY')

assert.throws(() => createMarketLearning({
  id: 'learning:bad',
  opportunityId: 'opportunity:1',
  validationTestId: test.id,
  assumption: 'buyer pays',
  expected: 'one payment',
  observed: 'verbal yes only',
  commitmentLevel: 'paid',
  evidenceRefs: ['call-note'],
  observedAt: now,
}), /paidAmount/)

const learning = createMarketLearning({
  id: 'learning:1',
  opportunityId: 'opportunity:1',
  validationTestId: test.id,
  assumption: 'buyer pays',
  expected: 'one payment',
  observed: 'one paid pilot',
  commitmentLevel: 'paid',
  paidAmount: 500,
  currency: 'usd',
  evidenceRefs: ['stripe-receipt:1'],
  observedAt: now,
})

const sprint = createProofSprint({
  id: 'proof-sprint:1',
  opportunityId: 'opportunity:1',
  question: 'will a qualified buyer pay for the pilot?',
  primaryUncertainty: 'willingness to pay',
  validationTestIds: [test.id],
  maxSpend: 100,
  currency: 'usd',
  maxHours: 10,
  maxDurationDays: 14,
  successCommitmentLevel: 'paid',
  createdAt: now,
})

const assessment = assessProofSprint({
  sprint,
  learnings: [learning],
  assessedAt: '2026-09-29T18:30:00.000Z',
})

assert.equal(assessment.decision, 'proven')
assert.equal(assessment.authorizationEffect, 'NONE')
assert.deepEqual(assessment.evidenceRefs, ['stripe-receipt:1'])


const secondTest = createCommercialValidationTest({
  id: 'validation:2',
  opportunityId: 'opportunity:1',
  hypothesis: 'a second channel can produce buyer intent',
  targetCustomer: 'local service businesses',
  offer: 'one-week content pilot',
  channel: 'local workshop',
  ask: 'book a paid pilot',
  expectedCommitment: 'behavioral',
  maxSpend: 50,
  currency: 'usd',
  maxHours: 5,
  minimumObservations: 1,
  successMetric: 'booked_pilots',
  successThreshold: 1,
  evidenceRefs: ['offer-canvas:1'],
  createdAt: now,
})

const multiTestSprint = createProofSprint({
  id: 'proof-sprint:2',
  opportunityId: 'opportunity:1',
  question: 'will either of the planned channels create a real commitment?',
  primaryUncertainty: 'channel fit',
  validationTestIds: [test.id, secondTest.id],
  maxSpend: 100,
  currency: 'usd',
  maxHours: 10,
  maxDurationDays: 14,
  successCommitmentLevel: 'repeat',
  createdAt: now,
})

const incompleteCoverage = assessProofSprint({
  sprint: multiTestSprint,
  learnings: [learning, { ...learning, id: 'learning:duplicate-same-test' }],
  assessedAt: '2026-09-29T18:30:00.000Z',
})

assert.equal(incompleteCoverage.decision, 'inconclusive')


const recurringBlocked = assessRecurringOffer({
  continuingValue: [{
    dimension: 'continuing_education',
    description: 'new implementation guidance',
    evidenceRefs: ['community:updates'],
  }],
  minimumDistinctDimensions: 2,
  memberOutcomeEvidenceRefs: [],
  supportCapacityEvidenceRefs: [],
})
assert.equal(recurringBlocked.supported, false)

const recurringSupported = assessRecurringOffer({
  continuingValue: [
    {
      dimension: 'continuing_education',
      description: 'new implementation guidance',
      evidenceRefs: ['community:updates'],
    },
    {
      dimension: 'implementation_support',
      description: 'ongoing office hours and troubleshooting',
      evidenceRefs: ['community:support'],
    },
  ],
  minimumDistinctDimensions: 2,
  memberOutcomeEvidenceRefs: ['community:member-outcomes'],
  supportCapacityEvidenceRefs: ['community:support-capacity'],
})
assert.equal(recurringSupported.supported, true)
assert.equal(recurringSupported.authority, 'ANALYSIS_ONLY')

console.log('commercial-learning tests passed')
