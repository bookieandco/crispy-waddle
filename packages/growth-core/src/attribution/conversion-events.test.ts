import { describe, expect, it } from 'vitest'
import { normalizeConversionEvent, ConversionEventLedger } from './conversion-events.js'

const measurement = {
  eventType: 'growth.distribution.published' as const,
  eventId: 'dist-1',
  occurredAt: '2026-08-28T00:00:00Z',
  opportunityId: 'opp-1',
  variantId: 'v1',
  targetId: 'target-1',
  channel: 'instagram',
  measurementId: 'opp-1:v1:instagram',
  externalPostId: 'post-1',
}

describe('conversion attribution identity', () => {
  it('inherits opportunity and creative lineage from the distribution measurement', () => {
    const event = normalizeConversionEvent({
      occurredAt: '2026-08-28T01:00:00Z', eventType: 'order', measurementId: measurement.measurementId,
      externalConversionId: 'order-1', value: 49, currency: 'USD', metadata: { source: 'checkout' }, measurement,
    })
    expect(event).toMatchObject({ opportunityId: 'opp-1', variantId: 'v1', channel: 'instagram', eventType: 'order', value: 49 })
  })

  it('rejects conversion events attached to a different measurement', () => {
    expect(() => normalizeConversionEvent({ occurredAt: measurement.occurredAt, eventType: 'revenue', measurementId: 'wrong', externalConversionId: 'rev-1', measurement })).toThrow('conversion_measurement_lineage_mismatch')
  })

  it('deduplicates conversion IDs at the ledger boundary', async () => {
    const ledger = new ConversionEventLedger()
    const event = normalizeConversionEvent({ occurredAt: measurement.occurredAt, eventType: 'order', measurementId: measurement.measurementId, externalConversionId: 'order-2', measurement })
    await ledger.append(event)
    await expect(ledger.append(event)).rejects.toThrow('Duplicate conversion event order-2')
  })
})
