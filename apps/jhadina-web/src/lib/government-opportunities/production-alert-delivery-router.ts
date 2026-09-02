import { InMemoryAlertDeliveryRouter } from './alert-delivery-router'
import { SupabaseInAppAlertDeliveryProvider } from './in-app-alert-delivery-provider'

/**
 * Production channel registry. Keep channel registration explicit so adding
 * email/push/webhook cannot silently change the delivery surface.
 */
export function createProductionAlertDeliveryRouter() {
  const router = new InMemoryAlertDeliveryRouter()
  router.register(new SupabaseInAppAlertDeliveryProvider())
  return router
}
