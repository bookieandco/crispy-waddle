import type {SupabaseClient} from '@supabase/supabase-js'
import {verifyRecastReviewLedger,type RecastReviewKind,type RecastReviewReceipt,
  type RecastCandidateSelection,type RecastBoundMedia} from '@jhadina/director-core'

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
):Promise<RecastLedgerReadStatus>{
  const video=media.find(v=>v.role==='footage'&&v.id===selection.sourceVideoAssetId)
  const image=media.find(v=>v.role==='reference'&&v.id===selection.characterImageAssetId)
  const audio=media.find(v=>v.role==='audio'&&v.id===selection.sourceAudioAssetId)
  if(!video||!image||!audio||![video,image,audio].every(x=>x.clean&&x.ownerMatched))
    return blocked('INCOMPLETE',['DIRECTOR_RECAST_REVIEW_SOURCE_ASSETS_UNVERIFIED'])
  let result
  try {
    result=await client.from('director_recast_review_receipts')
      .select('id,project_id,owner_user_id,kind,source_video_asset_id,character_image_asset_id,source_audio_asset_id,source_video_sha256,character_image_sha256,source_audio_sha256,reviewed_by_user_id,reviewed_at,expires_at,status,method,evidence')
      .eq('project_id',selection.projectId)
      .eq('owner_user_id',selection.ownerUserId)
      .eq('source_video_asset_id',selection.sourceVideoAssetId)
      .eq('character_image_asset_id',selection.characterImageAssetId)
      .eq('source_audio_asset_id',selection.sourceAudioAssetId)
      .limit(32)
  }catch{return blocked('NOT_COMMISSIONED',['DIRECTOR_RECAST_REVIEW_STORE_NOT_COMMISSIONED'])}
  if(result.error)return blocked('NOT_COMMISSIONED',['DIRECTOR_RECAST_REVIEW_STORE_NOT_COMMISSIONED'])
  const receipts:RecastReviewReceipt[]=(result.data??[]).flatMap(raw=>{
    if(!kinds.has(raw.kind as RecastReviewKind))return []
    if(!raw.evidence||typeof raw.evidence!=='object')return []
    return [{
      id:String(raw.id??''),projectId:String(raw.project_id??''),
      ownerUserId:String(raw.owner_user_id??''),kind:raw.kind as RecastReviewKind,
      sourceVideoAssetId:String(raw.source_video_asset_id??''),
      characterImageAssetId:String(raw.character_image_asset_id??''),
      sourceAudioAssetId:String(raw.source_audio_asset_id??''),
      sourceVideoSha256:String(raw.source_video_sha256??''),
      characterImageSha256:String(raw.character_image_sha256??''),
      sourceAudioSha256:String(raw.source_audio_sha256??''),
      reviewerId:String(raw.reviewed_by_user_id??''),
      reviewedAt:String(raw.reviewed_at??''),expiresAt:String(raw.expires_at??''),
      status:raw.status==='approved'?'approved':'rejected',
      method:raw.method==='trusted-media-probe'?'trusted-media-probe':'human-review',
      evidence:raw.evidence,
    }]
  })
  const decision=verifyRecastReviewLedger(selection,{
    video:video.sha256,image:image.sha256,audio:audio.sha256,
  },receipts,now)
  return {
    reviewStore:decision.receiptsComplete?'REVIEWED_READ_ONLY':'INCOMPLETE',
    reviewReceiptsComplete:decision.receiptsComplete,
    blockers:decision.blockers,
    renderAuthorized:false,executionAuthority:'NONE',
  }
}
