import {sealRecastEvidence,verifyRecastEvidenceSeal} from './recast-review-digest'
import type {RecastUnpersistedReceipt} from './recast-review-insert-manifest'

const uuid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

/** Revocation must come from an authenticated, independently approved
 * server-side review. This is an offline manifest builder, NOT a UI endpoint
 * and NOT a database writer. A prior receipt must be fetched and verified by
 * the server; do not supply it from a request JSON body. */
export function prepareRecastOwnerRevocation(input:{
  trustedPrior:RecastUnpersistedReceipt
  newServerReceiptId:string
  authenticatedOwnerUserId:string
  explicitOwnerRevocation:true
  reason:string
  reviewedAt:string
  expiresAt:string
  now:string
}):RecastUnpersistedReceipt{
  const {trustedPrior:prior}=input
  const now=Date.parse(input.now)
  const reviewed=Date.parse(input.reviewedAt)
  const expires=Date.parse(input.expiresAt)
  if(prior.disposition!=='UNPERSISTED_INSERT_MANIFEST'||
    prior.status!=='approved'||prior.kind==='media-probe'||!uuid(prior.id)||!uuid(input.newServerReceiptId)||
    input.newServerReceiptId===prior.id||
    prior.owner_user_id!==input.authenticatedOwnerUserId||
    input.explicitOwnerRevocation!==true||
    !verifyRecastEvidenceSeal(prior.evidence,prior.evidence_sha256)||
    input.reason.trim().length<12||input.reason.trim().length>500||
    !Number.isFinite(now)||!Number.isFinite(reviewed)||!Number.isFinite(expires)||
    reviewed>now||now-reviewed>60_000||expires<=now||
    expires-reviewed>30*60_000){
    throw new Error('DIRECTOR_RECAST_OWNER_REJECTION_NOT_VERIFIED')
  }
  const evidence={
    previousReceiptId:prior.id,
    revokedByOwnerUserId:input.authenticatedOwnerUserId,
    explicitRevocation:true,
    reason:input.reason.trim(),
    kind:prior.kind,
    sourceVideoSha256:prior.source_video_sha256,
    characterImageSha256:prior.character_image_sha256,
    sourceAudioSha256:prior.source_audio_sha256,
  }
  return Object.freeze({
    ...prior,
    id:input.newServerReceiptId,
    status:'rejected',
    reviewed_by_user_id:input.authenticatedOwnerUserId,
    method:'human-review',
    reviewed_at:input.reviewedAt,
    expires_at:input.expiresAt,
    evidence,
    evidence_sha256:sealRecastEvidence(evidence),
    disposition:'UNPERSISTED_INSERT_MANIFEST',
  })
}