/** LIVE-COMMISSION.48/.49 prospective source-to-paper-denominator audit.
 * No trading or API access. Ingress tokens alone are not chain coverage.
 */
export type SniperProspectiveEvent=Readonly<{
 eventId:string;signature:string;mint:string;receivedAt:string
 riskCompletedAt?:string;quoteReceivedAt?:string;paperDecisionAt?:string
 exitObservationAt?:string
 chainMintIndependentlyVerified:boolean
 exitRouteIndependentlyVerified:boolean
 result:'PAPER_ONLY'|'SKIPPED_EXPIRED'|'BLOCKED_RISK'|
  'BLOCKED_ROUTE'|'BLOCKED_UNKNOWN'|'NO_PRICE'
 evidenceIds:readonly string[]
}>
export type SniperSourceCohort=Readonly<{
 version:'SHARK-SNIPER.LIVE-COMMISSION.48'
 observedEvents:number;chainVerifiedEvents:number
 exitedOrObservedEvents:number;unverifiedEvents:number
 skippedOrBlockedEvents:number;missingDecisionEvents:number
 receiptToRiskMs?:Readonly<{p50:number;p95:number;p99:number}>
 receiptToQuoteMs?:Readonly<{p50:number;p95:number;p99:number}>
 receiptToPaperDecisionMs?:Readonly<{p50:number;p95:number;p99:number}>
 realEventToConfirmedExitSla:'NOT_ESTABLISHED'
 samplesAreRealTransactions:false
 canSign:false;canExecute:false;canCreditPurse:false
 authority:'SOURCE_PAPER_COHORT_ONLY'
}>
const ms=(date:string)=>Date.parse(date)
const percentile=(v:readonly number[])=>{
 if(!v.length)return undefined
 const sorted=[...v].sort((a,b)=>a-b)
 const p=(fraction:number)=>sorted[Math.ceil(fraction*sorted.length)-1]!
 return Object.freeze({p50:p(.5),p95:p(.95),p99:p(.99)})
}
export function summarizeSniperProspectiveCohort(
 events:readonly SniperProspectiveEvent[],
):SniperSourceCohort{
 if(events.length>100000)throw Error('SNIPER_COHORT_CAPACITY_INVALID')
 const seen=new Set<string>(),risk:number[]=[],quote:number[]=[],decision:number[]=[]
 let chainVerified=0,observedExit=0,skipped=0,missing=0
 for(const event of events){
  const receipt=ms(event.receivedAt)
  if(!event.eventId.trim()||!event.signature.trim()||!event.mint.trim()||
    !event.evidenceIds.length||seen.has(event.eventId)||
    !Number.isFinite(receipt)){
   throw Error('SNIPER_COHORT_IDENTITY_OR_EVIDENCE_INVALID')
  }
  seen.add(event.eventId)
  const times=[event.riskCompletedAt,event.quoteReceivedAt,
   event.paperDecisionAt,event.exitObservationAt].map(d=>d?ms(d):undefined)
  let previous=receipt
  for(const v of times){
   if(v===undefined)continue
   if(!Number.isFinite(v)||v<previous)throw Error('SNIPER_COHORT_NONMONOTONIC_CLOCK')
   previous=v
  }
  const [r,q,d,x]=times
  if(r!==undefined)risk.push(r-receipt)
  if(q!==undefined)quote.push(q-receipt)
  if(d!==undefined)decision.push(d-receipt)
  if(event.chainMintIndependentlyVerified)chainVerified++
  if(x!==undefined&&event.exitRouteIndependentlyVerified)observedExit++
  if(event.result!=='PAPER_ONLY')skipped++
  if(d===undefined)missing++
 }
 return Object.freeze({
  version:'SHARK-SNIPER.LIVE-COMMISSION.48',
  observedEvents:events.length,chainVerifiedEvents:chainVerified,
  exitedOrObservedEvents:observedExit,unverifiedEvents:events.length-chainVerified,
  skippedOrBlockedEvents:skipped,missingDecisionEvents:missing,
  ...(risk.length?{receiptToRiskMs:percentile(risk)}:{}),
  ...(quote.length?{receiptToQuoteMs:percentile(quote)}:{}),
  ...(decision.length?{receiptToPaperDecisionMs:percentile(decision)}:{}),
  realEventToConfirmedExitSla:'NOT_ESTABLISHED',
  samplesAreRealTransactions:false,
  canSign:false,canExecute:false,canCreditPurse:false,
  authority:'SOURCE_PAPER_COHORT_ONLY',
 })
}
