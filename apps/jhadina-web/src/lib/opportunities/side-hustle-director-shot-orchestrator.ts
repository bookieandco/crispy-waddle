import type {SupabaseClient} from '@supabase/supabase-js'
import {
  proposeStoryboardFromScreenplay,
  type ScreenplayScene,
  type StoryTreatment,
} from '@jhadina/director-core'
import type {SideHustleDirectorProductionPlan} from './side-hustle-director-bridge'

type BlueprintRow={
  id:string
  version:number
  blueprint:{
    treatment?:StoryTreatment
    scenes?:ScreenplayScene[]
    authority?:string
  }
  evidence_ids:string[]|null
}

function unique(values:readonly string[]):string[]{
  return [...new Set(values.map(value=>value.trim()).filter(Boolean))]
}

export async function advanceSideHustleDirectorShotOrchestration(input:{
  client:SupabaseClient
  userId:string
  projectId:string
}):Promise<Readonly<{
  projectId:string
  productionRunId:string
  storyboardSequenceIds:readonly string[]
  storyboardBoardIds:readonly string[]
  shotIds:readonly string[]
  gateIds:readonly string[]
  status:'awaiting_storyboard_approval'
  nextBoundary:'STORYBOARD_AND_SHOTLIST_APPROVAL_REQUIRED'
  publicationAuthority:'NONE'
  paidMediaAuthority:'NONE'
}>>{
  const {client,userId,projectId}=input
  const {data:context,error:contextError}=await client.from('director_project_business_context')
    .select('project_id,owner_user_id,production_run_id,automation_status,plan')
    .eq('project_id',projectId).eq('owner_user_id',userId).maybeSingle()
  if(contextError)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_READ_FAILED:'+contextError.message)
  if(!context)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_NOT_FOUND')
  const plan=context.plan as SideHustleDirectorProductionPlan
  if(!plan||plan.directorProjectId!==projectId)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_INVALID')
  if(['tiktok_short','ugc_ad'].includes(plan.format))throw new Error('SIDE_HUSTLE_DIRECTOR_WHOLE_VIDEO_JOB_OWNS_FORMAT')
  const runId=String(context.production_run_id??'')
  if(!runId)throw new Error('SIDE_HUSTLE_DIRECTOR_PRODUCTION_RUN_REQUIRED')

  const {data:blueprintRaw,error:blueprintError}=await client.from('director_screenplay_blueprints')
    .select('id,version,blueprint,evidence_ids')
    .eq('project_id',projectId)
    .eq('owner_user_id',userId)
    .order('version',{ascending:false})
    .limit(1)
    .maybeSingle()
  if(blueprintError)throw new Error('SIDE_HUSTLE_DIRECTOR_SCREENPLAY_READ_FAILED:'+blueprintError.message)
  if(!blueprintRaw){
    const code=plan.format==='faceless_youtube'
      ?'SIDE_HUSTLE_DIRECTOR_FACELESS_SCRIPT_BLUEPRINT_REQUIRED'
      :plan.format==='music_video'
        ?'SIDE_HUSTLE_DIRECTOR_MUSIC_VIDEO_TREATMENT_OR_SCRIPT_REQUIRED'
        :'SIDE_HUSTLE_DIRECTOR_SCREENPLAY_BLUEPRINT_REQUIRED'
    throw new Error(code)
  }
  const blueprint=blueprintRaw as BlueprintRow
  if(
    blueprint.blueprint?.authority!=='DIRECTOR_SCREENPLAY_BLUEPRINT'||
    !blueprint.blueprint.treatment||
    !Array.isArray(blueprint.blueprint.scenes)||
    !blueprint.blueprint.scenes.length
  )throw new Error('SIDE_HUSTLE_DIRECTOR_SCREENPLAY_BLUEPRINT_INVALID')

  const proposal=proposeStoryboardFromScreenplay({
    proposalId:'storyboard-proposal:'+String(blueprint.id),
    treatment:blueprint.blueprint.treatment,
    scenes:blueprint.blueprint.scenes,
    evidenceIds:unique([
      ...(blueprint.evidence_ids??[]),
      'screenplay-blueprint:'+String(blueprint.id),
      ...plan.evidenceRefs,
    ]),
  })

  const sequenceIds=proposal.sequences.map(item=>item.id)
  const boardIds=proposal.boards.map(item=>item.id)
  const shotIds=unique(proposal.boards.map(item=>item.shotId))

  const {data:existingSequences,error:existingError}=await client.from('director_storyboard_sequences')
    .select('id').eq('project_id',projectId).in('id',sequenceIds)
  if(existingError)throw new Error('SIDE_HUSTLE_DIRECTOR_STORYBOARD_READ_FAILED:'+existingError.message)
  const existingIds=new Set((existingSequences??[]).map(row=>String(row.id)))
  if(existingIds.size>0&&existingIds.size!==sequenceIds.length){
    throw new Error('SIDE_HUSTLE_DIRECTOR_STORYBOARD_PARTIAL_STATE_REQUIRES_RECONCILIATION')
  }

  if(existingIds.size===sequenceIds.length){
    const [{data:existingBoards,error:boardReadError},{data:existingBindings,error:bindingReadError}]=await Promise.all([
      client.from('director_storyboard_boards').select('id').eq('project_id',projectId).in('id',boardIds),
      client.from('director_storyboard_stage_bindings').select('storyboard_board_id').eq('project_id',projectId).in('storyboard_board_id',boardIds),
    ])
    if(boardReadError)throw new Error('SIDE_HUSTLE_DIRECTOR_STORYBOARD_BOARD_READ_FAILED:'+boardReadError.message)
    if(bindingReadError)throw new Error('SIDE_HUSTLE_DIRECTOR_STORYBOARD_BINDING_READ_FAILED:'+bindingReadError.message)
    const existingBoardIds=new Set((existingBoards??[]).map(row=>String(row.id)))
    const boundBoardIds=new Set((existingBindings??[]).map(row=>String(row.storyboard_board_id)))
    if(existingBoardIds.size!==boardIds.length||boundBoardIds.size!==boardIds.length){
      throw new Error('SIDE_HUSTLE_DIRECTOR_STORYBOARD_PARTIAL_STATE_REQUIRES_RECONCILIATION')
    }
  }

  const now=new Date().toISOString()
  if(existingIds.size===0){
    const {error:sequenceError}=await client.from('director_storyboard_sequences').insert(
      proposal.sequences.map(sequence=>({
        id:sequence.id,
        project_id:sequence.projectId,
        scene_id:sequence.sceneId,
        board_ids:[...sequence.boardIds],
        version:sequence.version,
        updated_at:sequence.updatedAt,
      })),
    )
    if(sequenceError)throw new Error('SIDE_HUSTLE_DIRECTOR_STORYBOARD_SEQUENCE_WRITE_FAILED:'+sequenceError.message)

    const {error:boardError}=await client.from('director_storyboard_boards').insert(
      proposal.boards.map(item=>({
        id:item.id,
        sequence_id:item.sequenceId,
        project_id:item.projectId,
        shot_id:item.shotId,
        ordinal:item.order,
        status:item.status,
        title:item.title??null,
        description:item.description??null,
        script_ref:item.scriptRef??null,
        reference_asset_ids:[...item.referenceAssetIds],
        continuity_anchor_ids:[...item.continuityAnchorIds],
        continuity_locks:item.continuityLocks??null,
        camera_language:item.cameraLanguage??null,
        framing:item.framing??null,
        action:item.action??null,
        notes:item.notes??null,
        cinematography:item.cinematography??null,
        version:item.version,
        artifact_ids:[...item.artifactIds],
        updated_at:item.updatedAt,
      })),
    )
    if(boardError)throw new Error('SIDE_HUSTLE_DIRECTOR_STORYBOARD_BOARD_WRITE_FAILED:'+boardError.message)

    const stageId=(kind:string)=>'stage:business:'+projectId+':'+plan.id+':'+kind
    const {error:bindingError}=await client.from('director_storyboard_stage_bindings').insert(
      proposal.boards.map(item=>({
        id:'binding:'+item.id+':v1',
        project_id:projectId,
        storyboard_board_id:item.id,
        storyboard_stage_id:stageId('storyboard'),
        shotlist_stage_id:stageId('shotlist'),
        previs_stage_id:stageId('previs'),
        generation_stage_id:stageId('generation'),
        edit_stage_id:stageId('edit'),
        review_stage_id:stageId('review'),
        version:1,
      })),
    )
    if(bindingError)throw new Error('SIDE_HUSTLE_DIRECTOR_STORYBOARD_BINDING_WRITE_FAILED:'+bindingError.message)
  }

  const storyboardGateId='gate:business:'+projectId+':'+plan.id+':storyboard'
  const shotlistGateId='gate:business:'+projectId+':'+plan.id+':shotlist'
  const gateRows=[
    {id:storyboardGateId,project_id:projectId,run_id:runId,kind:'storyboard',decision:'pending',requested_at:now,evidence_ids:proposal.evidenceIds},
    {id:shotlistGateId,project_id:projectId,run_id:runId,kind:'shotlist',decision:'pending',requested_at:now,evidence_ids:proposal.evidenceIds},
  ]
  for(const gate of gateRows){
    const {data:existing,error:gateReadError}=await client.from('director_creative_gates')
      .select('id').eq('id',gate.id).eq('run_id',runId).maybeSingle()
    if(gateReadError)throw new Error('SIDE_HUSTLE_DIRECTOR_GATE_READ_FAILED:'+gateReadError.message)
    if(!existing){
      const {error}=await client.from('director_creative_gates').insert(gate)
      if(error)throw new Error('SIDE_HUSTLE_DIRECTOR_GATE_WRITE_FAILED:'+error.message)
    }
  }

  const stageId=(kind:string)=>'stage:business:'+projectId+':'+plan.id+':'+kind
  const {error:storyboardStageError}=await client.from('director_creative_stages').update({
    status:'review',
    input_artifact_ids:['screenplay-blueprint:'+String(blueprint.id)],
    output_artifact_ids:boardIds,
    updated_at:now,
  }).eq('id',stageId('storyboard')).eq('project_id',projectId)
  if(storyboardStageError)throw new Error('SIDE_HUSTLE_DIRECTOR_STORYBOARD_STAGE_WRITE_FAILED:'+storyboardStageError.message)

  const {error:shotlistStageError}=await client.from('director_creative_stages').update({
    status:'review',
    input_artifact_ids:boardIds,
    output_artifact_ids:shotIds,
    updated_at:now,
  }).eq('id',stageId('shotlist')).eq('project_id',projectId)
  if(shotlistStageError)throw new Error('SIDE_HUSTLE_DIRECTOR_SHOTLIST_STAGE_WRITE_FAILED:'+shotlistStageError.message)

  const gateIds=[storyboardGateId,shotlistGateId]
  const {data:run,error:runReadError}=await client.from('director_production_runs')
    .select('shot_ids,gate_ids').eq('id',runId).eq('project_id',projectId).maybeSingle()
  if(runReadError)throw new Error('SIDE_HUSTLE_DIRECTOR_RUN_READ_FAILED:'+runReadError.message)
  if(!run)throw new Error('SIDE_HUSTLE_DIRECTOR_PRODUCTION_RUN_NOT_FOUND')
  const existingShotIds=Array.isArray(run.shot_ids)?run.shot_ids.map(String):[]
  const existingGateIds=Array.isArray(run.gate_ids)?run.gate_ids.map(String):[]
  const {error:runError}=await client.from('director_production_runs').update({
    status:'awaiting_approval',
    shot_ids:unique([...existingShotIds,...shotIds]),
    gate_ids:unique([...existingGateIds,...gateIds]),
    updated_at:now,
  }).eq('id',runId).eq('project_id',projectId)
  if(runError)throw new Error('SIDE_HUSTLE_DIRECTOR_RUN_ADVANCE_FAILED:'+runError.message)

  const {error:contextWriteError}=await client.from('director_project_business_context').update({
    automation_status:'running',
    automation_error:null,
    updated_at:now,
  }).eq('project_id',projectId).eq('owner_user_id',userId)
  if(contextWriteError)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_ADVANCE_FAILED:'+contextWriteError.message)

  return Object.freeze({
    projectId,
    productionRunId:runId,
    storyboardSequenceIds:Object.freeze(sequenceIds),
    storyboardBoardIds:Object.freeze(boardIds),
    shotIds:Object.freeze(shotIds),
    gateIds:Object.freeze(gateIds),
    status:'awaiting_storyboard_approval',
    nextBoundary:'STORYBOARD_AND_SHOTLIST_APPROVAL_REQUIRED',
    publicationAuthority:'NONE',
    paidMediaAuthority:'NONE',
  })
}


export async function advanceSideHustleDirectorAfterStoryboardApproval(input:{
  client:SupabaseClient
  userId:string
  projectId:string
}):Promise<Readonly<{
  projectId:string
  productionRunId:string
  status:'previs_rehearsal_ready'
  generationGateId:string
  nextBoundary:'PREVIS_REHEARSAL_AND_GENERATION_GATE'
  publicationAuthority:'NONE'
  paidMediaAuthority:'NONE'
}>>{
  const {client,userId,projectId}=input
  const {data:context,error:contextError}=await client.from('director_project_business_context')
    .select('owner_user_id,production_run_id,plan')
    .eq('project_id',projectId)
    .eq('owner_user_id',userId)
    .maybeSingle()
  if(contextError)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_READ_FAILED:'+contextError.message)
  if(!context)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_NOT_FOUND')
  const plan=context.plan as SideHustleDirectorProductionPlan
  if(!plan||plan.directorProjectId!==projectId)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_INVALID')
  const runId=String(context.production_run_id??'')
  if(!runId)throw new Error('SIDE_HUSTLE_DIRECTOR_PRODUCTION_RUN_REQUIRED')

  const storyboardGateId='gate:business:'+plan.id+':storyboard'
  const shotlistGateId='gate:business:'+plan.id+':shotlist'
  const {data:gates,error:gateError}=await client.from('director_creative_gates')
    .select('id,decision,decided_at,decided_by,evidence_ids')
    .eq('project_id',projectId)
    .eq('run_id',runId)
    .in('id',[storyboardGateId,shotlistGateId])
  if(gateError)throw new Error('SIDE_HUSTLE_DIRECTOR_GATE_READ_FAILED:'+gateError.message)
  if((gates??[]).length!==2)throw new Error('SIDE_HUSTLE_DIRECTOR_REQUIRED_GATES_MISSING')
  for(const gate of gates??[]){
    if(gate.decision==='changes_requested')throw new Error('SIDE_HUSTLE_DIRECTOR_STORYBOARD_CHANGES_REQUESTED')
    if(gate.decision==='rejected')throw new Error('SIDE_HUSTLE_DIRECTOR_STORYBOARD_REJECTED')
    if(gate.decision!=='approved'||!gate.decided_at||!gate.decided_by){
      throw new Error('SIDE_HUSTLE_DIRECTOR_STORYBOARD_APPROVAL_REQUIRED')
    }
  }

  const now=new Date().toISOString()
  const stageId=(kind:string)=>'stage:business:'+plan.id+':'+kind
  for(const kind of ['storyboard','shotlist'] as const){
    const {error}=await client.from('director_creative_stages').update({
      status:'approved',
      approved_at:now,
      approved_by:'creative-gate:'+kind,
      updated_at:now,
    }).eq('id',stageId(kind)).eq('project_id',projectId)
    if(error)throw new Error('SIDE_HUSTLE_DIRECTOR_STAGE_APPROVAL_WRITE_FAILED:'+error.message)
  }

  const {error:boardReadyError}=await client.from('director_storyboard_boards').update({
    status:'ready',
    updated_at:now,
  }).eq('project_id',projectId).in('status',['draft','ready'])
  if(boardReadyError)throw new Error('SIDE_HUSTLE_DIRECTOR_STORYBOARD_READY_FAILED:'+boardReadyError.message)

  const {error:previsError}=await client.from('director_creative_stages').update({
    status:'ready',updated_at:now,
  }).eq('id',stageId('previs')).eq('project_id',projectId)
  if(previsError)throw new Error('SIDE_HUSTLE_DIRECTOR_PREVIS_READY_FAILED:'+previsError.message)

  const generationGateId='gate:business:'+plan.id+':generation'
  const gateEvidence=unique((gates??[]).flatMap(gate=>Array.isArray(gate.evidence_ids)?gate.evidence_ids.map(String):[]))
  const {data:existingGenerationGate,error:generationGateReadError}=await client.from('director_creative_gates')
    .select('id').eq('id',generationGateId).eq('run_id',runId).maybeSingle()
  if(generationGateReadError)throw new Error('SIDE_HUSTLE_DIRECTOR_GENERATION_GATE_READ_FAILED:'+generationGateReadError.message)
  if(!existingGenerationGate){
    const {error}=await client.from('director_creative_gates').insert({
      id:generationGateId,
      project_id:projectId,
      run_id:runId,
      kind:'generation',
      decision:'pending',
      requested_at:now,
      evidence_ids:gateEvidence,
    })
    if(error)throw new Error('SIDE_HUSTLE_DIRECTOR_GENERATION_GATE_WRITE_FAILED:'+error.message)
  }

  const {data:run,error:runReadError}=await client.from('director_production_runs')
    .select('gate_ids').eq('id',runId).eq('project_id',projectId).maybeSingle()
  if(runReadError)throw new Error('SIDE_HUSTLE_DIRECTOR_RUN_READ_FAILED:'+runReadError.message)
  if(!run)throw new Error('SIDE_HUSTLE_DIRECTOR_PRODUCTION_RUN_NOT_FOUND')
  const gateIds=Array.isArray(run.gate_ids)?run.gate_ids.map(String):[]
  const {error:runError}=await client.from('director_production_runs').update({
    status:'awaiting_approval',
    gate_ids:unique([...gateIds,generationGateId]),
    updated_at:now,
  }).eq('id',runId).eq('project_id',projectId)
  if(runError)throw new Error('SIDE_HUSTLE_DIRECTOR_RUN_ADVANCE_FAILED:'+runError.message)

  const {error:contextWriteError}=await client.from('director_project_business_context').update({
    automation_status:'running',
    automation_error:null,
    updated_at:now,
  }).eq('project_id',projectId).eq('owner_user_id',userId)
  if(contextWriteError)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_ADVANCE_FAILED:'+contextWriteError.message)

  return Object.freeze({
    projectId,
    productionRunId:runId,
    status:'previs_rehearsal_ready',
    generationGateId,
    nextBoundary:'PREVIS_REHEARSAL_AND_GENERATION_GATE',
    publicationAuthority:'NONE',
    paidMediaAuthority:'NONE',
  })
}


export async function advanceSideHustleDirectorAfterRehearsal(input:{
  client:SupabaseClient
  userId:string
  projectId:string
}):Promise<Readonly<{
  projectId:string
  productionRunId:string
  generationGateId:string
  status:'generation_ready'
  nextBoundary:'DIRECTOR_TAKE_SET_SUBMISSION'
  publicationAuthority:'NONE'
  paidMediaAuthority:'NONE'
}>>{
  const {client,userId,projectId}=input
  const {data:context,error:contextError}=await client.from('director_project_business_context')
    .select('owner_user_id,production_run_id,plan')
    .eq('project_id',projectId)
    .eq('owner_user_id',userId)
    .maybeSingle()
  if(contextError)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_READ_FAILED:'+contextError.message)
  if(!context)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_NOT_FOUND')
  const plan=context.plan as SideHustleDirectorProductionPlan
  if(!plan||plan.directorProjectId!==projectId)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_INVALID')
  const runId=String(context.production_run_id??'')
  if(!runId)throw new Error('SIDE_HUSTLE_DIRECTOR_PRODUCTION_RUN_REQUIRED')

  const stageId=(kind:string)=>'stage:business:'+plan.id+':'+kind
  const generationGateId='gate:business:'+plan.id+':generation'

  const [{data:gate,error:gateError},{data:stages,error:stageError}]=await Promise.all([
    client.from('director_creative_gates')
      .select('id,decision,decided_at,decided_by')
      .eq('id',generationGateId).eq('project_id',projectId).eq('run_id',runId).maybeSingle(),
    client.from('director_creative_stages')
      .select('id,kind,status,output_artifact_ids')
      .eq('project_id',projectId)
      .in('id',[stageId('previs'),stageId('rehearsal')]),
  ])
  if(gateError)throw new Error('SIDE_HUSTLE_DIRECTOR_GENERATION_GATE_READ_FAILED:'+gateError.message)
  if(stageError)throw new Error('SIDE_HUSTLE_DIRECTOR_REHEARSAL_STAGE_READ_FAILED:'+stageError.message)
  if(!gate||gate.decision!=='approved'||!gate.decided_at||!gate.decided_by){
    throw new Error('SIDE_HUSTLE_DIRECTOR_GENERATION_APPROVAL_REQUIRED')
  }
  const byKind=new Map((stages??[]).map(stage=>[String(stage.kind),stage]))
  for(const kind of ['previs','rehearsal'] as const){
    const stage=byKind.get(kind)
    if(!stage||stage.status!=='approved'){
      throw new Error('SIDE_HUSTLE_DIRECTOR_'+kind.toUpperCase()+'_APPROVAL_REQUIRED')
    }
    if(!Array.isArray(stage.output_artifact_ids)||stage.output_artifact_ids.length===0){
      throw new Error('SIDE_HUSTLE_DIRECTOR_'+kind.toUpperCase()+'_EVIDENCE_REQUIRED')
    }
  }

  const now=new Date().toISOString()
  const {error:generationError}=await client.from('director_creative_stages').update({
    status:'ready',
    input_artifact_ids:[
      ...new Set((stages??[]).flatMap(stage=>Array.isArray(stage.output_artifact_ids)?stage.output_artifact_ids.map(String):[])),
    ],
    updated_at:now,
  }).eq('id',stageId('generation')).eq('project_id',projectId)
  if(generationError)throw new Error('SIDE_HUSTLE_DIRECTOR_GENERATION_READY_FAILED:'+generationError.message)

  const {error:runError}=await client.from('director_production_runs').update({
    status:'awaiting_approval',
    updated_at:now,
  }).eq('id',runId).eq('project_id',projectId)
  if(runError)throw new Error('SIDE_HUSTLE_DIRECTOR_RUN_ADVANCE_FAILED:'+runError.message)

  return Object.freeze({
    projectId,
    productionRunId:runId,
    generationGateId,
    status:'generation_ready',
    nextBoundary:'DIRECTOR_TAKE_SET_SUBMISSION',
    publicationAuthority:'NONE',
    paidMediaAuthority:'NONE',
  })
}
