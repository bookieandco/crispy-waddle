import {createHash} from 'node:crypto'
import {assertJhadinaPurseCharter,type JhadinaPurseCharter} from './jhadina-purse-charter.js'
import type {CofferTreasurySnapshot} from './coffer-treasury-contracts.js'
import type {CofferAccountantDecision} from './coffer-accountant.js'
import type {PurseLiquiditySnapshot} from './purse-liquidity.js'

export type PurseRealCustodyReadback=Readonly<{
 ownerUserId:string
 cofferId:string
 provider:string
 custodyAccountId:string
 verifiedOwnerDestinationId:string
 currency:string
 settledAvailableMinor:bigint
 reservedAtProviderMinor:bigint
 observedAt:string
 sourceEventIds:readonly string[]
 providerAccountVerificationId:string
 transferSettlementReceiptId:string
 verifier:string
 evidenceClass:'REAL_SETTLED_PROVIDER_OBSERVATION'
 synthetic:false
 authority:'CUSTODY_READBACK_ONLY'
 canMoveMoney:false
}>
export type PurseLiveCustodyReview=Readonly<{
 reviewId:string
 ownerUserId:string
 cofferId:string
 status:'BLOCKED'|'EVIDENCE_REVIEW_REQUIRED'
 maximumReviewableDeployableMinor:bigint
 blockers:readonly string[]
 evidenceIds:readonly string[]
 authority:'POTENTIAL_CUSTODY_EVIDENCE_ONLY'
 canFund:false
 canTrade:false
 canMoveMoney:false
 independentlyCertified:false
}>
const isFresh=(t:string,n:string)=>Number.isFinite(Date.parse(t))&&t<=n&&Date.parse(n)-Date.parse(t)<=300000
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const min=(a:bigint,b:bigint)=>a<b?a:b
/** Structural assessment, not provider-authentication. Never promote this review to a signed execution permit. */
export function reviewPurseRealCustody(input:{
 charter:JhadinaPurseCharter;treasury:CofferTreasurySnapshot
 liquidity:PurseLiquiditySnapshot;accountant:CofferAccountantDecision
 custody:PurseRealCustodyReadback|null;now:string
}):PurseLiveCustodyReview{
 const {charter:c,treasury:t,liquidity:l,accountant:a,custody:d,now}=input
 assertJhadinaPurseCharter(c,now)
 const blockers:string[]=[]
 if(t.authority!=='TREASURY_ACCOUNTING_EVIDENCE'||t.canMoveMoney!==false||
   t.cofferId!==c.cofferId||t.userId!==c.userId||t.reportingCurrency!==c.reportingCurrency||
   !isFresh(t.observedAt,now)||!t.evidenceIds.length)blockers.push('TREASURY_EVIDENCE_NOT_CURRENT_OR_OWNER_BOUND')
 if(l.authority!=='LIQUIDITY_EVIDENCE'||l.canExecute!==false||l.charterId!==c.charterId||
   l.reportingCurrency!==c.reportingCurrency||!isFresh(l.observedAt,now)||!l.evidenceIds.length)
   blockers.push('SPENDABLE_LIQUIDITY_NOT_VERIFIED')
 if(a.authority!=='ACCOUNTANT_DECISION_ONLY'||a.canMoveMoney!==false||a.cofferId!==c.cofferId||
   a.survivalState!=='ACTIVE')blockers.push('COFFER_FLOORS_OR_ACCOUNTANT_BLOCK')
 if(c.autonomyMode!=='LIVE_GOVERNED_INTENTS')blockers.push('OWNER_LIVE_CHARTER_NOT_ACTIVE')
 if(!c.ownerProfitSweepProtected||!c.verifiedOwnerPayoutDestinationId)blockers.push('OWNER_PROFIT_SWEEP_UNPROTECTED')
 if(!d)blockers.push('SETTLED_PROVIDER_CUSTODY_MISSING')
 else{
  if(d.ownerUserId!==c.userId||d.cofferId!==c.cofferId||d.currency!==c.reportingCurrency||
     d.verifiedOwnerDestinationId!==c.verifiedOwnerPayoutDestinationId)blockers.push('CUSTODY_OWNER_PAYOUT_BINDING_INVALID')
  if(d.authority!=='CUSTODY_READBACK_ONLY'||d.canMoveMoney!==false||d.synthetic!==false||
    d.evidenceClass!=='REAL_SETTLED_PROVIDER_OBSERVATION'||!d.provider.trim()||
    !d.custodyAccountId.trim()||!d.verifier.trim()||!d.providerAccountVerificationId.trim()||
    !d.transferSettlementReceiptId.trim()||!d.sourceEventIds.length||!isFresh(d.observedAt,now))
      blockers.push('CUSTODY_PROVENANCE_OR_FRESHNESS_MISSING')
  if(d.settledAvailableMinor<0n||d.reservedAtProviderMinor<0n||
    d.reservedAtProviderMinor>d.settledAvailableMinor)blockers.push('PROVIDER_FUNDS_INSUFFICIENT_OR_INVALID')
 }
 const available=d&&d.settledAvailableMinor>=d.reservedAtProviderMinor
  ?d.settledAvailableMinor-d.reservedAtProviderMinor:0n
 const limit=blockers.length?0n:[available,t.deployableReportingValueMinor,l.availableToAllocateMinor,a.deployableCashMinor]
   .reduce((m,x)=>min(m,x))
 const evidenceIds=Object.freeze([...new Set([...c.evidenceIds,...t.evidenceIds,...l.evidenceIds,
   ...(d?[d.providerAccountVerificationId,d.transferSettlementReceiptId,...d.sourceEventIds]:[])])].sort())
 return Object.freeze({
  reviewId:'purse-custody:'+digest({charter:c.charterId,now,source:d?.transferSettlementReceiptId,blockers}),
  ownerUserId:c.userId,cofferId:c.cofferId,status:blockers.length?'BLOCKED':'EVIDENCE_REVIEW_REQUIRED',
  maximumReviewableDeployableMinor:limit>0n?limit:0n,blockers:Object.freeze([...new Set(blockers)].sort()),
  evidenceIds,authority:'POTENTIAL_CUSTODY_EVIDENCE_ONLY',canFund:false,canTrade:false,
  canMoveMoney:false,independentlyCertified:false,
 })
}
