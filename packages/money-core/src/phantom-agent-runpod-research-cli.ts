import { constants } from 'node:fs'
import { open } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { createRunpodShadowPool } from './shark-shadow-runpod-store.js'
import { verifyExternalPhantomCheckpoint, type PhantomExternalCheckpoint } from './phantom-agent-external-checkpoint.js'
import { syncRunpodPhantomResearchCases } from './phantom-agent-runpod-research-ingest.js'

/**
 * Trusted owner-host command only, no API route and no model tool.
 * Do not enable until migration 033 is independently reviewed/applied and
 * a least-privilege INSERT/SELECT-only research role is configured.
 */
async function main(){
  const e=process.env
  if(e.PHANTOM_AGENT_RESEARCH_DB_IMPORT_ENABLED!=='OWNER_APPROVED_READ_ONLY')
    throw Error('PHANTOM_RUNPOD_IMPORT_NOT_AUTHORIZED')
  const studyPath=e.PHANTOM_AGENT_STUDY_JOURNAL_PATH??''
  const inboxPath=e.PHANTOM_AGENT_SHADOW_INBOX_PATH??''
  const anchorPath=e.PHANTOM_AGENT_EXTERNAL_CHECKPOINT_PATH??''
  const gitHead=e.PHANTOM_AGENT_APPROVED_GIT_HEAD??''
  const archiveHash=e.PHANTOM_AGENT_TRUSTED_ARCHIVE_SHA256??''
  if (![studyPath,inboxPath,anchorPath].every(isAbsolute) ||
      !e.SHARK_SHADOW_DATABASE_URL || !e.PHANTOM_AGENT_WITNESS_PUBKEY_PEM ||
      !e.PHANTOM_AGENT_STUDY_HMAC_KEY || !e.PHANTOM_AGENT_RESEARCH_INBOX_HMAC_KEY) {
    throw Error('PHANTOM_RUNPOD_IMPORT_CONFIG_INCOMPLETE')
  }
  const study={
    path:studyPath,hmacKey:e.PHANTOM_AGENT_STUDY_HMAC_KEY,
    expectedWalletId:e.PHANTOM_AGENT_PIN_WALLET_ID??'',
    expectedAddress:e.PHANTOM_AGENT_PIN_SOLANA_ADDRESS??'',
  }
  const file=await open(anchorPath,constants.O_RDONLY|constants.O_NOFOLLOW)
  let checkpoint:PhantomExternalCheckpoint
  try {
    const s=await file.stat()
    if(!s.isFile() || s.size<=0 || s.size>8192 || (s.mode&0o022)!==0)
      throw Error('PHANTOM_RUNPOD_IMPORT_ANCHOR_FILE_UNSAFE')
    checkpoint=JSON.parse(await file.readFile({encoding:'utf8'})) as PhantomExternalCheckpoint
  }finally{await file.close()}
  const verified=await verifyExternalPhantomCheckpoint({
    checkpoint,study,expectedGitHead:gitHead,
    expectedArchiveSha256:archiveHash,
    trustedWitnessPublicKeyPem:e.PHANTOM_AGENT_WITNESS_PUBKEY_PEM,
    assessedAt:new Date().toISOString(),
  })
  const db=createRunpodShadowPool({max:1})
  try {
    const receipt=await syncRunpodPhantomResearchCases({
      inbox:{
        study,inboxPath,inboxHmacKey:e.PHANTOM_AGENT_RESEARCH_INBOX_HMAC_KEY,
      },
      db,maximumCases:10000,
    })
    process.stdout.write(JSON.stringify({
      status:'RESEARCH_ONLY_SYNC_COMPLETE',
      inserted:receipt.inserted,replayed:receipt.replayed,
      observedCases:receipt.observedCases,
      witnessReceiptHash:verified.witnessReceiptHash,
      liveCommissioned:false,canExecute:false,
    })+'\n')
  }finally{await db.end()}
}
void main().catch(()=>{
  process.stderr.write('PHANTOM_RUNPOD_READONLY_IMPORT_BLOCKED\n')
  process.exitCode=1
})
