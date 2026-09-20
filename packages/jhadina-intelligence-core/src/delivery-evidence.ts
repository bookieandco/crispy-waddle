import type { ActionLedger } from '@jhadina/action-core'
import type { AuthorizedCommunicationDispatch } from './communication-action.js'
import type { TransportRoute } from './transport-registry.js'

export type DeliveryStatus = 'accepted' | 'sent' | 'acknowledged' | 'delivered' | 'failed'

export type DeliveryReceipt = Readonly<{
  receiptId: string
  intentId: string
  correlationId: string
  actorId: string
  transportId: string
  adapter: string
  status: DeliveryStatus
  occurredAt: string
  evidenceRefs?: readonly string[]
  failureReason?: string
}>

export function createDeliveryReceipt(input: {
  receiptId: string
  dispatch: AuthorizedCommunicationDispatch
  route: TransportRoute
  status: DeliveryStatus
  occurredAt: string
  evidenceRefs?: readonly string[]
  failureReason?: string
}): DeliveryReceipt {
  if (!input.receiptId.trim() || !input.dispatch.correlationId.trim()) throw new Error('DELIVERY_LINEAGE_REQUIRED')
  if (input.dispatch.correlationId !== input.dispatch.intent.correlationId) throw new Error('DELIVERY_LINEAGE_MISMATCH')
  if (input.status === 'failed' && !input.failureReason?.trim()) throw new Error('DELIVERY_FAILURE_REASON_REQUIRED')
  return Object.freeze({
    receiptId: input.receiptId,
    intentId: input.dispatch.intent.intentId,
    correlationId: input.dispatch.correlationId,
    actorId: input.dispatch.intent.actorId,
    transportId: input.route.identity.transportId,
    adapter: input.route.identity.adapter,
    status: input.status,
    occurredAt: input.occurredAt,
    evidenceRefs: Object.freeze([...(input.evidenceRefs ?? [])]),
    failureReason: input.failureReason,
  })
}

export async function appendDeliveryEvidence(ledger: ActionLedger, receipt: DeliveryReceipt): Promise<void> {
  await ledger.append({
    id: `communication-delivery:${receipt.receiptId}`,
    actionId: receipt.intentId,
    userId: receipt.actorId,
    type: `communication.delivery.${receipt.status}`,
    status: receipt.status === 'failed' ? 'failed' : 'completed',
    timestamp: receipt.occurredAt,
    metadata: {
      correlationId: receipt.correlationId,
      transportId: receipt.transportId,
      adapter: receipt.adapter,
      deliveryStatus: receipt.status,
      evidenceRefs: receipt.evidenceRefs,
      failureReason: receipt.failureReason,
    },
  })
}
