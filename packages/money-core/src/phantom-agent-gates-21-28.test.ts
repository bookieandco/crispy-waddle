import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, chmod, symlink, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { auditPhantomOwnerHostFiles } from './phantom-agent-host-preflight.js'
import { assertPhantomResearchDatabaseRole, validatePhantomResearchDatabaseUrl } from './phantom-agent-research-db-admission.js'
import { appendPhantomAgentStudy } from './phantom-agent-study-ledger.js'
import { syncPhantomAgentResearchInbox, readPhantomAgentResearchInbox } from './phantom-agent-research-inbox.js'
import { verifyRunpodPhantomResearchReadback } from './phantom-agent-runpod-readback.js'
import { evaluatePhantomMergeReadiness, PHANTOM_READONLY_STACK } from './phantom-agent-release-gate.js'
import { syncRunpodPhantomResearchCases, type PhantomResearchDb } from './phantom-agent-runpod-research-ingest.js'
import type { PhantomAgentVerifiedNativeSol } from './phantom-agent-chain-verification.js'

const walletId='05307b6d-2d5a-43d6-8d11-08db650a169b'
const address='H8FpYTgx4Uy9aF9Nk9fCTqKKFLYQ9KfC6UJhMkMDzCBh'
const when='2026-10-14T21:00:00.000Z'
const later='2026-10-14T21:00:05.000Z'
const key='local-study-fixture-key-abcdef'.padEnd(70,'x')
const inboxKey='different-shadows-fixture-key-ghijk'.padEnd(70,'y')
async function sandbox<T>(run:(dir:string)=>Promise<T>){
  const dir=await mkdtemp(join(tmpdir(),'phantom-gates-'))
  try{return await run(dir)}finally{await rm(dir,{recursive:true,force:true})}
}
function snap(slot:number,at:string,letter:string):PhantomAgentVerifiedNativeSol{
  return {
    provider:'solana-rpc-independent',walletId,address,slot,
    balanceLamports:'2500000000',commitment:'confirmed',observedAt:at,
    evidenceHash:letter.repeat(64),phantomEvidenceHash:'c'.repeat(64),
    authority:'CHAIN_OBSERVATION_ONLY',financialAuthority:'NONE',
    canSign:false,canExecute:false,canAuthorizeLive:false,spendableBalanceMinor:null,
  }
}
function databaseRow(){
  return {
    role_name:'phantom_research_ingest',is_superuser:false,
    bypasses_rls:false,can_create_role:false,can_create_db:false,
    can_create_schema_objects:false,can_read_research:true,
    can_insert_research:true,can_update_research:false,
    can_delete_research:false,can_truncate_research:false,
    can_mutate_other_money_tables:false,
  }
}
test('21 dedicated PostgreSQL TLS connection cannot reuse general SHARK credential',()=>{
  const dedicated='postgresql://restricted:secret@db.private.invalid/research?sslmode=verify-full'
  assert.equal(validatePhantomResearchDatabaseUrl(dedicated),dedicated)
  for(const bad of [
    'postgresql://restricted:secret@db.private.invalid/research?sslmode=disable',
    'postgresql://restricted:secret@db.private.invalid/research?sslmode=require',
    'postgresql://restricted:secret@db.private.invalid/research',
    'http://restricted:secret@db.private.invalid/research?sslmode=verify-full',
    'postgresql://db.private.invalid/research?sslmode=verify-full',
  ])assert.throws(()=>validatePhantomResearchDatabaseUrl(bad),/PHANTOM_RESEARCH_DATABASE_DEDICATED_TLS_REQUIRED/)
  assert.throws(()=>validatePhantomResearchDatabaseUrl(dedicated,dedicated),
    /PHANTOM_RESEARCH_DATABASE_DEDICATED_TLS_REQUIRED/)
})
test('22 privileged Postgres principal is rejected before any wallet research insert',async()=>{
  const db=(r:Record<string,unknown>):PhantomResearchDb=>({
    async query(sql){assert.match(sql,/has_table_privilege/);return {rows:[r],rowCount:1}},
  })
  const good=await assertPhantomResearchDatabaseRole(db(databaseRow()))
  assert.equal(good.scope,'RESEARCH_SELECT_INSERT_ONLY')
  assert.equal(good.canExecute,false)
  for(const elevation of [
    {is_superuser:true},{can_create_schema_objects:true},{can_update_research:true},
    {can_mutate_other_money_tables:true},{can_insert_research:false},
    {can_truncate_research:true},{role_name:'postgres'},
  ])await assert.rejects(assertPhantomResearchDatabaseRole(
    db({...databaseRow(),...elevation})),/PHANTOM_RESEARCH_DATABASE_ROLE_NOT_ISOLATED/)
})
test('23 incomplete locally authenticated research inbox cannot be imported as complete',async()=>sandbox(async dir=>{
  const study={path:join(dir,'study.jsonl'),hmacKey:key,expectedWalletId:walletId,expectedAddress:address}
  const inbox={study,inboxPath:join(dir,'inbox.jsonl'),inboxHmacKey:inboxKey}
  await appendPhantomAgentStudy({options:study,verified:snap(101,when,'a'),writtenAt:when})
  await syncPhantomAgentResearchInbox(inbox)
  await appendPhantomAgentStudy({options:study,verified:snap(102,later,'b'),writtenAt:later})
  let calls=0
  const db:PhantomResearchDb={async query(){calls++;return {rows:[],rowCount:0}}}
  await assert.rejects(syncRunpodPhantomResearchCases({inbox,db,maximumCases:100}),
    /PHANTOM_RUNPOD_RESEARCH_INBOX_NOT_AT_STUDY_HEAD/)
  assert.equal(calls,0)
  await syncPhantomAgentResearchInbox(inbox)
  const stored=new Map<string,Record<string,unknown>>()
  const db2:PhantomResearchDb={
    async query(sql,params=[]){
      if(sql.includes('INSERT INTO')){
        const id=String(params[0])
        if(stored.has(id))return {rowCount:0,rows:[]}
        stored.set(id,{source_study_digest:params[8],observation_json:JSON.parse(String(params[9]))})
        return {rowCount:1,rows:[{case_id:id}]}
      }
      const row=stored.get(String(params[0]))
      return {rowCount:row?1:0,rows:row?[row]:[]}
    },
  }
  const first=await syncRunpodPhantomResearchCases({inbox,db:db2,maximumCases:100})
  assert.equal(first.inserted,2)
  assert.match(first.admittedStudyHead,/^[0-9a-f]{64}$/)
  const repeat=await syncRunpodPhantomResearchCases({inbox,db:db2,maximumCases:100})
  assert.equal(repeat.inserted,0);assert.equal(repeat.replayed,2)
}))
test('24 host path ancestry rejects symlink and writable parent directories',async()=>sandbox(async dir=>{
  const secure=join(dir,'private')
  await mkdir(secure,{mode:0o700})
  const binaryPath=join(secure,'phantom-mcp')
  const sessionPath=join(secure,'session.json')
  await writeFile(binaryPath,'reviewed-binary-fixture',{mode:0o700})
  await writeFile(sessionPath,'session-fixture',{mode:0o600})
  const expectedBinarySha256=createHash('sha256').update('reviewed-binary-fixture').digest('hex')
  const props={binaryPath,sessionPath,expectedBinarySha256,ownerUid:process.getuid?.()??1001}
  await auditPhantomOwnerHostFiles(props)
  const alias=join(dir,'alias')
  await symlink(secure,alias)
  await assert.rejects(auditPhantomOwnerHostFiles({...props,binaryPath:join(alias,'phantom-mcp')}),
    /PHANTOM_HOST_DIRECTORY_UNSAFE/)
  await chmod(secure,0o777)
  await assert.rejects(auditPhantomOwnerHostFiles(props),/PHANTOM_HOST_DIRECTORY_UNSAFE/)
}))

test('25/26 read-after-write rejects missing, conflicting or execution-enabled rows',async()=>sandbox(async dir=>{
  const study={path:join(dir,'study.jsonl'),hmacKey:key,expectedWalletId:walletId,expectedAddress:address}
  const inbox={study,inboxPath:join(dir,'inbox.jsonl'),inboxHmacKey:inboxKey}
  await appendPhantomAgentStudy({options:study,verified:snap(101,when,'a'),writtenAt:when})
  await syncPhantomAgentResearchInbox(inbox)
  const wanted=(await readPhantomAgentResearchInbox(inbox))[0]!
  const row={
    case_id:wanted.caseId,parent_case_id:wanted.parentCaseId,
    observation_json:wanted,authority:'SHADOW_LEARNING_ONLY',
    can_execute:false,can_authorize_live:false,chain_id:'solana-mainnet-beta',
  }
  const db=(rows:Record<string,unknown>[]):PhantomResearchDb=>({
    async query(sql,args=[]){
      assert.match(sql,/SELECT case_id,parent_case_id/)
      assert.deepEqual(args,[walletId])
      return {rowCount:rows.length,rows}
    },
  })
  const receipt=await verifyRunpodPhantomResearchReadback({db:db([row]),inbox})
  assert.equal(receipt.verifiedCases,1)
  assert.equal(receipt.canExecute,false)
  for(const corrupt of [
    [],[{...row,can_execute:true}],[{...row,chain_id:'devnet'}],
    [{...row,observation_json:{...wanted,nativeBalanceLamports:'999'}}],
    [{...row,case_id:'wrong-case'}],
  ]){
    await assert.rejects(verifyRunpodPhantomResearchReadback({db:db(corrupt),inbox}),
      /PHANTOM_RUNPOD_READBACK_/)
  }
})

test('28 stacked draft PRs and missing owner evidence cannot accidentally become deployment approval',()=>{
  const stages=PHANTOM_READONLY_STACK.map(stage=>({
    ...stage,draft:true,merged:false,
    exactHeadCi:'PASS' as const,independentReview:'PENDING' as const,
  }))
  const nextPr={
    pr:1240,base:PHANTOM_READONLY_STACK[4].head,
    head:'feat/purse-phantom-mcp-21-28-20261014',
    draft:true,merged:false,
    exactHeadCi:'PASS' as const,independentReview:'PENDING' as const,
  }
  const result=evaluatePhantomMergeReadiness({
    stages,nextPr,hostReadOnlyCommissioned:false,
    externalRestoreIndependentlyVerified:false,
    realPhantomReadbackVerified:false,
  })
  assert.equal(result.status,'BLOCKED')
  assert.equal(result.finalDeploymentCertified,false)
  assert.equal(result.canExecute,false)
  assert.equal(result.canFundWallet,false)
  assert.ok(result.blockers.includes('PHANTOM_HOST_RUNTIME_NOT_CERTIFIED'))
  assert.ok(result.blockers.includes('PHANTOM_EXTERNAL_RESTORE_NOT_VERIFIED'))
  const tampered=evaluatePhantomMergeReadiness({
    stages,nextPr:{...nextPr,base:'main'},hostReadOnlyCommissioned:true,
    externalRestoreIndependentlyVerified:true,realPhantomReadbackVerified:true,
  })
  assert.ok(tampered.blockers.some(x=>x.startsWith('PHANTOM_STACK_TOPOLOGY_INVALID')))
})
