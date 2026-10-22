import { collectHeliusLaunch, type HeliusLaunchWebhookEvent, type SolanaLaunchCollectorConfig, type SolanaLaunchCollection } from './solana-launch-collector'

export const SNIPER_DISCOVERY_VERSION = 'SHARK-SNIPER.FASTPATH.04' as const
export type FastpathDiscoveryReceipt = Readonly<{
  version:typeof SNIPER_DISCOVERY_VERSION
  observationId:string
  mint:string
  signature?:string
  slot?:number
  providerObservedAt:string
  receivedAt:string
  discoveryDelayMs:number
  elapsedProcessingMs:number
  evidenceIds:readonly string[]
  verification:'PROVISIONAL_UNVERIFIED'
  authority:'DISCOVERY_EVIDENCE_ONLY'
  canTrade:false
}>
export type FastpathDiscoveryDisposition='OBSERVED'|'DUPLICATE'|'INVALID'|'DROPPED_CAPACITY'
export type FastpathDiscoveryResult=Readonly<{
  disposition:FastpathDiscoveryDisposition
  receipt?:FastpathDiscoveryReceipt
  reasonCodes:readonly string[]
  authority:'DISCOVERY_EVIDENCE_ONLY'
  canTrade:false
}>
export type FastpathDiscoveryConfig=Readonly<{
  collector?:SolanaLaunchCollectorConfig
  maxKeys?:number
  dedupeTtlMs?:number
  onObserved?:(receipt:FastpathDiscoveryReceipt,launch:SolanaLaunchCollection)=>void
}>
/**
 * Event-first intake adapter, NOT a running websocket or a live-trading service.
 * The authorized producer provides an already received launch payload. Source
 * claims must be verified independently against canonical program/slot evidence.
 */
export class SniperFastpathDiscoveryIntake {
  private readonly seen=new Map<string,number>()
  private readonly config:FastpathDiscoveryConfig
  constructor(config:FastpathDiscoveryConfig={}){
    this.config=config
    const max=config.maxKeys??4096,ttl=config.dedupeTtlMs??60000
    if(!Number.isSafeInteger(max)||max<1||!Number.isSafeInteger(ttl)||ttl<1)throw new Error('SHARK_DISCOVERY_CONFIG_INVALID')
  }
  /** Failed persistence must never poison a provider retry.
   * Idempotent durable upsert remains authoritative if a prior attempt committed.
   */
  releasePending(chainId:string,signature:string|undefined,mint:string):void{
    if(signature&&signature.trim()&&mint.trim()){
      this.seen.delete(`${chainId}:${signature}:${mint}`)
    }
  }
  ingest(event:HeliusLaunchWebhookEvent,meta:{receivedAt:string;startedMonotonicMs:number;finishedMonotonicMs:number;nowMonotonicMs?:()=>number}):FastpathDiscoveryResult{
    const finish=(disposition:FastpathDiscoveryDisposition,reasonCodes:string[],receipt?:FastpathDiscoveryReceipt):FastpathDiscoveryResult=>
      Object.freeze({disposition,reasonCodes:Object.freeze(reasonCodes),receipt,authority:'DISCOVERY_EVIDENCE_ONLY',canTrade:false})
    const receivedMs=Date.parse(meta.receivedAt)
    if(!Number.isFinite(receivedMs)||!Number.isFinite(meta.startedMonotonicMs)||!Number.isFinite(meta.finishedMonotonicMs)||meta.finishedMonotonicMs<meta.startedMonotonicMs){
      return finish('INVALID',['CLOCK_INVALID'])
    }
    if(!event.signature||!event.signature.trim()||!Number.isSafeInteger(event.slot)||event.slot===undefined||event.slot<=0||
      typeof event.timestamp!=='number'||!Number.isFinite(event.timestamp)||event.timestamp<=0){
      return finish('INVALID',['CHAIN_EVENT_PROVENANCE_INCOMPLETE'])
    }
    let launch:SolanaLaunchCollection|null
    try{launch=collectHeliusLaunch(event,this.config.collector)}catch{return finish('INVALID',['LAUNCH_NORMALIZATION_ERROR'])}
    if(!launch)return finish('INVALID',['MINT_MISSING'])
    const sourceMs=event.timestamp*1000
    if(sourceMs>receivedMs)return finish('INVALID',['PROVIDER_TIMESTAMP_IN_FUTURE'])
    const key=`${launch.observation.chainId}:${event.signature}:${launch.observation.tokenAddress}`
    const ttl=this.config.dedupeTtlMs??60000
    for(const [k,expiresAt] of this.seen){
      if(expiresAt<=receivedMs)this.seen.delete(k)
    }
    if(this.seen.has(key))return finish('DUPLICATE',['IDENTICAL_CHAIN_EVENT'])
    if(this.seen.size>=(this.config.maxKeys??4096))return finish('DROPPED_CAPACITY',['DISCOVERY_DEDUPE_CAPACITY'])
    this.seen.set(key,receivedMs+ttl)
    const endMonotonic=meta.nowMonotonicMs?.()??meta.finishedMonotonicMs
    if(!Number.isFinite(endMonotonic)||endMonotonic<meta.startedMonotonicMs){
      return finish('INVALID',['CLOCK_INVALID'])
    }
    const receipt:FastpathDiscoveryReceipt=Object.freeze({
      version:SNIPER_DISCOVERY_VERSION,observationId:launch.observation.observationId,
      mint:launch.observation.tokenAddress,signature:event.signature,slot:event.slot,
      providerObservedAt:launch.observation.observedAt,receivedAt:meta.receivedAt,
      discoveryDelayMs:receivedMs-sourceMs,
      elapsedProcessingMs:endMonotonic-meta.startedMonotonicMs,
      evidenceIds:Object.freeze([...launch.observation.evidenceIds]),
      verification:'PROVISIONAL_UNVERIFIED',authority:'DISCOVERY_EVIDENCE_ONLY',canTrade:false,
    })
    this.config.onObserved?.(receipt,launch)
    return finish('OBSERVED',[],receipt)
  }
}
