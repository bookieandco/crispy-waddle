import { describe, expect, it } from 'vitest'
import { createAlertEvent } from './domain/watchlist.js'
import { createDeliveryRecord, deliveryIdempotencyKey } from './domain/alert-delivery.js'
import { createFeedbackEvent, createVersionedAssessment } from './domain/feedback.js'
import {
  InMemoryAlertDeliveryRepository,
  InMemoryAlertEventRepository,
  InMemoryFeedbackRepository,
  InMemoryVersionedAssessmentRepository,
  InMemoryWatchlistRepository,
} from './repositories.js'

const entry = {
  id: 'watch-1', userId: 'user-1', opportunityId: 'opp-1', principalId: 'principal-1', enabled: true,
  createdAt: '2026-08-30T00:00:00Z',
} as const

const evaluation = {
  type: 'OPPORTUNITY_CHANGED' as const,
  priority: 'HIGH' as const,
  changeReason: 'deadline changed',
  previousState: { deadline: '2026-09-01' },
  newState: { deadline: '2026-09-15' },
  supportingEvidenceIds: ['ev-1'],
}

describe('OCE persistence repositories', () => {
  it('round-trips watchlist entries without exposing mutable references', async () => {
    const repo = new InMemoryWatchlistRepository()
    await repo.save({ ...entry })
    const loaded = await repo.get(entry.id)
    expect(loaded).toEqual(entry)
    if (loaded) loaded.enabled = false
    expect((await repo.get(entry.id))?.enabled).toBe(true)
  })

  it('filters watchlists by explicit owner rather than id naming', async () => {
    const repo = new InMemoryWatchlistRepository()
    await repo.save({ ...entry })
    await repo.save({ ...entry, id: 'watch-2', userId: 'user-2' })
    expect((await repo.listByUser('user-1')).map((item) => item.id)).toEqual(['watch-1'])
    expect((await repo.listByUser('user-2')).map((item) => item.id)).toEqual(['watch-2'])
  })

  it('deduplicates alert events by watchlist entry and fingerprint', async () => {
    const repo = new InMemoryAlertEventRepository()
    const first = createAlertEvent(entry, evaluation, '2026-08-30T12:00:00Z')
    const duplicate = { ...first, id: 'different-id', detectedAt: '2026-08-30T12:01:00Z' }
    expect((await repo.saveIfAbsent(first)).created).toBe(true)
    const result = await repo.saveIfAbsent(duplicate)
    expect(result.created).toBe(false)
    expect(result.event.id).toBe(first.id)
  })

  it('deduplicates deliveries by idempotency key', async () => {
    const repo = new InMemoryAlertDeliveryRepository()
    const request = {
      alertId: 'alert-1', recipientId: 'user-1', channel: 'EMAIL' as const,
      priority: 'HIGH' as const, payload: { title: 'changed' },
      idempotencyKey: deliveryIdempotencyKey('alert-1', 'user-1', 'EMAIL'),
    }
    const first = createDeliveryRecord(request, '2026-08-30T12:00:00Z')
    const duplicate = { ...first, id: 'different-id', status: 'FAILED' as const, attempt: 1 }
    expect((await repo.saveIfAbsent(first)).created).toBe(true)
    const result = await repo.saveIfAbsent(duplicate)
    expect(result.created).toBe(false)
    expect(result.record.id).toBe(first.id)
    expect(result.record.status).toBe('PENDING')
  })

  it('keeps feedback append-only and rejects duplicate ids', async () => {
    const repo = new InMemoryFeedbackRepository()
    const event = createFeedbackEvent({
      id: 'feedback-1', kind: 'OUTCOME', type: 'OPPORTUNITY_WON', opportunityId: 'opp-1',
      sourceEvidenceIds: ['ev-1'], payload: {}, observedAt: '2026-08-30T12:00:00Z',
      recordedAt: '2026-08-30T12:01:00Z', schemaVersion: '1.0',
    })
    await repo.append(event)
    await expect(repo.append(event)).rejects.toThrow('Duplicate feedback event')
  })

  it('requires a valid assessment version chain', async () => {
    const repo = new InMemoryVersionedAssessmentRepository()
    const first = createVersionedAssessment({
      id: 'assessment-1', subjectId: 'opp-1', assessmentType: 'ranking', score: 87,
      basisEvidenceIds: ['ev-1'], assessedAt: '2026-08-30T12:00:00Z', engineVersion: '6.73.0',
    })
    const second = createVersionedAssessment({
      id: 'assessment-2', subjectId: 'opp-1', assessmentType: 'ranking', score: 62,
      basisEvidenceIds: ['ev-1', 'ev-2'], supersedesId: first.id,
      assessedAt: '2026-08-31T12:00:00Z', engineVersion: '6.76.0',
    })
    await expect(repo.append(second)).rejects.toThrow('supersedes unknown version')
    await repo.append(first)
    await repo.append(second)
    expect((await repo.listBySubject('opp-1', 'ranking')).map((a) => a.id)).toEqual(['assessment-1', 'assessment-2'])
  })
})
