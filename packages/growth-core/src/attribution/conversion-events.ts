import type { GrowthId } from '../domain/types.js'
import type { DistributionMeasurementEvent } from '../opportunity/distribution/measurement-event.js'

export type ConversionEventType = 'lead' | 'order' | 'revenue'

export type NormalizedConversionEvent = {
  eventId: GrowthId
  occurredAt: string
  eventType: ConversionEventType
  measurementId: string
  opportunityId: string
  variantId: string
  channel: string
  externalConversionId: string
  currency?: string
  value?: number
  metadata: Record<string, unknown>
}

export type ConversionEventInput = Omit<NormalizedConversionEvent, 'eventId' | 'opportunityId' | 'variantId' | 'channel'> & {
  measurement: DistributionMeasurementEvent
}

export function normalizeConversionEvent(input: ConversionEventInput): NormalizedConversionEvent {
  const { measurement } = input
  if (input.measurementId !== measurement.measurementId) throw new Error('conversion_measurement_lineage_mismatch')
  return {
    eventId: input.externalConversionId as GrowthId,
    occurredAt: input.occurredAt,
    eventType: input.eventType,
    measurementId: measurement.measurementId,
    opportunityId: measurement.opportunityId,
    variantId: measurement.variantId,
    channel: measurement.channel,
    externalConversionId: input.externalConversionId,
    currency: input.currency,
    value: input.value,
    metadata: { ...(input.metadata ?? {}), distributionEventId: measurement.eventId },
  }
}

export interface ConversionEventSink {
  append(event: NormalizedConversionEvent): Promise<void>
}

export class ConversionEventLedger implements ConversionEventSink {
  private readonly events = new Map<GrowthId, NormalizedConversionEvent>()

  async append(event: NormalizedConversionEvent): Promise<void> {
    if (this.events.has(event.eventId)) throw new Error(`Duplicate conversion event ${event.eventId}`)
    this.events.set(event.eventId, { ...event, metadata: { ...event.metadata } })
  }

  list(): NormalizedConversionEvent[] {
    return [...this.events.values()].map(event => ({ ...event, metadata: { ...event.metadata } }))
  }
}
