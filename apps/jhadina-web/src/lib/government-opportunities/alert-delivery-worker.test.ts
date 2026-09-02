import { describe, expect, it } from 'vitest'
import { AlertDeliveryWorker } from './alert-delivery-worker'
import { InMemoryAlertDeliveryRepository } from '@jhadina/opportunity-core'
import { createDeliveryRecord } from '@jhadina/opportunity-core'

const baseRequest = {
  alertId: 'alert-1',
  recipientId: '00000000-0000-0000-0000-000000000001',
  channel: 'IN_APP' as const,
  priority: 'HIGH' as const,
  payload: { message: 'Opportunity changed' },
  idempotencyKey: 'alert-1:00000000-0000-0000-0000-000000000001:IN_APP',
  maxAttempts: 3,
}

const now = '2026-09-01T18:00:00.000Z'
const policy = { maxAttempts: 3, baseDelaySeconds: 10, maxDelaySeconds: 60 }

describe('AlertDeliveryWorker', () => {
  it('claims a due delivery, invokes the provider, and persists DELIVERED', async () => {
    const repository = new InMemoryAlertDeliveryRepository()
    const record = createDeliveryRecord(baseRequest, now)
    await repository.saveIfAbsent(record)

    let calls = 0
    const router = {
      register() {},
      async route() {
        calls += 1
        return { status: 'DELIVERED' as const, providerMessageId: 'notification-1' }
      },
    }

    const worker = new AlertDeliveryWorker(repository, router, { workerId: 'worker-1', retryPolicy: policy, now: () => now })
    const result = await worker.runOnce()
    const persisted = await repository.get(record.id)

    expect(calls).toBe(1)
    expect(result).toEqual({ claimed: 1, completed: 1, retrying: 0, deadLettered: 0, failed: 0 })
    expect(persisted?.status).toBe('DELIVERED')
    expect(persisted?.attempt).toBe(0)
    expect(persisted?.nextAttemptAt).toBeUndefined()
  })

  it('releases a claimed delivery back into retry scheduling after a provider failure', async () => {
    const repository = new InMemoryAlertDeliveryRepository()
    const record = createDeliveryRecord(baseRequest, now)
    await repository.saveIfAbsent(record)

    const router = {
      register() {},
      async route() {
        return { status: 'FAILED' as const, error: 'provider timeout' }
      },
    }

    const worker = new AlertDeliveryWorker(repository, router, { workerId: 'worker-1', retryPolicy: policy, now: () => now })
    const result = await worker.runOnce()
    const persisted = await repository.get(record.id)

    expect(result).toEqual({ claimed: 1, completed: 0, retrying: 1, deadLettered: 0, failed: 0 })
    expect(persisted?.status).toBe('RETRYING')
    expect(persisted?.attempt).toBe(1)
    expect(persisted?.lastError).toBe('provider timeout')
    expect(persisted?.nextAttemptAt).toBe('2026-09-01T18:00:10.000Z')

    const secondClaim = await repository.claimDue('2026-09-01T18:00:10.000Z', 'worker-2', 1)
    expect(secondClaim).toHaveLength(1)
  })
})
