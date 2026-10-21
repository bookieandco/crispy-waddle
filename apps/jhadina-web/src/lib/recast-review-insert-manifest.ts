import {sealRecastEvidence} from './recast-review-digest'
import type {RecastStagedReview} from './recast-review-submission'

export type RecastUnpersistedReceipt=Readonly<{
  id:string
  project_id:string
  owner_user_id:string
  kind:'media-probe'|'tracking'|'voice'|'rights'
  source_video_asset_id:string
  character_image_asset_id:string
  source_audio_asset_id:string
  source_video_sha256:string
  character_image_sha256:string
  source_audio_sha256:string
  reviewed_by_user_id:string
  reviewed_at:string
  expires_at:string
  status:'approved'
  method:'trusted-media-probe'|'human-review'
  evidence:unknown
  evidence_sha256:string
  disposition:'UNPERSISTED_INSERT_MANIFEST'
}>
const uuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const hex=(value:string)=>/^[0-9a-f]{64}$/i.test(value)

/**
 * For a future *server-trusted* authorization path only. This module never
 * performs a DB operation or grants review, worker or cost permissions.
 * It rejects browser-shaped IDs and seals the canonical SQL payload.
 */
export function prepareRecastUnpersistedInsert(
  stage:RecastStagedReview,
  serverReceiptId:string,
  authenticatedReviewerUserId:string,
):RecastUnpersistedReceipt {
  if(stage.disposition!=='UNPERSISTED_REVIEW_PROPOSAL'||
    stage.status!=='approved'||!uuid(serverReceiptId)||
    !uuid(stage.owner_user_id)||!uuid(stage.reviewed_by_user_id)||
    !uuid(stage.source_video_asset_id)||!uuid(stage.character_image_asset_id)||
    !uuid(stage.source_audio_asset_id)||
    stage.reviewed_by_user_id!==authenticatedReviewerUserId||
    !hex(stage.source_video_sha256)||!hex(stage.character_image_sha256)||
    !hex(stage.source_audio_sha256)||
    !stage.evidence||typeof stage.evidence!=='object'||
    !(Date.parse(stage.expires_at)>Date.parse(stage.reviewed_at)))
    throw new Error('DIRECTOR_RECAST_INSERT_MANIFEST_UNTRUSTED')
  const evidenceSha256=sealRecastEvidence(stage.evidence)
  return Object.freeze({
    id:serverReceiptId,project_id:stage.project_id,
    owner_user_id:stage.owner_user_id,kind:stage.kind,
    source_video_asset_id:stage.source_video_asset_id,
    character_image_asset_id:stage.character_image_asset_id,
    source_audio_asset_id:stage.source_audio_asset_id,
    source_video_sha256:stage.source_video_sha256,
    character_image_sha256:stage.character_image_sha256,
    source_audio_sha256:stage.source_audio_sha256,
    reviewed_by_user_id:stage.reviewed_by_user_id,
    reviewed_at:stage.reviewed_at,expires_at:stage.expires_at,
    status:'approved',method:stage.method,
    evidence:stage.evidence,evidence_sha256:evidenceSha256,
    disposition:'UNPERSISTED_INSERT_MANIFEST',
  })
}
