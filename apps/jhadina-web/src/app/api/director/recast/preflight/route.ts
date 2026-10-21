import {NextResponse} from 'next/server'
import {evaluateRecastMediaSelection,type RecastBoundMedia} from '@jhadina/director-core/recast-media-readiness'
import {createClient} from '@/lib/supabase/server'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {requireDirectorProjectAuthority} from '@/lib/director-project-authority'

export const dynamic='force-dynamic'
export const runtime='nodejs'

const noStore={'Cache-Control':'private, no-store'}
const fail=(error:string,status:number)=>NextResponse.json({ok:false,error},{status,headers:noStore})

async function readInputs(
  client:NonNullable<ReturnType<typeof createServiceRoleClient>>,
  projectId:string,
  ownerId:string,
):Promise<RecastBoundMedia[]> {
  const {data:bindings,error:bindingError}=await client.from('director_project_inputs')
    .select('artifact_id,role,label').eq('project_id',projectId).eq('owner_user_id',ownerId)
    .in('role',['footage','reference','audio']).limit(150)
  if(bindingError)throw new Error('DIRECTOR_RECAST_INPUT_STORE_UNAVAILABLE')
  const ids=[...new Set((bindings??[]).map(row=>String(row.artifact_id)))]
  if(!ids.length)return []
  const {data:assets,error:artifactError}=await client.from('jhadina_artifacts')
    .select('id,owner_user_id,detected_mime_type,status,sha256,size_bytes')
    .eq('owner_user_id',ownerId).in('id',ids)
  if(artifactError)throw new Error('DIRECTOR_RECAST_ARTIFACT_STORE_UNAVAILABLE')
  const valid=new Map((assets??[]).map(row=>[String(row.id),row]))
  return (bindings??[]).flatMap(row=>{
    const artifact=valid.get(String(row.artifact_id))
    if(!artifact)return []
    const role=String(row.role)
    if(role!=='footage'&&role!=='reference'&&role!=='audio')return []
    return [{
      id:String(row.artifact_id),
      role,
      label:String(row.label??'Attached '+role).slice(0,120),
      mimeType:String(artifact.detected_mime_type??''),
      sizeBytes:Number(artifact.size_bytes??0),
      sha256:String(artifact.sha256??''),
      clean:artifact.status==='clean',
      ownerMatched:artifact.owner_user_id===ownerId,
    }]
  })
}

async function context(projectId:string) {
  if(!projectId || projectId.length>200)return {error:fail('DIRECTOR_RECAST_PROJECT_REQUIRED',400)} as const
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user)return {error:fail('AUTHENTICATION_REQUIRED',401)} as const
  const privileged=createServiceRoleClient()
  if(!privileged)return {error:fail('DIRECTOR_RECAST_STORAGE_UNAVAILABLE',503)} as const
  try{
    await requireDirectorProjectAuthority(privileged,{projectId,userId:user.id,capability:'edit'})
  }catch(error){
    const message=error instanceof Error?error.message:''
    return {error:fail(/ACCESS_DENIED|CAPABILITY_DENIED/.test(message)?'DIRECTOR_PROJECT_ACCESS_DENIED':'DIRECTOR_RECAST_AUTHORITY_UNAVAILABLE',
      /ACCESS_DENIED|CAPABILITY_DENIED/.test(message)?403:503)} as const
  }
  return {client:privileged,projectId,ownerId:user.id} as const
}

/** Existing Workstation project-input upload flow is the only ingress.
 * This endpoint never provides signed media URLs, credentials or worker permits. */
export async function GET(request:Request) {
  const projectId=new URL(request.url).searchParams.get('projectId')?.trim()??''
  const result=await context(projectId)
  if('error' in result)return result.error
  try{
    const inputs=await readInputs(result.client,result.projectId,result.ownerId)
    return NextResponse.json({
      ok:true,inputs:inputs.map(({id,role,label,mimeType,sizeBytes,clean})=>({
        artifactId:id,role,label,mimeType,sizeBytes,clean,
      })),
      renderEnabled:false,
      uploadPath:'/api/workstation/inputs',
      authority:'INPUT_DISCOVERY_ONLY',
    },{headers:noStore})
  }catch{
    return fail('DIRECTOR_RECAST_INPUT_READ_UNAVAILABLE',503)
  }
}

export async function POST(request:Request) {
  let body:{projectId?:unknown;sourceVideoAssetId?:unknown;replacementCharacterAssetId?:unknown;sourceAudioAssetId?:unknown;durationSeconds?:unknown}
  try{body=await request.json()}catch{return fail('DIRECTOR_RECAST_INVALID_JSON',400)}
  if(!body||typeof body!=='object')return fail('DIRECTOR_RECAST_INVALID_INPUT',400)
  const projectId=typeof body.projectId==='string'?body.projectId.trim():''
  const result=await context(projectId)
  if('error' in result)return result.error
  const selections=[body.sourceVideoAssetId,body.replacementCharacterAssetId,body.sourceAudioAssetId]
  if(selections.some(value=>typeof value!=='string'||!value.trim()||value.length>200) ||
    typeof body.durationSeconds!=='number')return fail('DIRECTOR_RECAST_INVALID_SELECTION',400)
  try {
    const inputs=await readInputs(result.client,result.projectId,result.ownerId)
    const readiness=evaluateRecastMediaSelection(inputs,{
      sourceVideoAssetId:body.sourceVideoAssetId as string,
      replacementCharacterAssetId:body.replacementCharacterAssetId as string,
      sourceAudioAssetId:body.sourceAudioAssetId as string,
      durationSeconds:body.durationSeconds,
    })
    return NextResponse.json({
      ok:true,projectId,
      ...readiness,
      status:'BLOCKED_PENDING_GOVERNED_RENDER_ADMISSION',
      outputKind:'NO_RENDER',
    },{headers:noStore})
  }catch{return fail('DIRECTOR_RECAST_PREFLIGHT_UNAVAILABLE',503)}
}
