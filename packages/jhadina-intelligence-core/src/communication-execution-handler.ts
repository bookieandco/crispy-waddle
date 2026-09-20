import type { ActionHandler, ActionLedger } from '@jhadina/action-core'
import { type AuthorizedCommunicationDispatch, type GovernedCommunicationAction, COMMUNICATION_SEND_ACTION } from './communication-action.js'
import { assertCommunicationIntent } from './communication-contracts.js'
import { createDeliveryReceipt, type DeliveryReceipt } from './delivery-evidence.js'
import { ReticulumTransportAdapter } from './reticulum-adapter.js'
import { TransportRegistry } from './transport-registry.js'

export class ReticulumCommunicationExecutionHandler implements ActionHandler<GovernedCommunicationAction, DeliveryReceipt> {
  constructor(private readonly input: {
    registry: TransportRegistry
    adapter: ReticulumTransportAdapter
    receiptId: string
    occurredAt: string
  }) {}

  supports(type: string): boolean { return type === COMMUNICATION_SEND_ACTION }

  async execute(action: GovernedCommunicationAction): Promise<DeliveryReceipt> {
    const intent=assertCommunicationIntent(action.intent)
    const dispatch: AuthorizedCommunicationDispatch=Object.freeze({intent,correlationId:intent.correlationId})
    const route=this.input.registry.select(dispatch,'message.send',this.input.adapter.adapter)
    const receipt=await this.input.adapter.send({
      dispatch,
      route,
      receiptId:this.input.receiptId,
      occurredAt:this.input.occurredAt,
    })
    return createDeliveryReceipt({
      receiptId:receipt.receiptId,
      dispatch,
      route,
      status:receipt.status,
      occurredAt:receipt.occurredAt,
      evidenceRefs:receipt.evidenceRefs,
      failureCode:receipt.failureCode,
    })
  }
}

export async function recordCommunicationDeliveryEvidence(input: {
  ledger: ActionLedger
  receipt: DeliveryReceipt
}): Promise<'recorded'|'record_failed'> {
  const { appendDeliveryEvidence }=await import('./delivery-evidence.js')
  try {
    await appendDeliveryEvidence(input.ledger,input.receipt)
    return 'recorded'
  } catch {
    return 'record_failed'
  }
}
