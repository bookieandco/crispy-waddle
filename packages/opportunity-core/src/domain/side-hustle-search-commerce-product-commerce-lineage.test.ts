import assert from 'node:assert/strict'
import {
  buildSearchCommerceProductCommerceLineage,
  lineageBindsOutcome,
} from './side-hustle-search-commerce-product-commerce-lineage.js'

const lineage = buildSearchCommerceProductCommerceLineage({
  id: 'commerce-lineage:1',
  ventureId: 'venture:pod-1',
  opportunityId: 'opportunity:pod-1',
  family: 'pod_personalized_commerce',
  candidateId: 'sniper:hometown-ornament',
  productRef: 'pupson:ornament:1',
  sourceOwner: 'pupsonstuff',
  eventKind: 'settlement',
  orderRefs: ['order:1'],
  transactionRefs: ['transaction:stripe:1'],
  fulfillmentRefs: ['printify:order:1'],
  evidenceRefs: ['evidence:order-snapshot'],
  observedAt: '2026-10-04T12:00:00.000Z',
})

assert.equal(lineage.financialTruthOwnedByOutcomeLedger, true)
assert.equal(lineage.moneyMovementAuthorized, false)
assert.equal(lineageBindsOutcome(lineage, {
  opportunityId: 'opportunity:pod-1',
  transactionRefs: ['transaction:stripe:1'],
}), true)
assert.equal(lineageBindsOutcome(lineage, {
  opportunityId: 'opportunity:pod-1',
  transactionRefs: ['transaction:other'],
}), false)

assert.throws(() => buildSearchCommerceProductCommerceLineage({
  id: 'commerce-lineage:bad',
  ventureId: 'venture:pod-1',
  opportunityId: 'opportunity:pod-1',
  family: 'pod_personalized_commerce',
  candidateId: 'sniper:x',
  productRef: 'product:x',
  sourceOwner: 'commerce',
  eventKind: 'order',
  evidenceRefs: ['evidence:x'],
  observedAt: '2026-10-04T12:00:00.000Z',
}), /order, transaction, or fulfillment reference/)

console.log('side-hustle-search-commerce-product-commerce-lineage tests passed')
