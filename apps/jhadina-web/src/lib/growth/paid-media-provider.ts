import type { GrowthPaidOutboxRow } from "./production-repository"

export interface PaidMediaDeliveryReceipt {
  state: "delivered" | "failed" | "unknown"
  providerOperationId?: string
  providerCampaignId?: string
  error?: string
}

export interface PaidMediaProvider {
  readonly name: string
  readonly configured: boolean
  dispatch(job: GrowthPaidOutboxRow): Promise<PaidMediaDeliveryReceipt>
  reconcile?(job: GrowthPaidOutboxRow): Promise<PaidMediaDeliveryReceipt | undefined>
}

class UnavailablePaidMediaProvider implements PaidMediaProvider {
  readonly configured = false
  constructor(readonly name: string) {}
  async dispatch(): Promise<PaidMediaDeliveryReceipt> {
    throw new Error(`GROWTH_PAID_PROVIDER_NOT_CONFIGURED:${this.name}`)
  }
}

/**
 * Production fails closed until a credentialed provider adapter is connected.
 * The durable outbox remains pending and is never converted into a mock delivery.
 *
 * Markifact's intended adapter contract is:
 * find_operations -> get_operation_inputs -> run_write_operation.
 * Jhadina's paid-ad.publish receipt remains the upstream authorization boundary.
 */
export function createPaidMediaProvider(provider: string): PaidMediaProvider {
  return new UnavailablePaidMediaProvider(provider)
}
