import type { AlertDeliveryRecord, AlertDeliveryChannel, DeliveryProvider, DeliveryResult, DeliveryRouter } from '@jhadina/opportunity-core'

export class InMemoryAlertDeliveryRouter implements DeliveryRouter {
  private readonly providers = new Map<AlertDeliveryChannel, DeliveryProvider>()

  register(provider: DeliveryProvider): void {
    this.providers.set(provider.channel, provider)
  }

  async route(record: AlertDeliveryRecord, now: string): Promise<DeliveryResult> {
    if (['DELIVERED', 'SENT', 'SUPPRESSED', 'EXPIRED'].includes(record.status)) {
      return { status: record.status as 'DELIVERED' | 'SENT' | 'SUPPRESSED' | 'EXPIRED', ...(record.status === 'SUPPRESSED' ? { reason: 'already suppressed' } : {}), ...(record.status === 'EXPIRED' ? { reason: 'already expired' } : {}) }
    }
    if (new Date(record.updatedAt).getTime() > new Date(now).getTime()) return { status: 'RETRYING', error: 'delivery clock is ahead of router clock', nextAttemptAt: record.updatedAt }
    const provider = this.providers.get(record.channel)
    if (!provider) return { status: 'FAILED', error: `No delivery provider registered for ${record.channel}` }
    return provider.send(record)
  }
}
