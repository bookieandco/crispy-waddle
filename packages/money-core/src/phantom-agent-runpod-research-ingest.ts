import { createHash } from 'node:crypto'
import { verifyPhantomAgentStudyLedger } from './phantom-agent-study-ledger.js'
import {
  readPhantomAgentResearchInbox,
  type PhantomResearchInboxOptions,
} from './phantom-agent-research-inbox.js'

type Case = Awaited<ReturnType<typeof readPhantomAgentResearchInbox>>[number]
export type PhantomResearchDb = Readonly<{
  query: (sql:string,params?:readonly unknown[])=>Promise<{
    rowCount?:number|null
    rows:Record<string,unknown>[]
  }>
}>
const SHA=/^[a-f0-9]{64}$/
const ID=/^phantom-agent-native-sol:[0-9a-f]{64}$/
const canonical=(v:unknown):string=>JSON.stringify(v,(_,value)=>{
  if (value && typeof value==='object' && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)))
  }
  return value
})
const digest=(v:unknown)=>createHash('sha256').update(canonical(v)).digest('hex')

/**
 * Imports native SOL observation cases ONLY. Existing SHARK/SHADOW market
 * decision, execution, lesson, P&L, permit and custody tables are untouched.
 * A conflict is replay-safe only if exact content matches an admitted case.
 */
export async function appendRunpodPhantomResearchCase(input:Readonly<{
  db:PhantomResearchDb
  research:Case
}>):Promise<'INSERTED'|'REPLAY'> {
  const x=input.research
  const sourceDigest=x.caseId.slice('phantom-agent-native-sol:'.length)
  if (!ID.test(x.caseId) || !SHA.test(sourceDigest) ||
      x.caseKind!=='FORWARD_WALLET_OBSERVATION' ||
      x.network!=='SOLANA' || !x.subjectId.startsWith('wallet:solana:') ||
      x.authority!=='SHADOW_LEARNING_ONLY' ||
      x.canExecute!==false || x.canAuthorizeLive!==false ||
      x.realizedPnl!==null || x.simulatedPnl!==null ||
      !/^\d+$/.test(x.nativeBalanceLamports) ||
      !Number.isSafeInteger(x.slot) || x.slot<=0 ||
      !Array.isArray(x.evidenceIds) || x.evidenceIds.length<3 ||
      !x.evidenceIds.includes('phantom-study:hmac-sha256:'+sourceDigest) ||
      Number.isNaN(Date.parse(x.observedAt))) {
    throw new Error('PHANTOM_RUNPOD_RESEARCH_SOURCE_INVALID')
  }
  const row=Object.freeze({
    caseId:x.caseId,parentCaseId:x.parentCaseId,
    walletId:x.walletId,subjectId:x.subjectId,
    slot:x.slot,nativeBalanceLamports:x.nativeBalanceLamports,
    observedAt:x.observedAt,evidenceIds:[...x.evidenceIds],
    sourceStudyDigest:sourceDigest,
    observationJson:x,
  })
  const result=await input.db.query(
    `INSERT INTO runpod_phantom_agent_research_observations (
      case_id,parent_case_id,wallet_id,subject_id,chain_id,slot,
      native_balance_lamports,observed_at,evidence_ids,source_study_digest,
      observation_json,authority,can_execute,can_authorize_live
    ) VALUES($1,$2,$3,$4,'solana-mainnet-beta',$5,$6,$7,$8,$9,$10::jsonb,
             'SHADOW_LEARNING_ONLY',FALSE,FALSE)
    ON CONFLICT (case_id) DO NOTHING RETURNING case_id`,
    [row.caseId,row.parentCaseId,row.walletId,row.subjectId,row.slot,
     row.nativeBalanceLamports,row.observedAt,row.evidenceIds,
     row.sourceStudyDigest,JSON.stringify(row.observationJson)],
  )
  if(result.rowCount===1)return 'INSERTED'
  const existing=await input.db.query(
    `SELECT source_study_digest,observation_json FROM runpod_phantom_agent_research_observations
      WHERE case_id=$1 LIMIT 1`,[row.caseId],
  )
  if (existing.rows.length!==1 ||
      existing.rows[0]?.source_study_digest!==sourceDigest ||
      digest(existing.rows[0]?.observation_json)!==digest(row.observationJson)) {
    throw new Error('PHANTOM_RUNPOD_RESEARCH_CONFLICT')
  }
  return 'REPLAY'
}

export async function syncRunpodPhantomResearchCases(input:Readonly<{
  inbox:PhantomResearchInboxOptions
  db:PhantomResearchDb
  maximumCases:number
  /** Must come from an independently verified external checkpoint. */
  expectedJournalHead:string
  expectedJournalCount:number
}>){
  if (!Number.isInteger(input.maximumCases) || input.maximumCases<1 ||
      input.maximumCases>10000)throw new Error('PHANTOM_RUNPOD_RESEARCH_LIMIT_INVALID')
  // The latest independently verified study head must be present. An HMAC
  // valid but incomplete local inbox must never be presented as a fully
  // reconciled SHADOW import.
  const study = await verifyPhantomAgentStudyLedger(input.inbox.study)
  if (!SHA.test(input.expectedJournalHead) ||
      !Number.isSafeInteger(input.expectedJournalCount) ||
      input.expectedJournalCount < 1 ||
      input.expectedJournalHead !== study.headDigest ||
      input.expectedJournalCount !== study.count) {
    throw new Error('PHANTOM_RUNPOD_RESEARCH_WITNESS_HEAD_MISMATCH')
  }
  const cases=await readPhantomAgentResearchInbox(input.inbox)
  if (study.count !== cases.length ||
      (cases.length > 0 && cases[cases.length - 1]?.caseId !==
        'phantom-agent-native-sol:' + study.headDigest)) {
    throw new Error('PHANTOM_RUNPOD_RESEARCH_INBOX_NOT_AT_STUDY_HEAD')
  }
  for (let i=0;i<cases.length;i++) {
    const expectedParent=i===0?null:cases[i-1]!.caseId
    if(cases[i]!.parentCaseId!==expectedParent) {
      throw new Error('PHANTOM_RUNPOD_RESEARCH_LINEAGE_GAP')
    }
  }
  if(cases.length>input.maximumCases)throw new Error('PHANTOM_RUNPOD_RESEARCH_LIMIT_EXCEEDED')
  // Double-check immediately before the first DB write. Concurrent
  // observations must be reconciled against a fresh external witness.
  const beforeWrite = await verifyPhantomAgentStudyLedger(input.inbox.study)
  if(beforeWrite.headDigest!==study.headDigest || beforeWrite.count!==study.count) {
    throw new Error('PHANTOM_RUNPOD_RESEARCH_SOURCE_CHANGED_BEFORE_WRITE')
  }
  let inserted=0,replayed=0
  for(const research of cases){
    const status=await appendRunpodPhantomResearchCase({db:input.db,research})
    if(status==='INSERTED')inserted++
    else replayed++
  }
  // A concurrent append cannot be represented as a successful fully
  // reconciled import receipt even if the signed prefix was stored correctly.
  const finalStudy = await verifyPhantomAgentStudyLedger(input.inbox.study)
  if(finalStudy.headDigest!==study.headDigest || finalStudy.count!==study.count) {
    throw new Error('PHANTOM_RUNPOD_RESEARCH_SOURCE_CHANGED_DURING_WRITE')
  }
  return Object.freeze({
    observedCases:cases.length,inserted,replayed,
    admittedStudyHead:study.headDigest,
    authority:'SHADOW_RESEARCH_INGEST_RECEIPT_ONLY' as const,
    canExecute:false as const,canAuthorizeLive:false as const,
    marketDataCertified:false as const,tradingPerformanceCalculated:false as const,
    liveCommissioned:false as const,
  })
}
