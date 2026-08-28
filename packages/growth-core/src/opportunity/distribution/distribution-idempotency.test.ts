import { describe, expect, it } from 'vitest'
import { createDistributionJob } from './distribution-job.js'
import { getOrCreateDistributionJob, persistDistributionTransition, type DistributionJobStore } from './distribution-idempotency.js'

const job = createDistributionJob({ id: 'job-1', idempotencyKey: 'opp-1:v1:tiktok', targetId: 'v1:tiktok', opportunityId: 'opp-1', variantId: 'v1', measurementId: 'opp-1:v1:tiktok', channel: 'tiktok', maxAttempts: 2 })

class MemoryStore implements DistributionJobStore {
  jobs = new Map<string, typeof job>()
  async getByIdempotencyKey(key: string) { return this.jobs.get(key) }
  async save(value: typeof job) { this.jobs.set(value.idempotencyKey, value); return value }
}

describe('Distribution idempotency persistence', () => {
  it('returns the existing job instead of creating a duplicate', async () => {
    const store = new MemoryStore()
    expect((await getOrCreateDistributionJob(store, job)).created).toBe(true)
    const second = await getOrCreateDistributionJob(store, { ...job, id: 'job-2' })
    expect(second.created).toBe(false)
    expect(second.job.id).toBe('job-1')
  })

  it('rejects a conflicting transition under the same idempotency key', async () => {
    const store = new MemoryStore()
    await store.save(job)
    await expect(persistDistributionTransition(store, { ...job, id: 'job-2' })).rejects.toThrow('distribution_idempotency_conflict')
  })
})
