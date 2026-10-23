import type {SniperIngressBatchReceipt} from './sniper-live-ingress'
/** COMMISSION.19: characterize actual observed webhook receipt samples,
 * not order/submission/exit measurements. Provider timestamps are whole
 * seconds, so a 600ms displayed lag cannot certify a subsecond SLA.
 */
export type SniperWebhookTiming=Readonly<{
 version:'SHARK-SNIPER.COMMISSION.19'
 observedLaunches:number;acceptedEvents:number;persistedEvents:number
 duplicateEvents:number;ignoredEvents:number
 processingMs?:Readonly<{p50:number;p95:number;p99:number}>
 providerTimestampToReceiptMs?:Readonly<{p50:number;p95:number;p99:number}>
 stage:'PROVISIONAL_WEBHOOK_TO_PERSIST'
 providerTimeResolution:'SECONDS'
 meetsSubsecondEndToEndSla:false
 observedTradeSubmissions:0
 observedOnchainExits:0
 authority:'LATENCY_EVIDENCE_ONLY'
 canTrade:false
}>
const percentiles=(samples:readonly number[])=>{
 if(!samples.length)return undefined
 const a=[...samples].sort((x,y)=>x-y)
 const q=(n:number)=>a[Math.ceil(n*a.length)-1]!
 return Object.freeze({p50:q(.5),p95:q(.95),p99:q(.99)})
}
export function summarizeSniperWebhookTiming(
 receipts:readonly SniperIngressBatchReceipt[],
):SniperWebhookTiming{
 if(receipts.length>10000)throw Error('SNIPER_WEBHOOK_SAMPLE_BOUNDS_INVALID')
 let accepted=0,persisted=0,ignored=0,duplicates=0
 const processing:number[]=[],provider:number[]=[]
 for(const batch of receipts){
  if(batch.authority!=='INGRESS_EVIDENCE_ONLY'||batch.canExecute!==false||
     batch.received<0||batch.accepted<0||batch.persisted<0||
     batch.ignored<0||batch.duplicates<0||
     batch.accepted+batch.ignored+batch.duplicates!==batch.received||
     batch.persisted>batch.accepted||batch.launches.length!==batch.persisted){
   throw Error('SNIPER_WEBHOOK_SAMPLE_PROVENANCE_INVALID')
  }
  accepted+=batch.accepted;persisted+=batch.persisted
  ignored+=batch.ignored;duplicates+=batch.duplicates
  for(const item of batch.launches){
   if(item.verification!=='PROVISIONAL_UNVERIFIED'||!Number.isFinite(item.discoveryDelayMs)||
     item.discoveryDelayMs<0||!Number.isFinite(item.localProcessingMs)||
     item.localProcessingMs<0){
    throw Error('SNIPER_WEBHOOK_SAMPLE_PROVENANCE_INVALID')
   }
   provider.push(item.discoveryDelayMs)
   processing.push(item.localProcessingMs)
  }
 }
 return Object.freeze({
  version:'SHARK-SNIPER.COMMISSION.19',
  observedLaunches:provider.length,
  acceptedEvents:accepted,persistedEvents:persisted,
  duplicateEvents:duplicates,ignoredEvents:ignored,
  ...(processing.length?{processingMs:percentiles(processing)}:{}),
  ...(provider.length?{providerTimestampToReceiptMs:percentiles(provider)}:{}),
  stage:'PROVISIONAL_WEBHOOK_TO_PERSIST',
  providerTimeResolution:'SECONDS',
  meetsSubsecondEndToEndSla:false,
  observedTradeSubmissions:0,observedOnchainExits:0,
  authority:'LATENCY_EVIDENCE_ONLY',canTrade:false,
 })
}
