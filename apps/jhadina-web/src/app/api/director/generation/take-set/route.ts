import {NextResponse} from 'next/server'
import type {PlannedGeneration} from '@jhadina/director-core'
import {createConfiguredDirectorGenerationRuntime} from '@/lib/director-generation-composition'
import {createServiceRoleClient} from '@/lib/supabase/service-role'

export const runtime='nodejs'
export const dynamic='force-dynamic'

type Body={
  projectId:string
  runId:string
  gateId:string
  candidateCount:number
  take:{
    takeId:string
    sceneId:string
    storyboardBoardId:string
    prompt:string
    parentTakeId?:string
    locked?:('character'|'location'|'performance'|'camera'|'lighting'|'wardrobe')[]
    referenceCharacterIds?:string[]
    referenceAssetIds?:string[]
    targetRuntimeSeconds?:number
  }
  plan:PlannedGeneration
}

function isBody(value:unknown):value is Body{
  if(!value||typeof value!=='object')return false
  const body=value as Partial<Body>
  return typeof body.projectId==='string'&&typeof body.runId==='string'&&typeof body.gateId==='string'&&
    Number.isInteger(body.candidateCount)&&Number(body.candidateCount)>=2&&Number(body.candidateCount)<=4&&
    !!body.take&&!!body.plan&&typeof body.take.takeId==='string'&&typeof body.take.sceneId==='string'&&
    typeof body.take.storyboardBoardId==='string'&&typeof body.take.prompt==='string'&&typeof body.plan.modelId==='string'
}

export async function POST(request:Request){
  const secret=process.env.DIRECTOR_API_SECRET
  if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({ok:false},{status:401})
  const client=createServiceRoleClient()
  if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_SUPABASE_SERVICE_ROLE_NOT_CONFIGURED'},{status:503})
  let raw:unknown
  try{raw=await request.json()}catch{return NextResponse.json({ok:false,error:'DIRECTOR_INVALID_JSON'},{status:400})}
  if(!isBody(raw))return NextResponse.json({ok:false,error:'DIRECTOR_INVALID_TAKE_SET_REQUEST'},{status:400})

  try{
    const runtime=await createConfiguredDirectorGenerationRuntime(client)
    if(!runtime.hasModel(raw.plan.modelId))return NextResponse.json({ok:false,error:'DIRECTOR_MODEL_NOT_REGISTERED'},{status:400})
    const authority=await runtime.authority.resolve({
      projectId:raw.projectId,
      runId:raw.runId,
      gateId:raw.gateId,
      storyboardBoardId:raw.take.storyboardBoardId,
    })

    const jobs=[]
    for(let index=1;index<=raw.candidateCount;index++){
      const takeId=`${raw.take.takeId}:candidate:${index}`
      const take={
        ...raw.take,
        takeId,
        projectId:raw.projectId,
        takeCount:index,
        locked:raw.take.locked??[],
        referenceCharacterIds:raw.take.referenceCharacterIds??[],
        referenceAssetIds:raw.take.referenceAssetIds??[],
      }
      const plan:PlannedGeneration={
        ...raw.plan,
        parameters:{
          ...(raw.plan.parameters??{}),
          takeGroupId:raw.take.takeId,
          candidateIndex:index,
          backupTake:index>1,
          preserveAfterSelection:true,
        },
      }
      const job=await runtime.generation.submitTake(take,plan,{
        run:authority.run,
        gate:authority.gate,
        storyboardStage:authority.storyboardStage,
        generationStage:authority.generationStage,
      })
      jobs.push(job)
    }

    return NextResponse.json({
      ok:true,
      takeGroupId:raw.take.takeId,
      jobs,
      candidateCount:raw.candidateCount,
      preserveAlternates:raw.candidateCount-1,
      selectionRequired:true,
      selectionAuthority:'DIRECTOR_MULTIMODAL_TAKE_SELECTION',
    },{status:202})
  }catch(error){
    return NextResponse.json({
      ok:false,
      error:error instanceof Error?error.message:'DIRECTOR_TAKE_SET_SUBMISSION_FAILED',
    },{status:409})
  }
}
