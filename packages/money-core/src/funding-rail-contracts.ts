export type MoneyMovementKind='DEPOSIT'|'WITHDRAWAL'|'TRANSFER'
export type MoneyMovementEnvironment='SANDBOX'|'LIVE'
export type MoneyMovementState='QUOTED'|'PENDING_APPROVAL'|'APPROVED'|'REJECTED'|'EXPIRED'

export type FundingDestination=Readonly<{
 destinationId:string
 ownerUserId:string
 provider:string
 accountId:string
 currency:string
 verified:boolean
 kind:'BANK'|'BROKER_CASH'|'CRYPTO_WALLET'
 evidenceIds:readonly string[]
}>

export type MoneyMovementProposal=Readonly<{
 movementId:string
 kind:MoneyMovementKind
 userId:string
 cofferId:string
 amountMinor:bigint
 currency:string
 sourceId:string
 destinationId:string
 idempotencyKey:string
 requestedAt:string
 standingMandateId?:string
 state:'PENDING_APPROVAL'
 authority:'PROPOSAL_ONLY'
 canMoveMoney:false
}>

export type MoneyMovementRequest=Readonly<{
 movementId:string
 kind:MoneyMovementKind
 userId:string
 cofferId:string
 amountMinor:bigint
 currency:string
 sourceId:string
 destinationId:string
 idempotencyKey:string
 requestedAt:string
 standingMandateId?:string
 authorityId:string
 executionPermitId:string
}>

export type MoneyMovementQuote=Readonly<{
 quoteId:string
 movementId:string
 provider:string
 amountMinor:bigint
 feeMinor:bigint
 currency:string
 expiresAt:string
 evidenceIds:readonly string[]
 authority:'QUOTE_ONLY'
 canMoveMoney:false
}>

export type MoneyMovementInstruction=Readonly<{
 instructionId:string
 movementId:string
 provider:string
 providerAccountId:string
 kind:MoneyMovementKind
 amountMinor:bigint
 currency:string
 sourceId:string
 destinationId:string
 idempotencyKey:string
 approvalRequired:true
 reconciliationRequired:true
 authority:'PROVIDER_INSTRUCTION_ONLY'
 canMoveMoney:false
}>

export interface FundingRailAdapter{
 readonly provider:string
 readonly environment:MoneyMovementEnvironment
 readonly capabilities:Readonly<{deposit:boolean;withdrawal:boolean;transfer:boolean}>
 quote(request:MoneyMovementRequest):Promise<MoneyMovementQuote>
 prepareInstruction(request:MoneyMovementRequest,quote:MoneyMovementQuote):Promise<MoneyMovementInstruction>
}

export class FundingRailRegistry{
 private rows=new Map<string,FundingRailAdapter>()
 register(adapter:FundingRailAdapter){
  if(!adapter.provider)throw new Error('MONEY_LIVE1_FUNDING_PROVIDER_REQUIRED')
  if(this.rows.has(adapter.provider))throw new Error('MONEY_LIVE1_FUNDING_PROVIDER_DUPLICATE')
  this.rows.set(adapter.provider,adapter)
 }
 get(provider:string){const x=this.rows.get(provider);if(!x)throw new Error('MONEY_LIVE1_FUNDING_PROVIDER_NOT_REGISTERED:'+provider);return x}
 list(){return Object.freeze([...this.rows.values()])}
}

export function assertMoneyMovementRequest(r:MoneyMovementRequest,input:{verifiedSource:FundingDestination;verifiedDestination:FundingDestination}){
 if(r.amountMinor<=0n||!r.currency||!r.idempotencyKey||!r.authorityId||!r.executionPermitId)throw new Error('MONEY_LIVE1_MOVEMENT_INVALID')
 if(!input.verifiedSource.verified||!input.verifiedDestination.verified)throw new Error('MONEY_LIVE1_MOVEMENT_DESTINATION_UNVERIFIED')
 if(input.verifiedSource.ownerUserId!==r.userId||input.verifiedDestination.ownerUserId!==r.userId)throw new Error('MONEY_LIVE1_MOVEMENT_OWNER_MISMATCH')
 if(input.verifiedSource.destinationId!==r.sourceId||input.verifiedDestination.destinationId!==r.destinationId)throw new Error('MONEY_LIVE1_MOVEMENT_BINDING_MISMATCH')
 if(input.verifiedSource.currency!==r.currency||input.verifiedDestination.currency!==r.currency)throw new Error('MONEY_LIVE1_MOVEMENT_CURRENCY_MISMATCH')
 if(!input.verifiedSource.evidenceIds.length||!input.verifiedDestination.evidenceIds.length)throw new Error('MONEY_LIVE1_MOVEMENT_EVIDENCE_REQUIRED')
}


export function assertMoneyMovementProposal(p:MoneyMovementProposal,input:{verifiedSource:FundingDestination;verifiedDestination:FundingDestination}){
 if(p.authority!=='PROPOSAL_ONLY'||p.canMoveMoney!==false||p.state!=='PENDING_APPROVAL')throw new Error('MONEY_LIVE1_PROPOSAL_AUTHORITY_INVALID')
 if(p.amountMinor<=0n||!p.currency||!p.idempotencyKey)throw new Error('MONEY_LIVE1_PROPOSAL_INVALID')
 if(!input.verifiedSource.verified||!input.verifiedDestination.verified)throw new Error('MONEY_LIVE1_PROPOSAL_DESTINATION_UNVERIFIED')
 if(input.verifiedSource.ownerUserId!==p.userId||input.verifiedDestination.ownerUserId!==p.userId)throw new Error('MONEY_LIVE1_PROPOSAL_OWNER_MISMATCH')
 if(input.verifiedSource.destinationId!==p.sourceId||input.verifiedDestination.destinationId!==p.destinationId)throw new Error('MONEY_LIVE1_PROPOSAL_BINDING_MISMATCH')
 if(input.verifiedSource.currency!==p.currency||input.verifiedDestination.currency!==p.currency)throw new Error('MONEY_LIVE1_PROPOSAL_CURRENCY_MISMATCH')
}

export function promoteApprovedMoneyMovement(input:{proposal:MoneyMovementProposal;authorityId:string;executionPermitId:string;standingMandateId?:string}):MoneyMovementRequest{
 if(!input.authorityId||!input.executionPermitId)throw new Error('MONEY_LIVE1_APPROVED_MOVEMENT_AUTHORITY_REQUIRED')
 const p=input.proposal
 return Object.freeze({movementId:p.movementId,kind:p.kind,userId:p.userId,cofferId:p.cofferId,amountMinor:p.amountMinor,currency:p.currency,sourceId:p.sourceId,destinationId:p.destinationId,idempotencyKey:p.idempotencyKey,requestedAt:p.requestedAt,standingMandateId:input.standingMandateId??p.standingMandateId,authorityId:input.authorityId,executionPermitId:input.executionPermitId})
}
