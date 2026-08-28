import type { DistributionJob } from './distribution-job.js'

export type DistributionScheduler = {
  isDue(job: DistributionJob, now?: string): boolean
  markScheduled(job: DistributionJob, now?: string): DistributionJob
}

export function isDistributionJobDue(job: DistributionJob, now = new Date().toISOString()): boolean {
  if (job.status !== 'authorized' && job.status !== 'scheduled') return false
  if (!job.scheduledFor) return job.status === 'authorized'
  return new Date(job.scheduledFor).getTime() <= new Date(now).getTime()
}

export function markDistributionJobScheduled(job: DistributionJob, now = new Date().toISOString()): DistributionJob {
  if (job.status !== 'authorized') throw new Error('distribution_job_not_authorized_for_schedule')
  if (!job.scheduledFor) throw new Error('distribution_schedule_time_required')
  return { ...job, status: 'scheduled', updatedAt: now }
}
