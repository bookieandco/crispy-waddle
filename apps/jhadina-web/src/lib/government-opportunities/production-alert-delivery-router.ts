import { DeliveryRouter } from '@jhadina/opportunity-core'
import { SupabaseInAppAlertDeliveryProvider } from './in-app-alert-delivery-provider'

/**
 * Production channel registry. Keep channel registration explicit so adding
 * email/push/webhook cannot silently change the delivery surface.
 */
export function createProductionAlertDeliveryRouter() {
  const router = new DeliveryRouter()
  router.register(new SupabaseInAppAlertDeliveryProvider())
  return router
}
