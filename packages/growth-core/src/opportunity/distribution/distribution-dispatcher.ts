import type { DistributionJob } from './distribution-job.js'
import { authorizeDistributionJob, dispatchDistributionJob, recordProviderResult } from './distribution-job.js'
import type { DistributionProviderRegistry, DistributionProviderRequest } from './provider-adapter.js'

export type DistributionDispatcher = {
  dispatch(job: DistributionJob, content: string, registry: DistributionProviderRegistry): Promise<DistributionJob>
}

export async function dispatchDistributionJobToProvider(
  job: DistributionJob,
  content: string,
  registry: DistributionProviderRegistry,
  now = new Date().toISOString(),
): Promise<DistributionJob> {
  const authorized = authorizeDistributionJob(job, now)
  const adapter = registry.get(job.channel as Parameters<DistributionProviderRegistry['get']>[0])
  if (!adapter) throw new Error('distribution_provider_not_registered')
  const dispatched = dispatchDistributionJob(authorized, now)
  const request: DistributionProviderRequest = {
    targetId: dispatched.targetId,
    opportunityId: dispatched.opportunityId,
    variantId: dispatched.variantId,
    channel: adapter.channel,
    content,
    scheduledFor: dispatched.scheduledFor,
    measurementId: dispatched.measurementId,
  }
  const result = await adapter.publish(request)
  return recordProviderResult(dispatched, result, new Date().toISOString())
}
