import type { ActionHandler,ActionPolicy,ActionRequest } from '@jhadina/action-core'
import { createMoneyActionCoreAuthority,issueActionCoreBoundExecutionPermit } from './action-core-authority-bridge.js'
import { authorizeAndConsumeMoneyPermit,type MoneyExecutionPermit } from './execution-permit-gate.js'
import type { ExecutionAction,PermitStore } from './execution-permit.js'
import {
 assertFundingRailAdmissionMayExecute,
 executeGovernedMoneyMovement,
 type ExecutingFundingRailAdapter,
 type FundingRailAdmission,
 type FundingRailCertificateProof,
 type FundingRailRuntimeObservation,
 assertFundingRailAdmissionCertificate,
 type MoneyMovementAttemptStore,
 type MoneyMovementExecutionResult,
} from './funding-execution-contracts.js'
import { promoteApprovedMoneyMovement,type FundingDestination,type MoneyMovementInstruction,type MoneyMovementProposal,type MoneyMovementQuote } from './funding-rail-contracts.js'
import {
 MONEY_MOVEMENT_EXECUTE_CAPABILITY,
 moneyMovementApprovalAction,
 type MoneyMovementExecutionAction,
} from './money-movement-approval-contracts.js'

export type MoneyMovementExecutionContext=Readonly<{
 proposal:MoneyMovementProposal
 source:FundingDestination
 destination:FundingDestination
 admission:FundingRailAdmission
 observation:FundingRailRuntimeObservation
 adapter:ExecutingFundingRailAdapter
 commissioningCertificate:FundingRailCertificateProof
}>

export interface MoneyMovementExecutionContextLoader{
 load(action:MoneyMovementExecutionAction,request:ActionRequest<MoneyMovementExecutionAction>):Promise<MoneyMovementExecutionContext>
}

function assertActionMatchesProposal(action:MoneyMovementExecutionAction,proposal:MoneyMovementProposal){
 const expected=moneyMovementApprovalAction(proposal)
 for(const k of ['movementId','kind','cofferId','amountMinor','currency','sourceId','destinationId','idempotencyKey'] as const){
  if(action[k]!==expected[k])throw new Error('MONEY_FUND2_ACTION_PROPOSAL_MISMATCH:'+k)
 }
 if(!action.provider||!action.railId)throw new Error('MONEY_FUND2_EXECUTION_PROVIDER_REQUIRED')
}

function provisionalRequest(proposal:MoneyMovementProposal){
 return promoteApprovedMoneyMovement({proposal,authorityId:'preflight:authority',executionPermitId:'preflight:permit'})
}

export function createMoneyMovementActionPolicy(loader:MoneyMovementExecutionContextLoader):ActionPolicy<MoneyMovementExecutionAction>{
 return {
  async evaluate(request){
   if(request.type!==MONEY_MOVEMENT_EXECUTE_CAPABILITY)return 'deny'
   try{
    const ctx=await loader.load(request.action,request)
    assertActionMatchesProposal(request.action,ctx.proposal)
    assertFundingRailAdmissionCertificate(ctx.admission,ctx.commissioningCertificate)
    if(ctx.proposal.userId!==request.userId)return 'deny'
    if(ctx.admission.railId!==request.action.railId||ctx.admission.provider!==request.action.provider)return 'deny'
    assertFundingRailAdmissionMayExecute({admission:ctx.admission,observation:ctx.observation,adapter:ctx.adapter,request:provisionalRequest(ctx.proposal),source:ctx.source,destination:ctx.destination})
    return 'approval_required'
   }catch{return 'deny'}
  },
 }
}

export type MoneyMovementHandlerDeps=Readonly<{
 loader:MoneyMovementExecutionContextLoader
 permitStore:PermitStore
 attempts:MoneyMovementAttemptStore
 now:()=>string
 policyVersion:string
 policyHash:string
 authorityId:(request:ActionRequest<MoneyMovementExecutionAction>)=>string
 permitId?:(request:ActionRequest<MoneyMovementExecutionAction>)=>string
 permitNonce?:(request:ActionRequest<MoneyMovementExecutionAction>)=>string
 authorityTtlMs?:number
 permitTtlMs?:number
}>

function permitRef(permit:ReturnType<typeof issueActionCoreBoundExecutionPermit>):MoneyExecutionPermit{
 return Object.freeze({permitId:permit.permitId,nonce:permit.nonce,authorityId:permit.binding.authorityId,actionRequestFingerprint:permit.binding.actionRequestFingerprint,policyVersion:permit.binding.policyVersion,policyHash:permit.binding.policyHash,approvalId:permit.binding.approvalId})
}

export class MoneyMovementExecutionHandler implements ActionHandler<MoneyMovementExecutionAction,MoneyMovementExecutionResult>{
 constructor(private readonly deps:MoneyMovementHandlerDeps){}
 supports(type:string){return type===MONEY_MOVEMENT_EXECUTE_CAPABILITY}

 async execute(action:MoneyMovementExecutionAction,request:ActionRequest<MoneyMovementExecutionAction>):Promise<MoneyMovementExecutionResult>{
  if(request.type!==MONEY_MOVEMENT_EXECUTE_CAPABILITY)throw new Error('MONEY_FUND2_CAPABILITY_MISMATCH')
  if(!request.approvalReceiptId)throw new Error('MONEY_FUND2_APPROVAL_RECEIPT_REQUIRED')
  const ctx=await this.deps.loader.load(action,request)
  assertActionMatchesProposal(action,ctx.proposal)
  assertFundingRailAdmissionCertificate(ctx.admission,ctx.commissioningCertificate)
  if(ctx.proposal.userId!==request.userId)throw new Error('MONEY_FUND2_OWNER_MISMATCH')
  if(ctx.admission.railId!==action.railId||ctx.admission.provider!==action.provider||ctx.adapter.provider!==action.provider)throw new Error('MONEY_FUND2_PROVIDER_BINDING_MISMATCH')

  const now=this.deps.now(),nowMs=Date.parse(now)
  if(Number.isNaN(nowMs))throw new Error('MONEY_FUND2_NOW_INVALID')
  const authorityExpiresAt=new Date(nowMs+(this.deps.authorityTtlMs??5*60_000)).toISOString()
  const permitExpiresAt=new Date(nowMs+(this.deps.permitTtlMs??2*60_000)).toISOString()
  if(Date.parse(permitExpiresAt)>Date.parse(authorityExpiresAt))throw new Error('MONEY_FUND2_PERMIT_OUTLIVES_AUTHORITY')

  const authority=createMoneyActionCoreAuthority(request,{authorityId:this.deps.authorityId(request),decision:'approval_required',policyVersion:this.deps.policyVersion,policyHash:this.deps.policyHash,authorizedAt:now,expiresAt:authorityExpiresAt})
  const executionAction:ExecutionAction=Object.freeze({
   actionId:request.id,userId:request.userId,capability:MONEY_MOVEMENT_EXECUTE_CAPABILITY,provider:action.provider,
   fromAccountId:action.sourceId,toAccountId:action.destinationId,amount:action.amountMinor,currency:action.currency,
  })
  const permit=issueActionCoreBoundExecutionPermit(request,executionAction,authority,{expiresAt:permitExpiresAt,now,permitId:this.deps.permitId?.(request),nonce:this.deps.permitNonce?.(request)})
  await this.deps.permitStore.issue(permit)
  const movementRequest=promoteApprovedMoneyMovement({proposal:ctx.proposal,authorityId:authority.authorityId,executionPermitId:permit.permitId,standingMandateId:ctx.proposal.standingMandateId})

  let quote:MoneyMovementQuote,instruction:MoneyMovementInstruction
  try{
   assertFundingRailAdmissionMayExecute({admission:ctx.admission,observation:ctx.observation,adapter:ctx.adapter,request:movementRequest,source:ctx.source,destination:ctx.destination})
   quote=await ctx.adapter.quote(movementRequest)
   instruction=await ctx.adapter.prepareInstruction(movementRequest,quote)
  }catch(error){
   await this.deps.permitStore.revoke(permit.permitId)
   throw error
  }

  await authorizeAndConsumeMoneyPermit(this.deps.permitStore,permitRef(permit),request,executionAction,now)
  return executeGovernedMoneyMovement({request:movementRequest,source:ctx.source,destination:ctx.destination,quote,instruction,admission:ctx.admission,commissioningCertificate:ctx.commissioningCertificate,observation:ctx.observation,adapter:ctx.adapter,attempts:this.deps.attempts,now})
 }
}
