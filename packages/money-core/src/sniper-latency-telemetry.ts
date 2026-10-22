export const SNIPER_LATENCY_VERSION='SHARK-SNIPER.FASTPATH.05' as const
export type SniperStage='EVENT_RECEIVED'|'FEATURES_READY'|'SAFETY_READY'|'QUOTE_READY'|'MONEY_PREFLIGHT_READY'|'SUBMITTED'|'LANDED'|'CONFIRMED'|'EXIT_QUOTED'|'EXIT_LANDED'
const order:readonly SniperStage[]=['EVENT_RECEIVED','FEATURES_READY','SAFETY_READY','QUOTE_READY','MONEY_PREFLIGHT_READY','SUBMITTED','LANDED','CONFIRMED','EXIT_QUOTED','EXIT_LANDED']
export type SniperLatencyStamp=Readonly<{stage:SniperStage;monotonicMs:number;wallClock:string;evidenceId:string}>
export type SniperLatencyReceipt=Readonly<{
 tradeId:string
 version:typeof SNIPER_LATENCY_VERSION
 stages:readonly SniperLatencyStamp[]
 intervalsMs:Readonly<Record<string,number>>
 endToEndMs:number
 scope:'FIRST_TO_LAST_RECORDED_STAGE'
 authority:'LATENCY_EVIDENCE_ONLY'
 canExecute:false
}>
/** Caller supplies the local monotonic clock (performance.now/clock_gettime).
 * No wall-clock subtraction is used for local latency, and missing stages never
 * get silently interpolated. Submission/landing are separate from discovery. */
export function buildSniperLatencyReceipt(tradeId:string,stages:readonly SniperLatencyStamp[]):SniperLatencyReceipt{
 if(!tradeId.trim()||stages.length<2)throw new Error('SNIPER_LATENCY_STAGES_REQUIRED')
 let previousIndex=-1,previousTime=-Infinity
 for(const stamp of stages){
  const index=order.indexOf(stamp.stage)
  if(index<0||index<=previousIndex||!Number.isFinite(stamp.monotonicMs)||stamp.monotonicMs<previousTime||
    Number.isNaN(Date.parse(stamp.wallClock))||!stamp.evidenceId.trim())throw new Error('SNIPER_LATENCY_NONMONOTONIC_OR_INCOMPLETE')
  previousIndex=index
  previousTime=stamp.monotonicMs
 }
 const intervalsMs:Record<string,number>={}
 for(let i=1;i<stages.length;i++){
  intervalsMs[`${stages[i-1]!.stage}->${stages[i]!.stage}`]=stages[i]!.monotonicMs-stages[i-1]!.monotonicMs
 }
 return Object.freeze({
  tradeId,version:SNIPER_LATENCY_VERSION,stages:Object.freeze([...stages]),
  intervalsMs:Object.freeze(intervalsMs),endToEndMs:stages[stages.length-1]!.monotonicMs-stages[0]!.monotonicMs,
  scope:'FIRST_TO_LAST_RECORDED_STAGE',authority:'LATENCY_EVIDENCE_ONLY',canExecute:false,
 })
}
export function summarizeSniperLatency(receipts:readonly SniperLatencyReceipt[]):Readonly<{
 count:number;p50Ms?:number;p95Ms?:number;scope:'OBSERVED_ONLY'
}>{
 const data=receipts.map(x=>x.endToEndMs).sort((a,b)=>a-b)
 const pct=(p:number)=>data[Math.ceil(p*data.length)-1]
 return Object.freeze({
  count:data.length,p50Ms:data.length?pct(.5):undefined,p95Ms:data.length?pct(.95):undefined,scope:'OBSERVED_ONLY',
 })
}
