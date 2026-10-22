import {describe,expect,it} from 'vitest'
import {
 archiveSniperIntel,buildSniperArchiveRow,
 type SniperArchiveStore,type SniperIntelArchiveRow,
} from './sniper-intel-journal'
import type {SniperPaperCycleResult} from './sniper-paper-cycle'
const now='2026-10-22T22:30:00Z'
const owner='11111111-1111-4111-8111-111111111111'
const risk={
  tokenAddress:'MINT',disposition:'BLOCK',authority:'RISK_RESEARCH_ONLY',
  reasonCodes:['RUG'],mechanisms:[{mechanism:'CONCENTRATED_DUMP',
    evidenceClass:'RISK_PATTERN',severity:'CRITICAL',trigger:'top10HolderPct'}],canExecute:false,
}
const intel={
  version:'SHARK-INTEL.FUSION.01',decisionId:'trade:1',tokenAddress:'MINT',
  informationCutoff:now,authority:'INTELLIGENCE_EVIDENCE_ONLY',canExecute:false,
  canSign:false,canMutateModel:false,canCreditPurse:false,canAuthorizeLive:false,
  admittedEvidenceIds:['onchain:1'],hypothesisEvidenceIds:['transcript:1'],
  quarantinedEvidenceIds:['future:1'],independentVerifiedGroups:1,
  historicalIndependentDecisions:0,historicalLessonIds:[],claims:[],
  rugMechanisms:risk.mechanisms,riskDisposition:'BLOCK',deferredReasons:[],
}
const noTrade={
  tokenAddress:'MINT',disposition:'NO_TRADE',intel,risk,
  reasonCodes:['SHARK_SAFETY_VETO','RUG'],authority:'SHARK_MONEY_PAPER_ONLY',canExecute:false,
} as unknown as SniperPaperCycleResult
const paper={
  ...noTrade,disposition:'PAPER_RECORDED',risk:{...risk,disposition:'PAPER_CANDIDATE'},
  intel:{...intel,riskDisposition:'PAPER_CANDIDATE'},
  paper:{runId:'run:1',tokenAddress:'MINT',status:'CLOSED',
    realizedNetPnlMinor:100000n,authority:'PAPER_SIMULATION_ONLY',canExecute:false,canCreditPurse:false},
  acceptance:{status:'PAPER_CLOSED_ACCEPTED',canExecute:false,
    handoff:{handoffId:'handoff:1',deferredReasons:['PAPER_NOT_PURSE_ACCOUNTING']}},
} as unknown as SniperPaperCycleResult
const archive=(r:SniperPaperCycleResult=noTrade)=>buildSniperArchiveRow({ownerId:owner,tradeId:'trade:1',informationCutoff:now,result:r})
function store(){
 const rows=new Map<string,SniperIntelArchiveRow>()
 let failAfterCommit=false
 let failBeforeCommit=false
 const adapter:SniperArchiveStore={
  read:async id=>rows.get(id)??null,
  insert:async r=>{
   if(failBeforeCommit)throw Error('STORE_UNAVAILABLE')
   if(rows.has(r.receipt_id))throw Error('duplicate receipt ID')
   rows.set(r.receipt_id,r)
   if(failAfterCommit)throw Error('COMMITTED_BUT_RESPONSE_LOST')
  },
 }
 return {rows,adapter,afterCommit:()=>failAfterCommit=true,beforeCommit:()=>failBeforeCommit=true}
}
describe('SHARK archived research: one-record atomic replay and failure quarantine',()=>{
 it('records a veto with no trade or alleged profit',async()=>{
  const row=archive()
  expect(row.owner_id).toBe(owner)
  expect(row.payload_json.disposition).toBe('NO_TRADE')
  expect(row.payload_json.paper).toBeUndefined()
  expect(row.payload_json.canExecute).toBe(false)
  const s=store()
  const a=await archiveSniperIntel(s.adapter,row)
  expect(a.outcome).toBe('INSERTED')
  expect(s.rows.size).toBe(1)
  const retry=await archiveSniperIntel(s.adapter,row)
  expect(retry.outcome).toBe('REPLAY_IDENTICAL')
  expect(s.rows.size).toBe(1)
 })
 it('stores closed paper returns as simulation, never an onchain P&L or purse credit',()=>{
  const row=archive(paper)
  expect(row.payload_json.paper?.realizedNetPnlMinor).toBe('100000')
  expect(row.payload_json.paper?.authority).toBe('PAPER_SIMULATION_ONLY')
  expect(row.payload_json.handoff?.status).toBe('PAPER_CLOSED_ACCEPTED')
  expect(row.payload_json.canCreditPurse).toBe(false)
  expect(row.payload_json.canMutateModel).toBe(false)
 })
 it('a lost response after the database commit is a safe replay, not two trades',async()=>{
  const s=store();s.afterCommit()
  const result=await archiveSniperIntel(s.adapter,archive())
  expect(result.outcome).toBe('REPLAY_IDENTICAL')
  expect(s.rows.size).toBe(1)
 })
 it('a failed write before the commit cannot produce a success receipt',async()=>{
  const s=store();s.beforeCommit()
  await expect(archiveSniperIntel(s.adapter,archive())).rejects.toThrow('STORE_UNAVAILABLE')
  expect(s.rows.size).toBe(0)
 })
 it('same trade + cutoff + changed evidence is a tampering/conflict alarm',async()=>{
  const s=store(),first=archive()
  await archiveSniperIntel(s.adapter,first)
  const changed=archive({...noTrade,reasonCodes:['DIFFERENT_RISK']} as SniperPaperCycleResult)
  expect(changed.receipt_id).toBe(first.receipt_id)
  expect(changed.payload_hash).not.toBe(first.payload_hash)
  await expect(archiveSniperIntel(s.adapter,changed)).rejects.toThrow('SHARK_INTEL_ARCHIVE_CONFLICT')
 })
 it('denies wrong identity and accidental financial authority',()=>{
  expect(()=>buildSniperArchiveRow({ownerId:owner,tradeId:'different',informationCutoff:now,result:noTrade})).toThrow()
  expect(()=>buildSniperArchiveRow({ownerId:'wrong',tradeId:'trade:1',informationCutoff:now,result:noTrade})).toThrow()
  expect(()=>archive({...noTrade,canExecute:true} as unknown as SniperPaperCycleResult)).toThrow()
  expect(()=>archive({...noTrade,paper:paper.paper} as SniperPaperCycleResult)).toThrow()
 })
 it('rejects client-side modified hash and financial authority flags',async()=>{
  const s=store()
  const row=archive()
  await expect(archiveSniperIntel(s.adapter,{...row,payload_hash:'0'.repeat(64)})).rejects.toThrow()
  await expect(archiveSniperIntel(s.adapter,{
   ...row,payload_json:{...row.payload_json,canSign:true} as unknown as typeof row.payload_json,
  })).rejects.toThrow()
 })
})