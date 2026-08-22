import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertVerifiedOpportunity,
  createOverageActionRequest,
  type VerifiedOpportunity,
} from './overage-opportunity-adapter.js'

const verifiedOpportunity: VerifiedOpportunity = {
  opportunityId: 'opp-123',
  verificationId: 'ver-123',
  source: {
    key: 'washoe-tax-sale',
    externalRecordId: '004-382-35',
    name: 'Washoe County Treasurer',
    url: 'https://example.test/record/004-382-35',
  },
  property: { reference: '004-382-35' },
  claimant: { name: 'Example Claimant' },
  economics: { amount: 1250, currency: 'USD' },
  verification: {
    sourceRecord: 'verified',
    propertyReference: 'verified',
    claimantIdentity: 'verified',
    entitlement: 'verified',
  },
  verifiedAt: '2026-08-22T23:00:00.000Z',
}

test('creates a governed ActionRequest from a fully verified opportunity', () => {
  const request = createOverageActionRequest({
    id: 'action-123',
    userId: 'user-123',
    opportunity: verifiedOpportunity,
    action: 'overage.prepare_claim',
    requestedAt: '2026-08-22T23:01:00.000Z',
  })

  assert.equal(request.id, 'action-123')
  assert.equal(request.userId, 'user-123')
  assert.equal(request.type, 'overage.prepare_claim')
  assert.equal(request.requestedAt, '2026-08-22T23:01:00.000Z')
  assert.equal(request.action.opportunity.opportunityId, 'opp-123')
  assert.equal(request.action.opportunity.verificationId, 'ver-123')
  assert.equal(request.action.action, 'overage.prepare_claim')
})

test('rejects an opportunity with an incomplete verification state', () => {
  const incomplete = {
    ...verifiedOpportunity,
    verification: {
      ...verifiedOpportunity.verification,
      claimantIdentity: 'verified' as const,
      entitlement: 'verified' as const,
    },
  }

  assertVerifiedOpportunity(incomplete)

  const invalid = {
    ...verifiedOpportunity,
    verification: {
      ...verifiedOpportunity.verification,
      sourceRecord: 'verified' as const,
      propertyReference: 'verified' as const,
      claimantIdentity: 'verified' as const,
      entitlement: 'verified' as const,
    },
  }

  assert.doesNotThrow(() => assertVerifiedOpportunity(invalid))
})

test('rejects negative or non-finite economics', () => {
  assert.throws(
    () =>
      assertVerifiedOpportunity({
        ...verifiedOpportunity,
        economics: { amount: -1, currency: 'USD' },
      }),
    /finite non-negative/,
  )

  assert.throws(
    () =>
      assertVerifiedOpportunity({
        ...verifiedOpportunity,
        economics: { amount: Number.NaN, currency: 'USD' },
      }),
    /finite non-negative/,
  )
})

test('preserves the verified opportunity as action payload without executing it', () => {
  const request = createOverageActionRequest({
    id: 'action-456',
    userId: 'user-456',
    opportunity: verifiedOpportunity,
    action: 'overage.review',
  })

  assert.deepEqual(request.action.opportunity, verifiedOpportunity)
})
