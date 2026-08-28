export type CreativeMetric = 'impressions' | 'three_second_views' | 'watch_percent' | 'profile_visits' | 'clicks' | 'leads' | 'orders' | 'revenue' | 'commission' | 'cost' | 'profit'

export type CreativeMeasurementIdentity = {
  measurementId: string
  opportunityId: string
  creativeDnaId: string
  variantId: string
  channel: string
  campaignId?: string
}

export type CreativeMeasurementEvent = {
  identity: CreativeMeasurementIdentity
  metric: CreativeMetric
  value: number
  occurredAt: string
  externalEventId?: string
}

export function createMeasurementIdentity(input: Omit<CreativeMeasurementIdentity, 'measurementId'>): CreativeMeasurementIdentity {
  return { ...input, measurementId: `${input.opportunityId}:${input.variantId}:${input.channel}` }
}

export function isValidMeasurementEvent(event: CreativeMeasurementEvent): boolean {
  return Boolean(event.identity.measurementId && event.identity.opportunityId && event.identity.variantId && event.identity.channel)
    && Number.isFinite(event.value)
    && Boolean(event.occurredAt)
}
