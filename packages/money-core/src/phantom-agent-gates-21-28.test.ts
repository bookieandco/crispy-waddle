import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, chmod, symlink, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { auditPhantomOwnerHostFiles } from './phantom-agent-host-preflight.js'
import { assertPhantomResearchDatabaseRole, validatePhantomResearchDatabaseUrl } from './phantom-agent-research-db-admission.js'
import { appendPhantomAgentStudy } from './phantom-agent-study-ledger.js'
import { syncPhantomAgentResearchInbox } from './phantom-agent-research-inbox.js'
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
  assert.equal(first.admittedStudyHead,first.observedCases?first.admittedStudyHead:null)
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
