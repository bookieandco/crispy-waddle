import type { ActionExecutor } from '@jhadina/action-core'
import { appendDeliveryEvidence, type DeliveryReceipt } from './delivery-evidence.js'
import { toCommunicationActionRequest, type AuthorizedCommunicationDispatch } from './communication-action.js'
import type { CommunicationIntent } from './communication-contracts.js'
import { ReticulumTransportAdapter } from './reticulum-adapter.js'
import { TransportRegistry } from './transport-registry.js'

export async function executeGovernedReticulumCommunication(input: {
  intent: CommunicationIntent
  approvalReceiptId?: string
  executor: ActionExecutor
  registry: TransportRegistry
  adapter: ReticulumTransportAdapter
  receiptId: string
  occurredAt: string
  ledger: Parameters<typeof appendDeliveryEvidence>[0]
}): Promise<DeliveryReceipt> {
  const request = toCommunicationActionRequest({ intent: input.intent, approvalReceiptId: input.approvalReceiptId })
  const dispatch = await input.executor.execute(request) as AuthorizedCommunicationDispatch
  const route = input.registry.select(dispatch)
  if (!input.adapter.supports(route)) throw new Error('RETICULUM_ROUTE_REQUIRED')
  const receipt = await input.adapter.send({ dispatch, route, receiptId: input.receiptId, occurredAt: input.occurredAt })
  await appendDeliveryEvidence(input.ledger, receipt)
  return receipt
}
