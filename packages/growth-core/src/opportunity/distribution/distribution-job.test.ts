import { describe, expect, it } from 'vitest'
import { authorizeDistributionJob, canRetryDistributionJob, createDistributionJob, dispatchDistributionJob, recordProviderResult } from './distribution-job.js'

const input = {
  id: 'job-1', idempotencyKey: 'opp-1:v1:tiktok', targetId: 'v1:tiktok', opportunityId: 'opp-1', variantId: 'v1', measurementId: 'opp-1:v1:tiktok', channel: 'tiktok', maxAttempts: 2,
}

describe('Distribution Job', () => {
  it('enforces the durable lifecycle', () => {
    const queued = createDistributionJob(input, '2026-08-28T00:00:00Z')
    const authorized = authorizeDistributionJob(queued, '2026-08-28T00:01:00Z')
    const dispatched = dispatchDistributionJob(authorized, '2026-08-28T00:02:00Z')
    expect(dispatched).toMatchObject({ status: 'dispatched', attempts: 1 })
    const published = recordProviderResult(dispatched, { status: 'published', externalPostId: 'post-1', measurementId: input.measurementId }, '2026-08-28T00:03:00Z')
    expect(published).toMatchObject({ status: 'published', providerPostId: 'post-1' })
  })

  it('rejects measurement lineage mismatches', () => {
    const job = dispatchDistributionJob(authorizeDistributionJob(createDistributionJob(input)),)
    expect(() => recordProviderResult(job, { status: 'published', measurementId: 'wrong' })).toThrow('distribution_measurement_lineage_mismatch')
  })

  it('supports bounded retries after provider failure', () => {
    const job = dispatchDistributionJob(authorizeDistributionJob(createDistributionJob(input)))
    const retrying = recordProviderResult(job, { status: 'failed', measurementId: input.measurementId })
    expect(retrying.status).toBe('retrying')
    expect(canRetryDistributionJob(retrying)).toBe(true)
  })
})
