import assert from 'node:assert/strict'
import {
  buildSearchCommerceProductTruthSnapshot,
  productTruthToProductSniperSignals,
  searchCommerceEvidenceFromProductTruth,
} from './side-hustle-search-commerce-product-truth.js'

const truth = buildSearchCommerceProductTruthSnapshot({
  id: 'product-truth:ornament:1',
  ventureId: 'venture:pod-1',
  opportunityId: 'opportunity:pod-1',
  family: 'pod_personalized_commerce',
  candidateId: 'sniper:hometown-ornament',
  sourceOwner: 'pupsonstuff',
  productRef: 'pupson:ornament:1',
  productType: 'ornament',
  title: 'Original hometown ornament',
  targetChannels: ['etsy', 'pupsonstuff'],
  catalogStatus: 'active',
  listingRefs: ['listing:etsy:1'],
  creativeAssetRefs: ['asset:mockup:1'],
  providerRefs: ['printify:variant:1'],
  channelEligibility: [{
    channel: 'etsy',
    status: 'eligible',
    evidenceRefs: ['evidence:etsy-eligibility'],
  }],
  unitEconomics: {
    currency: 'USD',
    retailPrice: 30,
    productCost: 8,
    merchantShippingCost: 5,
    platformFees: 3,
    providerCost: 2,
  },
  fulfillment: {
    certification: 'sample_verified',
    productionLeadDays: 4,
    evidenceRefs: ['evidence:sample'],
  },
  policy: {
    status: 'reviewed',
    evidenceRefs: ['evidence:policy'],
  },
  risk: {
    platform: { score: 20, confidence: 0.8, evidenceRefs: ['risk:platform'] },
    fulfillmentComplexity: { score: 25, confidence: 0.85, evidenceRefs: ['risk:fulfillment'] },
    capital: { score: 10, confidence: 0.9, evidenceRefs: ['risk:capital'] },
  },
  observedAt: '2026-10-04T12:00:00.000Z',
  evidenceRefs: ['evidence:catalog'],
})

assert.equal(truth.unitEconomics.costCompleteness, 'complete')
assert.equal(truth.unitEconomics.expectedContributionPerUnit, 12)
assert.equal(truth.unitEconomics.expectedMargin, 0.4)
assert.equal(truth.externalActionAuthorized, false)
assert.equal(truth.sourceAuthorityRetained, true)

const evidence = searchCommerceEvidenceFromProductTruth([truth])
for (const key of [
  'product candidates',
  'current listing inventory',
  'current creative/listing state',
  'listings',
  'creative assets',
  'pricing',
  'product costs',
  'shipping',
  'fees',
  'provider costs',
  'fulfillment observations',
  'policy context',
  'policies',
] as const) {
  assert.ok(evidence.some((entry) => entry.key === key), key)
}

const signals = productTruthToProductSniperSignals(truth)
assert.equal(signals.find((signal) => signal.kind === 'margin_potential')?.score, 40)
assert.equal(signals.find((signal) => signal.kind === 'platform_risk')?.score, 20)
assert.equal(signals.find((signal) => signal.kind === 'capital_risk')?.score, 10)

const partial = buildSearchCommerceProductTruthSnapshot({
  id: 'product-truth:partial',
  ventureId: 'venture:pod-1',
  opportunityId: 'opportunity:pod-1',
  family: 'pod_personalized_commerce',
  sourceOwner: 'commerce',
  productRef: 'product:partial',
  productType: 'mug',
  title: 'Partial product truth',
  targetChannels: ['etsy'],
  catalogStatus: 'candidate',
  unitEconomics: {
    currency: 'USD',
    retailPrice: 20,
    productCost: 8,
  },
  observedAt: '2026-10-04T12:00:00.000Z',
  evidenceRefs: ['evidence:partial'],
})
assert.equal(partial.unitEconomics.costCompleteness, 'partial')
assert.equal(partial.unitEconomics.expectedMargin, undefined)
assert.equal(productTruthToProductSniperSignals(partial).length, 0)

console.log('side-hustle-search-commerce-product-truth tests passed')
