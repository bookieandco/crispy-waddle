import type { GrowthPaidOutboxRow } from "./production-repository"
import { MarkifactHttpTransport } from "./markifact-mcp-transport"
import { MarkifactPaidMediaProvider } from "./markifact-provider"

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

function createMarkifactProvider(): PaidMediaProvider {
  const token = process.env.MARKIFACT_MCP_ACCESS_TOKEN?.trim()
  if (!token) return new UnavailablePaidMediaProvider("markifact")
  const endpoint = process.env.MARKIFACT_MCP_URL?.trim() || "https://api.markifact.com/mcp"
  return new MarkifactPaidMediaProvider(new MarkifactHttpTransport({
    endpoint,
    accessToken: token,
  }))
}

/**
 * Production fails closed until a credentialed provider adapter is connected.
 * The durable outbox remains pending and is never converted into a mock delivery.
 *
 * Markifact uses its live meta-tool contract:
 * find_operations -> get_operation_inputs -> run_write_operation.
 * Jhadina's paid-ad.publish receipt remains the upstream authorization boundary,
 * and the adapter additionally requires Markifact to flag the operation
 * requires_approval=true before it will issue a write.
 */
export function createPaidMediaProvider(provider: string): PaidMediaProvider {
  const normalized = provider.trim().toLowerCase()
  if (normalized === "markifact") return createMarkifactProvider()
  return new UnavailablePaidMediaProvider(normalized || "unknown")
}
