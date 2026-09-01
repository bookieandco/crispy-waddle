import type { AlertDeliveryRecord, DeliveryProvider, DeliveryResult } from '@jhadina/opportunity-core'
import { createServiceRoleClient } from '../supabase/service-role'

/**
 * First concrete OCE delivery provider.
 *
 * The delivery worker remains the only caller. The provider turns a claimed
 * durable delivery into a durable user notification and uses delivery_id as
 * its idempotency boundary so a worker retry cannot create a second notice.
 */
export class SupabaseInAppAlertDeliveryProvider implements DeliveryProvider {
  readonly channel = 'IN_APP' as const

  async send(record: AlertDeliveryRecord): Promise<DeliveryResult> {
    const client = createServiceRoleClient()
    if (!client) throw new Error('Supabase service-role configuration is missing')

    const notificationId = `oce-notification:${record.id}`
    const { error } = await client
      .from('oce_in_app_notifications')
      .upsert(
        {
          id: notificationId,
          delivery_id: record.id,
          alert_id: record.alertId,
          recipient_id: record.recipientId,
          priority: record.priority,
          payload: record.payload ?? {},
        },
        { onConflict: 'delivery_id', ignoreDuplicates: true },
      )

    if (error) throw new Error(`In-app notification persistence failed: ${error.message}`)

    return { status: 'DELIVERED', providerMessageId: notificationId }
  }
}
