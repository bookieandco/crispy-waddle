import type { DistributionJob } from './distribution-job.js'

export interface DistributionJobStore {
  getByIdempotencyKey(key: string): Promise<DistributionJob | undefined>
  save(job: DistributionJob): Promise<DistributionJob>
}

export async function getOrCreateDistributionJob(
  store: DistributionJobStore,
  job: DistributionJob,
): Promise<{ job: DistributionJob; created: boolean }> {
  const existing = await store.getByIdempotencyKey(job.idempotencyKey)
  if (existing) return { job: existing, created: false }
  return { job: await store.save(job), created: true }
}

export async function persistDistributionTransition(
  store: DistributionJobStore,
  job: DistributionJob,
): Promise<DistributionJob> {
  const existing = await store.getByIdempotencyKey(job.idempotencyKey)
  if (existing && existing.id !== job.id) throw new Error('distribution_idempotency_conflict')
  return store.save(job)
}
