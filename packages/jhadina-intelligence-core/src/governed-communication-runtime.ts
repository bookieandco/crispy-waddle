import { ActionExecutor, type ActionLedger, type ActionPolicy, type ApprovalReceiptVerifier } from '@jhadina/action-core'
import { toCommunicationActionRequest, type GovernedCommunicationAction } from './communication-action.js'
import { ReticulumCommunicationExecutionHandler, recordCommunicationDeliveryEvidence } from './communication-execution-handler.js'
import type { CommunicationIntent } from './communication-contracts.js'
import type { DeliveryReceipt } from './delivery-evidence.js'
import { ReticulumTransportAdapter } from './reticulum-adapter.js'
import { TransportRegistry } from './transport-registry.js'

export type GovernedCommunicationResult = Readonly<{
  receipt: DeliveryReceipt
  deliveryEvidence: 'recorded' | 'record_failed'
}>

export async function executeGovernedReticulumCommunication(input: {
  intent: CommunicationIntent
  approvalReceiptId?: string
  policy: ActionPolicy<GovernedCommunicationAction>
  actionLedger: ActionLedger
  approvalReceipts?: ApprovalReceiptVerifier<GovernedCommunicationAction>
  registry: TransportRegistry
  adapter: ReticulumTransportAdapter
  receiptId: string
  occurredAt: string
  deliveryLedger: ActionLedger
}): Promise<GovernedCommunicationResult> {
  const handler=new ReticulumCommunicationExecutionHandler({
    registry:input.registry,
    adapter:input.adapter,
    receiptId:input.receiptId,
    occurredAt:input.occurredAt,
  })
  const executor=new ActionExecutor<GovernedCommunicationAction,DeliveryReceipt>(
    input.policy,
    input.actionLedger,
    [handler],
    input.approvalReceipts,
  )
  const receipt=await executor.execute(toCommunicationActionRequest({
    intent:input.intent,
    approvalReceiptId:input.approvalReceiptId,
  }))
  const deliveryEvidence=await recordCommunicationDeliveryEvidence({ledger:input.deliveryLedger,receipt})
  return Object.freeze({receipt,deliveryEvidence})
}
