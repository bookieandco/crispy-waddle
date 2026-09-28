import { createHash } from 'node:crypto'
import type { FundingDestination,FundingRailAdapter,MoneyMovementInstruction,MoneyMovementKind,MoneyMovementQuote,MoneyMovementRequest } from './funding-rail-contracts.js'
import { assertMoneyMovementRequest } from './funding-rail-contracts.js'

export type FundingRailAdmissionState='UNCOMMISSIONED'|'READ_ONLY'|'CONTROLLED_CANARY'|'LIVE'
export type MoneyMovementProviderState='ACKNOWLEDGED'|'PENDING'|'SETTLED'|'REJECTED'|'CANCELLED'|'UNKNOWN'
export type MoneyMovementAttemptState='STARTED'|'ACKNOWLEDGED'|'PENDING'|'SETTLED'|'FAILED'|'UNKNOWN'|'RECOVERY_REQUIRED'

export type FundingRailAdmission=Readonly<{
 railId:string
 provider:string
 environment:'SANDBOX'|'LIVE'
 admission:FundingRailAdmissionState
 allowedKinds:readonly MoneyMovementKind[]
 allowedCurrencies:readonly string[]
 sourceKinds:readonly FundingDestination['kind'][]
 destinationKinds:readonly FundingDestination['kind'][]
 maxMovementMinor:bigint
 maxDailyMovementMinor:bigint
 commissioningCertificateId?:string
 credentialRef?:string
 evidenceIds:readonly string[]
 authority:'ADMISSION_ONLY'
 canMoveMoney:false
}>

export type FundingRailRuntimeObservation=Readonly<{
 railId:string
 movedTodayMinor:bigint
 unresolvedAttemptCount:number
 observedAt:string
 evidenceIds:readonly string[]
 authority:'RUNTIME_EVIDENCE'
}>

export type MoneyMovementProviderEvent=Readonly<{
 eventId:string
 providerEventId:string
 provider:string
 movementId:string
 instructionId:string
 state:MoneyMovementProviderState
 providerReference?:string
 amountMinor:bigint
 feeMinor:bigint
 currency:string
 occurredAt:string
 observedAt:string
 evidenceIds:readonly string[]
 authority:'EVIDENCE_ONLY'
}>

export interface ExecutingFundingRailAdapter extends FundingRailAdapter{
 submitInstruction(input:{request:MoneyMovementRequest;instruction:MoneyMovementInstruction;idempotencyKey:string;submittedAt:string}):Promise<MoneyMovementProviderEvent>
}

export type MoneyMovementAttempt=Readonly<{
 attemptId:string
 movementId:string
 userId:string
 provider:string
 instructionId:string
 idempotencyKey:string
 amountMinor:bigint
 currency:string
 state:MoneyMovementAttemptState
 providerReference?:string
 startedAt:string
 completedAt?:string
 recoveryRequired:boolean
 evidenceIds:readonly string[]
 authority:'EXECUTION_ATTEMPT_ONLY'
}>

export interface MoneyMovementAttemptStore{
 get(attemptId:string):Promise<MoneyMovementAttempt|undefined>|MoneyMovementAttempt|undefined
 start(attempt:MoneyMovementAttempt):Promise<void>|void
 complete(attemptId:string,update:Pick<MoneyMovementAttempt,'state'|'providerReference'|'completedAt'|'recoveryRequired'|'evidenceIds'>):Promise<void>|void
}

export type MoneyMovementExecutionResult=Readonly<{
 disposition:'SUBMITTED'|'REPLAY_TERMINAL'
 attempt:MoneyMovementAttempt
 providerEvent?:MoneyMovementProviderEvent
 authority:'EXECUTION_RESULT_ONLY'
}>

const hash=(v:string)=>createHash('sha256').update(v).digest('hex')
export function fundingMovementAttemptId(request:MoneyMovementRequest,instruction:MoneyMovementInstruction):string{
 return 'money-movement-attempt:'+hash([request.movementId,request.executionPermitId,instruction.provider,instruction.instructionId].join('|'))
}

function assertTime(v:string,code:string){if(Number.isNaN(Date.parse(v)))throw new Error(code)}

export function assertFundingRailAdmissionMayExecute(input:{
 admission:FundingRailAdmission
 observation:FundingRailRuntimeObservation
 adapter:ExecutingFundingRailAdapter
 request:MoneyMovementRequest
 source:FundingDestination
 destination:FundingDestination
}){
 const {admission:a,observation:o,adapter,request:r,source,destination}=input
 if(a.authority!=='ADMISSION_ONLY'||a.canMoveMoney!==false||o.authority!=='RUNTIME_EVIDENCE')throw new Error('MONEY_FUND2_AUTHORITY_INVALID')
 if(!a.evidenceIds.length||!o.evidenceIds.length)throw new Error('MONEY_FUND2_EVIDENCE_REQUIRED')
 if(a.admission!=='CONTROLLED_CANARY'&&a.admission!=='LIVE')throw new Error('MONEY_FUND2_RAIL_NOT_EXECUTABLE')
 if(!a.commissioningCertificateId?.trim())throw new Error('MONEY_FUND3_COMMISSIONING_CERTIFICATE_REQUIRED')
 if(a.environment!=='LIVE'||adapter.environment!=='LIVE')throw new Error('MONEY_FUND2_LIVE_RAIL_REQUIRED')
 if(a.provider!==adapter.provider||a.railId!==o.railId)throw new Error('MONEY_FUND2_RAIL_BINDING_MISMATCH')
 if(!a.allowedKinds.includes(r.kind)||!a.allowedCurrencies.includes(r.currency))throw new Error('MONEY_FUND2_RAIL_POLICY_BLOCK')
 if(!a.sourceKinds.includes(source.kind)||!a.destinationKinds.includes(destination.kind))throw new Error('MONEY_FUND2_ENDPOINT_KIND_BLOCK')
 if(r.amountMinor<=0n||r.amountMinor>a.maxMovementMinor)throw new Error('MONEY_FUND2_MOVEMENT_LIMIT')
 if(o.movedTodayMinor<0n||o.unresolvedAttemptCount<0)throw new Error('MONEY_FUND2_RUNTIME_INVALID')
 if(o.movedTodayMinor+r.amountMinor>a.maxDailyMovementMinor)throw new Error('MONEY_FUND2_DAILY_LIMIT')
 if(o.unresolvedAttemptCount>0)throw new Error('MONEY_FUND2_UNRESOLVED_ATTEMPT_BLOCK')
 const capability=r.kind==='DEPOSIT'?adapter.capabilities.deposit:r.kind==='WITHDRAWAL'?adapter.capabilities.withdrawal:adapter.capabilities.transfer
 if(!capability)throw new Error('MONEY_FUND2_ADAPTER_CAPABILITY_BLOCK')
}

export function assertFundingQuoteBound(request:MoneyMovementRequest,quote:MoneyMovementQuote,now:string){
 if(quote.authority!=='QUOTE_ONLY'||quote.canMoveMoney!==false||!quote.evidenceIds.length)throw new Error('MONEY_FUND2_QUOTE_AUTHORITY_INVALID')
 if(quote.movementId!==request.movementId||quote.amountMinor!==request.amountMinor||quote.currency!==request.currency)throw new Error('MONEY_FUND2_QUOTE_BINDING_MISMATCH')
 if(quote.feeMinor<0n)throw new Error('MONEY_FUND2_QUOTE_FEE_INVALID')
 assertTime(quote.expiresAt,'MONEY_FUND2_QUOTE_EXPIRY_INVALID');assertTime(now,'MONEY_FUND2_NOW_INVALID')
 if(Date.parse(now)>=Date.parse(quote.expiresAt))throw new Error('MONEY_FUND2_QUOTE_EXPIRED')
}

export function assertFundingInstructionBound(request:MoneyMovementRequest,quote:MoneyMovementQuote,instruction:MoneyMovementInstruction){
 if(instruction.authority!=='PROVIDER_INSTRUCTION_ONLY'||instruction.canMoveMoney!==false||instruction.approvalRequired!==true||instruction.reconciliationRequired!==true)throw new Error('MONEY_FUND2_INSTRUCTION_AUTHORITY_INVALID')
 if(instruction.movementId!==request.movementId||instruction.provider!==quote.provider||instruction.kind!==request.kind||instruction.amountMinor!==request.amountMinor||instruction.currency!==request.currency)throw new Error('MONEY_FUND2_INSTRUCTION_BINDING_MISMATCH')
 if(instruction.sourceId!==request.sourceId||instruction.destinationId!==request.destinationId||instruction.idempotencyKey!==request.idempotencyKey)throw new Error('MONEY_FUND2_INSTRUCTION_ENDPOINT_MISMATCH')
}

export function assertFundingProviderEventBound(input:{request:MoneyMovementRequest;instruction:MoneyMovementInstruction;event:MoneyMovementProviderEvent}){
 const {request:r,instruction:i,event:e}=input
 if(e.authority!=='EVIDENCE_ONLY'||!e.evidenceIds.length)throw new Error('MONEY_FUND2_PROVIDER_EVIDENCE_REQUIRED')
 if(e.provider!==i.provider||e.movementId!==r.movementId||e.instructionId!==i.instructionId||e.amountMinor!==r.amountMinor||e.currency!==r.currency)throw new Error('MONEY_FUND2_PROVIDER_BINDING_MISMATCH')
 if(e.feeMinor<0n)throw new Error('MONEY_FUND2_PROVIDER_FEE_INVALID')
 assertTime(e.occurredAt,'MONEY_FUND2_PROVIDER_TIME_INVALID');assertTime(e.observedAt,'MONEY_FUND2_PROVIDER_TIME_INVALID')
 if(Date.parse(e.observedAt)<Date.parse(e.occurredAt))throw new Error('MONEY_FUND2_PROVIDER_CLOCK_INVALID')
 if((e.state==='ACKNOWLEDGED'||e.state==='PENDING'||e.state==='SETTLED')&&!e.providerReference)throw new Error('MONEY_FUND2_PROVIDER_REFERENCE_REQUIRED')
}

export async function executeGovernedMoneyMovement(input:{
 request:MoneyMovementRequest
 source:FundingDestination
 destination:FundingDestination
 quote:MoneyMovementQuote
 instruction:MoneyMovementInstruction
 admission:FundingRailAdmission
 observation:FundingRailRuntimeObservation
 adapter:ExecutingFundingRailAdapter
 attempts:MoneyMovementAttemptStore
 now:string
}):Promise<MoneyMovementExecutionResult>{
 const {request:r,source,destination,quote:q,instruction:i,admission:a,observation:o,adapter,attempts,now}=input
 assertMoneyMovementRequest(r,{verifiedSource:source,verifiedDestination:destination})
 assertFundingRailAdmissionMayExecute({admission:a,observation:o,adapter,request:r,source,destination})
 assertFundingQuoteBound(r,q,now)
 assertFundingInstructionBound(r,q,i)
 if(q.provider!==adapter.provider)throw new Error('MONEY_FUND2_QUOTE_PROVIDER_MISMATCH')
 const attemptId=fundingMovementAttemptId(r,i)
 const prior=await attempts.get(attemptId)
 if(prior){
  if(prior.state==='SETTLED'||prior.state==='FAILED')return Object.freeze({disposition:'REPLAY_TERMINAL' as const,attempt:prior,authority:'EXECUTION_RESULT_ONLY' as const})
  throw new Error('MONEY_FUND2_ATTEMPT_ALREADY_IN_FLIGHT_OR_UNKNOWN')
 }
 const started:MoneyMovementAttempt=Object.freeze({attemptId,movementId:r.movementId,userId:r.userId,provider:adapter.provider,instructionId:i.instructionId,idempotencyKey:r.idempotencyKey,amountMinor:r.amountMinor,currency:r.currency,state:'STARTED',startedAt:now,recoveryRequired:false,evidenceIds:Object.freeze([...source.evidenceIds,...destination.evidenceIds,...q.evidenceIds]),authority:'EXECUTION_ATTEMPT_ONLY'})
 await attempts.start(started)
 let event:MoneyMovementProviderEvent
 try{event=await adapter.submitInstruction({request:r,instruction:i,idempotencyKey:r.idempotencyKey,submittedAt:now})}
 catch(error){
  const evidenceIds=Object.freeze([...started.evidenceIds,'provider-submit:ambiguous'])
  await attempts.complete(attemptId,{state:'UNKNOWN',providerReference:undefined,completedAt:now,recoveryRequired:true,evidenceIds})
  throw new Error('MONEY_FUND2_PROVIDER_SUBMIT_UNKNOWN:'+(error instanceof Error?error.message:String(error)))
 }
 assertFundingProviderEventBound({request:r,instruction:i,event})
 const state:MoneyMovementAttemptState=event.state==='SETTLED'?'SETTLED':event.state==='REJECTED'||event.state==='CANCELLED'?'FAILED':event.state==='UNKNOWN'?'UNKNOWN':event.state
 const recoveryRequired=event.state==='UNKNOWN'
 const completedAt=event.state==='ACKNOWLEDGED'||event.state==='PENDING'?undefined:event.observedAt
 const evidenceIds=Object.freeze([...new Set([...started.evidenceIds,...event.evidenceIds])])
 const next=Object.freeze({...started,state,providerReference:event.providerReference,completedAt,recoveryRequired,evidenceIds})
 await attempts.complete(attemptId,{state,providerReference:event.providerReference,completedAt,recoveryRequired,evidenceIds})
 return Object.freeze({disposition:'SUBMITTED' as const,attempt:next,providerEvent:event,authority:'EXECUTION_RESULT_ONLY' as const})
}

export type MovementFeeApplication='SOURCE_ADDED'|'DESTINATION_DEDUCTED'|'SEPARATE'
export type MoneyMovementSettlementEvidence=Readonly<{
 settlementId:string
 movementId:string
 amountMinor:bigint
 feeMinor:bigint
 feeApplication:MovementFeeApplication
 sourceBeforeMinor:bigint
 sourceAfterMinor:bigint
 destinationBeforeMinor:bigint
 destinationAfterMinor:bigint
 observedAt:string
 evidenceIds:readonly string[]
 authority:'SETTLEMENT_EVIDENCE'
}>

export type MoneyMovementReconciliation=Readonly<{
 reconciliationId:string
 movementId:string
 passed:boolean
 sourceDecreaseMinor:bigint
 destinationIncreaseMinor:bigint
 feeMinor:bigint
 reasonCodes:readonly string[]
 observedAt:string
 evidenceIds:readonly string[]
 authority:'RECONCILIATION_ONLY'
 canMoveMoney:false
}>

export function reconcileMoneyMovement(request:MoneyMovementRequest,e:MoneyMovementSettlementEvidence):MoneyMovementReconciliation{
 if(e.authority!=='SETTLEMENT_EVIDENCE'||!e.evidenceIds.length||e.movementId!==request.movementId)throw new Error('MONEY_FUND2_SETTLEMENT_EVIDENCE_INVALID')
 if([e.amountMinor,e.feeMinor,e.sourceBeforeMinor,e.sourceAfterMinor,e.destinationBeforeMinor,e.destinationAfterMinor].some(x=>x<0n))throw new Error('MONEY_FUND2_SETTLEMENT_NEGATIVE')
 if(e.amountMinor!==request.amountMinor)throw new Error('MONEY_FUND2_SETTLEMENT_AMOUNT_MISMATCH')
 const sourceDecrease=e.sourceBeforeMinor-e.sourceAfterMinor
 const destinationIncrease=e.destinationAfterMinor-e.destinationBeforeMinor
 const reasons:string[]=[]
 if(sourceDecrease<0n)reasons.push('SOURCE_BALANCE_INCREASED')
 if(destinationIncrease<0n)reasons.push('DESTINATION_BALANCE_DECREASED')
 if(e.feeApplication==='SOURCE_ADDED'){
  if(sourceDecrease!==request.amountMinor+e.feeMinor)reasons.push('SOURCE_DELTA_MISMATCH')
  if(destinationIncrease!==request.amountMinor)reasons.push('DESTINATION_DELTA_MISMATCH')
 }else if(e.feeApplication==='DESTINATION_DEDUCTED'){
  if(sourceDecrease!==request.amountMinor)reasons.push('SOURCE_DELTA_MISMATCH')
  if(destinationIncrease!==request.amountMinor-e.feeMinor)reasons.push('DESTINATION_DELTA_MISMATCH')
 }else{
  if(sourceDecrease!==request.amountMinor)reasons.push('SOURCE_DELTA_MISMATCH')
  if(destinationIncrease!==request.amountMinor)reasons.push('DESTINATION_DELTA_MISMATCH')
 }
 const passed=reasons.length===0
 return Object.freeze({reconciliationId:'money-movement-recon:'+hash([e.settlementId,request.movementId,...e.evidenceIds].join('|')),movementId:request.movementId,passed,sourceDecreaseMinor:sourceDecrease,destinationIncreaseMinor:destinationIncrease,feeMinor:e.feeMinor,reasonCodes:Object.freeze(reasons),observedAt:e.observedAt,evidenceIds:Object.freeze([...e.evidenceIds]),authority:'RECONCILIATION_ONLY' as const,canMoveMoney:false as const})
}
