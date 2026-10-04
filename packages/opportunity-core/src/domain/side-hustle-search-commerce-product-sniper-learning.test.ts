import assert from 'node:assert/strict'
import type { OpportunityOutcome } from './outcome.js'
import {
  buildSearchCommerceProductSniperLearningSnapshot,
  buildSearchCommerceProductSniperRealizedObservation,
} from './side-hustle-search-commerce-product-sniper-learning.js'

function outcome(id: string, input: {
  result: 'won' | 'lost'
  grossRevenue: number
  refunds?: number
  totalCosts: number
  profit: number
  margin: number | null
  transaction?: boolean
  day: number
}): OpportunityOutcome {
  return {
    id,
    opportunityId: 'opportunity:pod-1',
    result: input.result,
    currency: 'USD',
    grossRevenue: input.grossRevenue,
    refunds: input.refunds ?? 0,
    directCosts: input.totalCosts,
    fees: 0,
    hours: 1,
    sourceOwner: 'commerce',
    evidenceRefs: ['evidence:' + id],
    transactionRefs: input.transaction ? ['transaction:' + id] : [],
    observedAt: `2026-10-${String(input.day).padStart(2, '0')}T12:00:00.000Z`,
    netRevenue: input.grossRevenue - (input.refunds ?? 0),
    totalCosts: input.totalCosts,
    profit: input.profit,
    margin: input.margin,
    dollarsPerHour: input.profit,
  }
}

const observations = [
  outcome('1', { result: 'won', grossRevenue: 100, totalCosts: 55, profit: 45, margin: 0.45, transaction: true, day: 1 }),
  outcome('2', { result: 'won', grossRevenue: 120, totalCosts: 65, profit: 55, margin: 0.4583, transaction: true, day: 2 }),
  outcome('3', { result: 'won', grossRevenue: 110, totalCosts: 60, profit: 50, margin: 0.4545, transaction: true, day: 3 }),
].map((item) => buildSearchCommerceProductSniperRealizedObservation({
  ventureId: 'venture:pod-1',
  family: 'pod_personalized_commerce',
  candidateId: 'sniper:hometown-ornament',
  productType: 'ornament',
  marketMechanic: 'hometown identity gift',
  targetChannels: ['etsy'],
  outcome: item,
  bindingEvidenceRefs: ['binding:' + item.id],
}))

const snapshot = buildSearchCommerceProductSniperLearningSnapshot({ observations })
assert.equal(snapshot.observationCount, 3)
assert.equal(snapshot.wins, 3)
assert.equal(snapshot.losses, 0)
assert.equal(snapshot.profit, 150)
assert.equal(snapshot.decision, 'reinforce')
assert.ok(snapshot.scoreAdjustment > 0)
assert.ok(snapshot.scoreAdjustment <= 10)
assert.equal(snapshot.externalActionAuthorized, false)
assert.equal(snapshot.moneyMovementAuthorized, false)

const thin = buildSearchCommerceProductSniperLearningSnapshot({
  observations: observations.slice(0, 1),
})
assert.equal(thin.decision, 'insufficient_evidence')
assert.equal(thin.scoreAdjustment, 0)

assert.throws(
  () => buildSearchCommerceProductSniperRealizedObservation({
    ventureId: 'venture:pod-1',
    family: 'pod_personalized_commerce',
    candidateId: 'sniper:hometown-ornament',
    productType: 'ornament',
    marketMechanic: 'hometown identity gift',
    targetChannels: ['etsy'],
    outcome: outcome('4', { result: 'won', grossRevenue: 100, totalCosts: 60, profit: 40, margin: 0.4, day: 4 }),
    bindingEvidenceRefs: [],
  }),
  /binding evidence/,
)

console.log('side-hustle-search-commerce-product-sniper-learning tests passed')
