import { createHash } from 'node:crypto'
import {
  bindOwnerCreatedMemeWallet,
  type MemeWalletCandidate,
  type MemeWalletPaperPolicy,
  type MemeWalletPaperDecision,
} from './meme-wallet-paper-gate.js'
import { submitMemeWalletPaperProposal, type MemeWalletPaperJournal } from './meme-wallet-paper-runtime.js'
import {
  assertMemePaperSchedulerDbRole,claimMemeWalletPaperCycle,recoverMemePaperDay,
} from './meme-wallet-paper-scheduler.js'
import type { MemeWalletPaperSql } from './meme-wallet-postgres-paper-journal.js'

/** Source must be produced by a separate, authenticated SHARK research
 * importer from persisted assessment and independently dated safety receipts.
 * A digest checks transport integrity, NOT producer authorization.
 */
export type MemeWalletPaperSourceBatch=Readonly<{
  batchId:string
  availableAt:string
  candidates:readonly MemeWalletCandidate[]
  contentHash:string
  authority:'PERSISTED_SHARK_RESEARCH_BATCH_ONLY'
  canExecute:false
}>
const encode=(value:unknown)=>JSON.stringify(value,(_,x)=>typeof x==='bigint'?x.toString():x)
export function memePaperSourceDigest(input:Pick<MemeWalletPaperSourceBatch,
  'batchId'|'availableAt'|'candidates'>){
  return createHash('sha256').update(encode([
    input.batchId,input.availableAt,input.candidates,
  ])).digest('hex')
}
export type MemeWalletPaperCycleResult=Readonly<{
  claimId:string
  evaluated:number
  admitted:number
  blocked:number
  decisions:readonly MemeWalletPaperDecision[]
  authority:'UNATTENDED_PAPER_RESEARCH_ONLY'
  persistentDatabaseVerified:false
  hostedSchedulerRunning:false
  canSign:false
  canExecute:false
  canFund:false
}>
/** A single, owner-reviewed, bounded daily paper batch. There is NO auto
 * order, no auto fill, and no retry after an interrupted claimed UTC day.
 * All construction/secret-management/deployment responsibilities stay with
 * a separate owner-controlled commissioning layer.
 */
export async function runMemeWalletPaperDailyCycle(input:Readonly<{
  db:MemeWalletPaperSql
  journal:MemeWalletPaperJournal
  walletAddress:string
  otherOwnerAddresses:readonly string[]
  cofferAddresses:readonly string[]
  phantomMcpAddresses:readonly string[]
  policy:MemeWalletPaperPolicy
  batch:MemeWalletPaperSourceBatch
  entryMinor:bigint
  now:string
  commissionedPaperOnly:boolean
  ownerApprovalReference:string
}>):Promise<MemeWalletPaperCycleResult>{
  if(input.commissionedPaperOnly!==true ||
    !input.ownerApprovalReference.trim() ||
    input.policy.ownerReview!=='APPROVED_FOR_PAPER_ONLY'||
    input.policy.paperOnly!==true||input.policy.liveExecutionEnabled!==false)
    throw Error('MEME_PAPER_OWNER_COMMISSIONING_REQUIRED')
  if(input.batch.authority!=='PERSISTED_SHARK_RESEARCH_BATCH_ONLY' ||
    input.batch.canExecute!==false || !input.batch.batchId ||
    input.batch.batchId.length>256 ||input.batch.candidates.length<1 ||
    input.batch.candidates.length>20 ||
    memePaperSourceDigest(input.batch)!==input.batch.contentHash)
    throw Error('MEME_PAPER_SOURCE_BATCH_INVALID')
  const clock=Date.parse(input.now),available=Date.parse(input.batch.availableAt)
  if(!Number.isFinite(clock)||!Number.isFinite(available)||
    available>clock||clock-available>120000)
    throw Error('MEME_PAPER_SOURCE_BATCH_STALE')
  const seen=new Set<string>()
  for(const candidate of input.batch.candidates){
    if(!candidate.caseId || seen.has(candidate.caseId) ||
       Date.parse(candidate.observedAt)>available ||
       candidate.authority!=='SHARK_RESEARCH_ONLY' ||
       candidate.canAuthorizeTrade!==false)
      throw Error('MEME_PAPER_SOURCE_CANDIDATE_INVALID')
    seen.add(candidate.caseId)
  }
  const wallet=bindOwnerCreatedMemeWallet({
    solanaAddress:input.walletAddress,
    ownerWalletAddresses:input.otherOwnerAddresses,
    cofferWalletAddresses:input.cofferAddresses,
    mcpAgentAddresses:input.phantomMcpAddresses,
  })
  await assertMemePaperSchedulerDbRole(input.db)
  const claim=await claimMemeWalletPaperCycle(input.db,{
    walletId:wallet.walletId,ownerPolicyId:input.policy.policyId,
    sourceBatchId:input.batch.batchId,now:input.now,
  })
  const decisions:MemeWalletPaperDecision[]=[]
  for(const candidate of input.batch.candidates){
    const recovery=await recoverMemePaperDay(input.db,{
      walletId:wallet.walletId,utcDay:claim.utcDay,
    })
    if(recovery.state.halted)throw Error('MEME_PAPER_STOPPED_BY_OWNER')
    const receipt=await submitMemeWalletPaperProposal({
      wallet,policy:input.policy,candidate,state:recovery.state,
      entryMinor:input.entryMinor,now:input.now,journal:input.journal,
    })
    decisions.push(receipt.decision)
  }
  return Object.freeze({
    claimId:claim.claimId,evaluated:decisions.length,
    admitted:decisions.filter(d=>d.disposition==='PAPER_ADMIT').length,
    blocked:decisions.filter(d=>d.disposition==='PAPER_BLOCK').length,
    decisions:Object.freeze(decisions),
    authority:'UNATTENDED_PAPER_RESEARCH_ONLY',
    persistentDatabaseVerified:false,
    hostedSchedulerRunning:false,
    canSign:false,canExecute:false,canFund:false,
  })
}
