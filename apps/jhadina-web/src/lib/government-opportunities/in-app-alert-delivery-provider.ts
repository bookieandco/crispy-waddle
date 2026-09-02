import type { AlertDeliveryRecord, DeliveryProvider, DeliveryResult } from '@jhadina/opportunity-core'
import { createServiceRoleClient } from '../supabase/service-role'

/**
 * Durable in-app delivery provider.
 *
 * The delivery worker remains the only caller. The provider persists one
 * notification per delivery and relies on the unique delivery_id constraint
 * as the idempotency boundary. The database owns notification UUID creation.
 */
export class SupabaseInAppAlertDeliveryProvider implements DeliveryProvider {
  readonly channel = 'IN_APP' as const

  async send(record: AlertDeliveryRecord): Promise<DeliveryResult> {
    const client = createServiceRoleClient()
    if (!client) throw new Error('Supabase service-role configuration is missing')

    const { error } = await client
      .from('oce_in_app_notifications')
      .upsert(
        {
          delivery_id: record.id,
          alert_id: record.alertId,
          recipient_id: record.recipientId,
          priority: record.priority,
          payload: record.payload ?? {},
        },
        { onConflict: 'delivery_id', ignoreDuplicates: true },
      )

    if (error) throw new Error(`In-app notification persistence failed: ${error.message}`)

    return { status: 'DELIVERED', providerMessageId: record.id }
  }
}
