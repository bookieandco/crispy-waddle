import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { appendPhantomAgentStudy } from './phantom-agent-study-ledger.js'
import { createEncryptedPhantomStudyBackup, restoreEncryptedPhantomStudyBackup } from './phantom-agent-encrypted-backup.js'
import { readPhantomAgentResearchInbox, syncPhantomAgentResearchInbox } from './phantom-agent-research-inbox.js'
import type { PhantomAgentVerifiedNativeSol } from './phantom-agent-chain-verification.js'
import { evaluatePhantomReadOnlyCommissioning, PHANTOM_READ_ONLY_PROOF_TYPES } from './phantom-agent-readonly-certification.js'

const walletId='05307b6d-2d5a-43d6-8d11-08db650a169b'
const address='H8FpYTgx4Uy9aF9Nk9fCTqKKFLYQ9KfC6UJhMkMDzCBh'
const hmacKey='study-owner-host-secret-'+ 'x'.repeat(45)
const inboxKey='separate-shadow-inbox-secret-'+ 'y'.repeat(45)
const encryptionKey='ab'.repeat(32)
const time='2026-10-12T21:00:00.000Z'
const later='2026-10-12T21:00:04.000Z'

async function temp<T>(run:(dir:string)=>Promise<T>) {
  const dir=await mkdtemp(join(tmpdir(),'phantom-restoration-'))
  try{return await run(dir)} finally {await rm(dir,{recursive:true,force:true})}
}
function snapshot(slot:number,at:string,letter:'a'|'b'):PhantomAgentVerifiedNativeSol {
  return {
    provider:'solana-rpc-independent',walletId,address,slot,
    balanceLamports:'1200000000',commitment:'confirmed',observedAt:at,
    evidenceHash:letter.repeat(64),phantomEvidenceHash:'c'.repeat(64),
    authority:'CHAIN_OBSERVATION_ONLY',financialAuthority:'NONE',canSign:false,
    canExecute:false,canAuthorizeLive:false,spendableBalanceMinor:null,
  }
}
test('AES-GCM backup restores into a brand-new isolated path against an independent trusted anchor',async()=>temp(async dir=>{
  const study={path:join(dir,'study.jsonl'),hmacKey,expectedWalletId:walletId,expectedAddress:address}
  await appendPhantomAgentStudy({options:study,verified:snapshot(101,time,'a'),writtenAt:time})
  const {bytes,receipt}=await createEncryptedPhantomStudyBackup({options:study,encryptionKeyHex:encryptionKey})
  assert.equal(receipt.count,1)
  assert.equal(receipt.offHostCertified,false)
  assert.equal(bytes.toString().includes('balanceLamports'),false)
  assert.equal(bytes.toString().includes('1200000000'),false)
  const destination={...study,path:join(dir,'isolated-recovery.jsonl')}
  const restore=await restoreEncryptedPhantomStudyBackup({
    archiveBytes:bytes,encryptionKeyHex:encryptionKey,
    trustedArchiveSha256:receipt.archiveSha256,
    trustedHeadDigest:receipt.head,destination,
  })
  assert.equal(restore.isolatedRestoreVerified,true)
  assert.equal(restore.canExecute,false)
  assert.equal(restore.headDigest,receipt.head)
  assert.equal(await readFile(destination.path,'utf8'),await readFile(study.path,'utf8'))
  await assert.rejects(restoreEncryptedPhantomStudyBackup({
    archiveBytes:bytes,encryptionKeyHex:encryptionKey,
    trustedArchiveSha256:receipt.archiveSha256,
    trustedHeadDigest:receipt.head,destination,
  }),/EEXIST/)
}))

test('wrong archive anchor, wrong key, corrupted ciphertext and switched wallet all fail closed',async()=>temp(async dir=>{
  const study={path:join(dir,'study.jsonl'),hmacKey,expectedWalletId:walletId,expectedAddress:address}
  await appendPhantomAgentStudy({options:study,verified:snapshot(101,time,'a'),writtenAt:time})
  const {bytes,receipt}=await createEncryptedPhantomStudyBackup({options:study,encryptionKeyHex:encryptionKey})
  const destination={...study,path:join(dir,'restore.jsonl')}
  const good={archiveBytes:bytes,encryptionKeyHex:encryptionKey,
    trustedArchiveSha256:receipt.archiveSha256,trustedHeadDigest:receipt.head,destination}
  await assert.rejects(restoreEncryptedPhantomStudyBackup({
    ...good, trustedHeadDigest:'0'.repeat(64),
  }),/PHANTOM_BACKUP_ARCHIVE_METADATA_INVALID/)
  await assert.rejects(restoreEncryptedPhantomStudyBackup({
    ...good, trustedArchiveSha256:'0'.repeat(64),
  }),/PHANTOM_BACKUP_TRUSTED_ANCHOR_OR_ARCHIVE_INVALID/)
  await assert.rejects(restoreEncryptedPhantomStudyBackup({
    ...good, encryptionKeyHex:'ef'.repeat(32),
  }),/PHANTOM_BACKUP_DECRYPTION_FAILED/)
  const badArchive=Buffer.from(bytes)
  badArchive[10]=badArchive[10]===48?49:48
  await assert.rejects(restoreEncryptedPhantomStudyBackup({
    ...good,archiveBytes:badArchive,
  }),/PHANTOM_BACKUP_TRUSTED_ANCHOR_OR_ARCHIVE_INVALID/)
  await assert.rejects(restoreEncryptedPhantomStudyBackup({
    ...good,destination:{...destination,expectedWalletId:'different-wallet'},
  }),/PHANTOM_STUDY_CHAIN_INVALID/)
  await assert.rejects(readFile(destination.path),/ENOENT/)
}))

test('research ingestion is durable, deduplicated, ordered, and permits no financial execution',async()=>temp(async dir=>{
  const study={path:join(dir,'study.jsonl'),hmacKey,expectedWalletId:walletId,expectedAddress:address}
  const inbox={study,inboxPath:join(dir,'shadow-inbox.jsonl'),inboxHmacKey:inboxKey}
  await appendPhantomAgentStudy({options:study,verified:snapshot(101,time,'a'),writtenAt:time})
  const initial=await syncPhantomAgentResearchInbox(inbox)
  assert.equal(initial.admitted,1)
  assert.equal(initial.total,1)
  assert.equal(initial.canExecute,false)
  assert.equal(initial.canAuthorizeLive,false)
  assert.equal(initial.deploymentCertified,false)
  const firstContent=await readFile(inbox.inboxPath,'utf8')
  assert.equal((await syncPhantomAgentResearchInbox(inbox)).admitted,0)
  assert.equal(await readFile(inbox.inboxPath,'utf8'),firstContent)
  await appendPhantomAgentStudy({options:study,verified:snapshot(102,later,'b'),writtenAt:later})
  assert.equal((await syncPhantomAgentResearchInbox(inbox)).admitted,1)
  const research=await readPhantomAgentResearchInbox(inbox)
  assert.equal(research.length,2)
  assert.equal(research[1]?.parentCaseId,research[0]?.caseId)
  assert.equal(research[1]?.authority,'SHADOW_LEARNING_ONLY')
  assert.equal(research[1]?.canExecute,false)
  assert.equal(research[1]?.realizedPnl,null)
  assert.equal(research[1]?.simulatedPnl,null)
  assert.equal((await syncPhantomAgentResearchInbox(inbox)).admitted,0)
}))

test('research inbox tampering and source rollback cannot be silently repaired',async()=>temp(async dir=>{
  const study={path:join(dir,'study.jsonl'),hmacKey,expectedWalletId:walletId,expectedAddress:address}
  const inbox={study,inboxPath:join(dir,'shadow-inbox.jsonl'),inboxHmacKey:inboxKey}
  await appendPhantomAgentStudy({options:study,verified:snapshot(101,time,'a'),writtenAt:time})
  await syncPhantomAgentResearchInbox(inbox)
  const raw=await readFile(inbox.inboxPath,'utf8')
  await writeFile(inbox.inboxPath,raw.replace('1200000000','5000000000'),{mode:0o600})
  await assert.rejects(syncPhantomAgentResearchInbox(inbox),/PHANTOM_RESEARCH_INBOX_SOURCE_OR_CHAIN_INVALID/)
  await writeFile(inbox.inboxPath,raw,{mode:0o600})
  await writeFile(study.path,'',{mode:0o600})
  await assert.rejects(syncPhantomAgentResearchInbox(inbox),/PHANTOM_RESEARCH_INBOX_SOURCE_ROLLBACK/)
}))

test('research inbox denies same HMAC key or wallet study file as destination',async()=>temp(async dir=>{
  const study={path:join(dir,'study.jsonl'),hmacKey,expectedWalletId:walletId,expectedAddress:address}
  await assert.rejects(syncPhantomAgentResearchInbox({
    study,inboxPath:study.path,inboxHmacKey:inboxKey,
  }),/PHANTOM_RESEARCH_INBOX_CONFIG_INVALID/)
  await assert.rejects(syncPhantomAgentResearchInbox({
    study,inboxPath:join(dir,'inbox.jsonl'),inboxHmacKey:hmacKey,
  }),/PHANTOM_RESEARCH_INBOX_CONFIG_INVALID/)
}))

test('commissioning stays BLOCKED with missing independent host, backup and exact-head evidence',()=>{
  const assessedAt='2026-10-12T21:20:00.000Z'
  const expectedGitHead='a'.repeat(40)
  const report=evaluatePhantomReadOnlyCommissioning({
    expectedGitHead,assessedAt,proofs:[],
  })
  assert.equal(report.status,'BLOCKED')
  assert.equal(report.blockerCodes.length,12)
  assert.equal(report.canExecute,false)
  assert.equal(report.liveCommissioned,false)
  assert.equal(report.productionCertified,false)
  assert.equal(report.financialAuthority,'NONE')
})

test('even a complete mock checklist only requests independent owner review, never certifies trading',()=>{
  const assessedAt='2026-10-12T21:20:00.000Z'
  const expectedGitHead='a'.repeat(40)
  const proofs=PHANTOM_READ_ONLY_PROOF_TYPES.map((kind,i)=>({
    kind,evidenceId:'independent-proof:'+i+'-receipt',
    source:'owner-host-independent-assessor',observedAt:assessedAt,
    observedHead:expectedGitHead,
  }))
  const result=evaluatePhantomReadOnlyCommissioning({
    expectedGitHead,assessedAt,proofs,
  })
  assert.equal(result.status,'READY_FOR_INDEPENDENT_OWNER_REVIEW')
  assert.equal(result.canExecute,false)
  assert.equal(result.canAuthorizeLive,false)
  assert.equal(result.liveCommissioned,false)
  assert.equal(result.productionCertified,false)
  const altered=evaluatePhantomReadOnlyCommissioning({
    expectedGitHead,assessedAt,
    proofs:[...proofs,{...proofs[0]!, observedHead:'f'.repeat(40)}],
  })
  assert.equal(altered.status,'BLOCKED')
  assert.ok(altered.blockerCodes.some(code=>code.includes('INVALID')))
})
