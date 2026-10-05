import assert from 'node:assert/strict'
import { buildSearchCommerceProductPublicationLineage } from './side-hustle-search-commerce-product-publication-lineage.js'

const receipt = buildSearchCommerceProductPublicationLineage({
  id: 'publication:1',
  ventureId: 'venture:pod-1',
  opportunityId: 'opportunity:pod-1',
  family: 'pod_personalized_commerce',
  candidateId: 'sniper:hometown-ornament',
  productRef: 'pupson:ornament:1',
  proposalId: 'proposal:1',
  outboxId: 'outbox:1',
  platform: 'instagram',
  provider: 'hootsuite',
  accountId: 'account:1',
  providerPostId: 'post:1',
  observedAt: '2026-10-04T12:00:00.000Z',
  evidenceRefs: ['social-outbox:outbox:1'],
})

assert.equal(receipt.state, 'delivered')
assert.equal(receipt.socialAuthorityRetained, true)
assert.equal(receipt.publishingAuthorized, false)
assert.equal(receipt.moneyMovementAuthorized, false)

console.log('side-hustle-search-commerce-product-publication-lineage tests passed')
