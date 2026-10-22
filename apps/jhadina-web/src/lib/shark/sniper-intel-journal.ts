import {createHash} from 'node:crypto'
import type {SniperPaperCycleResult} from './sniper-paper-cycle'

/**
 * SHARK-INTEL.DURABLE.02: one durable atomic decision snapshot per cycle.
 * Zero privileged clients, senders or signers are constructed here.
 * This is NOT a money ledger and never authorizes execution/model learning.
 *
 * Deploy requires the separately reviewed money_shark_sniper_intel_archive
 * storage contract. Existing trade memory/paper accounting are NOT replaced.
 */
export const SNIPER_INTEL_ARCHIVE_VERSION='SHARK-INTEL.ARCHIVE.02' as const
export type SniperIntelArchivePayload=Readonly<{
 version:typeof SNIPER_INTEL_ARCHIVE_VERSION
 tradeId:string
 tokenAddress:string
 informationCutoff:string
 disposition:'NO_TRADE'|'PAPER_RECORDED'
 riskDisposition:'BLOCK'|'REVIEW'|'PAPER_CANDIDATE'
 rugMechanisms:readonly string[]
 reasonCodes:readonly string[]
 admittedEvidenceIds:readonly string[]
 hypothesisEvidenceIds:readonly string[]
 quarantinedEvidenceIds:readonly string[]
 independentVerifiedGroups:number
 historicalIndependentDecisions:number
 historicalLessonIds:readonly string[]
 paper?:Readonly<{
   runId:string
   status:'NO_ENTRY_FILL'|'OPEN_NO_SELL_ROUTE'|'PARTIAL_EXIT'|'CLOSED'
   realizedNetPnlMinor?:string
   authority:'PAPER_SIMULATION_ONLY'
 }>
 handoff?:Readonly<{
   status:'PAPER_CLOSED_ACCEPTED'|'PAPER_INCOMPLETE'|'BLOCKED'
   evidenceId:string
   deferredReasons:readonly string[]
 }>
 authority:'ARCHIVED_RESEARCH_ONLY'
 canSign:false
 canExecute:false
 canAuthorizeLive:false
 canCreditPurse:false
 canMutateModel:false
}>
export type SniperIntelArchiveRow=Readonly<{
 receipt_id:string
 trade_id:string
 token_address:string
 information_cutoff:string
 payload_hash:string
 payload_json:SniperIntelArchivePayload
}>
export type SniperArchiveStore=Readonly<{
 /** Must implement an atomic INSERT; conflicts are resolved by receipt_id.
  * A pre-existing conflicting hash MUST fail, not be silently overwritten.
  */
 insert:(row:SniperIntelArchiveRow)=>Promise<void>
 read:(receiptId:string)=>Promise<SniperIntelArchiveRow|null>
}>
export type SniperArchiveReceipt=Readonly<{
 receiptId:string
 outcome:'INSERTED'|'REPLAY_IDENTICAL'
 tradeId:string
 payloadHash:string
 authority:'ARCHIVE_EVIDENCE_ONLY'
 canExecute:false
 canCreditPurse:false
 canMutateModel:false
}>
const unique=(items:readonly string[])=>Object.freeze([...new Set(items)].sort())
const sha256=(s:string)=>createHash('sha256').update(s).digest('hex')
const validId=(s:string)=>typeof s==='string'&&s.length>=1&&s.length<=256
const iso=(s:string)=>!!s&&Number.isFinite(Date.parse(s))
/** Sort keys recursively and encode BigInt safely; NO timestamp of import is
 * mixed into the digest. Replay is byte-identical after crashes/retries.
 */
function stable(value:unknown):string{
 const transform=(v:unknown):unknown=>{
  if(typeof v==='bigint')return v.toString(10)
  if(Array.isArray(v))return v.map(transform)
  if(v&&typeof v==='object')return Object.fromEntries(
    Object.entries(v as Record<string,unknown>).filter(([_,x])=>x!==undefined)
      .sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,transform(x)]))
  return v
 }
 return JSON.stringify(transform(value))
}
export function buildSniperArchiveRow(input:{
 tradeId:string
 informationCutoff:string
 result:SniperPaperCycleResult
}):SniperIntelArchiveRow{
 const {tradeId,informationCutoff,result}=input
 if(!validId(tradeId)||!validId(result.tokenAddress)||!iso(informationCutoff)||
    informationCutoff!==result.intel.informationCutoff||tradeId!==result.intel.decisionId||
    result.intel.tokenAddress!==result.tokenAddress||
    result.authority!=='SHARK_MONEY_PAPER_ONLY'||result.canExecute!==false||
    result.intel.authority!=='INTELLIGENCE_EVIDENCE_ONLY'||result.intel.canExecute!==false||
    result.intel.canSign!==false||result.intel.canMutateModel!==false||
    (result.disposition==='NO_TRADE'&&result.paper!==undefined)||
    (result.disposition==='PAPER_RECORDED'&&(!result.paper||!result.acceptance))||
    result.paper?.authority!=='PAPER_SIMULATION_ONLY'&&result.paper!==undefined||
    result.paper?.canCreditPurse!==false&&result.paper!==undefined||
    result.acceptance?.canExecute!==false&&result.acceptance!==undefined){
  throw new Error('SHARK_INTEL_ARCHIVE_IDENTITY_OR_AUTHORITY_INVALID')
 }
 const payload:SniperIntelArchivePayload=Object.freeze({
  version:SNIPER_INTEL_ARCHIVE_VERSION,tradeId,tokenAddress:result.tokenAddress,
  informationCutoff,disposition:result.disposition,
  riskDisposition:result.risk.disposition,
  rugMechanisms:unique(result.risk.mechanisms.map(m=>m.mechanism+':'+m.evidenceClass+':'+m.trigger)),
  reasonCodes:unique(result.reasonCodes),
  admittedEvidenceIds:unique(result.intel.admittedEvidenceIds),
  hypothesisEvidenceIds:unique(result.intel.hypothesisEvidenceIds),
  quarantinedEvidenceIds:unique(result.intel.quarantinedEvidenceIds),
  independentVerifiedGroups:result.intel.independentVerifiedGroups,
  historicalIndependentDecisions:result.intel.historicalIndependentDecisions,
  historicalLessonIds:unique(result.intel.historicalLessonIds),
  ...(result.paper?{paper:Object.freeze({
   runId:result.paper.runId,status:result.paper.status,
   ...(result.paper.realizedNetPnlMinor===undefined?{}:{realizedNetPnlMinor:result.paper.realizedNetPnlMinor.toString(10)}),
   authority:'PAPER_SIMULATION_ONLY' as const,
  })}:{}),
  ...(result.acceptance?{handoff:Object.freeze({
    status:result.acceptance.status,
    evidenceId:result.acceptance.handoff.handoffId,
    deferredReasons:unique(result.acceptance.handoff.deferredReasons),
  })}:{}),
  authority:'ARCHIVED_RESEARCH_ONLY',
  canSign:false,canExecute:false,canAuthorizeLive:false,canCreditPurse:false,canMutateModel:false,
 })
 const digest=sha256(stable(payload))
 // A trade can have distinct point-in-time observations but the same exact
 // decision+cutoff+stage may never mutate underneath a caller.
 const receiptId='shark-intel:'+sha256(stable([
  SNIPER_INTEL_ARCHIVE_VERSION,tradeId,result.tokenAddress,informationCutoff,
 ]))
 return Object.freeze({
  receipt_id:receiptId,trade_id:tradeId,token_address:result.tokenAddress,
  information_cutoff:informationCutoff,payload_hash:digest,payload_json:payload,
 })
}
function matches(a:SniperIntelArchiveRow,b:SniperIntelArchiveRow):boolean{
 return a.receipt_id===b.receipt_id&&a.trade_id===b.trade_id&&
  a.token_address===b.token_address&&a.information_cutoff===b.information_cutoff&&
  a.payload_hash===b.payload_hash&&sha256(stable(a.payload_json))===b.payload_hash
}
/** A failed response after a durable insert may be safely retried.
 * Any conflicting source facts for the same decision/cutoff are quarantined.
 */
export async function archiveSniperIntel(store:SniperArchiveStore,row:SniperIntelArchiveRow):Promise<SniperArchiveReceipt>{
 if(!row.receipt_id.startsWith('shark-intel:')||
  !/^[a-f0-9]{64}$/.test(row.payload_hash)||
  row.payload_hash!==sha256(stable(row.payload_json))||
  row.trade_id!==row.payload_json.tradeId||
  row.token_address!==row.payload_json.tokenAddress||
  row.information_cutoff!==row.payload_json.informationCutoff||
  row.payload_json.authority!=='ARCHIVED_RESEARCH_ONLY'||
  row.payload_json.canExecute!==false||row.payload_json.canSign!==false||
  row.payload_json.canCreditPurse!==false||row.payload_json.canMutateModel!==false){
  throw new Error('SHARK_INTEL_ARCHIVE_RECEIPT_INVALID')
 }
 // Read-before-write is an optimization only; INSERT must enforce unique ID.
 const prior=await store.read(row.receipt_id)
 if(prior){
  if(!matches(prior,row))throw new Error('SHARK_INTEL_ARCHIVE_CONFLICT')
  return Object.freeze({receiptId:row.receipt_id,outcome:'REPLAY_IDENTICAL',
   tradeId:row.trade_id,payloadHash:row.payload_hash,
   authority:'ARCHIVE_EVIDENCE_ONLY',canExecute:false,canCreditPurse:false,canMutateModel:false})
 }
 try{
  await store.insert(row)
  return Object.freeze({receiptId:row.receipt_id,outcome:'INSERTED',
   tradeId:row.trade_id,payloadHash:row.payload_hash,
   authority:'ARCHIVE_EVIDENCE_ONLY',canExecute:false,canCreditPurse:false,canMutateModel:false})
 }catch(error){
  // Handles post-commit connection failures and concurrent same-payload
  // requests. A failed duplicate query is an ERROR, not a false success.
  const existing=await store.read(row.receipt_id)
  if(!existing||!matches(existing,row))throw error instanceof Error?error:new Error('SHARK_INTEL_ARCHIVE_WRITE_FAILED')
  return Object.freeze({receiptId:row.receipt_id,outcome:'REPLAY_IDENTICAL',
   tradeId:row.trade_id,payloadHash:row.payload_hash,
   authority:'ARCHIVE_EVIDENCE_ONLY',canExecute:false,canCreditPurse:false,canMutateModel:false})
 }
}
