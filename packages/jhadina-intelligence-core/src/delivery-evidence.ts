import type { ActionLedger } from '@jhadina/action-core'
import type { AuthorizedCommunicationDispatch } from './communication-action.js'
import type { TransportRoute } from './transport-registry.js'

export type DeliveryStatus = 'accepted' | 'sent' | 'acknowledged' | 'delivered' | 'failed'

export type DeliveryReceipt = Readonly<{
  receiptId: string
  intentId: string
  correlationId: string
  actorId: string
  recipientEndpointId: string
  transportId: string
  adapter: string
  status: DeliveryStatus
  occurredAt: string
  evidenceRefs?: readonly string[]
  failureCode?: string
}>

function assertFailureCode(value: string | undefined): void {
  if (!value?.trim() || !/^[A-Z0-9_]{1,64}$/.test(value)) throw new Error('DELIVERY_FAILURE_CODE_INVALID')
}

export function assertDeliveryReceipt(receipt: DeliveryReceipt): DeliveryReceipt {
  if (!receipt.receiptId.trim() || !receipt.intentId.trim() || !receipt.correlationId.trim()) throw new Error('DELIVERY_LINEAGE_REQUIRED')
  if (!receipt.actorId.trim() || !receipt.recipientEndpointId.trim() || !receipt.transportId.trim() || !receipt.adapter.trim()) throw new Error('DELIVERY_IDENTITY_REQUIRED')
  if (!receipt.occurredAt.trim()) throw new Error('DELIVERY_TIMESTAMP_REQUIRED')
  if (receipt.status === 'failed') assertFailureCode(receipt.failureCode)
  if (receipt.status !== 'failed' && receipt.failureCode !== undefined) throw new Error('DELIVERY_FAILURE_CODE_UNEXPECTED')
  return receipt
}

export function createDeliveryReceipt(input: {
  receiptId: string
  dispatch: AuthorizedCommunicationDispatch
  route: TransportRoute
  status: DeliveryStatus
  occurredAt: string
  evidenceRefs?: readonly string[]
  failureCode?: string
}): DeliveryReceipt {
  if (!input.receiptId.trim() || !input.dispatch.correlationId.trim()) throw new Error('DELIVERY_LINEAGE_REQUIRED')
  if (input.dispatch.correlationId !== input.dispatch.intent.correlationId) throw new Error('DELIVERY_LINEAGE_MISMATCH')
  return assertDeliveryReceipt(Object.freeze({
    receiptId: input.receiptId,
    intentId: input.dispatch.intent.intentId,
    correlationId: input.dispatch.correlationId,
    actorId: input.dispatch.intent.actorId,
    recipientEndpointId: input.dispatch.intent.recipient.endpointId,
    transportId: input.route.identity.transportId,
    adapter: input.route.identity.adapter,
    status: input.status,
    occurredAt: input.occurredAt,
    evidenceRefs: Object.freeze([...(input.evidenceRefs ?? [])]),
    failureCode: input.failureCode,
  }))
}

export async function appendDeliveryEvidence(ledger: ActionLedger, inputReceipt: DeliveryReceipt): Promise<void> {
  const receipt=assertDeliveryReceipt(inputReceipt)
  await ledger.append({
    id: `communication-delivery:${receipt.receiptId}`,
    actionId: receipt.intentId,
    userId: receipt.actorId,
    type: `communication.delivery.${receipt.status}`,
    status: receipt.status === 'failed' ? 'failed' : 'completed',
    timestamp: receipt.occurredAt,
    metadata: {
      correlationId: receipt.correlationId,
      recipientEndpointId: receipt.recipientEndpointId,
      transportId: receipt.transportId,
      adapter: receipt.adapter,
      deliveryStatus: receipt.status,
      evidenceRefs: receipt.evidenceRefs,
      failureCode: receipt.failureCode,
    },
  })
}
