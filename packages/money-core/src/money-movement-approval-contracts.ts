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

export type MoneyMovementExecutionAction=Readonly<MoneyMovementApprovalAction&{
 provider:string
 railId:string
}>

export function moneyMovementApprovalAction(proposal:MoneyMovementProposal):MoneyMovementApprovalAction{
 return Object.freeze({
  movementId:proposal.movementId,kind:proposal.kind,cofferId:proposal.cofferId,amountMinor:proposal.amountMinor.toString(),
  currency:proposal.currency,sourceId:proposal.sourceId,destinationId:proposal.destinationId,idempotencyKey:proposal.idempotencyKey,
 })
}

export function moneyMovementApprovalRequest(proposal:MoneyMovementProposal):ActionRequest<MoneyMovementApprovalAction>{
 return Object.freeze({id:proposal.movementId,userId:proposal.userId,type:MONEY_MOVEMENT_EXECUTE_CAPABILITY,action:moneyMovementApprovalAction(proposal),requestedAt:proposal.requestedAt})
}

export function moneyMovementExecutionRequest(input:{proposal:MoneyMovementProposal;approvalReceiptId:string;provider:string;railId:string}):ActionRequest<MoneyMovementExecutionAction>{
 if(!input.approvalReceiptId||!input.provider||!input.railId)throw new Error('MONEY_FUND2_EXECUTION_REQUEST_INCOMPLETE')
 return Object.freeze({
  id:input.proposal.movementId,userId:input.proposal.userId,type:MONEY_MOVEMENT_EXECUTE_CAPABILITY,
  action:Object.freeze({...moneyMovementApprovalAction(input.proposal),provider:input.provider,railId:input.railId}),
  requestedAt:input.proposal.requestedAt,approvalReceiptId:input.approvalReceiptId,
 })
}

export function fingerprintMoneyMovementApproval(request:Pick<ActionRequest<MoneyMovementApprovalAction|MoneyMovementExecutionAction>,'id'|'userId'|'type'|'action'|'requestedAt'>):string{
 const a=request.action
 const economic=Object.freeze({movementId:a.movementId,kind:a.kind,cofferId:a.cofferId,amountMinor:a.amountMinor,currency:a.currency,sourceId:a.sourceId,destinationId:a.destinationId,idempotencyKey:a.idempotencyKey})
 return createHash('sha256').update(JSON.stringify({id:request.id,userId:request.userId,type:request.type,action:economic,requestedAt:request.requestedAt})).digest('hex')
}
