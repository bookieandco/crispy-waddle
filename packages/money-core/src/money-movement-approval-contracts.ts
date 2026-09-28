import { createHash } from 'node:crypto'
import type { ActionRequest } from '@jhadina/action-core'
import type { MoneyMovementProposal } from './funding-rail-contracts.js'

export const MONEY_MOVEMENT_EXECUTE_CAPABILITY='money.movement.execute' as const

export type MoneyMovementApprovalAction=Readonly<{
 movementId:string
 kind:MoneyMovementProposal['kind']
 cofferId:string
 amountMinor:string
 currency:string
 sourceId:string
 destinationId:string
 idempotencyKey:string
}>

export function moneyMovementApprovalAction(proposal:MoneyMovementProposal):MoneyMovementApprovalAction{
 return Object.freeze({
  movementId:proposal.movementId,kind:proposal.kind,cofferId:proposal.cofferId,amountMinor:proposal.amountMinor.toString(),
  currency:proposal.currency,sourceId:proposal.sourceId,destinationId:proposal.destinationId,idempotencyKey:proposal.idempotencyKey,
 })
}

export function moneyMovementApprovalRequest(proposal:MoneyMovementProposal):ActionRequest<MoneyMovementApprovalAction>{
 return Object.freeze({
  id:proposal.movementId,
  userId:proposal.userId,
  type:MONEY_MOVEMENT_EXECUTE_CAPABILITY,
  action:moneyMovementApprovalAction(proposal),
  requestedAt:proposal.requestedAt,
 })
}

export function fingerprintMoneyMovementApproval(request:Pick<ActionRequest<MoneyMovementApprovalAction>,'id'|'userId'|'type'|'action'|'requestedAt'>):string{
 return createHash('sha256').update(JSON.stringify({
  id:request.id,userId:request.userId,type:request.type,action:request.action,requestedAt:request.requestedAt,
 })).digest('hex')
}
