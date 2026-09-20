import type { ActionHandler, ActionRequest } from '@jhadina/action-core'
import { assertCommunicationIntent, type CommunicationIntent } from './communication-contracts.js'

export const COMMUNICATION_SEND_ACTION = 'communications.send' as const

export type GovernedCommunicationAction = Readonly<{
  intent: CommunicationIntent
}>

export type AuthorizedCommunicationDispatch = Readonly<{
  intent: CommunicationIntent
  correlationId: string
}>

export function toCommunicationActionRequest(input: {
  intent: CommunicationIntent
  approvalReceiptId?: string
}): ActionRequest<GovernedCommunicationAction> {
  const intent = assertCommunicationIntent(input.intent)
  return {
    id: intent.intentId,
    userId: intent.actorId,
    type: COMMUNICATION_SEND_ACTION,
    action: { intent },
    requestedAt: intent.createdAt,
    approvalReceiptId: input.approvalReceiptId,
  }
}

export class CommunicationAuthorizationHandler implements ActionHandler<GovernedCommunicationAction, AuthorizedCommunicationDispatch> {
  supports(type: string): boolean {
    return type === COMMUNICATION_SEND_ACTION
  }

  async execute(action: GovernedCommunicationAction): Promise<AuthorizedCommunicationDispatch> {
    const intent = assertCommunicationIntent(action.intent)
    return Object.freeze({ intent, correlationId: intent.correlationId })
  }
}
