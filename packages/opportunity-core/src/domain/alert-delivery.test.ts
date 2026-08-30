import { describe, expect, it } from 'vitest'
import { canRetryDelivery, createDeliveryRecord, deliveryIdempotencyKey } from './alert-delivery.js'

describe('OCE-6.75 alert delivery', () => {
  it('creates a deterministic idempotency key', () => {
    expect(deliveryIdempotencyKey('alert-1', 'user-1', 'EMAIL')).toBe('alert-1:user-1:EMAIL')
  })

  it('starts delivery records pending', () => {
    const request = { alertId: 'alert-1', recipientId: 'user-1', channel: 'EMAIL' as const, priority: 'HIGH' as const, payload: { title: 'changed' }, idempotencyKey: 'alert-1:user-1:EMAIL' }
    expect(createDeliveryRecord(request, '2026-08-30T12:00:00Z').status).toBe('PENDING')
  })

  it('allows retry only for failed/retrying states', () => {
    expect(canRetryDelivery('FAILED')).toBe(true)
    expect(canRetryDelivery('RETRYING')).toBe(true)
    expect(canRetryDelivery('DELIVERED')).toBe(false)
  })
})
