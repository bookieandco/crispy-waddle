import type { AlertDeliveryChannel, AlertDeliveryRecord, AlertDeliveryStatus } from './alert-delivery.js'

export type DeliveryResult =
  | { status: 'SENT' | 'DELIVERED'; providerMessageId?: string }
  | { status: 'RETRYING'; error: string; nextAttemptAt: string }
  | { status: 'FAILED'; error: string }
  | { status: 'SUPPRESSED'; reason: string }
  | { status: 'EXPIRED'; reason: string }

export type DeliveryProvider = {
  channel: AlertDeliveryChannel
  send(record: AlertDeliveryRecord): Promise<DeliveryResult>
}

export type DeliveryRouter = {
  register(provider: DeliveryProvider): void
  route(record: AlertDeliveryRecord, now: string): Promise<DeliveryResult>
}

export type DeliveryRetryPolicy = {
  maxAttempts: number
  baseDelaySeconds: number
  maxDelaySeconds: number
}

export function nextRetryAttempt(record: AlertDeliveryRecord, now: string, policy: DeliveryRetryPolicy): AlertDeliveryRecord {
  const maxAttempts = Math.max(1, policy.maxAttempts)
  const nextAttempt = record.attempt + 1
  if (nextAttempt >= maxAttempts) {
    return { ...record, attempt: nextAttempt, status: 'FAILED', updatedAt: now }
  }
  const delay = Math.min(policy.maxDelaySeconds, policy.baseDelaySeconds * 2 ** Math.max(0, nextAttempt - 1))
  return { ...record, attempt: nextAttempt, status: 'RETRYING', updatedAt: now, payload: { ...((record.payload && typeof record.payload === 'object') ? record.payload : {}), _retryDelaySeconds: delay } }
}

export function isTerminalDeliveryStatus(status: AlertDeliveryStatus): boolean {
  return status === 'DELIVERED' || status === 'SENT' || status === 'SUPPRESSED' || status === 'EXPIRED'
}
