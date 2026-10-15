import {createHash} from 'node:crypto'
import {
  proposeBusinessProfitWaterfall,
  type BusinessProfitPolicy,
  type BusinessProfitPeriod,
  type BusinessProfitProposal,
} from './biz-purse-profit-waterfall.js'

/**
 * BIZ-PURSE.18 - accounting-research projection of an append-only evidence log.
 * This module has NO I/O, trust root, connection to Stripe/Supabase, or
 * execution capability. Self-asserted readback flags are NOT certificates.
 */
export type BusinessProfitLedgerKind =
  |'CUSTOMER_SETTLEMENT'
  |'CUSTOMER_REFUND'
  |'CUSTOMER_CHARGEBACK'
  |'DIRECT_COST'
  |'PROVIDER_FEE'
  |'TAX_AND_OBLIGATION_PROVISION'
  |'PRIOR_ALLOCATED_PROFIT'
  |'OWNER_SEED_CAPITAL'
  |'UNSETTLED_ORDER'
  |'SETTLED_CASH_READBACK'
  |'OTHER_RESERVED_CASH_READBACK'
export type BusinessProfitLedgerEvent=Readonly<{
  eventId:string
  sequence:number
  ownerUserId:string
  businessId:string
  periodId:string
  currency:string
  kind:BusinessProfitLedgerKind
  mode:'LIVE_UNCOMMISSIONED'|'STRIPE_TEST'|'SYNTHETIC'
  amountMinor:bigint
  observedAt:string
  evidenceId:string
  providerPaymentId?:string
  providerEventId?:string
  linkedPaymentId?:string
  independentReadbackClaimed:boolean
}>
export type BusinessProfitLedgerInput=Readonly<{
  ownerUserId:string
  businessId:string
  periodId:string
  currency:string
  asOf:string
  policy:BusinessProfitPolicy
  events:readonly BusinessProfitLedgerEvent[]
}>
export type BusinessProfitLedgerReview=Readonly<{
  ownerUserId:string
  businessId:string
  periodId:string
  currency:string
  eventCount:number
  quarantinedCount:number
  seedCapitalExcludedMinor:bigint
  unsettledOrderExcludedMinor:bigint
  syntheticOrTestExcludedMinor:bigint
  settledRevenueCandidateMinor:bigint
  refundsAndChargebacksCandidateMinor:bigint
  directCostsCandidateMinor:bigint
  feesCandidateMinor:bigint
  taxProvisionCandidateMinor:bigint
  previouslyAllocatedCandidateMinor:bigint
  grossAccountingDeficitMinor:bigint
  provisionalWaterfall:BusinessProfitProposal|null
  reasons:readonly string[]
  status:'BLOCKED'|'REVIEW_ONLY_NOT_COMMISSIONED'
  ledgerDigest:string
  authority:'ACCOUNTING_RESEARCH_ONLY'
  providerSettlementCertified:false
  ownerEntitlementPayable:false
  reinvestmentAuthorized:false
  canPostJournal:false
  canMoveMoney:false
  canTrade:false
}>
const valid=(s:unknown):s is string=>typeof s==='string'&&s.length>0&&s.length<=256&&s.trim()===s
const date=(s:string)=>Date.parse(s)
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value,(_k,v)=>typeof v==='bigint'?v.toString():v)).digest('hex')
const paymentKind=(kind:BusinessProfitLedgerKind)=>kind==='CUSTOMER_SETTLEMENT'||kind==='CUSTOMER_REFUND'||kind==='CUSTOMER_CHARGEBACK'

export function projectBusinessProfitLedger(input:BusinessProfitLedgerInput):BusinessProfitLedgerReview{
 if(!input||!valid(input.ownerUserId)||!valid(input.businessId)||!valid(input.periodId)||
    !valid(input.currency)||!Number.isFinite(date(input.asOf))||!Array.isArray(input.events)||
    input.events.length===0||input.events.length>5000)
   throw new Error('BIZ_PURSE_18_LEDGER_SCOPE_INVALID')
 if(input.policy.authority!=='OWNER_POLICY'||input.policy.currency!==input.currency)
   throw new Error('BIZ_PURSE_18_POLICY_CURRENCY_INVALID')
 const seen=new Map<string,string>(),reasons:string[]=[]
 const uniqueEvidence=new Set<string>(),providerEventIds=new Set<string>()
 const settlements=new Map<string,{amount:bigint;reversed:bigint}>()
 const sums={revenue:0n,reversals:0n,costs:0n,fees:0n,tax:0n,prior:0n,seed:0n,unsettled:0n,excluded:0n}
 let previousTime=-Infinity,sequence=1,quarantined=0
 let settledCash:bigint|null=null,reservedCash:bigint|null=null,cashAt:number|null=null,reservedAt:number|null=null
 for(const e of input.events){
  if(!e||!valid(e.eventId)||!Number.isSafeInteger(e.sequence)||
     !valid(e.evidenceId)||!valid(e.observedAt)||!Number.isFinite(date(e.observedAt))||
     e.ownerUserId!==input.ownerUserId||e.businessId!==input.businessId||
     e.periodId!==input.periodId||e.currency!==input.currency||
     !['LIVE_UNCOMMISSIONED','STRIPE_TEST','SYNTHETIC'].includes(e.mode)||
     !['CUSTOMER_SETTLEMENT','CUSTOMER_REFUND','CUSTOMER_CHARGEBACK','DIRECT_COST',
       'PROVIDER_FEE','TAX_AND_OBLIGATION_PROVISION','PRIOR_ALLOCATED_PROFIT',
       'OWNER_SEED_CAPITAL','UNSETTLED_ORDER','SETTLED_CASH_READBACK',
       'OTHER_RESERVED_CASH_READBACK'].includes(e.kind)||
     typeof e.amountMinor!=='bigint'||e.amountMinor<0n||
     typeof e.independentReadbackClaimed!=='boolean')
    throw new Error('BIZ_PURSE_18_INVALID_OR_CROSS_TENANT_EVENT')
  const fingerprint=digest(e),prior=seen.get(e.eventId)
  if(prior!==undefined){
   if(prior!==fingerprint)throw new Error('BIZ_PURSE_18_EVENT_ID_REPLAY_CONFLICT')
   continue
  }
  if(e.sequence!==sequence++)throw new Error('BIZ_PURSE_18_EVENT_SEQUENCE_GAP')
  const at=date(e.observedAt)
  if(at<previousTime||at>date(input.asOf))throw new Error('BIZ_PURSE_18_EVENT_TIME_REVERSED_OR_FUTURE')
  previousTime=at
  if(uniqueEvidence.has(e.evidenceId))throw new Error('BIZ_PURSE_18_DUPLICATE_SOURCE_EVIDENCE')
  uniqueEvidence.add(e.evidenceId);seen.set(e.eventId,fingerprint)
  if(paymentKind(e.kind)){
   if(!valid(e.providerPaymentId)||!valid(e.providerEventId))
    throw new Error('BIZ_PURSE_18_PROVIDER_IDENTIFIERS_REQUIRED')
   if(providerEventIds.has(e.providerEventId))
    throw new Error('BIZ_PURSE_18_PROVIDER_EVENT_REUSED')
   providerEventIds.add(e.providerEventId)
  }else if(e.providerPaymentId!==undefined||e.providerEventId!==undefined||e.linkedPaymentId!==undefined){
   throw new Error('BIZ_PURSE_18_NONPAYMENT_PROVIDER_ID')
  }
  if(e.mode!=='LIVE_UNCOMMISSIONED'){
   sums.excluded+=e.amountMinor;quarantined++
   reasons.push('SYNTHETIC_OR_STRIPE_TEST_EVIDENCE_QUARANTINED')
   continue
  }
  if(!e.independentReadbackClaimed){
   quarantined++;reasons.push('UNVERIFIED_ACCOUNTING_EVIDENCE_QUARANTINED')
   continue
  }
  if(e.kind==='OWNER_SEED_CAPITAL'){sums.seed+=e.amountMinor;continue}
  if(e.kind==='UNSETTLED_ORDER'){sums.unsettled+=e.amountMinor;continue}
  if(e.kind==='SETTLED_CASH_READBACK'){
   settledCash=e.amountMinor;cashAt=at;continue
  }
  if(e.kind==='OTHER_RESERVED_CASH_READBACK'){
   reservedCash=e.amountMinor;reservedAt=at;continue
  }
  if(e.kind==='CUSTOMER_SETTLEMENT'){
   if(e.amountMinor===0n||settlements.has(e.providerPaymentId!))
    throw new Error('BIZ_PURSE_18_SETTLEMENT_DUPLICATED_OR_ZERO')
   settlements.set(e.providerPaymentId!,{amount:e.amountMinor,reversed:0n})
   sums.revenue+=e.amountMinor;continue
  }
  if(e.kind==='CUSTOMER_REFUND'||e.kind==='CUSTOMER_CHARGEBACK'){
   const settlement=settlements.get(e.providerPaymentId!)
   if(!settlement||e.linkedPaymentId!==e.providerPaymentId||
     e.amountMinor===0n||settlement.reversed+e.amountMinor>settlement.amount)
    throw new Error('BIZ_PURSE_18_ORPHAN_OR_EXCESS_REFUND')
   settlement.reversed+=e.amountMinor;sums.reversals+=e.amountMinor;continue
  }
  if(e.kind==='DIRECT_COST')sums.costs+=e.amountMinor
  else if(e.kind==='PROVIDER_FEE')sums.fees+=e.amountMinor
  else if(e.kind==='TAX_AND_OBLIGATION_PROVISION')sums.tax+=e.amountMinor
  else if(e.kind==='PRIOR_ALLOCATED_PROFIT')sums.prior+=e.amountMinor
 }
 if(settledCash===null||reservedCash===null)reasons.push('INDEPENDENT_CASH_AND_RESERVE_READBACK_REQUIRED')
 else {
  if(settledCash<reservedCash)reasons.push('RESERVES_EXCEED_SETTLED_CASH')
  if(cashAt===null||reservedAt===null||date(input.asOf)-cashAt>86400000||
     date(input.asOf)-reservedAt>86400000)
    reasons.push('CASH_READBACK_STALE')
 }
 if(sums.revenue===0n)reasons.push('NO_LIVE_SETTLEMENT_CANDIDATE')
 const remaining=sums.revenue-sums.reversals-sums.costs-sums.fees-sums.tax-sums.prior
 const grossDeficit=remaining<0n?-remaining:0n
 if(grossDeficit>0n)reasons.push('ACCOUNTING_REVERSAL_DEFICIT')
 // This adapter does not own a provider trust root. Even claimed live readbacks
 // must never be promoted to actual disbursement or spendable cash.
 reasons.push('LIVE_PROVIDER_AND_CUSTODY_COMMISSIONING_NOT_VERIFIED')
 const blockers=new Set(reasons)
 let proposal:BusinessProfitProposal|null=null
 if(settledCash!==null&&reservedCash!==null&&
    !blockers.has('INDEPENDENT_CASH_AND_RESERVE_READBACK_REQUIRED')&&
    !blockers.has('RESERVES_EXCEED_SETTLED_CASH')&&
    !blockers.has('CASH_READBACK_STALE')&&sums.revenue>0n&&quarantined===0){
  const period:BusinessProfitPeriod={
   businessId:input.businessId,periodId:input.periodId,currency:input.currency,
   settledRevenueMinor:sums.revenue,refundsMinor:sums.reversals,
   directCostsMinor:sums.costs,providerFeesMinor:sums.fees,
   taxAndObligationProvisionMinor:sums.tax,previouslyAllocatedProfitMinor:sums.prior,
   settledCashMinor:settledCash,otherReservedCashMinor:reservedCash+sums.seed,
   observedAt:input.asOf,evidenceIds:[...uniqueEvidence].sort(),
   authority:'SETTLED_ACCOUNTING_EVIDENCE',
  }
  proposal=proposeBusinessProfitWaterfall({policy:input.policy,period})
 }
 const ledgerDigest=digest({scope:[input.ownerUserId,input.businessId,input.periodId,input.currency],
  observedAt:input.asOf,events:[...seen.values()],policy:input.policy})
 return Object.freeze({
  ownerUserId:input.ownerUserId,businessId:input.businessId,periodId:input.periodId,
  currency:input.currency,eventCount:seen.size,quarantinedCount:quarantined,
  seedCapitalExcludedMinor:sums.seed,unsettledOrderExcludedMinor:sums.unsettled,
  syntheticOrTestExcludedMinor:sums.excluded,
  settledRevenueCandidateMinor:sums.revenue,
  refundsAndChargebacksCandidateMinor:sums.reversals,
  directCostsCandidateMinor:sums.costs,feesCandidateMinor:sums.fees,
  taxProvisionCandidateMinor:sums.tax,previouslyAllocatedCandidateMinor:sums.prior,
  grossAccountingDeficitMinor:grossDeficit,
  provisionalWaterfall:proposal,
  reasons:Object.freeze([...new Set(reasons)]),
  status:reasons.some(r=>r!=='LIVE_PROVIDER_AND_CUSTODY_COMMISSIONING_NOT_VERIFIED')
    ?'BLOCKED' as const:'REVIEW_ONLY_NOT_COMMISSIONED' as const,
  ledgerDigest,
  authority:'ACCOUNTING_RESEARCH_ONLY' as const,
  providerSettlementCertified:false as const,ownerEntitlementPayable:false as const,
  reinvestmentAuthorized:false as const,canPostJournal:false as const,
  canMoveMoney:false as const,canTrade:false as const,
 })
}
