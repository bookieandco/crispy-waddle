import {ingestTokenLaunch, type TokenLaunchIngestResult, type TokenLaunchObservation} from './token-launch-ingest'
import {decodePumpLogsNotification} from './pump-anchor-log-decoder'
import {PumpDecodedEventLifecycleTracker} from './pump-decoded-event-stream'
import {createAlphaEvidenceV2,type AlphaEvidenceV2} from './alpha-evidence-v2'

/** Helius enhanced transactions vary by subscription type.
 * Only a bounded, actual Pump program log with a validated CreateEvent may produce a launch.
 * Generic TOKEN_MINT, arbitrary token transfers, description strings, and Explore listings are not launches.
 * If the provider does not include program logs, configure a separate trusted logs subscription in .05.
 */
export type HeliusLaunchWebhookEvent={
  type?:string
  signature?:string
  timestamp?:number
  slot?:number
  source?:string
  feePayer?:string
  transactionError?:unknown
  programLogs?:readonly string[]
  tokenTransfers?:readonly {mint?:string;tokenAmount?:number}[]
  events?:{token?:{mint?:string;decimals?:number;amount?:number;authority?:string}}
}
export type SolanaLaunchCollectorConfig={
  chainId?:'solana-mainnet'|'solana-devnet'
  source?:string
}
export type SolanaLaunchCollection={
  observation:TokenLaunchObservation
  ingested:TokenLaunchIngestResult
  signature:string
  slot:number
  provenance:AlphaEvidenceV2
}
const sig=/^[1-9A-HJ-NP-Za-km-z]{64,88}$/
const iso=(value:string)=>Number.isFinite(Date.parse(value))
const MAX_LOGS=300
const MAX_LOG_LENGTH=20_000

/**
 * Fail closed: provider-authenticated input is still *provider asserted*, never on-chain
 * independently attested. No money, wallets, or provider-side API calls.
 */
export async function collectHeliusLaunch(
  event:HeliusLaunchWebhookEvent,
  config:SolanaLaunchCollectorConfig={},
  receivedAt:string=new Date().toISOString(),
):Promise<SolanaLaunchCollection|null>{
  if(!iso(receivedAt))throw new Error('shark_helius_receipt_clock_invalid')
  if(config.chainId==='solana-devnet')return null
  if(!sig.test(event.signature??'')||!Number.isSafeInteger(event.slot)||event.slot!<=0||
    !Number.isSafeInteger(event.timestamp)||event.timestamp!<=0 ||
    event.transactionError!==undefined&&event.transactionError!==null ||
    !Array.isArray(event.programLogs)||!event.programLogs.length||
    event.programLogs.length>MAX_LOGS||
    event.programLogs.some(line=>typeof line!=='string'||line.length>MAX_LOG_LENGTH)){
    return null
  }
  const providerTime=event.timestamp!*1000
  const receiptTime=Date.parse(receivedAt)
  if(!Number.isSafeInteger(providerTime)||providerTime>receiptTime)return null
  const decoded=decodePumpLogsNotification({
    method:'logsNotification',
    params:{result:{context:{slot:event.slot},value:{signature:event.signature,err:null,logs:event.programLogs}}},
  },receivedAt,config.source??'helius-program-logs')
  const creates=decoded.filter(e=>e.eventName==='CreateEvent')
  if(creates.length!==1)return null
  const create=creates[0]!
  // A program-log timestamp and Helius transaction timestamp must be consistent.
  if(Math.abs(Date.parse(create.observedAt)-providerTime)>300_000)return null
  const update=await new PumpDecodedEventLifecycleTracker().ingest(create)
  const observation=update.launchObservation
  if(!observation)return null
  // Helius's generic summary can never override the mint from Pump's decoded log.
  if(event.events?.token?.mint && event.events.token.mint!==observation.tokenAddress)return null
  const provenance=createAlphaEvidenceV2({
    sourceEventId:create.eventId,
    sourceFamily:'CHAIN',
    sourceHandle:config.source??'helius-program-logs',
    occurredAt:create.observedAt,receivedAt,availableAt:receivedAt,
    evidenceIds:[...observation.evidenceIds],
  })
  return Object.freeze({
    observation,
    ingested:ingestTokenLaunch(observation),
    signature:event.signature!,
    slot:event.slot!,
    provenance,
  })
}
export type SolanaLaunchCollector={
  ingestWebhook(event:HeliusLaunchWebhookEvent,receivedAt?:string):Promise<SolanaLaunchCollection|null>
}
export function createSolanaLaunchCollector(config:SolanaLaunchCollectorConfig={}):SolanaLaunchCollector {
  return {ingestWebhook:(event,receivedAt)=>collectHeliusLaunch(event,config,receivedAt)}
}
