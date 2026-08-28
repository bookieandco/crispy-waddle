import { describe, expect, it } from 'vitest'
import { createDistributionJob } from './distribution-job.js'
import { createDistributionMeasurementEvent } from './measurement-event.js'

describe('distribution measurement event', () => {
  const job = createDistributionJob({ id: 'job-1', idempotencyKey: 'opp-1:v1:instagram', targetId: 'v1:instagram', opportunityId: 'opp-1', variantId: 'v1', measurementId: 'opp-1:v1:instagram', channel: 'instagram', maxAttempts: 2 })

  it('emits canonical publication lineage', () => {
    const event = createDistributionMeasurementEvent(job, { status: 'published', externalPostId: 'post-1', canonicalUrl: 'https://example.test/post-1', measurementId: job.measurementId }, 'evt-1', '2026-08-28T00:00:00Z')
    expect(event).toMatchObject({ eventType: 'growth.distribution.published', eventId: 'evt-1', opportunityId: 'opp-1', variantId: 'v1', channel: 'instagram', measurementId: job.measurementId })
  })

  it('fails closed on mismatched attribution lineage', () => {
    expect(() => createDistributionMeasurementEvent(job, { status: 'published', measurementId: 'wrong' }, 'evt-1')).toThrow('distribution_measurement_lineage_mismatch')
  })

  it('does not emit measurement for failed provider results', () => {
    expect(() => createDistributionMeasurementEvent(job, { status: 'failed', measurementId: job.measurementId }, 'evt-1')).toThrow('distribution_result_not_measurement_eligible')
  })
})
