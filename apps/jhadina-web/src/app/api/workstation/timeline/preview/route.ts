import {NextResponse} from 'next/server'
import {planDirectorPlayback} from '@jhadina/director-core/timeline-playback-plan'
import {directorProductionAssetBlockers} from '@jhadina/director-core/production-asset-admission'
import {createClient} from '@/lib/supabase/server'
import {createRuntimeServiceRoleClient} from '@/lib/supabase/service-role'
import {requireDirectorProjectAuthority} from '@/lib/director-project-authority'
import {DirectorWorkstationTimelineRepository} from '@/lib/director-workstation-timeline-repository'

export const runtime='nodejs'
export const dynamic='force-dynamic'

/** Only canonical project-local storage gets a short-lived browser playback URL. */
export function directorStoragePath(uri:string):string|null{
  const prefix='storage://director-media/'
  if(!uri.startsWith(prefix))return null
  const path=uri.slice(prefix.length)
  if(!path||path.startsWith('/')||path.split('/').some(segment=>!segment||
    segment==='.'||segment==='..')||path.includes('\\')||path.includes('?')||path.includes('#'))return null
  return path
}

export async function GET(request:Request){
  try{
    const auth=await createClient()
    const {data:{user}}=await auth.auth.getUser()
    if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})
    const projectId=new URL(request.url).searchParams.get('projectId')?.trim()??''
    if(!projectId)return NextResponse.json({ok:false,error:'DIRECTOR_PROJECT_ID_REQUIRED'},{status:400})
    const client=await createRuntimeServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_PREVIEW_STORAGE_UNAVAILABLE'},{status:503})
    await requireDirectorProjectAuthority(client,{projectId,userId:user.id,capability:'read'})
    const record=await new DirectorWorkstationTimelineRepository(client).load(projectId)
    if(!record)return NextResponse.json({ok:false,error:'DIRECTOR_TIMELINE_NOT_FOUND'},{status:404})
    const segments=planDirectorPlayback(record.timeline)
    const assetIds=[...new Set(segments.map(segment=>segment.assetId))]
    if(!assetIds.length)return NextResponse.json({ok:true,revision:record.revision,durationSeconds:record.timeline.durationSeconds,
      segments:[],notices:[],authority:'DIRECTOR_APPROVED_PREVIEW_ONLY'},{headers:{'cache-control':'private, no-store'}})
    const [{data:assets,error:assetError},{data:approvals,error:approvalError}]=await Promise.all([
      client.from('director_generated_editing_assets').select('id,project_id,provider_id,media_type,metadata,uri')
        .eq('project_id',projectId).in('id',assetIds),
      client.from('director_editing_asset_approvals').select('asset_id').in('asset_id',assetIds),
    ])
    if(assetError||approvalError)throw new Error('DIRECTOR_PREVIEW_ASSET_READ_FAILED')
    const byId=new Map((assets??[]).map(asset=>[String(asset.id),asset]))
    const approved=new Set((approvals??[]).map(item=>String(item.asset_id)))
    const urls=new Map<string,string>()
    const notices:string[]=[]
    for(const id of assetIds){
      const asset=byId.get(id)
      const path=asset&&directorStoragePath(String(asset.uri??''))
      const expectedKinds=segments.filter(segment=>segment.assetId===id).map(segment=>segment.kind)
      if(!asset||!approved.has(id)||directorProductionAssetBlockers(asset).length||
        expectedKinds.some(kind=>kind!==asset.media_type)||!path){
        notices.push('DIRECTOR_PREVIEW_ASSET_UNAVAILABLE:'+id)
        continue
      }
      const {data:signed,error}=await client.storage.from('director-media').createSignedUrl(path,900)
      if(error||!signed?.signedUrl){
        notices.push('DIRECTOR_PREVIEW_SIGNING_FAILED:'+id)
        continue
      }
      urls.set(id,signed.signedUrl)
    }
    return NextResponse.json({
      ok:true,revision:record.revision,durationSeconds:record.timeline.durationSeconds,
      segments:segments.filter(segment=>urls.has(segment.assetId)).map(segment=>({...segment,url:urls.get(segment.assetId)})),
      notices,
      authority:'DIRECTOR_APPROVED_PREVIEW_ONLY',
      isFinalRender:false,
    },{headers:{'cache-control':'private, no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_PREVIEW_FAILED'
    return NextResponse.json({ok:false,error:/ACCESS_DENIED|CAPABILITY_DENIED/.test(message)?'DIRECTOR_PROJECT_ACCESS_DENIED':message},{
      status:/ACCESS_DENIED|CAPABILITY_DENIED/.test(message)?403:
        /NOT_FOUND/.test(message)?404:
        /CLIP_UNSUPPORTED|INVALID|REQUIRED/.test(message)?409:503,
    })
  }
}
