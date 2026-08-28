import { describe, expect, it } from 'vitest'
import { authorizeDistributionJob, createDistributionJob } from './distribution-job.js'
import { isDistributionJobDue, markDistributionJobScheduled } from './distribution-scheduler.js'

const input = { id: 'job-1', idempotencyKey: 'opp-1:v1:tiktok', targetId: 'v1:tiktok', opportunityId: 'opp-1', variantId: 'v1', measurementId: 'opp-1:v1:tiktok', channel: 'tiktok', maxAttempts: 2 }

describe('Distribution scheduler', () => {
  it('does not publish scheduled work before its due time', () => {
    const job = authorizeDistributionJob(createDistributionJob({ ...input, scheduledFor: '2026-08-28T12:00:00Z' }))
    const scheduled = markDistributionJobScheduled(job)
    expect(isDistributionJobDue(scheduled, '2026-08-28T11:59:59Z')).toBe(false)
    expect(isDistributionJobDue(scheduled, '2026-08-28T12:00:00Z')).toBe(true)
  })

  it('allows an authorized unscheduled job to execute immediately', () => {
    const job = authorizeDistributionJob(createDistributionJob(input))
    expect(isDistributionJobDue(job)).toBe(true)
  })

  it('requires a scheduled time when marking scheduled', () => {
    const job = authorizeDistributionJob(createDistributionJob(input))
    expect(() => markDistributionJobScheduled(job)).toThrow('distribution_schedule_time_required')
  })
})
