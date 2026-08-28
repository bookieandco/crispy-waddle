import type { DistributionJob } from './distribution-job.js'
import type { DistributionProviderResult } from './provider-adapter.js'

export const DISTRIBUTION_PUBLISHED_EVENT = 'growth.distribution.published'

export type DistributionMeasurementEvent = {
  eventType: typeof DISTRIBUTION_PUBLISHED_EVENT
  eventId: string
  occurredAt: string
  opportunityId: string
  variantId: string
  targetId: string
  channel: string
  measurementId: string
  externalPostId?: string
  canonicalUrl?: string
}

export function createDistributionMeasurementEvent(
  job: DistributionJob,
  result: DistributionProviderResult,
  eventId: string,
  occurredAt = new Date().toISOString(),
): DistributionMeasurementEvent {
  if (result.measurementId !== job.measurementId) throw new Error('distribution_measurement_lineage_mismatch')
  if (result.status !== 'published' && result.status !== 'scheduled') throw new Error('distribution_result_not_measurement_eligible')
  return {
    eventType: DISTRIBUTION_PUBLISHED_EVENT,
    eventId,
    occurredAt,
    opportunityId: job.opportunityId,
    variantId: job.variantId,
    targetId: job.targetId,
    channel: job.channel,
    measurementId: job.measurementId,
    externalPostId: result.externalPostId,
    canonicalUrl: result.canonicalUrl,
  }
}

export interface DistributionMeasurementSink {
  emit(event: DistributionMeasurementEvent): Promise<void>
}
