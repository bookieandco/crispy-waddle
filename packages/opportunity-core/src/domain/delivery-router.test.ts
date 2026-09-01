import { describe, expect, it } from 'vitest'
import { applyDeliveryResult, nextRetryAttempt } from './delivery-router.js'
import { createDeliveryRecord } from './alert-delivery.js'

const request = {
  alertId: 'alert-1',
  recipientId: '00000000-0000-0000-0000-000000000001',
  channel: 'IN_APP' as const,
  priority: 'HIGH' as const,
  payload: { message: 'test' },
  idempotencyKey: 'alert-1:recipient-1:IN_APP',
  maxAttempts: 3,
}

const policy = { maxAttempts: 3, baseDelaySeconds: 10, maxDelaySeconds: 60 }


describe('delivery retry scheduling', () => {
  it('creates records ready for immediate delivery', () => {
    const record = createDeliveryRecord(request, '2026-09-01T18:00:00.000Z')
    expect(record.attempt).toBe(0)
    expect(record.status).toBe('PENDING')
    expect(record.nextAttemptAt).toBe('2026-09-01T18:00:00.000Z')
    expect(record.maxAttempts).toBe(3)
  })

  it('uses first-class nextAttemptAt instead of payload metadata', () => {
    const record = createDeliveryRecord(request, '2026-09-01T18:00:00.000Z')
    const retry = nextRetryAttempt(record, '2026-09-01T18:00:00.000Z', policy)
    expect(retry.status).toBe('RETRYING')
    expect(retry.attempt).toBe(1)
    expect(retry.nextAttemptAt).toBe('2026-09-01T18:00:10.000Z')
    expect(retry.payload).toEqual({ message: 'test' })
    expect(retry.lastError).toBeUndefined()
  })

  it('dead-letters when the configured attempt budget is exhausted', () => {
    const record = { ...createDeliveryRecord(request, '2026-09-01T18:00:00.000Z'), attempt: 2, status: 'RETRYING' as const }
    const exhausted = nextRetryAttempt(record, '2026-09-01T18:01:00.000Z', policy)
    expect(exhausted.status).toBe('FAILED')
    expect(exhausted.attempt).toBe(3)
    expect(exhausted.nextAttemptAt).toBeUndefined()
    expect(exhausted.deadLetteredAt).toBe('2026-09-01T18:01:00.000Z')
  })

  it('records provider retry errors without hiding scheduling state in payload', () => {
    const record = createDeliveryRecord(request, '2026-09-01T18:00:00.000Z')
    const updated = applyDeliveryResult(record, {
      status: 'RETRYING',
      error: 'provider timeout',
      nextAttemptAt: '2026-09-01T18:00:20.000Z',
    }, '2026-09-01T18:00:05.000Z')
    expect(updated.status).toBe('RETRYING')
    expect(updated.lastError).toBe('provider timeout')
    expect(updated.nextAttemptAt).toBe('2026-09-01T18:00:20.000Z')
    expect(updated.payload).toEqual({ message: 'test' })
  })
})
