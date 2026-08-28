import type { GrowthId } from '../domain/types.js'
import type { NormalizedAdvertisingEvent } from '../events/advertising-events.js'
import type { DistributionMeasurementEvent } from '../opportunity/distribution/measurement-event.js'

export type DistributionAttributionIdentity = {
  eventId: GrowthId
  occurredAt: string
  channel: NormalizedAdvertisingEvent['channel']
  eventType: 'impression'
  campaignId: GrowthId
  externalCampaignId: string
  externalEventId: string
  assetId?: GrowthId
  creativeConceptId?: GrowthId
  audienceId?: GrowthId
  offerId?: GrowthId
  metadata: Record<string, unknown>
}

export function toAdvertisingEventIdentity(
  event: DistributionMeasurementEvent,
  campaignId: GrowthId,
): DistributionAttributionIdentity {
  const supportedChannel = event.channel === 'instagram' ? 'meta' : event.channel === 'x' ? 'x' : undefined
  if (!supportedChannel) throw new Error(`unsupported_attribution_channel:${event.channel}`)

  return {
    eventId: event.measurementId as GrowthId,
    occurredAt: event.occurredAt,
    channel: supportedChannel,
    eventType: 'impression',
    campaignId,
    externalCampaignId: event.targetId,
    externalEventId: event.externalPostId ?? event.eventId,
    metadata: {
      distributionEventId: event.eventId,
      opportunityId: event.opportunityId,
      variantId: event.variantId,
      measurementId: event.measurementId,
      canonicalUrl: event.canonicalUrl,
    },
  }
}
