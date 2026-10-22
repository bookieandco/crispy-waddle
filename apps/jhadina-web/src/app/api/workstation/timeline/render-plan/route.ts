import {buildDirectorOfflineRenderPlan} from '@jhadina/director-core/offline-final-render-plan'
import {directorProductionAssetBlockers} from '@jhadina/director-core/production-asset-admission'
import {planDirectorPlayback} from '@jhadina/director-core/timeline-playback-plan'
import {createClient} from '@/lib/supabase/server'
import {createRuntimeServiceRoleClient} from '@/lib/supabase/service-role'
import {requireDirectorProjectAuthority} from '@/lib/director-project-authority'
import {DirectorWorkstationTimelineRepository} from '@/lib/director-workstation-timeline-repository'
import {directorStoragePath} from '../preview/route'

export const runtime='nodejs'
export const dynamic='force-dynamic'

/** Downloadable plan only. Execution lives in an explicitly managed offline worker. */
export async function POST(request:Request){
 try{
   const supabase=await createClient()
   const {data:{user}}=await supabase.auth.getUser()
   if(!user)return Response.json({ok:false,error:'Authentication required'},{status:401})
   const body=await request.json() as {projectId?:string;expectedRevision?:number}
   const projectId=body.projectId?.trim()??''
   if(!projectId||!Number.isSafeInteger(body.expectedRevision)){
     return Response.json({ok:false,error:'DIRECTOR_RENDER_PROJECT_AND_REVISION_REQUIRED'},{status:400})
   }
   const client=await createRuntimeServiceRoleClient()
   if(!client)return Response.json({ok:false,error:'DIRECTOR_RENDER_STORE_UNAVAILABLE'},{status:503})
   await requireDirectorProjectAuthority(client,{projectId,userId:user.id,capability:'read'})
   const record=await new DirectorWorkstationTimelineRepository(client).load(projectId)
   if(!record)return Response.json({ok:false,error:'DIRECTOR_TIMELINE_NOT_FOUND'},{status:404})
   if(record.revision!==body.expectedRevision)return Response.json({ok:false,error:'DIRECTOR_RENDER_STALE_TIMELINE_REVISION'},{status:409})
   const ids=[...new Set(planDirectorPlayback(record.timeline).map(clip=>clip.assetId))]
   if(!ids.length)return Response.json({ok:false,error:'DIRECTOR_RENDER_NO_MEDIA'},{status:409})
   const [{data:assets,error:assetError},{data:approvals,error:approvalError}]=await Promise.all([
     client.from('director_generated_editing_assets')
       .select('id,project_id,provider_id,uri,sha256,metadata,media_type')
       .eq('project_id',projectId).in('id',ids),
     client.from('director_editing_asset_approvals').select('asset_id').in('asset_id',ids),
   ])
   if(assetError||approvalError)throw new Error('DIRECTOR_RENDER_ASSET_READ_FAILED')
   const approved=new Set((approvals??[]).map(row=>String(row.asset_id)))
   const sources=(assets??[]).map(asset=>{
     const objectPath=directorStoragePath(String(asset.uri??''))
     if(!approved.has(String(asset.id))||directorProductionAssetBlockers(asset).length||!objectPath){
       throw new Error('DIRECTOR_RENDER_ASSET_NOT_ADMITTED')
     }
     return {assetId:String(asset.id),objectPath,sha256:String(asset.sha256??''),
       mediaType:asset.media_type as 'video'|'audio'}
   })
   const plan=buildDirectorOfflineRenderPlan(record.timeline,record.revision,sources)
   return Response.json({
     ok:true,plan,renderExecuted:false,canPublish:false,
     nextBoundary:'DOWNLOAD_APPROVED_ORIGINAL_MEDIA_TO_TRUSTED_LOCAL_WORKER',
     requiresSeparateWorkerExecution:true,
   },{headers:{'cache-control':'private, no-store'}})
 }catch(error){
   const message=error instanceof Error?error.message:'DIRECTOR_RENDER_PLAN_FAILED'
   const denied=/ACCESS_DENIED|CAPABILITY_DENIED/.test(message)
   return Response.json({ok:false,error:denied?'DIRECTOR_PROJECT_ACCESS_DENIED':message},{
     status:denied?403:/STALE|NOT_ADMITTED|UNSUPPORTED|INVALID|REQUIRED|OVERLAP|NOT_FOUND|NO_MEDIA/.test(message)?409:503,
   })
 }
}
