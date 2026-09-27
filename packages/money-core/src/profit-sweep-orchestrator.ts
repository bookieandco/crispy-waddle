import { createHash } from 'node:crypto'
import type { CofferAccountantDecision } from './coffer-accountant.js'
import type { FundingDestination,MoneyMovementProposal } from './funding-rail-contracts.js'

const hash=(value:string)=>createHash('sha256').update(value).digest('hex')

export function buildProfitSweepMovementProposal(input:{
 decision:CofferAccountantDecision
 userId:string
 currency:string
 sourceCofferId:string
 destination:FundingDestination
 requestedAt:string
}):MoneyMovementProposal{
 const d=input.decision
 if(d.sweepStatus!=='READY_FOR_GOVERNED_EXECUTION'||d.proposedSweepMinor<=0n)throw new Error('MONEY_LIVE1_SWEEP_NOT_READY')
 if(!d.destinationId||d.destinationId!==input.destination.destinationId)throw new Error('MONEY_LIVE1_SWEEP_DESTINATION_MISMATCH')
 if(!input.destination.verified||input.destination.ownerUserId!==input.userId||input.destination.kind!=='BANK')throw new Error('MONEY_LIVE1_SWEEP_OWNER_BANK_REQUIRED')
 if(input.destination.currency!==input.currency)throw new Error('MONEY_LIVE1_SWEEP_CURRENCY_MISMATCH')
 if(!d.standingSweepMandateId)throw new Error('MONEY_LIVE1_SWEEP_MANDATE_REQUIRED')
 const seed=[d.cofferId,input.userId,input.destination.destinationId,d.proposedSweepMinor.toString(),input.currency,input.requestedAt].join('|')
 const movementId='profit-sweep:'+hash(seed)
 return Object.freeze({
  movementId,
  kind:'WITHDRAWAL' as const,
  userId:input.userId,
  cofferId:d.cofferId,
  amountMinor:d.proposedSweepMinor,
  currency:input.currency,
  sourceId:'coffer:'+input.sourceCofferId,
  destinationId:input.destination.destinationId,
  idempotencyKey:'profit-sweep-proposal:'+movementId,
  requestedAt:input.requestedAt,
  state:'PENDING_APPROVAL' as const,
  authority:'PROPOSAL_ONLY' as const,
  canMoveMoney:false as const,
 })
}
