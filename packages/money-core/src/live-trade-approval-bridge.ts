import type { ActionRequest, ApprovalReceipt, ApprovalReceiptStore } from '@jhadina/action-core'
import { createHash } from 'node:crypto'
import { createMoneyActionCoreAuthority, issueActionCoreBoundExecutionPermit, type MoneyActionCoreAuthority } from './action-core-authority-bridge.js'
import { fingerprintAction, type ExecutionAction, type ExecutionPermit, type PermitStore } from './execution-permit.js'
import { assertBrokerAccountEntitlement, type BrokerAccountEntitlement } from './broker-account-entitlement.js'
import type { ExecutionPlan } from './execution-planning-contracts.js'
import type { LiveApprovalCandidate, LiveExecutionPreflight } from './live-preflight-contracts.js'

export type LiveTradeApprovalAction=Readonly<{capability:'money.trade.submit';provider:string;accountId:string;instrumentId:string;side:'BUY'|'SELL';notionalMinor:string;currency:string;executionPlanId:string;preflightId:string;approvalCandidateId:string;entitlementId:string}>
export type LiveTradeApprovalRequest=ActionRequest<LiveTradeApprovalAction>
export type LiveTradePermitPackage=Readonly<{request:LiveTradeApprovalRequest;authority:MoneyActionCoreAuthority;permit:ExecutionPermit;action:ExecutionAction;approvalReceiptId:string;actionFingerprint:string;mode:'MANUAL_LIVE_ONLY';autonomous:false}>

function stable(value:unknown){return JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v)}
export function fingerprintLiveTradeApprovalRequest(request:LiveTradeApprovalRequest){return createHash('sha256').update(stable({id:request.id,userId:request.userId,type:request.type,action:request.action,requestedAt:request.requestedAt})).digest('hex')}

export function createLiveTradeApprovalRequest(input:{actionId:string;userId:string;candidate:LiveApprovalCandidate;preflight:LiveExecutionPreflight;plan:ExecutionPlan;entitlement:BrokerAccountEntitlement;requestedAt:string}):LiveTradeApprovalRequest{
 const {candidate,preflight,plan,entitlement}=input
 if(candidate.authority!=='APPROVAL_REQUEST_ONLY'||!candidate.requiresExplicitHumanApproval||candidate.canExecute)throw new Error('MONEY_048_CANDIDATE_GOVERNANCE_INVALID')
 if(preflight.status!=='PASS_FOR_HUMAN_APPROVAL'||preflight.authority!=='PREFLIGHT_ONLY'||preflight.canSubmitOrders||preflight.canAuthorizeLive)throw new Error('MONEY_048_PREFLIGHT_NOT_ELIGIBLE')
 if(candidate.executionPlanId!==plan.executionPlanId||candidate.preflightId!==preflight.preflightId||preflight.executionPlanId!==plan.executionPlanId)throw new Error('MONEY_048_PLAN_PREFLIGHT_BINDING_MISMATCH')
 if(candidate.provider!==preflight.provider||candidate.accountId!==preflight.accountId)throw new Error('MONEY_048_PROVIDER_ACCOUNT_BINDING_MISMATCH')
 assertBrokerAccountEntitlement(entitlement,{userId:input.userId,provider:candidate.provider,accountId:candidate.accountId,capability:'money.trade.submit',now:input.requestedAt})
 if(input.requestedAt<candidate.requestedAt||input.requestedAt>=candidate.expiresAt||input.requestedAt>=preflight.expiresAt)throw new Error('MONEY_048_APPROVAL_REQUEST_WINDOW_INVALID')
 const action:LiveTradeApprovalAction=Object.freeze({capability:'money.trade.submit',provider:candidate.provider,accountId:candidate.accountId,instrumentId:plan.instrumentId,side:plan.side,notionalMinor:plan.notional.minor.toString(),currency:plan.notional.currency,executionPlanId:plan.executionPlanId,preflightId:preflight.preflightId,approvalCandidateId:candidate.candidateId,entitlementId:entitlement.entitlementId})
 return Object.freeze({id:input.actionId,userId:input.userId,type:'money.trade.submit',action,requestedAt:input.requestedAt})
}

export async function requestLiveTradeHumanApproval(store:ApprovalReceiptStore,request:LiveTradeApprovalRequest,expiresAt:string):Promise<ApprovalReceipt>{
 if(expiresAt<=request.requestedAt)throw new Error('MONEY_048_APPROVAL_EXPIRY_INVALID')
 return store.createPending({actionId:request.id,userId:request.userId,type:request.type,fingerprint:fingerprintLiveTradeApprovalRequest(request),expiresAt})
}

export function toLiveTradeExecutionAction(request:LiveTradeApprovalRequest):ExecutionAction{
 const a=request.action
 return Object.freeze({actionId:request.id,userId:request.userId,capability:a.capability,provider:a.provider,accountId:a.accountId,instrumentId:a.instrumentId,side:a.side,executionPlanId:a.executionPlanId,preflightId:a.preflightId,approvalCandidateId:a.approvalCandidateId,amount:a.notionalMinor,currency:a.currency})
}

export async function consumeApprovalAndIssueLiveTradePermit(input:{approvalStore:ApprovalReceiptStore;permitStore:PermitStore;request:LiveTradeApprovalRequest;approvalReceiptId:string;candidate:LiveApprovalCandidate;preflight:LiveExecutionPreflight;plan:ExecutionPlan;entitlement:BrokerAccountEntitlement;authorityId:string;policyVersion:string;policyHash:string;authorizedAt:string;authorityExpiresAt:string;permitExpiresAt:string;permitId?:string;nonce?:string}):Promise<LiveTradePermitPackage>{
 const {request,candidate,preflight,plan,entitlement}=input
 const rebuilt=createLiveTradeApprovalRequest({actionId:request.id,userId:request.userId,candidate,preflight,plan,entitlement,requestedAt:request.requestedAt})
 if(fingerprintLiveTradeApprovalRequest(rebuilt)!==fingerprintLiveTradeApprovalRequest(request))throw new Error('MONEY_048_APPROVAL_REQUEST_MUTATED')
 if(input.authorizedAt<request.requestedAt||input.authorizedAt>=candidate.expiresAt||input.authorizedAt>=preflight.expiresAt)throw new Error('MONEY_048_AUTHORIZATION_WINDOW_INVALID')
 if(input.permitExpiresAt>input.authorityExpiresAt||input.permitExpiresAt>candidate.expiresAt||input.permitExpiresAt>preflight.expiresAt||input.permitExpiresAt<=input.authorizedAt)throw new Error('MONEY_048_PERMIT_WINDOW_INVALID')
 const consumed=await input.approvalStore.consume(input.approvalReceiptId,{actionId:request.id,userId:request.userId,type:request.type,fingerprint:fingerprintLiveTradeApprovalRequest(request)})
 if(!consumed)throw new Error('MONEY_048_APPROVAL_INVALID_EXPIRED_OR_REPLAYED')
 const approvedRequest:LiveTradeApprovalRequest=Object.freeze({...request,approvalReceiptId:input.approvalReceiptId})
 const action=toLiveTradeExecutionAction(approvedRequest)
 const authority=createMoneyActionCoreAuthority(approvedRequest,{authorityId:input.authorityId,decision:'approval_required',policyVersion:input.policyVersion,policyHash:input.policyHash,authorizedAt:input.authorizedAt,expiresAt:input.authorityExpiresAt})
 const permit=issueActionCoreBoundExecutionPermit(approvedRequest,action,authority,{expiresAt:input.permitExpiresAt,now:input.authorizedAt,permitId:input.permitId,nonce:input.nonce})
 await input.permitStore.issue(permit)
 return Object.freeze({request:approvedRequest,authority,permit,action,approvalReceiptId:input.approvalReceiptId,actionFingerprint:fingerprintAction(action),mode:'MANUAL_LIVE_ONLY',autonomous:false})
}
