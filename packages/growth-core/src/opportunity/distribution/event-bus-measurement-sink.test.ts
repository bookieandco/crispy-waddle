import { describe, expect, it, vi } from 'vitest'
import { EventBusDistributionMeasurementSink } from './event-bus-measurement-sink.js'
import type { DistributionMeasurementEvent } from './measurement-event.js'

const event: DistributionMeasurementEvent = {
  eventType: 'growth.distribution.published',
  eventId: 'evt-1',
  occurredAt: '2026-08-28T00:00:00Z',
  opportunityId: 'opp-1',
  variantId: 'v1',
  targetId: 'instagram:v1',
  channel: 'instagram',
  measurementId: 'opp-1:v1:instagram',
  externalPostId: 'post-1',
}

describe('EventBusDistributionMeasurementSink', () => {
  it('publishes the canonical measurement event without coupling growth-core to a concrete bus', async () => {
    const publish = vi.fn(async () => undefined)
    const sink = new EventBusDistributionMeasurementSink({ publish })

    await sink.emit(event)

    expect(publish).toHaveBeenCalledWith({
      id: 'evt-1',
      type: 'growth.distribution.published',
      occurredAt: '2026-08-28T00:00:00Z',
      payload: event,
    })
  })
})
