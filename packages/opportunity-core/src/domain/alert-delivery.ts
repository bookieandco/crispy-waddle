export type AlertDeliveryChannel = 'IN_APP' | 'EMAIL' | 'PUSH' | 'WEBHOOK'
export type AlertDeliveryStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'RETRYING' | 'SUPPRESSED' | 'EXPIRED'

export type AlertDeliveryRequest = {
  alertId: string
  recipientId: string
  channel: AlertDeliveryChannel
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
  payload: unknown
  idempotencyKey: string
  maxAttempts?: number
}

export type AlertDeliveryRecord = AlertDeliveryRequest & {
  id: string
  status: AlertDeliveryStatus
  attempt: number
  createdAt: string
  updatedAt: string
  nextAttemptAt?: string
  lastError?: string
  deadLetteredAt?: string
}

export function deliveryIdempotencyKey(alertId: string, recipientId: string, channel: AlertDeliveryChannel): string {
  return `${alertId}:${recipientId}:${channel}`
}

export function createDeliveryRecord(request: AlertDeliveryRequest, now: string, id = request.idempotencyKey): AlertDeliveryRecord {
  return {
    ...request,
    id,
    status: 'PENDING',
    attempt: 0,
    createdAt: now,
    updatedAt: now,
    nextAttemptAt: now,
    maxAttempts: Math.max(1, request.maxAttempts ?? 5),
  }
}

export function canRetryDelivery(status: AlertDeliveryStatus): boolean {
  return status === 'FAILED' || status === 'RETRYING'
}
