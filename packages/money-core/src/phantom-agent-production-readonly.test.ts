import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, chmod, rm, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { auditPhantomOwnerHostFiles } from './phantom-agent-host-preflight.js'
import { phantomCheckpointPayload, verifyExternalPhantomCheckpoint, type PhantomExternalCheckpoint } from './phantom-agent-external-checkpoint.js'
import { appendPhantomAgentStudy, verifyPhantomAgentStudyLedger } from './phantom-agent-study-ledger.js'
import { syncPhantomAgentResearchInbox, readPhantomAgentResearchInbox } from './phantom-agent-research-inbox.js'
import { syncRunpodPhantomResearchCases, appendRunpodPhantomResearchCase, type PhantomResearchDb } from './phantom-agent-runpod-research-ingest.js'
import type { PhantomAgentVerifiedNativeSol } from './phantom-agent-chain-verification.js'

const walletId='05307b6d-2d5a-43d6-8d11-08db650a169b'
const address='H8FpYTgx4Uy9aF9Nk9fCTqKKFLYQ9KfC6UJhMkMDzCBh'
const at='2026-10-12T22:10:00.000Z'
const gitHead='a'.repeat(40)
const sourceKey='local-study-test-'+ 'p'.repeat(45)
const inboxKey='distinct-inbox-test-'+ 'q'.repeat(45)
async function sandbox<T>(fn:(dir:string)=>Promise<T>){
  const dir=await mkdtemp(join(tmpdir(),'phantom-final-'))
  try{return await fn(dir)}finally{await rm(dir,{recursive:true,force:true})}
}
function snapshot(slot=101):PhantomAgentVerifiedNativeSol{
  return {
    provider:'solana-rpc-independent',walletId,address,slot,balanceLamports:'2500000000',
    commitment:'confirmed',observedAt:at,evidenceHash:'b'.repeat(64),
    phantomEvidenceHash:'c'.repeat(64),authority:'CHAIN_OBSERVATION_ONLY',
    financialAuthority:'NONE',canSign:false,canExecute:false,
    canAuthorizeLive:false,spendableBalanceMinor:null,
  }
}
test('owner-host preflight validates pinned binary and private session without reading wallet data',async()=>sandbox(async dir=>{
  const folder=join(dir,'secure')
  await mkdir(folder,{mode:0o700})
  const binaryPath=join(folder,'reviewed-mcp')
  const sessionPath=join(folder,'session.json')
  await writeFile(binaryPath,'version-pinned-phantom-mcp-placeholder', {mode:0o700})
  await writeFile(sessionPath,'private-session-test-content', {mode:0o600})
  const digest=createHash('sha256').update('version-pinned-phantom-mcp-placeholder').digest('hex')
  const config={binaryPath,sessionPath,expectedBinarySha256:digest,ownerUid:process.getuid?.()??1001}
  const admitted=await auditPhantomOwnerHostFiles(config)
  assert.equal(admitted.binaryPathVerified,true)
  assert.equal(admitted.ownerSessionPermissionsVerified,true)
  assert.equal(admitted.signerIsolationCertified,false)
  assert.equal(admitted.canExecute,false)
  await assert.rejects(auditPhantomOwnerHostFiles({...config,expectedBinarySha256:'f'.repeat(64)}),/PHANTOM_HOST_BINARY_DIGEST_CHANGED/)
  await chmod(sessionPath,0o644)
  await assert.rejects(auditPhantomOwnerHostFiles(config),/PHANTOM_HOST_FILE_UNSAFE/)
  await chmod(sessionPath,0o600)
  const symlinkPath=join(folder,'session-symlink')
  await symlink(sessionPath,symlinkPath)
  await assert.rejects(auditPhantomOwnerHostFiles({...config,sessionPath:symlinkPath}))
}))
test('independent Ed25519 checkpoint binds trusted signer to verified study head + archive digest',async()=>sandbox(async dir=>{
  const study={path:join(dir,'study.jsonl'),hmacKey:sourceKey,expectedWalletId:walletId,expectedAddress:address}
  await appendPhantomAgentStudy({options:study,verified:snapshot(),writtenAt:at})
  const {headDigest,count}=await verifyPhantomAgentStudyLedger(study)
  const {privateKey,publicKey}=generateKeyPairSync('ed25519')
  const base={
    schema:'jhadina.phantom-study.external-checkpoint.v1' as const,
    walletId,address,journalHead:headDigest,journalCount:count,
    archiveSha256:'d'.repeat(64),
    externalReceiptId:'provider:confirmed-upload:123456',
    gitHead,witnessedAt:at,
  }
  const signed:PhantomExternalCheckpoint={
    ...base,signatureBase64:sign(null,phantomCheckpointPayload(base),privateKey).toString('base64'),
  }
  const args={checkpoint:signed,trustedWitnessPublicKeyPem:publicKey.export({type:'spki',format:'pem'}).toString(),
    study,expectedGitHead:gitHead,expectedArchiveSha256:base.archiveSha256,assessedAt:at}
  const verified=await verifyExternalPhantomCheckpoint(args)
  assert.equal(verified.checkpointSignatureVerified,true)
  assert.equal(verified.verifiedExternalUpload,false)
  assert.equal(verified.canExecute,false)
  await assert.rejects(verifyExternalPhantomCheckpoint({
    ...args,checkpoint:{...signed,journalCount:count+1},
  }),/PHANTOM_EXTERNAL_CHECKPOINT_SIGNATURE_INVALID/)
  await assert.rejects(verifyExternalPhantomCheckpoint({
    ...args,expectedArchiveSha256:'e'.repeat(64),
  }),/PHANTOM_EXTERNAL_CHECKPOINT_METADATA_INVALID/)
  const other=generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'}).toString()
  await assert.rejects(verifyExternalPhantomCheckpoint({
    ...args,trustedWitnessPublicKeyPem:other,
  }),/PHANTOM_EXTERNAL_CHECKPOINT_SIGNATURE_INVALID/)
}))

function mockDb(){
  const records=new Map<string,Record<string,unknown>>()
  const sqlLog:string[]=[]
  const db:PhantomResearchDb={
    async query(sql,params=[]){
      sqlLog.push(sql)
      if(sql.includes('INSERT INTO runpod_phantom_agent_research_observations')){
        const key=String(params[0])
        if(records.has(key))return {rowCount:0,rows:[]}
        records.set(key,{source_study_digest:String(params[8]),observation_json:JSON.parse(String(params[9]))})
        return {rowCount:1,rows:[{case_id:key}]}
      }
      if(sql.includes('SELECT source_study_digest')){
        const x=records.get(String(params[0]))
        return {rowCount:x?1:0,rows:x?[x]:[]}
      }
      throw new Error('UNAPPROVED_DB_QUERY')
    },
  }
  return {db,sqlLog,records}
}
test('Runpod research importer admits source-verified observations and replays exactly once',async()=>sandbox(async dir=>{
  const study={path:join(dir,'study.jsonl'),hmacKey:sourceKey,expectedWalletId:walletId,expectedAddress:address}
  const inbox={study,inboxPath:join(dir,'shadow.jsonl'),inboxHmacKey:inboxKey}
  await appendPhantomAgentStudy({options:study,verified:snapshot(),writtenAt:at})
  await syncPhantomAgentResearchInbox(inbox)
  const studyHead=await verifyPhantomAgentStudyLedger(study)
  const {db,records,sqlLog}=mockDb()
  const first=await syncRunpodPhantomResearchCases({inbox,db,maximumCases:5,expectedJournalHead:studyHead.headDigest,expectedJournalCount:studyHead.count})
  assert.equal(first.inserted,1)
  assert.equal(first.replayed,0)
  assert.equal(first.canExecute,false)
  assert.equal(first.liveCommissioned,false)
  const second=await syncRunpodPhantomResearchCases({inbox,db,maximumCases:5,expectedJournalHead:studyHead.headDigest,expectedJournalCount:studyHead.count})
  assert.equal(second.inserted,0)
  assert.equal(second.replayed,1)
  assert.equal(records.size,1)
  assert.ok(sqlLog.every(q=>!/\b(update|delete|truncate|money_shark_shadow_decisions)\b/i.test(q)))
  const case0=(await readPhantomAgentResearchInbox(inbox))[0]!
  await assert.rejects(appendRunpodPhantomResearchCase({
    db,research:{...case0,canExecute:true} as unknown as typeof case0,
  }),/PHANTOM_RUNPOD_RESEARCH_SOURCE_INVALID/)
  const key=case0.caseId
  const prior=records.get(key)!
  records.set(key,{...prior,observation_json:{...prior.observation_json as Record<string,unknown>,nativeBalanceLamports:'9999'}})
  await assert.rejects(appendRunpodPhantomResearchCase({db,research:case0}),
    /PHANTOM_RUNPOD_RESEARCH_CONFLICT/)
}))
