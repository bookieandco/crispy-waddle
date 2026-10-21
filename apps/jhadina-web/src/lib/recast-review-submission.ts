import {
  verifyRecastDuration,
  type RecastBoundMedia, type RecastCandidateSelection,
  type RecastMediaProbeResult, type RecastReviewedMedia,
  type RecastReviewedTracking, type RecastReviewedVoice,
  type RecastReviewedRights, type RecastReviewKind,
} from '@jhadina/director-core'

/**
 * SERVER-ONLY source review submission validation. No public route calls this
 * function, and it does not persist. Never construct evidence from a JSON
 * request body. A commissioned reviewer workspace must derive it from audited
 * scanner outputs and project-scoped human review decisions.
 */
export type RecastSubmissionEvidence =
  | {kind:'media-probe';payload:{media:RecastReviewedMedia;probe:RecastMediaProbeResult}}
  | {kind:'tracking';payload:RecastReviewedTracking}
  | {kind:'voice';payload:RecastReviewedVoice}
  | {kind:'rights';payload:RecastReviewedRights}

export type RecastReviewerAttestation=Readonly<{
  reviewerUserId:string
  authenticatedUserId:string
  authorityRole:'owner'|'editor'
  explicitlyReviewed:boolean
  reviewedAt:string
  expiresAt:string
  evidenceSource:'trusted-server-adapter'
}>

export type RecastStagedReview=Readonly<{
  project_id:string
  owner_user_id:string
  kind:RecastReviewKind
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
  disposition:'UNPERSISTED_REVIEW_PROPOSAL'
}>

const sha=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{64}$/i.test(s)
const nonempty=(s:unknown):s is string=>typeof s==='string'&&s.trim().length>0
const match=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase()

export function stageRecastReviewSubmission(input:{
  selection:RecastCandidateSelection
  attachedMedia:readonly RecastBoundMedia[]
  evidence:RecastSubmissionEvidence
  reviewer:RecastReviewerAttestation
  checkedAt:string
  declaredDurationSeconds:number
}):RecastStagedReview {
  const {selection,evidence,reviewer}=input
  const current=Date.parse(input.checkedAt)
  const reviewed=Date.parse(reviewer.reviewedAt)
  const expiry=Date.parse(reviewer.expiresAt)
  if(!nonempty(selection.projectId)||!nonempty(selection.ownerUserId)||
    !nonempty(reviewer.reviewerUserId)||
    reviewer.reviewerUserId!==reviewer.authenticatedUserId||
    !['owner','editor'].includes(reviewer.authorityRole)||
    reviewer.evidenceSource!=='trusted-server-adapter'||
    !reviewer.explicitlyReviewed||
    !Number.isFinite(current)||!Number.isFinite(reviewed)||!Number.isFinite(expiry)||
    reviewed>current||current-reviewed>5*60*1000||
    expiry<=current||expiry-reviewed>30*60*1000)
    throw new Error('DIRECTOR_RECAST_AUTHENTICATED_RECENT_REVIEW_REQUIRED')

  const identities=[
    ['footage',selection.sourceVideoAssetId],
    ['reference',selection.characterImageAssetId],
    ['audio',selection.sourceAudioAssetId],
  ] as const
  const assets=identities.map(([role,id])=>{
    const matches=input.attachedMedia.filter(x=>x.role===role&&x.id===id)
    if(matches.length!==1||!matches[0].clean||!matches[0].ownerMatched||
      !sha(matches[0].sha256)||matches[0].sizeBytes<=0)
      throw new Error('DIRECTOR_RECAST_CLEAN_SCOPED_MEDIA_REQUIRED')
    return matches[0]
  })
  if(new Set(assets.map(x=>x.id)).size!==3)
    throw new Error('DIRECTOR_RECAST_UNIQUE_MEDIA_REQUIRED')
  const [video,image,audio]=assets
  const payload=evidence.payload
  if(!payload||typeof payload!=='object')
    throw new Error('DIRECTOR_RECAST_EVIDENCE_REQUIRED')
  if(evidence.kind==='media-probe'){
    if(!payload.media.verified||payload.media.ownerUserId!==selection.ownerUserId||
      payload.media.projectId!==selection.projectId||
      payload.media.sourceVideoAssetId!==video.id||
      payload.media.characterImageAssetId!==image.id||
      payload.media.sourceAudioAssetId!==audio.id||
      !match(payload.media.sourceVideoSha256,video.sha256)||
      !match(payload.media.characterImageSha256,image.sha256)||
      !match(payload.media.sourceAudioSha256,audio.sha256))
      throw new Error('DIRECTOR_RECAST_PROBE_MEDIA_LINEAGE_INVALID')
    const decision=verifyRecastDuration(payload.probe,{
      projectId:selection.projectId,sourceVideoAssetId:video.id,
      sourceVideoSha256:video.sha256,
      declaredDurationSeconds:input.declaredDurationSeconds,
    })
    if(!decision.verified||Math.abs(payload.media.decodedDurationSeconds-payload.probe.durationSeconds)>.01)
      throw new Error('DIRECTOR_RECAST_TRUSTED_PROBE_REQUIRED')
  }else if(evidence.kind==='tracking'){
    if(!payload.approved||payload.projectId!==selection.projectId||
      payload.sourceVideoAssetId!==video.id||
      !match(payload.sourceVideoSha256,video.sha256)||
      payload.reviewedByUserId!==reviewer.reviewerUserId||
      !nonempty(payload.reviewReceiptId)||!nonempty(payload.trackingArtifactId)||
      !Array.isArray(payload.tracks)||!payload.tracks.length||
      payload.tracks.some(t=>!t.approved||t.class!=='character'||t.source==='model'||
        !Number.isFinite(t.confidence)||t.confidence<.5))
      throw new Error('DIRECTOR_RECAST_TRACKING_REVIEW_NOT_VERIFIED')
  }else if(evidence.kind==='voice'){
    if(!payload.approved||payload.projectId!==selection.projectId||
      payload.sourceAudioAssetId!==audio.id||payload.sourceVideoAssetId!==video.id||
      !match(payload.sourceAudioSha256,audio.sha256)||
      payload.reviewerUserId!==reviewer.reviewerUserId||
      !nonempty(payload.reviewReceiptId)||
      !Array.isArray(payload.evidenceIds)||!payload.evidenceIds.length||
      !Array.isArray(payload.tracks)||!payload.tracks.length||
      payload.tracks.some(t=>!Number.isFinite(t.confidence)||t.confidence<.7||
        t.startMs<0||t.endMs<=t.startMs||
        t.endMs>input.declaredDurationSeconds*1000+250))
      throw new Error('DIRECTOR_RECAST_VOICE_REVIEW_NOT_VERIFIED')
  }else if(evidence.kind==='rights'){
    if(!payload.approved||payload.projectId!==selection.projectId||
      payload.ownerUserId!==selection.ownerUserId||
      payload.sourceVideoAssetId!==video.id||
      payload.characterImageAssetId!==image.id||
      payload.sourceAudioAssetId!==audio.id||
      payload.reviewedByUserId!==reviewer.reviewerUserId||
      !nonempty(payload.consentReceiptId)||!nonempty(payload.rightsReceiptId))
      throw new Error('DIRECTOR_RECAST_RIGHTS_CONSENT_REVIEW_NOT_VERIFIED')
  }else{
    throw new Error('DIRECTOR_RECAST_REVIEW_KIND_INVALID')
  }
  return Object.freeze({
    project_id:selection.projectId,owner_user_id:selection.ownerUserId,
    kind:evidence.kind,source_video_asset_id:video.id,
    character_image_asset_id:image.id,source_audio_asset_id:audio.id,
    source_video_sha256:video.sha256,character_image_sha256:image.sha256,
    source_audio_sha256:audio.sha256,reviewed_by_user_id:reviewer.reviewerUserId,
    reviewed_at:reviewer.reviewedAt,expires_at:reviewer.expiresAt,
    status:'approved',method:evidence.kind==='media-probe'?'trusted-media-probe':'human-review',
    evidence:payload,disposition:'UNPERSISTED_REVIEW_PROPOSAL',
  })
}
