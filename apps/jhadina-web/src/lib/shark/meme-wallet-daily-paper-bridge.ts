import {
  memePaperSourceDigest,
  runMemeWalletPaperDailyCycle,
  type MemeWalletPaperPolicy,type MemeWalletPaperJournal,
  type MemeWalletPaperSourceBatch,type MemeWalletPaperSql,
} from '@jhadina/money-core'
import type { MemeAssessmentCycleResult } from './meme-assessment-worker'
import {
  mapSharkAssessmentToMemePaper,
  type MemePaperQuoteEvidence,type MemePaperSafetyReceipt,
} from './meme-wallet-paper-adapter'

export type PersistedSharkPaperItem=Readonly<{
  persisted:MemeAssessmentCycleResult
  quote:MemePaperQuoteEvidence
  safety:readonly MemePaperSafetyReceipt[]
}>

/**
 * MEME-WALLET.13 SHARK source adapter: only canonical actor-aware assessment
 * cycles whose assessment and money ingress were persisted may be considered.
 * This is NOT a background scheduler or a direct live RPC/source fetcher.
 * The caller must be an authenticated, authorized app/server worker and must
 * independently source price/liquidity/sellability receipts.
 */
export function buildMemePaperBatchFromPersistedShark(input:Readonly<{
  sourceBatchId:string
  items:readonly PersistedSharkPaperItem[]
  informationCutoff:string
  maxEvidenceAgeMs:number
}>):MemeWalletPaperSourceBatch{
  const cutoff=Date.parse(input.informationCutoff)
  if(!Number.isFinite(cutoff)||!input.sourceBatchId.trim()||
     input.items.length<1||input.items.length>20)
    throw Error('MEME_PAPER_SHARK_BATCH_INPUT_INVALID')
  const candidates=input.items.map(item=>{
    const p=item.persisted
    if(!['INSERTED','REPLAY'].includes(p.persistence)||
       !['INSERTED','REPLAY'].includes(p.runtimeIngress)||
       p.authority!=='INTELLIGENCE_ONLY'||p.canAuthorizeTrade!==false||
       p.envelope.authority.financialExecution!=='NONE'||
       p.envelope.authority.walletSigning!=='NONE'||
       p.envelope.assessment.assessmentId!==p.assessment.assessmentId||
       p.envelope.assessment.tokenAddress!==p.assessment.token.tokenAddress ||
       Date.parse(p.envelope.assessment.informationCutoff)>cutoff)
      throw Error('MEME_PAPER_SHARK_PERSISTENCE_OR_AUTHORITY_INVALID')
    return mapSharkAssessmentToMemePaper({
      assessment:p.assessment,strategyId:'JHADINA_SHARK_SNIPER_PAPER_V1',
      quote:item.quote,safety:item.safety,
      cutoff:input.informationCutoff,maxEvidenceAgeMs:input.maxEvidenceAgeMs,
    })
  })
  const ids=new Set(candidates.map(x=>x.caseId))
  if(ids.size!==candidates.length)throw Error('MEME_PAPER_SHARK_DUPLICATE_ASSESSMENT')
  const base={
    batchId:input.sourceBatchId,
    availableAt:input.informationCutoff,
    candidates:Object.freeze(candidates),
  }
  return Object.freeze({
    ...base,contentHash:memePaperSourceDigest(base),
    authority:'PERSISTED_SHARK_RESEARCH_BATCH_ONLY',canExecute:false,
  })
}
/** App-side composition of persisted SHARK output and Money's locked daily
 * paper runner. Does not create credentials, wallet sessions or host jobs. */
export async function submitPersistedSharkPaperBatch(input:Readonly<{
  sourceBatchId:string
  items:readonly PersistedSharkPaperItem[]
  maxEvidenceAgeMs:number
  now:string
  db:MemeWalletPaperSql
  journal:MemeWalletPaperJournal
  walletAddress:string
  otherOwnerAddresses:readonly string[]
  cofferAddresses:readonly string[]
  phantomMcpAddresses:readonly string[]
  policy:MemeWalletPaperPolicy
  entryMinor:bigint
  ownerPaperApprovalReference:string
  commissionedPaperOnly:boolean
}>){
  const batch=buildMemePaperBatchFromPersistedShark({
    sourceBatchId:input.sourceBatchId,items:input.items,
    informationCutoff:input.now,maxEvidenceAgeMs:input.maxEvidenceAgeMs,
  })
  return runMemeWalletPaperDailyCycle({
    db:input.db,journal:input.journal,
    walletAddress:input.walletAddress,
    otherOwnerAddresses:input.otherOwnerAddresses,
    cofferAddresses:input.cofferAddresses,
    phantomMcpAddresses:input.phantomMcpAddresses,
    policy:input.policy,batch,entryMinor:input.entryMinor,
    now:input.now,commissionedPaperOnly:input.commissionedPaperOnly,
    ownerApprovalReference:input.ownerPaperApprovalReference,
  })
}
