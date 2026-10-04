import type {SupabaseClient} from '@supabase/supabase-js'
import type {ContinuityLock,PlannedGeneration,TakeRequest} from '@jhadina/director-core'
import {createConfiguredDirectorGenerationRuntime} from '@/lib/director-generation-composition'
import type {SideHustleDirectorProductionPlan} from './side-hustle-director-bridge'

type BoardRow={
  id:string
  sequence_id:string
  shot_id:string
  status:string
  title:string|null
  description:string|null
  script_ref:string|null
  reference_asset_ids:string[]|null
  continuity_locks:string[]|null
  camera_language:string|null
  framing:string|null
  action:string|null
  notes:string|null
}
type SequenceRow={id:string;scene_id:string}
type SubmittedTake=Readonly<{
  boardId:string
  shotId:string
  takeGroupId:string
  takeId:string
  candidateIndex:number
  generationTaskId:string
  providerId:string
  providerJobId?:string
  status:string
}>

const MODEL_ID='hunyuan-video-1.5-480p-t2v'

function unique(values:readonly string[]):string[]{
  return [...new Set(values.map(value=>value.trim()).filter(Boolean))]
}

function buildPrompt(plan:SideHustleDirectorProductionPlan,board:BoardRow):string{
  return [
    plan.activeTask,
    board.title?'SHOT: '+board.title:'',
    board.description?'DESCRIPTION: '+board.description:'',
    board.action?'ACTION: '+board.action:'',
    board.framing?'FRAMING: '+board.framing:'',
    board.camera_language?'CAMERA: '+board.camera_language:'',
    board.notes?'NOTES: '+board.notes:'',
    'Generate only this shot. Preserve screenplay/storyboard meaning and continuity. Do not invent brands, labels, people, claims, or copyrighted source expression.',
  ].filter(Boolean).join('\n')
}

export async function submitSideHustleDirectorTakeBatch(input:{
  client:SupabaseClient
  userId:string
  projectId:string
  maxBoards?:number
}):Promise<Readonly<{
  projectId:string
  productionRunId:string
  modelId:string
  inspectedBoards:number
  submitted:readonly SubmittedTake[]
  skippedAlreadySubmitted:readonly string[]
  remainingBoardIds:readonly string[]
  status:'submitted'|'nothing_to_submit'
  nextBoundary:'DIRECTOR_GENERATION_RECONCILIATION'
  publicationAuthority:'NONE'
  paidMediaAuthority:'NONE'
}>>{
  const {client,userId,projectId}=input
  const maxBoards=Math.max(1,Math.min(3,input.maxBoards??1))
  const {data:context,error:contextError}=await client.from('director_project_business_context')
    .select('owner_user_id,production_run_id,plan')
    .eq('project_id',projectId).eq('owner_user_id',userId).maybeSingle()
  if(contextError)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_READ_FAILED:'+contextError.message)
  if(!context)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_NOT_FOUND')
  const plan=context.plan as SideHustleDirectorProductionPlan
  if(!plan||plan.directorProjectId!==projectId)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_INVALID')
  if(['tiktok_short','ugc_ad'].includes(plan.format))throw new Error('SIDE_HUSTLE_DIRECTOR_WHOLE_VIDEO_JOB_OWNS_FORMAT')
  const runId=String(context.production_run_id??'')
  if(!runId)throw new Error('SIDE_HUSTLE_DIRECTOR_PRODUCTION_RUN_REQUIRED')

  const generationGateId='gate:business:'+projectId+':'+plan.id+':generation'
  const stageId='stage:business:'+projectId+':'+plan.id+':generation'
  const [{data:gate,error:gateError},{data:stage,error:stageError},{data:boardsRaw,error:boardsError}]=await Promise.all([
    client.from('director_creative_gates')
      .select('id,decision,decided_at,decided_by').eq('id',generationGateId).eq('run_id',runId).eq('project_id',projectId).maybeSingle(),
    client.from('director_creative_stages')
      .select('id,status').eq('id',stageId).eq('project_id',projectId).maybeSingle(),
    client.from('director_storyboard_boards')
      .select('id,sequence_id,shot_id,status,title,description,script_ref,reference_asset_ids,continuity_locks,camera_language,framing,action,notes')
      .eq('project_id',projectId).in('status',['ready','approved']).order('sequence_id',{ascending:true}).order('ordinal',{ascending:true}),
  ])
  if(gateError)throw new Error('SIDE_HUSTLE_DIRECTOR_GENERATION_GATE_READ_FAILED:'+gateError.message)
  if(stageError)throw new Error('SIDE_HUSTLE_DIRECTOR_GENERATION_STAGE_READ_FAILED:'+stageError.message)
  if(boardsError)throw new Error('SIDE_HUSTLE_DIRECTOR_STORYBOARD_READ_FAILED:'+boardsError.message)
  if(!gate||gate.decision!=='approved'||!gate.decided_at||!gate.decided_by)throw new Error('SIDE_HUSTLE_DIRECTOR_GENERATION_APPROVAL_REQUIRED')
  if(!stage||!['ready','approved','running'].includes(String(stage.status)))throw new Error('SIDE_HUSTLE_DIRECTOR_GENERATION_STAGE_NOT_READY')

  const boards=(boardsRaw??[]) as BoardRow[]
  const sequenceIds=unique(boards.map(board=>board.sequence_id))
  const sequenceQuery=sequenceIds.length
    ? await client.from('director_storyboard_sequences').select('id,scene_id').eq('project_id',projectId).in('id',sequenceIds)
    : {data:[],error:null}
  if(sequenceQuery.error)throw new Error('SIDE_HUSTLE_DIRECTOR_SEQUENCE_READ_FAILED:'+sequenceQuery.error.message)
  const sequences=new Map(((sequenceQuery.data??[]) as SequenceRow[]).map(row=>[String(row.id),String(row.scene_id)]))

  const runtime=await createConfiguredDirectorGenerationRuntime(client)
  if(!runtime.hasModel(MODEL_ID))throw new Error('SIDE_HUSTLE_DIRECTOR_HUNYUAN_MODEL_NOT_REGISTERED')

  const skipped:string[]=[]
  const eligible:BoardRow[]=[]
  for(const board of boards){
    if((board.reference_asset_ids??[]).length){
      throw new Error('SIDE_HUSTLE_DIRECTOR_REFERENCE_AWARE_I2V_REQUIRED:'+board.id)
    }
    const takeGroupId='take-group:'+plan.id+':'+board.id
    const firstTakeId=takeGroupId+':candidate:1'
    const requestId='director:'+projectId+':take:'+firstTakeId
    const {data:existing,error:existingError}=await client.from('director_generation_tasks')
      .select('id,status').eq('idempotency_key',requestId).maybeSingle()
    if(existingError)throw new Error('SIDE_HUSTLE_DIRECTOR_GENERATION_TASK_READ_FAILED:'+existingError.message)
    if(existing){skipped.push(board.id);continue}
    eligible.push(board)
    if(eligible.length>=maxBoards)break
  }

  const submitted:SubmittedTake[]=[]
  for(const board of eligible){
    const sceneId=sequences.get(board.sequence_id)
    if(!sceneId)throw new Error('SIDE_HUSTLE_DIRECTOR_SEQUENCE_SCENE_MISSING:'+board.sequence_id)
    const authority=await runtime.authority.resolve({
      projectId,
      runId,
      gateId:generationGateId,
      storyboardBoardId:board.id,
    })
    const takeGroupId='take-group:'+plan.id+':'+board.id
    const candidateCount=Math.max(2,Math.min(4,Number(plan.takeSet.candidateCount||2)))
    for(let candidateIndex=1;candidateIndex<=candidateCount;candidateIndex++){
      const takeId=takeGroupId+':candidate:'+candidateIndex
      const request:TakeRequest={
        takeId,
        projectId,
        sceneId,
        storyboardBoardId:board.id,
        prompt:buildPrompt(plan,board),
        targetRuntimeSeconds:5,
        takeCount:candidateIndex,
        locked:((board.continuity_locks??['character','wardrobe','location','camera','composition','color','performance']) as ContinuityLock[]),
        referenceCharacterIds:[],
        referenceAssetIds:[],
      }
      const generationPlan:PlannedGeneration={
        modelId:MODEL_ID,
        modality:'video',
        parameters:{
          hunyuanAspectRatio:plan.aspectRatio,
          hunyuanVideoLength:121,
          hunyuanInferenceSteps:50,
          hunyuanEnableSuperResolution:false,
          hunyuanRewritePrompt:false,
          takeGroupId,
          candidateIndex,
          backupTake:candidateIndex>1,
          preserveAfterSelection:true,
          sourceSystem:'business-factory',
          opportunityId:plan.opportunityId,
          productionPlanId:plan.id,
          storyboardBoardId:board.id,
          shotId:board.shot_id,
        },
      }
      const job=await runtime.generation.submitTake(request,generationPlan,{
        run:authority.run,
        gate:authority.gate,
        storyboardStage:authority.storyboardStage,
        generationStage:authority.generationStage,
      })
      submitted.push(Object.freeze({
        boardId:board.id,
        shotId:board.shot_id,
        takeGroupId,
        takeId,
        candidateIndex,
        generationTaskId:job.id,
        providerId:job.providerId,
        ...(job.providerJobId?{providerJobId:job.providerJobId}:{}),
        status:job.status,
      }))
    }
  }

  const submittedBoards=new Set(submitted.map(item=>item.boardId))
  const remainingBoardIds=boards.map(board=>board.id).filter(id=>!skipped.includes(id)&&!submittedBoards.has(id))
  const now=new Date().toISOString()
  if(submitted.length){
    const {error:generationWriteError}=await client.from('director_creative_stages').update({
      status:'running',updated_at:now,
    }).eq('id',stageId).eq('project_id',projectId)
    if(generationWriteError)throw new Error('SIDE_HUSTLE_DIRECTOR_GENERATION_STAGE_WRITE_FAILED:'+generationWriteError.message)
    const {error:runWriteError}=await client.from('director_production_runs').update({
      status:'executing',updated_at:now,
    }).eq('id',runId).eq('project_id',projectId)
    if(runWriteError)throw new Error('SIDE_HUSTLE_DIRECTOR_RUN_EXECUTING_FAILED:'+runWriteError.message)
    const {error:contextWriteError}=await client.from('director_project_business_context').update({
      automation_status:'running',automation_error:null,updated_at:now,
    }).eq('project_id',projectId).eq('owner_user_id',userId)
    if(contextWriteError)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_ADVANCE_FAILED:'+contextWriteError.message)
  }

  return Object.freeze({
    projectId,
    productionRunId:runId,
    modelId:MODEL_ID,
    inspectedBoards:boards.length,
    submitted:Object.freeze(submitted),
    skippedAlreadySubmitted:Object.freeze(skipped),
    remainingBoardIds:Object.freeze(remainingBoardIds),
    status:submitted.length?'submitted':'nothing_to_submit',
    nextBoundary:'DIRECTOR_GENERATION_RECONCILIATION',
    publicationAuthority:'NONE',
    paidMediaAuthority:'NONE',
  })
}
