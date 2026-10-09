import {createHash} from 'node:crypto'
import {assertJhadinaPurseCharter,type JhadinaPurseCharter} from './jhadina-purse-charter.js'
import {assertAutonomousMandateLimits,type AutonomousMandateLimits,type AutonomousMandateActivationAction} from './autonomous-trading-contracts.js'
import type {MoneyStrategyLane} from './money-commissioning-contracts.js'
import type {PurseLiveCustodyReview} from './purse-live-custody-gate.js'

export type PurseLiveMandateProposal=Readonly<{
 proposalId:string
 charterId:string
 userId:string
 cofferId:string
 provider:string
 accountId:string
 lane:MoneyStrategyLane
 action:AutonomousMandateActivationAction
 maximumReviewableCustodyMinor:bigint
 ownerDestinationId:string
 evidenceIds:readonly string[]
 approvalReceiptId:null
 status:'OWNER_REVIEW_REQUIRED'
 authority:'MANDATE_PROPOSAL_ONLY'
 requiresActionCoreApproval:true
 canActivate:false
 canExecute:false
 canMoveMoney:false
}>
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v)).digest('hex')
/**
 * P-LIVE.04 -- Build the EXACT proposed mandate economics for owner review.
 * NEVER generates an approval receipt, Action Core authority, live mandate, permit or order.
 */
export function buildPurseLiveMandateProposal(x:{
 charter:JhadinaPurseCharter
 custody:PurseLiveCustodyReview
 provider:string
 accountId:string
 lane:MoneyStrategyLane
 currency:string
 strategies:readonly string[]
 instrumentPrefixes:readonly string[]
 limits:AutonomousMandateLimits
 allowOpeningShorts:boolean
 startsAt:string
 expiresAt:string
 requestedAt:string
}):PurseLiveMandateProposal{
 const {charter:c,custody:d}=x
 assertJhadinaPurseCharter(c,x.requestedAt)
 assertAutonomousMandateLimits(x.limits)
 if(c.autonomyMode!=='LIVE_GOVERNED_INTENTS')throw new Error('PURSE_LIVE_OWNER_CHARTER_REQUIRED')
 if(d.status!=='EVIDENCE_REVIEW_REQUIRED'||d.authority!=='POTENTIAL_CUSTODY_EVIDENCE_ONLY'||
   d.independentlyCertified!==false||d.canTrade!==false||d.canMoveMoney!==false||
   d.ownerUserId!==c.userId||d.cofferId!==c.cofferId||
   d.maximumReviewableDeployableMinor<=0n)throw new Error('PURSE_LIVE_CUSTODY_REVIEW_REQUIRED')
 const policy=c.lanePolicies.find(p=>p.lane===x.lane&&p.enabled)
 if(!policy||policy.maxAllocationBps<=0||policy.maxSinglePositionBps<=0)throw new Error('PURSE_LIVE_LANE_DISABLED')
 if(!x.provider.trim()||!x.accountId.trim()||x.currency!==c.reportingCurrency||
   !x.strategies.length||!x.instrumentPrefixes.length||x.strategies.some(a=>!a.trim())||
   x.instrumentPrefixes.some(a=>!a.trim())||new Set(x.strategies).size!==x.strategies.length||
   new Set(x.instrumentPrefixes).size!==x.instrumentPrefixes.length)
   throw new Error('PURSE_LIVE_SCOPE_INVALID')
 if(!Number.isFinite(Date.parse(x.startsAt))||!Number.isFinite(Date.parse(x.expiresAt))||
    x.startsAt<x.requestedAt||x.expiresAt<=x.startsAt)throw new Error('PURSE_LIVE_WINDOW_INVALID')
 // Never let a proposed mandate exceed the reconciled owner/treasury/settled-cash ceiling.
 const cap=d.maximumReviewableDeployableMinor
 const charterCap=cap*BigInt(c.maxTotalDeployableBps)/10000n
 const laneCap=cap*BigInt(policy.maxAllocationBps)/10000n
 const singleCap=cap*BigInt(Math.min(c.maxSingleOpportunityBps,policy.maxSinglePositionBps))/10000n
 if(x.limits.maxOrderNotionalMinor>singleCap||x.limits.maxGrossExposureMinor>laneCap||
    x.limits.maxDailySubmittedNotionalMinor>charterCap||x.limits.maxDailySubmittedNotionalMinor>cap)
    throw new Error('PURSE_LIVE_PROPOSED_LIMITS_EXCEED_OWNER_OR_CUSTODY')
 const action:AutonomousMandateActivationAction=Object.freeze({
  capability:'money.autonomous.mandate.activate',provider:x.provider,accountId:x.accountId,
  currency:x.currency,mode:'LIVE_AUTONOMOUS',allowedInstrumentPrefixes:Object.freeze([...x.instrumentPrefixes]),
  allowedStrategyIds:Object.freeze([...x.strategies]),allowOpeningShorts:x.allowOpeningShorts,
  maxOrderNotionalMinor:String(x.limits.maxOrderNotionalMinor),
  maxDailySubmittedNotionalMinor:String(x.limits.maxDailySubmittedNotionalMinor),
  maxDailyOrders:x.limits.maxDailyOrders,maxDailyRealizedLossMinor:String(x.limits.maxDailyRealizedLossMinor),
  maxGrossExposureMinor:String(x.limits.maxGrossExposureMinor),
  maxDrawdownBps:x.limits.maxDrawdownBps,maxLeverageBps:x.limits.maxLeverageBps,
  minModelConfidenceBps:Math.max(policy.minConfidenceBps,x.limits.minModelConfidenceBps),
  startsAt:x.startsAt,expiresAt:x.expiresAt,
 })
 return Object.freeze({proposalId:'purse-live-mandate-draft:'+hash({charterId:c.charterId,custody:d.reviewId,action}),
  charterId:c.charterId,userId:c.userId,cofferId:c.cofferId,provider:x.provider,accountId:x.accountId,lane:x.lane,
  action,maximumReviewableCustodyMinor:cap,ownerDestinationId:c.verifiedOwnerPayoutDestinationId,
  evidenceIds:Object.freeze([...new Set([...d.evidenceIds,...c.evidenceIds])].sort()),
  approvalReceiptId:null,status:'OWNER_REVIEW_REQUIRED',authority:'MANDATE_PROPOSAL_ONLY',
  requiresActionCoreApproval:true,canActivate:false,canExecute:false,canMoveMoney:false})
}
