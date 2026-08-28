import type { DistributionProviderResult } from './provider-adapter.js'

export type DistributionJobStatus = 'queued' | 'authorized' | 'dispatched' | 'scheduled' | 'published' | 'failed' | 'retrying' | 'cancelled'

export type DistributionJob = {
  id: string
  idempotencyKey: string
  targetId: string
  opportunityId: string
  variantId: string
  measurementId: string
  channel: string
  status: DistributionJobStatus
  attempts: number
  maxAttempts: number
  providerPostId?: string
  canonicalUrl?: string
  scheduledFor?: string
  lastError?: string
  createdAt: string
  updatedAt: string
}

export function createDistributionJob(input: Omit<DistributionJob, 'status' | 'attempts' | 'createdAt' | 'updatedAt'>, now = new Date().toISOString()): DistributionJob {
  return { ...input, status: 'queued', attempts: 0, createdAt: now, updatedAt: now }
}

export function authorizeDistributionJob(job: DistributionJob, now = new Date().toISOString()): DistributionJob {
  if (job.status !== 'queued' && job.status !== 'retrying') throw new Error('distribution_job_not_authorizable')
  return { ...job, status: 'authorized', updatedAt: now }
}

export function dispatchDistributionJob(job: DistributionJob, now = new Date().toISOString()): DistributionJob {
  if (job.status !== 'authorized') throw new Error('distribution_job_not_authorized')
  return { ...job, status: 'dispatched', attempts: job.attempts + 1, updatedAt: now }
}

export function recordProviderResult(job: DistributionJob, result: DistributionProviderResult, now = new Date().toISOString()): DistributionJob {
  if (job.status !== 'dispatched') throw new Error('distribution_job_not_dispatched')
  if (result.measurementId !== job.measurementId) throw new Error('distribution_measurement_lineage_mismatch')
  if (result.status === 'failed') return { ...job, status: job.attempts < job.maxAttempts ? 'retrying' : 'failed', lastError: 'provider_failed', updatedAt: now }
  return { ...job, status: result.status, providerPostId: result.externalPostId, canonicalUrl: result.canonicalUrl, updatedAt: now }
}

export function canRetryDistributionJob(job: DistributionJob): boolean {
  return job.status === 'retrying' && job.attempts < job.maxAttempts
}
