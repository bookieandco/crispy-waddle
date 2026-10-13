import { verify as verifySignature, createHash, createPublicKey } from 'node:crypto'
import type { PhantomStudyStoreOptions } from './phantom-agent-study-ledger.js'
import { verifyPhantomAgentStudyLedger } from './phantom-agent-study-ledger.js'

/**
 * A separately controlled Ed25519 witness signs the canonical digest/head
 * AFTER it receives and verifies an off-host archive. Signing occurs outside
 * the Phantom process and this library provides NO signing/private key API.
 *
 * A valid signature proves the pinned witness signed these exact fields;
 * it cannot independently prove cloud upload unless the operator verifies
 * the referenced remote provider receipt.
 */
export type PhantomExternalCheckpoint = Readonly<{
  schema:'jhadina.phantom-study.external-checkpoint.v1'
  walletId:string
  address:string
  journalHead:string
  journalCount:number
  archiveSha256:string
  externalReceiptId:string
  gitHead:string
  witnessedAt:string
  signatureBase64:string
}>
const hex=/^[0-9a-f]{64}$/
const commit=/^[0-9a-f]{40}$/
const rid=/^[a-zA-Z0-9:._/-]{16,256}$/
export function phantomCheckpointPayload(c:Omit<PhantomExternalCheckpoint,'signatureBase64'>):Buffer {
  return Buffer.from(JSON.stringify({
    schema:c.schema,walletId:c.walletId,address:c.address,journalHead:c.journalHead,
    journalCount:c.journalCount,archiveSha256:c.archiveSha256,
    externalReceiptId:c.externalReceiptId,gitHead:c.gitHead,witnessedAt:c.witnessedAt,
  }))
}
export async function verifyExternalPhantomCheckpoint(input:Readonly<{
  checkpoint:PhantomExternalCheckpoint
  trustedWitnessPublicKeyPem:string
  study:PhantomStudyStoreOptions
  expectedGitHead:string
  expectedArchiveSha256:string
  assessedAt:string
}>) {
  const c=input.checkpoint
  const now=Date.parse(input.assessedAt),seen=Date.parse(c.witnessedAt)
  if (c.schema!=='jhadina.phantom-study.external-checkpoint.v1' ||
      c.walletId!==input.study.expectedWalletId || c.address!==input.study.expectedAddress ||
      !hex.test(c.journalHead) || !hex.test(c.archiveSha256) ||
      c.archiveSha256!==input.expectedArchiveSha256 ||
      !commit.test(input.expectedGitHead) || c.gitHead!==input.expectedGitHead ||
      !rid.test(c.externalReceiptId) || !Number.isSafeInteger(c.journalCount) ||
      c.journalCount<=0 || !Number.isFinite(now) || !Number.isFinite(seen) ||
      seen>now+30_000 || now-seen>30*24*3600_000 ||
      typeof c.signatureBase64!=='string' || c.signatureBase64.length>256) {
    throw new Error('PHANTOM_EXTERNAL_CHECKPOINT_METADATA_INVALID')
  }
  let key
  try {
    key=createPublicKey(input.trustedWitnessPublicKeyPem)
    if(key.asymmetricKeyType!=='ed25519')throw Error('key_type')
  } catch {throw new Error('PHANTOM_EXTERNAL_WITNESS_KEY_INVALID')}
  const signature=Buffer.from(c.signatureBase64,'base64')
  if(signature.length!==64 || !verifySignature(null,phantomCheckpointPayload(c),key,signature)) {
    throw new Error('PHANTOM_EXTERNAL_CHECKPOINT_SIGNATURE_INVALID')
  }
  const onHost=await verifyPhantomAgentStudyLedger(input.study)
  if(c.journalHead!==onHost.headDigest || c.journalCount!==onHost.count) {
    throw new Error('PHANTOM_EXTERNAL_CHECKPOINT_LEDGER_DIVERGENCE')
  }
  return Object.freeze({
    receiptId:c.externalReceiptId,
    witnessReceiptHash:createHash('sha256').update(phantomCheckpointPayload(c)).digest('hex'),
    journalHead:c.journalHead,
    count:c.journalCount,
    checkpointSignatureVerified:true as const,
    verifiedExternalUpload:false as const, // requires provider receipt check
    isolatedRestoreVerified:false as const, // separately proven via restore
    authority:'EXTERNAL_AUDIT_EVIDENCE_ONLY' as const,
    canExecute:false as const,
  })
}
