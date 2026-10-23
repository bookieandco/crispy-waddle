/**
 * SHARK-SNIPER.FASTLANE.01: deterministic, O(1), source-time-aware paper
 * admission clock. This contract is NOT a running worker, execution permit,
 * RPC attestation, or a guarantee about inclusion/exit.
 *
 * Provider event timestamps may have second resolution; do not turn an
 * apparent 0.6s provider-to-receipt observation into an end-to-end SLA.
 */
export type SniperFastlanePolicy=Readonly<{
 maxOpportunityAgeMs:number
 maxProviderToReceiptMs:number
 maxRiskEvidenceAgeMs:number
 maxSelectedQuoteAgeMs:number
 minOrderRemainingMs:number
}>
export type SniperFastlaneDisposition=
 'ENTRY_WINDOW_OPEN'|'ENTRY_EXPIRED'|'REVIEW_MISSING_EVIDENCE'|'EXIT_PRIORITY'
export type SniperFastlaneDecision=Readonly<{
 version:'SHARK-SNIPER.FASTLANE.01'
 disposition:SniperFastlaneDisposition
 reasonCodes:readonly string[]
 providerToReceiptMs:number
 opportunityAgeMs:number
 riskEvidenceAgeMs:number
 selectedQuoteAgeMs?:number
 orderRemainingMs?:number
 authority:'TIMING_RESEARCH_ONLY'
 canSign:false
 canSubmit:false
 canExecute:false
 canCreditPurse:false
}>
export type SniperFastlaneInput=Readonly<{
 eventObservedAt:string
 serverReceivedAt:string
 riskEvidenceAvailableAt:string
 /** Only the quote for the selected Money route is eligible. */
 selectedQuoteAvailableAt?:string
 entryOrderExpiresAt?:string
 now:string
 hasOpenPosition:boolean
 unresolvedExitAttempt:boolean
 policy:SniperFastlanePolicy
}>
const toMs=(value:string):number=>{
 const n=Date.parse(value)
 if(!value.trim()||!Number.isFinite(n))throw new Error('SNIPER_FASTLANE_TIMESTAMP_INVALID')
 return n
}
const nonNegative=(value:number):boolean=>Number.isSafeInteger(value)&&value>=0
/** Never extend entry time merely because a signal is popular or a quote was refreshed. */
export function assessSniperFastlane(input:SniperFastlaneInput):SniperFastlaneDecision{
 const {policy:p}=input
 if(![p.maxOpportunityAgeMs,p.maxProviderToReceiptMs,p.maxRiskEvidenceAgeMs,
       p.maxSelectedQuoteAgeMs,p.minOrderRemainingMs].every(nonNegative)||
    p.maxOpportunityAgeMs===0||p.maxProviderToReceiptMs===0||
    p.maxRiskEvidenceAgeMs===0||p.maxSelectedQuoteAgeMs===0){
  throw new Error('SNIPER_FASTLANE_POLICY_INVALID')
 }
 const now=toMs(input.now),event=toMs(input.eventObservedAt)
 const received=toMs(input.serverReceivedAt),risk=toMs(input.riskEvidenceAvailableAt)
 if(event>received||received>now||event>risk||risk>now){
  throw new Error('SNIPER_FASTLANE_CHRONOLOGY_INVALID')
 }
 const quote=input.selectedQuoteAvailableAt===undefined?undefined:toMs(input.selectedQuoteAvailableAt)
 const expires=input.entryOrderExpiresAt===undefined?undefined:toMs(input.entryOrderExpiresAt)
 if(quote!==undefined&&(quote<event||quote>now)){
  throw new Error('SNIPER_FASTLANE_QUOTE_CHRONOLOGY_INVALID')
 }
 const reasons:string[]=[]
 const providerToReceiptMs=received-event
 const opportunityAgeMs=now-event
 const riskEvidenceAgeMs=now-risk
 const selectedQuoteAgeMs=quote===undefined?undefined:now-quote
 const orderRemainingMs=expires===undefined?undefined:expires-now
 // Open exposure and unresolved exits cannot be dropped because a new-coin
 // entry deadline has expired. The caller must route to the existing exit
 // sentinel and reconcile unknown outcomes before further actions.
 if(input.hasOpenPosition||input.unresolvedExitAttempt){
  reasons.push(input.unresolvedExitAttempt?'RECONCILE_UNRESOLVED_EXIT':'EXISTING_POSITION_EXIT_FIRST')
  return Object.freeze({
   version:'SHARK-SNIPER.FASTLANE.01',disposition:'EXIT_PRIORITY',
   reasonCodes:Object.freeze(reasons),providerToReceiptMs,opportunityAgeMs,
   riskEvidenceAgeMs,selectedQuoteAgeMs,orderRemainingMs,
   authority:'TIMING_RESEARCH_ONLY',canSign:false,canSubmit:false,
   canExecute:false,canCreditPurse:false,
  })
 }
 if(providerToReceiptMs>p.maxProviderToReceiptMs)reasons.push('PROVIDER_INGRESS_TOO_LATE')
 if(opportunityAgeMs>p.maxOpportunityAgeMs)reasons.push('OPPORTUNITY_ENTRY_WINDOW_EXPIRED')
 if(riskEvidenceAgeMs>p.maxRiskEvidenceAgeMs)reasons.push('RISK_EVIDENCE_EXPIRED')
 if(selectedQuoteAgeMs!==undefined&&selectedQuoteAgeMs>p.maxSelectedQuoteAgeMs){
  reasons.push('SELECTED_ROUTE_QUOTE_EXPIRED')
 }
 if(orderRemainingMs!==undefined&&orderRemainingMs<p.minOrderRemainingMs){
  reasons.push('ENTRY_ORDER_DEADLINE_TOO_CLOSE')
 }
 const missing=quote===undefined||expires===undefined
 if(quote===undefined)reasons.push('SELECTED_ROUTE_QUOTE_MISSING')
 if(expires===undefined)reasons.push('ENTRY_ORDER_DEADLINE_MISSING')
 const disposition:SniperFastlaneDisposition=reasons.some(r=>
   !r.endsWith('_MISSING'))?'ENTRY_EXPIRED':missing?'REVIEW_MISSING_EVIDENCE':'ENTRY_WINDOW_OPEN'
 return Object.freeze({
  version:'SHARK-SNIPER.FASTLANE.01',disposition,
  reasonCodes:Object.freeze(reasons),providerToReceiptMs,opportunityAgeMs,
  riskEvidenceAgeMs,selectedQuoteAgeMs,orderRemainingMs,
  authority:'TIMING_RESEARCH_ONLY',canSign:false,canSubmit:false,
  canExecute:false,canCreditPurse:false,
 })
}

/** A bounded, stable ordering of already-admitted work. This does not poll or
 * submit orders. Never starve exits behind speculative incoming launches. */
export type SniperQueueKind='RECONCILE_EXIT'|'MONITOR_EXIT'|'RESEARCH_ENTRY'
export type SniperQueuedItem=Readonly<{workId:string;kind:SniperQueueKind;queuedAt:string}>
export function orderSniperFastlaneWork(items:readonly SniperQueuedItem[],input:{
 now:string;maxItems:number;maxEntryQueueMs:number
}):Readonly<{ready:readonly SniperQueuedItem[];deferred:readonly string[];expiredEntries:readonly string[];canExecute:false}>{
 const now=toMs(input.now)
 if(!Number.isSafeInteger(input.maxItems)||input.maxItems<1||
    !nonNegative(input.maxEntryQueueMs)||items.length>4096){
  throw new Error('SNIPER_FASTLANE_QUEUE_BOUNDS_INVALID')
 }
 const seen=new Set<string>()
 const work:SniperQueuedItem[]=[],expiredEntries:string[]=[]
 for(const item of items){
  if(!item.workId.trim()||seen.has(item.workId))throw new Error('SNIPER_FASTLANE_QUEUE_ID_INVALID')
  seen.add(item.workId)
  if(!['RECONCILE_EXIT','MONITOR_EXIT','RESEARCH_ENTRY'].includes(item.kind)){
   throw new Error('SNIPER_FASTLANE_QUEUE_KIND_INVALID')
  }
  const queued=toMs(item.queuedAt)
  if(queued>now)throw new Error('SNIPER_FASTLANE_QUEUE_FUTURE_ITEM')
  if(item.kind==='RESEARCH_ENTRY'&&now-queued>input.maxEntryQueueMs){
   expiredEntries.push(item.workId)
  }else{
   work.push(item)
  }
 }
 const priority:Record<SniperQueueKind,number>={
  RECONCILE_EXIT:0,MONITOR_EXIT:1,RESEARCH_ENTRY:2,
 }
 work.sort((a,b)=>priority[a.kind]-priority[b.kind]||
  toMs(a.queuedAt)-toMs(b.queuedAt)||a.workId.localeCompare(b.workId))
 return Object.freeze({
  ready:Object.freeze(work.slice(0,input.maxItems)),
  deferred:Object.freeze(work.slice(input.maxItems).map(x=>x.workId)),
  expiredEntries:Object.freeze(expiredEntries),
  canExecute:false,
 })
}
