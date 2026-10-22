import {verifyRecastEvidenceSeal} from './recast-review-digest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {verifyRecastReviewLedger,resolveEffectiveRecastReviews,reviewedEvidenceFromLedger,evaluateRecastReviewedEvidence,verifyRecastDuration,
  type RecastReviewKind,type RecastReviewReceipt,type RecastCandidateSelection,type RecastBoundMedia,
  type RecastMediaProbeResult} from '@jhadina/director-core'

export type RecastLedgerReadStatus=Readonly<{
  reviewStore:'NOT_COMMISSIONED'|'INCOMPLETE'|'REVIEWED_READ_ONLY'
  reviewReceiptsComplete:boolean
  blockers:readonly string[]
  renderAuthorized:false
  executionAuthority:'NONE'
}>

const kinds=new Set<RecastReviewKind>(['media-probe','tracking','voice','rights'])
const blocked=(status:RecastLedgerReadStatus['reviewStore'],blockers:readonly string[]):RecastLedgerReadStatus=>({
  reviewStore:status,reviewReceiptsComplete:false,blockers,renderAuthorized:false,executionAuthority:'NONE',
})

/** Reads only from a future audited append-only service-role review registry.
 * If the table is absent, unavailable, misconfigured or full of stale records,
 * it must not break ordinary uploaded-media intake or grant permissions.
 *
 * REQUIRED before production rollout: independent audit of source-only schema
 * proposal in docs/director/RECAST-REVIEW-REGISTRY-PROPOSAL.sql.
 */
export async function readRecastReviewLedgerStatus(
  client:SupabaseClient,
  selection:RecastCandidateSelection,
  media:readonly RecastBoundMedia[],
  now:string,
  declaredDurationSeconds:number,
):Promise<RecastLedgerReadStatus>{
  const video=media.find(v=>v.role==='footage'&&v.id===selection.sourceVideoAssetId)
  const image=media.find(v=>v.role==='reference'&&v.id===selection.characterImageAssetId)
  const audio=media.find(v=>v.role==='audio'&&v.id===selection.sourceAudioAssetId)
  if(!video||!image||!audio||![video,image,audio].every(x=>x.clean&&x.ownerMatched))
    return blocked('INCOMPLETE',['DIRECTOR_RECAST_REVIEW_SOURCE_ASSETS_UNVERIFIED'])
  let result
  try {
    result=await client.from('director_recast_review_receipts')
      .select('id,project_id,owner_user_id,kind,source_video_asset_id,character_image_asset_id,source_audio_asset_id,source_video_sha256,character_image_sha256,source_audio_sha256,reviewed_by_user_id,reviewed_at,expires_at,created_at,status,method,evidence,evidence_sha256')
      .eq('project_id',selection.projectId)
      .eq('owner_user_id',selection.ownerUserId)
      .eq('source_video_asset_id',selection.sourceVideoAssetId)
      .eq('character_image_asset_id',selection.characterImageAssetId)
      .eq('source_audio_asset_id',selection.sourceAudioAssetId)
      .order('created_at',{ascending:false})
      .limit(129)
  }catch{return blocked('NOT_COMMISSIONED',['DIRECTOR_RECAST_REVIEW_STORE_NOT_COMMISSIONED'])}
  if(result.error)return blocked('NOT_COMMISSIONED',['DIRECTOR_RECAST_REVIEW_STORE_NOT_COMMISSIONED'])
  const rawRows=result.data??[]
  if(rawRows.length>=129)
    return blocked('INCOMPLETE',['DIRECTOR_RECAST_REVIEW_HISTORY_LIMIT_EXCEEDED'])
  // Never silently filter an altered revocation: discarding it could resurrect
  // an older approved receipt. One corrupt row blocks the full review set.
  if(rawRows.some(raw=>!kinds.has(raw.kind as RecastReviewKind)||
    (raw.method!=='trusted-media-probe'&&raw.method!=='human-review')||
    !raw.evidence||typeof raw.evidence!=='object'||
    typeof raw.created_at!=='string'||!Number.isFinite(Date.parse(raw.created_at))||
    !verifyRecastEvidenceSeal(raw.evidence,raw.evidence_sha256)))
    return blocked('INCOMPLETE',['DIRECTOR_RECAST_REVIEW_EVIDENCE_TAMPERED_OR_UNKNOWN'])
  const receipts:RecastReviewReceipt[]=rawRows.map(raw=>({
      id:String(raw.id??''),projectId:String(raw.project_id??''),
      ownerUserId:String(raw.owner_user_id??''),kind:raw.kind as RecastReviewKind,
      sourceVideoAssetId:String(raw.source_video_asset_id??''),
      characterImageAssetId:String(raw.character_image_asset_id??''),
      sourceAudioAssetId:String(raw.source_audio_asset_id??''),
      sourceVideoSha256:String(raw.source_video_sha256??''),
      characterImageSha256:String(raw.character_image_sha256??''),
      sourceAudioSha256:String(raw.source_audio_sha256??''),
      reviewerId:String(raw.reviewed_by_user_id??''),
      createdAt:String(raw.created_at??''),
      reviewedAt:String(raw.reviewed_at??''),expiresAt:String(raw.expires_at??''),
      status:raw.status==='approved'?'approved':'rejected',
      method:raw.method==='trusted-media-probe'?'trusted-media-probe':'human-review',
      evidence:raw.evidence,
  }))
  const effective=resolveEffectiveRecastReviews(receipts,now)
  if(!effective.complete)return blocked('INCOMPLETE',effective.blockers)
  const currentReceipts=effective.reviews
  const decision=verifyRecastReviewLedger(selection,{
    video:video.sha256,image:image.sha256,audio:audio.sha256,
  },currentReceipts,now)
  if(!decision.receiptsComplete)return blocked('INCOMPLETE',decision.blockers)
  try {
    const evidence=reviewedEvidenceFromLedger(selection,currentReceipts,decision)
    const review=evaluateRecastReviewedEvidence(selection,evidence)
    const mediaBundle=currentReceipts.find(r=>r.kind==='media-probe')?.evidence as {probe?:RecastMediaProbeResult}|undefined
    const rawProbe=mediaBundle?.probe
    const duration=verifyRecastDuration(rawProbe??null,{
      projectId:selection.projectId,sourceVideoAssetId:selection.sourceVideoAssetId,
      sourceVideoSha256:video.sha256,declaredDurationSeconds,
    })
    const blockers=[...review.blockers,...duration.blockers]
    if(!evidence.media||duration.measuredDurationSeconds===null||
      Math.abs(evidence.media.decodedDurationSeconds-duration.measuredDurationSeconds)>0.01){
      blockers.push('DIRECTOR_RECAST_REVIEW_PROBE_DURATION_CONFLICT')
    }
    return {
      reviewStore:blockers.length?'INCOMPLETE':'REVIEWED_READ_ONLY',
      reviewReceiptsComplete:blockers.length===0,
      blockers,
      renderAuthorized:false,executionAuthority:'NONE',
    }
  }catch{return blocked('INCOMPLETE',['DIRECTOR_RECAST_REVIEW_PAYLOAD_INVALID'])}
}
