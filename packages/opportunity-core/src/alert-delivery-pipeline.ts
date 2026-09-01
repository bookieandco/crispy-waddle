import type { AlertDeliveryChannel, AlertDeliveryRecord, AlertDeliveryRequest } from './domain/alert-delivery.js'
import { createDeliveryRecord, deliveryIdempotencyKey } from './domain/alert-delivery.js'
import type { AlertDeliveryRepository } from './repositories.js'

export type AlertDeliveryPipelineInput = Omit<AlertDeliveryRequest, 'idempotencyKey'> & {
  idempotencyKey?: string
}

export type AlertDeliveryPipelineResult = {
  record: AlertDeliveryRecord
  created: boolean
}

/** Durable enqueue boundary. Sending is deliberately delegated to a provider/router. */
export class AlertDeliveryPipeline {
  constructor(private readonly deliveries: AlertDeliveryRepository) {}

  async enqueue(input: AlertDeliveryPipelineInput, now: string): Promise<AlertDeliveryPipelineResult> {
    const idempotencyKey = input.idempotencyKey ?? deliveryIdempotencyKey(input.alertId, input.recipientId, input.channel)
    const record = createDeliveryRecord({ ...input, idempotencyKey }, now)
    return this.deliveries.saveIfAbsent(record)
  }
}

export function defaultDeliveryIdempotencyKey(
  alertId: string,
  recipientId: string,
  channel: AlertDeliveryChannel,
): string {
  return deliveryIdempotencyKey(alertId, recipientId, channel)
}
