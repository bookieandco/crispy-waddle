import {
 SniperFastpathDiscoveryIntake,type FastpathDiscoveryReceipt,
 type HeliusLaunchWebhookEvent,type SolanaLaunchCollection,
} from '@jhadina/shark-intelligence-core/meme-trader'

export type SniperIngressPersistResult=Readonly<{launchId:string;persistedEdges:number}>
export type SniperIngressItem=Readonly<{
  launchId:string;observationId:string;tokenAddress:string;signature?:string;slot?:number
  discoveryDelayMs:number;localProcessingMs:number;verification:'PROVISIONAL_UNVERIFIED'
}>
export type SniperIngressBatchReceipt=Readonly<{
  received:number;accepted:number;ignored:number;duplicates:number;persisted:number
  launches:readonly SniperIngressItem[]
  authority:'INGRESS_EVIDENCE_ONLY';canExecute:false
}>
/**
 * LIVE-WIRING.01. Existing authenticated Helius route remains the only HTTP
 * boundary. Input receipts are provisional: neither webhook transport nor
 * timestamps independently prove the chain event.
 *
 * Durable Supabase launch upserts remain the cross-instance idempotency layer.
 * The in-memory intake only deduplicates within a warm worker / batch.
 */
export async function persistSniperHeliusBatch(input:{
  events:readonly unknown[]
  receivedAt:string
  intake:SniperFastpathDiscoveryIntake
  clock:()=>number
  persist:(launch:SolanaLaunchCollection)=>Promise<SniperIngressPersistResult>
  concurrency?:number
}):Promise<SniperIngressBatchReceipt>{
 const concurrency=input.concurrency??8
 if(!Number.isSafeInteger(concurrency)||concurrency<1||concurrency>16||input.events.length>500){
  throw new Error('SNIPER_INGRESS_BOUNDS_INVALID')
 }
 const accepted:Array<{collection:SolanaLaunchCollection;receipt:FastpathDiscoveryReceipt}>=[]
 let ignored=0,duplicates=0
 for(const value of input.events){
  if(!value||typeof value!=='object'||Array.isArray(value)){ignored++;continue}
  const event=value as HeliusLaunchWebhookEvent
  // Transfers alone do not prove a new launch.
  if(event.type!=='TOKEN_MINT'&&!event.events?.token?.mint){ignored++;continue}
  const started=input.clock()
  const result=input.intake.ingest(event,{receivedAt:input.receivedAt,startedMonotonicMs:started,finishedMonotonicMs:input.clock()})
  if(result.disposition==='DUPLICATE'){duplicates++;continue}
  if(result.disposition!=='OBSERVED'||!result.receipt){ignored++;continue}
  // Canonical collector may return null for unrecognized non-mint evidence.
  // Reuse the collection from one normalized launch identity, not a second parser.
  const collection=(await import('@jhadina/shark-intelligence-core/meme-trader')).collectHeliusLaunch(event)
  if(!collection){ignored++;continue}
  accepted.push({collection,receipt:result.receipt})
 }
 const launches:SniperIngressItem[]=[]
 for(let offset=0;offset<accepted.length;offset+=concurrency){
  const chunk=accepted.slice(offset,offset+concurrency)
  const persisted=await Promise.all(chunk.map(async entry=>{
   const saved=await input.persist(entry.collection)
   return Object.freeze({
    launchId:saved.launchId,
    observationId:entry.collection.observation.observationId,
    tokenAddress:entry.collection.observation.tokenAddress,
    signature:entry.collection.signature,
    slot:entry.collection.slot,
    discoveryDelayMs:entry.receipt.discoveryDelayMs,
    localProcessingMs:entry.receipt.elapsedProcessingMs,
    verification:'PROVISIONAL_UNVERIFIED' as const,
   })
  }))
  launches.push(...persisted)
 }
 return Object.freeze({
  received:input.events.length,accepted:accepted.length,ignored,duplicates,
  persisted:launches.length,launches:Object.freeze(launches),
  authority:'INGRESS_EVIDENCE_ONLY',canExecute:false,
 })
}
