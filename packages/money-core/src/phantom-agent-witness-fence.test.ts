import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { appendPhantomAgentStudy, verifyPhantomAgentStudyLedger } from './phantom-agent-study-ledger.js'
import { syncPhantomAgentResearchInbox } from './phantom-agent-research-inbox.js'
import { syncRunpodPhantomResearchCases, type PhantomResearchDb } from './phantom-agent-runpod-research-ingest.js'
import type { PhantomAgentVerifiedNativeSol } from './phantom-agent-chain-verification.js'

const walletId='05307b6d-2d5a-43d6-8d11-08db650a169b'
const address='H8FpYTgx4Uy9aF9Nk9fCTqKKFLYQ9KfC6UJhMkMDzCBh'
const firstAt='2026-10-14T22:00:00.000Z'
const secondAt='2026-10-14T22:00:05.000Z'
const hmacKey='test-hmac-journal-'.padEnd(48,'x')
const inboxHmacKey='test-hmac-inbox-'.padEnd(48,'y')
const snap=(slot:number,at:string,hashChar:string):PhantomAgentVerifiedNativeSol=>({
  provider:'solana-rpc-independent',walletId,address,slot,
  balanceLamports:'1111111111',commitment:'confirmed',observedAt:at,
  evidenceHash:hashChar.repeat(64),phantomEvidenceHash:'c'.repeat(64),
  authority:'CHAIN_OBSERVATION_ONLY',financialAuthority:'NONE',
  canSign:false,canExecute:false,canAuthorizeLive:false,spendableBalanceMinor:null,
})
async function withStudy<T>(fn:(ctx:{
  study:{path:string;hmacKey:string;expectedWalletId:string;expectedAddress:string}
  inbox:{study:{path:string;hmacKey:string;expectedWalletId:string;expectedAddress:string};inboxPath:string;inboxHmacKey:string}
})=>Promise<T>) {
  const dir=await mkdtemp(join(tmpdir(),'phantom-witness-fence-'))
  const study={path:join(dir,'study.jsonl'),hmacKey,expectedWalletId:walletId,expectedAddress:address}
  const inbox={study,inboxPath:join(dir,'research.jsonl'),inboxHmacKey}
  try {
    await appendPhantomAgentStudy({options:study,verified:snap(101,firstAt,'a'),writtenAt:firstAt})
    await syncPhantomAgentResearchInbox(inbox)
    return await fn({study,inbox})
  } finally {await rm(dir,{recursive:true,force:true})}
}
function mockDb(hook?:(n:number)=>Promise<void>):{db:PhantomResearchDb;calls:()=>number}{
  const rows=new Map<string,{source_study_digest:string;observation_json:unknown}>()
  let count=0
  return {
    calls:()=>count,
    db:{
      async query(sql,params=[]){
        count++
        if(sql.includes('INSERT INTO runpod_phantom_agent_research_observations')){
          const id=String(params[0])
          if(!rows.has(id)){
            rows.set(id,{
              source_study_digest:String(params[8]),
              observation_json:JSON.parse(String(params[9])),
            })
            await hook?.(count)
            return {rowCount:1,rows:[{case_id:id}]}
          }
          return {rowCount:0,rows:[]}
        }
        if(sql.includes('SELECT source_study_digest')){
          const old=rows.get(String(params[0]))
          return {rowCount:old?1:0,rows:old?[old]:[]}
        }
        throw Error('UNEXPECTED_RESEARCH_QUERY')
      },
    },
  }
}

test('witness head and count must both match before any database write',async()=>withStudy(async({study,inbox})=>{
  const head=await verifyPhantomAgentStudyLedger(study)
  const sql=mockDb()
  await assert.rejects(syncRunpodPhantomResearchCases({
    inbox,db:sql.db,maximumCases:10,expectedJournalHead:'f'.repeat(64),
    expectedJournalCount:head.count,
  }),/PHANTOM_RUNPOD_RESEARCH_WITNESS_HEAD_MISMATCH/)
  await assert.rejects(syncRunpodPhantomResearchCases({
    inbox,db:sql.db,maximumCases:10,expectedJournalHead:head.headDigest,
    expectedJournalCount:head.count+1,
  }),/PHANTOM_RUNPOD_RESEARCH_WITNESS_HEAD_MISMATCH/)
  await assert.rejects(syncRunpodPhantomResearchCases({
    inbox,db:sql.db,maximumCases:10,expectedJournalHead:head.headDigest,
  }),/PHANTOM_RUNPOD_RESEARCH_WITNESS_HEAD_MISMATCH/)
  assert.equal(sql.calls(),0)
}))

test('exact signed-head fence admits one research case and idempotent replay',async()=>withStudy(async({study,inbox})=>{
  const head=await verifyPhantomAgentStudyLedger(study)
  const sql=mockDb()
  const run=()=>syncRunpodPhantomResearchCases({
    inbox,db:sql.db,maximumCases:10,
    expectedJournalHead:head.headDigest,expectedJournalCount:head.count,
  })
  const first=await run()
  assert.equal(first.inserted,1)
  assert.equal(first.replayed,0)
  assert.equal(first.admittedStudyHead,head.headDigest)
  const again=await run()
  assert.equal(again.inserted,0)
  assert.equal(again.replayed,1)
}))

test('new observation after witness refuses import of unwitnessed newer study',async()=>withStudy(async({study,inbox})=>{
  const witnessed=await verifyPhantomAgentStudyLedger(study)
  await appendPhantomAgentStudy({options:study,verified:snap(102,secondAt,'b'),writtenAt:secondAt})
  await syncPhantomAgentResearchInbox(inbox)
  const sql=mockDb()
  await assert.rejects(syncRunpodPhantomResearchCases({
    inbox,db:sql.db,maximumCases:10,
    expectedJournalHead:witnessed.headDigest,expectedJournalCount:witnessed.count,
  }),/PHANTOM_RUNPOD_RESEARCH_WITNESS_HEAD_MISMATCH/)
  assert.equal(sql.calls(),0)
}))

test('new observation during DB inserts fails success receipt and cannot masquerade as witnessed',async()=>withStudy(async({study,inbox})=>{
  const witnessed=await verifyPhantomAgentStudyLedger(study)
  const sql=mockDb(async n=>{
    if(n===1)await appendPhantomAgentStudy({
      options:study,verified:snap(102,secondAt,'b'),writtenAt:secondAt,
    })
  })
  await assert.rejects(syncRunpodPhantomResearchCases({
    inbox,db:sql.db,maximumCases:10,
    expectedJournalHead:witnessed.headDigest,expectedJournalCount:witnessed.count,
  }),/PHANTOM_RUNPOD_RESEARCH_SOURCE_CHANGED_DURING_WRITE/)
  assert.equal(sql.calls(),1)
}))
