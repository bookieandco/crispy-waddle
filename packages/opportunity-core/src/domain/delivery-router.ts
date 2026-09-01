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
  const maxAttempts = Math.max(1, record.maxAttempts ?? policy.maxAttempts)
  const nextAttempt = record.attempt + 1
  if (nextAttempt >= maxAttempts) {
    return {
      ...record,
      attempt: nextAttempt,
      status: 'FAILED',
      updatedAt: now,
      nextAttemptAt: undefined,
      lastError: record.lastError,
      deadLetteredAt: now,
      maxAttempts,
    }
  }

  const delaySeconds = Math.min(policy.maxDelaySeconds, policy.baseDelaySeconds * 2 ** Math.max(0, nextAttempt - 1))
  const nextAttemptAt = new Date(new Date(now).getTime() + delaySeconds * 1000).toISOString()
  return {
    ...record,
    attempt: nextAttempt,
    status: 'RETRYING',
    updatedAt: now,
    nextAttemptAt,
    maxAttempts,
  }
}

export function applyDeliveryResult(record: AlertDeliveryRecord, result: DeliveryResult, now: string): AlertDeliveryRecord {
  switch (result.status) {
    case 'RETRYING':
      return { ...record, status: 'RETRYING', updatedAt: now, nextAttemptAt: result.nextAttemptAt, lastError: result.error }
    case 'FAILED':
      return { ...record, status: 'FAILED', updatedAt: now, nextAttemptAt: undefined, lastError: result.error, deadLetteredAt: now }
    case 'SUPPRESSED':
      return { ...record, status: 'SUPPRESSED', updatedAt: now, nextAttemptAt: undefined, lastError: result.reason }
    case 'EXPIRED':
      return { ...record, status: 'EXPIRED', updatedAt: now, nextAttemptAt: undefined, lastError: result.reason }
    case 'SENT':
    case 'DELIVERED':
      return { ...record, status: result.status, updatedAt: now, nextAttemptAt: undefined, lastError: undefined, deadLetteredAt: undefined }
  }
}

export function isTerminalDeliveryStatus(status: AlertDeliveryStatus): boolean {
  return status === 'DELIVERED' || status === 'SENT' || status === 'SUPPRESSED' || status === 'EXPIRED'
}
