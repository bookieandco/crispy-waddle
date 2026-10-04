import assert from 'node:assert/strict'
import {
  buildSearchCommerceProductBindingReceipt,
} from './side-hustle-search-commerce-product-binding.js'
import type { SearchCommerceProductSniperCandidate } from './side-hustle-search-commerce-product-sniper.js'

const candidate = {
  id: 'sniper:ornament',
  ventureId: 'venture:pod-1',
  family: 'pod_personalized_commerce',
  recommendation: 'research',
  evidenceRefs: ['candidate:evidence'],
} as unknown as SearchCommerceProductSniperCandidate

const binding = buildSearchCommerceProductBindingReceipt({
  id: 'binding:pupson:ornament:white',
  ventureId: candidate.ventureId,
  opportunityId: 'opportunity:pod-1',
  family: candidate.family,
  candidate,
  sourceOwner: 'pupsonstuff',
  sourceProductRef: 'ornament',
  sourceVariantRef: 'white',
  skuRef: 'pupson:ornament:white',
  targetChannels: ['pupsonstuff'],
  bindingEvidenceRefs: ['research-pack:ornament', 'catalog:pupson:ornament:white'],
  observedAt: '2026-10-04T14:00:00.000Z',
})
assert.equal(binding.candidateId, candidate.id)
assert.equal(binding.state, 'verified')
assert.equal(binding.externalActionAuthorized, false)
assert.equal(binding.sourceAuthorityRetained, true)

assert.throws(
  () => buildSearchCommerceProductBindingReceipt({
    ...binding,
    candidate: { ...candidate, recommendation: 'reject' } as SearchCommerceProductSniperCandidate,
    bindingEvidenceRefs: ['evidence:block'],
  }),
  /Rejected Product Sniper candidate/,
)

assert.throws(
  () => buildSearchCommerceProductBindingReceipt({
    ...binding,
    candidate,
    bindingEvidenceRefs: [],
  }),
  /verification evidence/,
)

console.log('side-hustle-search-commerce-product-binding tests passed')
