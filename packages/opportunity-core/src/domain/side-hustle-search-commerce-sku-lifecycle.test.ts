import assert from 'node:assert/strict'
import {
  buildSearchCommerceSellerSettlementObservation,
  buildSearchCommerceSkuPublicationReceipt,
  searchCommerceEvidenceFromSkuLifecycle,
  sellerSettlementToOpportunityOutcome,
} from './side-hustle-search-commerce-sku-lifecycle.js'

const publication = buildSearchCommerceSkuPublicationReceipt({
  id: 'sku-publication:etsy:1',
  ventureId: 'venture:pod-1',
  opportunityId: 'opportunity:pod-1',
  family: 'pod_personalized_commerce',
  candidateId: 'sniper:ornament',
  productTruthId: 'product-truth:ornament',
  sourceOwner: 'commerce',
  productRef: 'product:ornament',
  skuRef: 'sku:ornament:white',
  channel: 'etsy',
  externalListingId: 'listing-123',
  listingUrl: 'https://www.etsy.com/listing/123',
  state: 'published',
  governanceRefs: ['approval:public-product-publish:1'],
  observedAt: '2026-10-04T12:00:00.000Z',
  evidenceRefs: ['provider:etsy:listing:123'],
})
assert.equal(publication.state, 'published')
assert.equal(publication.publishingAuthorized, false)
assert.equal(publication.sourceAuthorityRetained, true)

assert.throws(
  () => buildSearchCommerceSkuPublicationReceipt({
    ...publication,
    id: 'sku-publication:bad',
    governanceRefs: [],
  }),
  /governance evidence/,
)

const settlement = buildSearchCommerceSellerSettlementObservation({
  id: 'settlement:etsy:1',
  ventureId: publication.ventureId,
  opportunityId: publication.opportunityId,
  family: publication.family,
  sourceOwner: 'commerce',
  provider: 'etsy',
  accountRef: 'shop:1',
  settlementRef: 'etsy:settlement:1',
  scope: 'sku',
  candidateId: publication.candidateId,
  productRef: publication.productRef,
  skuRef: publication.skuRef,
  currency: 'usd',
  grossRevenue: 100,
  refunds: 10,
  productCosts: 25,
  shippingCosts: 10,
  providerCosts: 5,
  otherDirectCosts: 0,
  fees: 8,
  hours: 1,
  costBasisComplete: true,
  state: 'settled',
  transactionRefs: ['transaction:etsy:1'],
  observedAt: '2026-10-04T13:00:00.000Z',
  evidenceRefs: ['provider:etsy:settlement:1'],
})
const outcome = sellerSettlementToOpportunityOutcome(settlement)
assert.equal(outcome.sourceOwner, 'commerce')
assert.equal(outcome.directCosts, 40)
assert.equal(outcome.grossRevenue, 100)
assert.equal(outcome.refunds, 10)
assert.equal(outcome.result, 'won')

const evidence = searchCommerceEvidenceFromSkuLifecycle({
  publications: [publication],
  settlements: [settlement],
})
for (const key of [
  'listings',
  'current listing inventory',
  'revenue',
  'refunds/reversals',
  'fees',
  'product costs',
  'shipping',
  'provider costs',
] as const) {
  assert.ok(evidence.some((entry) => entry.key === key), key)
}

const partial = buildSearchCommerceSellerSettlementObservation({
  ...settlement,
  id: 'settlement:partial',
  costBasisComplete: false,
})
assert.throws(
  () => sellerSettlementToOpportunityOutcome(partial),
  /complete realized cost basis/,
)

console.log('side-hustle-search-commerce-sku-lifecycle tests passed')
