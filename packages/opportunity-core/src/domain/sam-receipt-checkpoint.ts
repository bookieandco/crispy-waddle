import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto'
import { SAM_RECEIPT_SOURCES, type SamReceiptObservation, type SamReceiptWindow } from './sam-readonly-receipt-feed.js'
import type { SamExternalReceipt, SamExternalSource } from './sam-external-safety-audit.js'

/** SAM-SAFETY-LEDGER.14–.15: Node/server-only verification. NOT exported
 * from the browser-facing opportunity-core package root.
 * Trusted keys MUST come from the operator's independently controlled config.
 * Never import or accept a signing key from an untrusted feed/checkpoint.
 */
export type SamReceiptCheckpoint={
  source:SamExternalSource
  window:SamReceiptWindow
  snapshotId:string
  totalCount:number
  sha256:string
  readFence:string
  signerId:string
  signedAt:string
  expiresAt:string
  signatureBase64:string
}
export type SamCheckpointVerification={
  source:SamExternalSource
  integrityVerified:boolean
  reasons:string[]
  safetyEvidenceComplete:false
  productionAuthority:false
}

const canonicalReceipt=(r:SamExternalReceipt)=>({
  id:r.id,operationId:r.operationId,surface:r.surface,source:r.source,
  status:r.status,observedAt:r.observedAt,
  authorizationId:r.authorizationId??null,externalRef:r.externalRef??null,
  destinationRef:r.destinationRef??null,
})
export function digestSamReceiptObservation(observation:SamReceiptObservation):string{
  const sorted=observation.receipts.map(canonicalReceipt).sort((a,b)=>a.id.localeCompare(b.id))
  return createHash('sha256').update(JSON.stringify(sorted),'utf8').digest('hex')
}
export function samCheckpointSigningPayload(c:Omit<SamReceiptCheckpoint,'signatureBase64'>):Buffer{
  return Buffer.from(JSON.stringify({
    source:c.source,window:{from:c.window.from,through:c.window.through},
    snapshotId:c.snapshotId,totalCount:c.totalCount,sha256:c.sha256,
    readFence:c.readFence,signerId:c.signerId,signedAt:c.signedAt,expiresAt:c.expiresAt,
  }),'utf8')
}
const nonblank=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0

/** Verifies real Ed25519 over canonical snapshot metadata AND receipt digest.
 * It cannot prove that a provider collected every action in the world.
 */
export function verifySamReceiptCheckpoint(input:{
  observation:SamReceiptObservation
  checkpoint:SamReceiptCheckpoint
  trustedPublicKeys:Readonly<Record<string,string>>
  verifiedAt:string
}):SamCheckpointVerification{
  const {observation:o,checkpoint:c}=input
  const reasons:string[]=[]
  const now=Date.parse(input.verifiedAt)
  const issued=Date.parse(c.signedAt),expiry=Date.parse(c.expiresAt)
  if(!Number.isFinite(now)||!Number.isFinite(issued)||!Number.isFinite(expiry)||
    now<issued||now>=expiry||expiry-issued>7*86_400_000){
    reasons.push('SAM_CHECKPOINT_TIME_INVALID')
  }
  if(!SAM_RECEIPT_SOURCES.includes(c.source)||c.source!==o.source||
    c.window.from!==o.window.from||c.window.through!==o.window.through||
    c.snapshotId!==o.snapshotId||c.totalCount!==o.totalCount||
    !nonblank(c.readFence)||!nonblank(c.signerId)){
    reasons.push('SAM_CHECKPOINT_SCOPE_MISMATCH')
  }
  if(c.sha256!==digestSamReceiptObservation(o))reasons.push('SAM_CHECKPOINT_DIGEST_MISMATCH')
  // No trust-on-first-use: self-supplied certs/keys do not qualify.
  if(!Object.prototype.hasOwnProperty.call(input.trustedPublicKeys,c.signerId)||
    !nonblank(input.trustedPublicKeys[c.signerId])){
    reasons.push('SAM_CHECKPOINT_SIGNER_UNTRUSTED')
  }
  const sig=Buffer.from(c.signatureBase64,'base64')
  if(sig.length!==64||sig.toString('base64')!==c.signatureBase64){
    reasons.push('SAM_CHECKPOINT_SIGNATURE_MALFORMED')
  }
  if(!reasons.length){
    try{
      const {signatureBase64:_,...unsigned}=c
      const key=createPublicKey(input.trustedPublicKeys[c.signerId])
      if(key.asymmetricKeyType!=='ed25519'||!verifySignature(
        null,samCheckpointSigningPayload(unsigned),key,sig)){
        reasons.push('SAM_CHECKPOINT_SIGNATURE_INVALID')
      }
    }catch{reasons.push('SAM_CHECKPOINT_KEY_INVALID')}
  }
  return {source:o.source,integrityVerified:reasons.length===0,reasons,
    safetyEvidenceComplete:false,productionAuthority:false}
}
export type SamReceiptCoverageReport={
  status:'blocked'
  requiredSources:SamExternalSource[]
  verifiedSources:SamExternalSource[]
  missingSources:SamExternalSource[]
  gaps:string[]
  safetyEvidenceComplete:false
  productionAuthority:false
}

/** Checks roster coverage and independently pinned signature outcomes; still
 * BLOCKS full production certification until real external sink completeness,
 * off-host writer attestation, approval linkage and forensic time fence exist.
 */
export function assessSamReceiptCoverage(input:{
  window:SamReceiptWindow
  observations:SamReceiptObservation[]
  checkpoints:SamCheckpointVerification[]
}):SamReceiptCoverageReport{
  const requiredSources=[...SAM_RECEIPT_SOURCES]
  const gaps:string[]=[]
  const verifiedSources:SamExternalSource[]=[]
  for(const source of requiredSources){
    const obs=input.observations.filter(o=>o.source===source)
    const checks=input.checkpoints.filter(o=>o.source===source)
    if(obs.length!==1||checks.length!==1){
      gaps.push(`SAM_RECEIPT_MISSING_OR_DUPLICATE_SOURCE:${source}`)
      continue
    }
    if(!checks[0].integrityVerified||obs[0].window.from!==input.window.from||
      obs[0].window.through!==input.window.through||obs[0].independentlyVerified!==false||
      obs[0].productionAuthority!==false||obs[0].totalCount!==obs[0].receipts.length){
      gaps.push(`SAM_RECEIPT_SOURCE_UNVERIFIED:${source}`)
      continue
    }
    verifiedSources.push(source)
  }
  // This is an integrity preflight, not a completeness admission. Signed
  // provider claims do not establish independent uninstrumented side channels.
  gaps.push('SAM_RECEIPT_NO_END_TO_END_EXTERNAL_SINK_COMPLETENESS_ATTESTATION')
  gaps.push('SAM_RECEIPT_NO_SEALED_CROSS_SOURCE_WATERMARK_AND_APPROVAL_RECONCILIATION')
  return {status:'blocked',requiredSources,verifiedSources,
    missingSources:requiredSources.filter(s=>!verifiedSources.includes(s)),gaps,
    safetyEvidenceComplete:false,productionAuthority:false}
}
