import type { DistributionMeasurementEvent, DistributionMeasurementSink } from './measurement-event.js'

export interface DistributionDomainEventBus {
  publish<TPayload>(event: {
    readonly id: string
    readonly type: string
    readonly occurredAt: string
    readonly payload: TPayload
  }): Promise<void>
}

export class EventBusDistributionMeasurementSink implements DistributionMeasurementSink {
  constructor(private readonly eventBus: DistributionDomainEventBus) {}

  async emit(event: DistributionMeasurementEvent): Promise<void> {
    await this.eventBus.publish({
      id: event.eventId,
      type: event.eventType,
      occurredAt: event.occurredAt,
      payload: event,
    })
  }
}
