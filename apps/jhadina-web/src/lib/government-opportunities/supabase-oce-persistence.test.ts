import { describe, expect, it } from 'vitest'
import { createAlertEvent, type WatchlistEntry } from '@jhadina/opportunity-core'
import { createDeliveryRecord, deliveryIdempotencyKey } from '@jhadina/opportunity-core'
import { createFeedbackEvent, createVersionedAssessment } from '@jhadina/opportunity-core'

describe('Supabase OCE persistence contract', () => {
  it('uses the canonical domain identifiers required by the durable schema', () => {
    const entry: WatchlistEntry = {
      id: 'watch-1', userId: '00000000-0000-0000-0000-000000000001',
      opportunityId: 'opp-1', principalId: 'principal-1', enabled: true,
      createdAt: '2026-08-30T00:00:00Z',
    }
    const alert = createAlertEvent(entry, {
      type: 'OPPORTUNITY_CHANGED', priority: 'HIGH', changeReason: 'deadline changed',
      previousState: { deadline: '2026-09-01' }, newState: { deadline: '2026-09-15' },
      supportingEvidenceIds: ['ev-1'],
    }, '2026-08-30T12:00:00Z')
    expect(alert.watchlistEntryId).toBe(entry.id)
    expect(alert.fingerprint).toBeTruthy()

    const delivery = createDeliveryRecord({
      alertId: alert.id, recipientId: entry.userId, channel: 'EMAIL', priority: 'HIGH',
      payload: { alertId: alert.id }, idempotencyKey: deliveryIdempotencyKey(alert.id, entry.userId, 'EMAIL'),
    }, '2026-08-30T12:01:00Z')
    expect(delivery.idempotencyKey).toBe(`${alert.id}:${entry.userId}:EMAIL`)

    const feedback = createFeedbackEvent({
      kind: 'OUTCOME', type: 'OPPORTUNITY_WON', opportunityId: entry.opportunityId,
      sourceEvidenceIds: ['ev-1'], payload: {}, observedAt: '2026-08-30T12:02:00Z',
      recordedAt: '2026-08-30T12:03:00Z', schemaVersion: '1.0',
    })
    expect(feedback.id).toMatch(/^feedback:/)

    const assessment = createVersionedAssessment({
      subjectId: entry.opportunityId, assessmentType: 'ranking', score: 91,
      basisEvidenceIds: ['ev-1'], assessedAt: '2026-08-30T12:04:00Z', engineVersion: '6.76.0',
    })
    expect(assessment.score).toBe(91)
  })
})
