import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {requireDirectorProjectAuthority} from '@/lib/director-project-authority'

export const runtime='nodejs'
export const dynamic='force-dynamic'

type RankedTake={
  takeId:string
  assetId:string
  score:number
  admissible:boolean
  reasons:string[]
  evidenceIds:string[]
  observationIds:string[]
}

function storageLocation(uri:string):{bucket:string;path:string}|undefined{
  const prefix='storage://'
  if(!uri.startsWith(prefix))return undefined
  const rest=uri.slice(prefix.length)
  const slash=rest.indexOf('/')
  if(slash<=0||slash===rest.length-1)return undefined
  return {bucket:rest.slice(0,slash),path:rest.slice(slash+1)}
}

export async function GET(request:Request){
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user)return NextResponse.json({ok:false,error:'Authentication required'},{status:401})

  const projectId=new URL(request.url).searchParams.get('projectId')?.trim()??''
  if(!projectId)return NextResponse.json({ok:false,error:'projectId is required'},{status:400})

  const privileged=createServiceRoleClient()
  if(!privileged)return NextResponse.json({ok:false,error:'Director project store is not configured'},{status:503})
  try{
    await requireDirectorProjectAuthority(privileged,{projectId,userId:user.id,capability:'read'})
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_PROJECT_ACCESS_DENIED'
    return NextResponse.json({ok:false,error:message},{status:/ACCESS_DENIED|CAPABILITY_DENIED/.test(message)?403:500})
  }

  const [{data:selections,error:selectionError},{data:boards,error:boardError}]=await Promise.all([
    privileged.from('director_take_selections')
      .select('take_group_id,policy_id,selected_take_id,selected_asset_id,alternate_take_ids,ranked,status,evidence_ids,updated_at')
      .eq('project_id',projectId)
      .order('updated_at',{ascending:true}),
    privileged.from('director_storyboard_boards')
      .select('id,title,description,shot_id,ordinal')
      .eq('project_id',projectId),
  ])
  if(selectionError)return NextResponse.json({ok:false,error:selectionError.message},{status:500})
  if(boardError)return NextResponse.json({ok:false,error:boardError.message},{status:500})

  const ranked=(selections??[]).flatMap(row=>Array.isArray(row.ranked)?row.ranked as RankedTake[]:[])
  const assetIds=[...new Set(ranked.map(item=>String(item.assetId)).filter(Boolean))]
  const assetQuery=assetIds.length
    ?await privileged.from('director_generated_editing_assets')
      .select('id,uri,mime_type,media_type,metadata')
      .eq('project_id',projectId)
      .in('id',assetIds)
    :{data:[],error:null}
  if(assetQuery.error)return NextResponse.json({ok:false,error:assetQuery.error.message},{status:500})

  const approvalQuery=assetIds.length
    ?await privileged.from('director_editing_asset_approvals')
      .select('asset_id,approval_id,approved_at,approved_by_user_id')
      .in('asset_id',assetIds)
    :{data:[],error:null}
  if(approvalQuery.error)return NextResponse.json({ok:false,error:approvalQuery.error.message},{status:500})

  const assets=new Map((assetQuery.data??[]).map(asset=>[String(asset.id),asset]))
  const approvals=new Map((approvalQuery.data??[]).map(approval=>[String(approval.asset_id),approval]))
  const boardById=new Map((boards??[]).map(board=>[String(board.id),board]))

  const sets=[]
  for(const row of selections??[]){
    const takeGroupId=String(row.take_group_id)
    const rankedTakes=Array.isArray(row.ranked)?row.ranked as RankedTake[]:[]
    const marker=':'
    const last=takeGroupId.lastIndexOf(marker)
    const boardId=last>=0?takeGroupId.slice(last+1):takeGroupId
    // Board IDs may themselves contain colons. Fall back to suffix matching.
    const board=(boards??[]).find(candidate=>takeGroupId.endsWith(':'+String(candidate.id)))??boardById.get(boardId)

    const takes=[]
    for(const item of rankedTakes){
      const asset=assets.get(String(item.assetId))
      let previewUrl:string|null=null
      if(asset?.uri){
        const location=storageLocation(String(asset.uri))
        if(location){
          const {data:signed}=await privileged.storage.from(location.bucket).createSignedUrl(location.path,15*60)
          previewUrl=signed?.signedUrl??null
        }
      }
      const approval=approvals.get(String(item.assetId))
      takes.push({
        takeId:String(item.takeId),
        assetId:String(item.assetId),
        score:Number(item.score),
        admissible:Boolean(item.admissible),
        reasons:Array.isArray(item.reasons)?item.reasons.map(String):[],
        evidenceIds:Array.isArray(item.evidenceIds)?item.evidenceIds.map(String):[],
        observationIds:Array.isArray(item.observationIds)?item.observationIds.map(String):[],
        selected:String(item.takeId)===String(row.selected_take_id??''),
        alternate:(row.alternate_take_ids??[]).map(String).includes(String(item.takeId)),
        approved:Boolean(approval&&String(approval.approved_by_user_id)===user.id),
        approvalId:approval?.approval_id?String(approval.approval_id):null,
        previewUrl,
        mimeType:asset?.mime_type?String(asset.mime_type):null,
        mediaType:asset?.media_type?String(asset.media_type):null,
        metadata:asset?.metadata??null,
      })
    }
    sets.push({
      takeGroupId,
      policyId:String(row.policy_id),
      status:String(row.status),
      selectedTakeId:row.selected_take_id?String(row.selected_take_id):null,
      selectedAssetId:row.selected_asset_id?String(row.selected_asset_id):null,
      alternateTakeIds:(row.alternate_take_ids??[]).map(String),
      evidenceIds:(row.evidence_ids??[]).map(String),
      board:board?{
        id:String(board.id),
        shotId:String(board.shot_id),
        title:board.title?String(board.title):null,
        description:board.description?String(board.description):null,
        ordinal:Number(board.ordinal),
      }:null,
      takes,
      updatedAt:String(row.updated_at),
    })
  }

  return NextResponse.json({ok:true,projectId,sets},{headers:{'cache-control':'no-store'}})
}
