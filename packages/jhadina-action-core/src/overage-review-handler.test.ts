import assert from 'node:assert/strict'
import { test } from 'node:test'
import { OverageReviewHandler } from './overage-review-handler.js'
import type { OverageAction } from './overage-opportunity-adapter.js'

const verifiedOpportunity = {
  opportunityId: 'opp-1',
  verificationId: 'ver-1',
  source: {
    key: 'washoe',
    externalRecordId: 'parcel-1',
    name: 'Washoe County',
    url: 'https://example.test/opportunity/1',
  },
  property: { reference: 'APN-123' },
  claimant: { name: 'Example Claimant' },
  economics: { amount: 1250, currency: 'USD' },
  verification: {
    sourceRecord: 'verified' as const,
    propertyReference: 'verified' as const,
    claimantIdentity: 'verified' as const,
    entitlement: 'verified' as const,
  },
  verifiedAt: '2026-08-22T12:00:00.000Z',
}

test('OverageReviewHandler supports only overage.review', () => {
  const handler = new OverageReviewHandler()

  assert.equal(handler.supports('overage.review'), true)
  assert.equal(handler.supports('overage.prepare_claim'), false)
  assert.equal(handler.supports('overage.submit_claim'), false)
})

test('OverageReviewHandler returns a read-only review result', async () => {
  const handler = new OverageReviewHandler()
  const action: OverageAction = {
    opportunity: verifiedOpportunity,
    action: 'overage.review',
  }

  const result = await handler.execute(action, {
    id: 'action-1',
    userId: 'user-1',
    type: 'overage.review',
    action,
    requestedAt: '2026-08-22T12:01:00.000Z',
  })

  assert.deepEqual(result, {
    status: 'reviewable',
    opportunityId: 'opp-1',
    verificationId: 'ver-1',
    sourceKey: 'washoe',
    externalRecordId: 'parcel-1',
    amount: 1250,
    currency: 'USD',
    claimantName: 'Example Claimant',
    propertyReference: 'APN-123',
    verifiedAt: '2026-08-22T12:00:00.000Z',
  })
})

test('OverageReviewHandler rejects a non-review action payload', async () => {
  const handler = new OverageReviewHandler()
  const action = {
    opportunity: verifiedOpportunity,
    action: 'overage.prepare_claim',
  } as OverageAction

  await assert.rejects(
    () => handler.execute(action, {
      id: 'action-2',
      userId: 'user-1',
      type: 'overage.review',
      action,
      requestedAt: '2026-08-22T12:01:00.000Z',
    }),
    /only accepts overage\.review/,
  )
})
