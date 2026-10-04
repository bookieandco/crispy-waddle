import {createHash} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {
  EditableTimeline,
  TimelineClip,
  TimelineSnapshot,
  TimelineTrack,
  TimelineVersion,
} from '@jhadina/director-core'
import {DirectorWorkstationTimelineRepository} from '@/lib/director-workstation-timeline-repository'
import type {SideHustleDirectorProductionPlan} from './side-hustle-director-bridge'

type SelectionRow={
  take_group_id:string
  selected_take_id:string|null
  selected_asset_id:string|null
  alternate_take_ids:string[]|null
  policy_id:string
  evidence_ids:string[]|null
  status:'selected'|'blocked'
}
type BoardRow={
  id:string
  sequence_id:string
  ordinal:number
  shot_id:string
  title:string|null
}
type SequenceRow={id:string;scene_id:string}
type AssetRow={
  id:string
  generation_job_id:string
  uri:string
  mime_type:string|null
  metadata:Record<string,unknown>|null
}

function unique(values:readonly string[]):string[]{
  return [...new Set(values.map(String).map(value=>value.trim()).filter(Boolean))]
}
function snapshot(timeline:EditableTimeline):TimelineSnapshot{
  return {
    tracks:timeline.tracks,
    transitions:timeline.transitions,
    markers:timeline.markers,
    playheadSeconds:timeline.playheadSeconds,
  }
}
function snapshotHash(value:TimelineSnapshot):string{
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
function measuredDuration(asset:AssetRow):{seconds:number;measured:boolean}{
  const metadata=asset.metadata??{}
  const value=metadata.measuredDurationSeconds
  if(typeof value==='number'&&Number.isFinite(value)&&value>0)return {seconds:value,measured:true}
  const nested=metadata.providerMetadata
  if(nested&&typeof nested==='object'){
    const candidate=(nested as Record<string,unknown>).measuredDurationSeconds
    if(typeof candidate==='number'&&Number.isFinite(candidate)&&candidate>0)return {seconds:candidate,measured:true}
  }
  return {seconds:121/24,measured:false}
}
function dimensions(aspect:'9:16'|'16:9'|'1:1'){
  return aspect==='9:16'
    ? {width:1080,height:1920}
    : aspect==='1:1'
      ? {width:1080,height:1080}
      : {width:1920,height:1080}
}

async function loadPlan(client:SupabaseClient,userId:string,projectId:string){
  const {data,error}=await client.from('director_project_business_context')
    .select('owner_user_id,production_run_id,plan,automation_status')
    .eq('project_id',projectId).eq('owner_user_id',userId).maybeSingle()
  if(error)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_READ_FAILED:'+error.message)
  if(!data)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_NOT_FOUND')
  const plan=data.plan as SideHustleDirectorProductionPlan
  if(!plan||plan.directorProjectId!==projectId)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_INVALID')
  const runId=String(data.production_run_id??'')
  if(!runId)throw new Error('SIDE_HUSTLE_DIRECTOR_PRODUCTION_RUN_REQUIRED')
  return {plan,runId}
}

async function orderedSelectedAssets(client:SupabaseClient,projectId:string,plan:SideHustleDirectorProductionPlan){
  const {data:selectionsRaw,error:selectionError}=await client.from('director_take_selections')
    .select('take_group_id,selected_take_id,selected_asset_id,alternate_take_ids,policy_id,evidence_ids,status')
    .eq('project_id',projectId)
    .eq('status','selected')
  if(selectionError)throw new Error('DIRECTOR_ASSEMBLY_SELECTION_READ_FAILED:'+selectionError.message)
  const selections=(selectionsRaw??[]) as SelectionRow[]
  if(!selections.length)throw new Error('DIRECTOR_ASSEMBLY_SELECTED_TAKES_REQUIRED')

  const boardPrefix='take-group:'+plan.id+':'
  const boardIds=unique(selections.map(selection=>selection.take_group_id.startsWith(boardPrefix)
    ? selection.take_group_id.slice(boardPrefix.length)
    : ''
  ))
  if(!boardIds.length)throw new Error('DIRECTOR_ASSEMBLY_SELECTION_LINEAGE_INVALID')

  const {data:boardsRaw,error:boardError}=await client.from('director_storyboard_boards')
    .select('id,sequence_id,ordinal,shot_id,title')
    .eq('project_id',projectId)
    .in('id',boardIds)
  if(boardError)throw new Error('DIRECTOR_ASSEMBLY_BOARD_READ_FAILED:'+boardError.message)
  const boards=(boardsRaw??[]) as BoardRow[]
  if(boards.length!==boardIds.length)throw new Error('DIRECTOR_ASSEMBLY_BOARD_LINEAGE_INCOMPLETE')

  const sequenceIds=unique(boards.map(board=>board.sequence_id))
  const {data:sequencesRaw,error:sequenceError}=await client.from('director_storyboard_sequences')
    .select('id,scene_id').eq('project_id',projectId).in('id',sequenceIds)
  if(sequenceError)throw new Error('DIRECTOR_ASSEMBLY_SEQUENCE_READ_FAILED:'+sequenceError.message)
  const sequences=(sequencesRaw??[]) as SequenceRow[]

  const {data:blueprintRaw,error:blueprintError}=await client.from('director_screenplay_blueprints')
    .select('blueprint').eq('project_id',projectId).order('version',{ascending:false}).limit(1).maybeSingle()
  if(blueprintError)throw new Error('DIRECTOR_ASSEMBLY_BLUEPRINT_READ_FAILED:'+blueprintError.message)
  const blueprint=blueprintRaw?.blueprint as {scenes?:Array<{id?:string;order?:number}>}|undefined
  const sceneOrder=new Map((blueprint?.scenes??[]).map((scene,index)=>[
    String(scene.id??''),
    typeof scene.order==='number'?scene.order:index+1,
  ]))
  const sequenceScene=new Map(sequences.map(sequence=>[sequence.id,sequence.scene_id]))
  const boardById=new Map(boards.map(board=>[board.id,board]))
  const selectionByBoard=new Map(selections.map(selection=>[
    selection.take_group_id.slice(boardPrefix.length),
    selection,
  ]))

  const assetIds=unique(selections.map(selection=>selection.selected_asset_id??''))
  const {data:assetsRaw,error:assetError}=await client.from('director_generated_editing_assets')
    .select('id,generation_job_id,uri,mime_type,metadata')
    .eq('project_id',projectId).in('id',assetIds)
  if(assetError)throw new Error('DIRECTOR_ASSEMBLY_ASSET_READ_FAILED:'+assetError.message)
  const assets=(assetsRaw??[]) as AssetRow[]
  const assetById=new Map(assets.map(asset=>[asset.id,asset]))
  if(assetById.size!==assetIds.length)throw new Error('DIRECTOR_ASSEMBLY_SELECTED_ASSET_MISSING')

  const ordered=boardIds.map(boardId=>{
    const board=boardById.get(boardId)!
    const selection=selectionByBoard.get(boardId)!
    const asset=assetById.get(String(selection.selected_asset_id))!
    const sceneId=sequenceScene.get(board.sequence_id)??''
    return {board,selection,asset,sceneOrder:sceneOrder.get(sceneId)??Number.MAX_SAFE_INTEGER}
  }).sort((a,b)=>
    a.sceneOrder-b.sceneOrder||
    a.board.ordinal-b.board.ordinal||
    a.board.id.localeCompare(b.board.id)
  )
  return ordered
}

function buildTimeline(
  base:EditableTimeline,
  plan:SideHustleDirectorProductionPlan,
  selected:Awaited<ReturnType<typeof orderedSelectedAssets>>,
){
  const pictureClips:TimelineClip[]=[]
  const limitations:string[]=[]
  let cursor=0
  for(const [index,item] of selected.entries()){
    const duration=measuredDuration(item.asset)
    if(!duration.measured)limitations.push('unmeasured-duration:'+item.asset.id)
    pictureClips.push({
      id:'auto-picture:'+plan.id+':'+(index+1),
      name:item.board.title??('Shot '+(index+1)),
      assetId:item.asset.id,
      trackId:'video-primary',
      startSeconds:cursor,
      durationSeconds:duration.seconds,
      sourceInSeconds:0,
      sourceOutSeconds:duration.seconds,
      sourceDurationSeconds:duration.seconds,
      takeGroupId:item.selection.take_group_id,
      takeId:item.selection.selected_take_id??undefined,
      effects:[],
      generativeRegions:[],
    })
    cursor+=duration.seconds
  }

  const isFaceless=plan.format==='faceless_youtube'
  const tracks:TimelineTrack[]=[
    {
      id:'video-primary',
      name:isFaceless?'Generated B-Roll / Visual Story':'Picture',
      kind:'video',
      index:0,
      relationship:'primary',
      clips:pictureClips,
    },
    {
      id:'video-broll',
      name:isFaceless?'B-Roll / Inserts':'B-Roll / Cutaways',
      kind:'overlay',
      index:1,
      relationship:'lane',
      clips:[],
    },
    {
      id:'audio-dialogue',
      name:isFaceless?'Narration / Voiceover':'Dialogue / ADR',
      kind:'audio',
      index:2,
      relationship:'lane',
      role:isFaceless?'voiceover':'dialogue',
      clips:[],
    },
    {
      id:'audio-music',
      name:'Music / Score',
      kind:'audio',
      index:3,
      relationship:'lane',
      role:'music',
      clips:[],
    },
    {
      id:'audio-foley',
      name:'Foley / SFX',
      kind:'audio',
      index:4,
      relationship:'lane',
      role:'foley',
      clips:[],
    },
    {
      id:'subtitles',
      name:'Captions / Subtitles',
      kind:'subtitle',
      index:5,
      relationship:'lane',
      clips:[],
    },
  ]
  const markers=selected.map((item,index)=>({
    id:'auto-take-marker:'+plan.id+':'+(index+1),
    timeSeconds:pictureClips[index]!.startSeconds,
    label:'Selected '+String(item.selection.selected_take_id),
    notes:item.selection.alternate_take_ids?.length
      ? 'Preserved backup takes: '+item.selection.alternate_take_ids.join(', ')
      : 'No admitted backup take recorded.',
  }))
  if(cursor<plan.targetRuntimeSeconds){
    limitations.push('picture-duration-short-of-target:'+(plan.targetRuntimeSeconds-cursor).toFixed(3))
    markers.push({
      id:'auto-duration-gap:'+plan.id,
      timeSeconds:cursor,
      label:'Additional picture/B-roll required',
      notes:'Automatic assembly does not fabricate missing duration. Use B-roll, generative extend, inserts, or additional storyboard coverage.',
    })
  }

  const timeline:EditableTimeline={
    ...base,
    width:dimensions(plan.aspectRatio).width,
    height:dimensions(plan.aspectRatio).height,
    durationSeconds:Math.max(plan.targetRuntimeSeconds,cursor),
    playheadSeconds:0,
    tracks,
    transitions:[],
    markers,
    versions:base.versions,
  }
  return {timeline,pictureDurationSeconds:cursor,limitations:unique(limitations)}
}

export async function proposeSideHustleDirectorEditAssembly(input:{
  client:SupabaseClient
  userId:string
  projectId:string
}){
  const {client,userId,projectId}=input
  const {plan,runId}=await loadPlan(client,userId,projectId)
  const {data:editStage,error:editStageError}=await client.from('director_creative_stages')
    .select('id,status').eq('id','stage:business:'+plan.id+':edit').eq('project_id',projectId).maybeSingle()
  if(editStageError)throw new Error('DIRECTOR_ASSEMBLY_EDIT_STAGE_READ_FAILED:'+editStageError.message)
  if(!editStage||!['ready','running','review'].includes(String(editStage.status))){
    throw new Error('DIRECTOR_ASSEMBLY_EDIT_STAGE_NOT_READY')
  }

  const repository=new DirectorWorkstationTimelineRepository(client)
  const record=await repository.load(projectId)
  if(!record)throw new Error('DIRECTOR_ASSEMBLY_TIMELINE_NOT_FOUND')
  const existingClipCount=record.timeline.tracks.reduce((sum,track)=>sum+track.clips.length,0)
  if(existingClipCount>0){
    const {data:existing}=await client.from('director_edit_assembly_proposals')
      .select('id,status,timeline_revision').eq('project_id',projectId).eq('plan_id',plan.id).maybeSingle()
    if(existing?.status!=='materialized'){
      throw new Error('DIRECTOR_ASSEMBLY_MANUAL_OR_EXISTING_TIMELINE_NOT_EMPTY')
    }
  }

  const selected=await orderedSelectedAssets(client,projectId,plan)
  const selectedAssetIds=selected.map(item=>item.asset.id)
  const {data:approvals,error:approvalError}=await client.from('director_editing_asset_approvals')
    .select('asset_id,approved_by_user_id').in('asset_id',selectedAssetIds)
  if(approvalError)throw new Error('DIRECTOR_ASSEMBLY_APPROVAL_READ_FAILED:'+approvalError.message)
  const approved=new Set((approvals??[])
    .filter(row=>String(row.approved_by_user_id)===userId)
    .map(row=>String(row.asset_id)))
  const requiredApprovalAssetIds=selectedAssetIds.filter(id=>!approved.has(id))
  const assembly=buildTimeline(record.timeline,plan,selected)
  const proposalId='edit-assembly:'+plan.id
  const status=requiredApprovalAssetIds.length?'awaiting_asset_approval':'proposed'
  const proposal={
    id:proposalId,
    projectId,
    productionRunId:runId,
    planId:plan.id,
    format:plan.format,
    baseTimelineRevision:record.revision,
    pictureDurationSeconds:assembly.pictureDurationSeconds,
    targetDurationSeconds:plan.targetRuntimeSeconds,
    timeline:assembly.timeline,
    limitations:assembly.limitations,
    selectedTakes:selected.map(item=>({
      boardId:item.board.id,
      shotId:item.board.shot_id,
      takeGroupId:item.selection.take_group_id,
      selectedTakeId:item.selection.selected_take_id,
      selectedAssetId:item.asset.id,
      alternateTakeIds:item.selection.alternate_take_ids??[],
      policyId:item.selection.policy_id,
      evidenceIds:item.selection.evidence_ids??[],
    })),
    authority:'DIRECTOR_EDIT_ASSEMBLY_PROPOSAL_ONLY',
  }
  const {error}=await client.from('director_edit_assembly_proposals').upsert({
    id:proposalId,
    project_id:projectId,
    owner_user_id:userId,
    production_run_id:runId,
    plan_id:plan.id,
    timeline_revision:record.revision,
    proposal,
    selected_asset_ids:selectedAssetIds,
    required_approval_asset_ids:requiredApprovalAssetIds,
    status,
    error:null,
    updated_at:new Date().toISOString(),
  },{onConflict:'project_id,plan_id'})
  if(error)throw new Error('DIRECTOR_ASSEMBLY_PROPOSAL_WRITE_FAILED:'+error.message)

  return Object.freeze({
    proposalId,
    status,
    selectedAssetIds:Object.freeze(selectedAssetIds),
    requiredApprovalAssetIds:Object.freeze(requiredApprovalAssetIds),
    pictureDurationSeconds:assembly.pictureDurationSeconds,
    targetDurationSeconds:plan.targetRuntimeSeconds,
    limitations:Object.freeze(assembly.limitations),
    nextBoundary:requiredApprovalAssetIds.length
      ?'DIRECTOR_SELECTED_ASSET_APPROVAL'
      :'DIRECTOR_EDIT_ASSEMBLY_MATERIALIZATION',
    publicationAuthority:'NONE' as const,
    paidMediaAuthority:'NONE' as const,
  })
}

export async function materializeSideHustleDirectorEditAssembly(input:{
  client:SupabaseClient
  userId:string
  projectId:string
}){
  const {client,userId,projectId}=input
  const {plan,runId}=await loadPlan(client,userId,projectId)
  const proposalId='edit-assembly:'+plan.id
  const {data:row,error:readError}=await client.from('director_edit_assembly_proposals')
    .select('id,timeline_revision,proposal,selected_asset_ids,status')
    .eq('id',proposalId).eq('project_id',projectId).eq('owner_user_id',userId).maybeSingle()
  if(readError)throw new Error('DIRECTOR_ASSEMBLY_PROPOSAL_READ_FAILED:'+readError.message)
  if(!row)throw new Error('DIRECTOR_ASSEMBLY_PROPOSAL_NOT_FOUND')
  if(row.status==='materialized'){
    return Object.freeze({
      proposalId,status:'materialized' as const,alreadyMaterialized:true,
      nextBoundary:'DIRECTOR_AUDIO_POST',
      publicationAuthority:'NONE' as const,paidMediaAuthority:'NONE' as const,
    })
  }

  const selectedAssetIds=Array.isArray(row.selected_asset_ids)?row.selected_asset_ids.map(String):[]
  const {data:approvals,error:approvalError}=await client.from('director_editing_asset_approvals')
    .select('asset_id,approved_by_user_id').in('asset_id',selectedAssetIds)
  if(approvalError)throw new Error('DIRECTOR_ASSEMBLY_APPROVAL_READ_FAILED:'+approvalError.message)
  const approved=new Set((approvals??[])
    .filter(item=>String(item.approved_by_user_id)===userId)
    .map(item=>String(item.asset_id)))
  const missing=selectedAssetIds.filter(id=>!approved.has(id))
  if(missing.length){
    await client.from('director_edit_assembly_proposals').update({
      status:'awaiting_asset_approval',
      required_approval_asset_ids:missing,
      updated_at:new Date().toISOString(),
    }).eq('id',proposalId)
    throw new Error('DIRECTOR_ASSEMBLY_SELECTED_ASSET_APPROVAL_REQUIRED:'+missing.join(','))
  }

  const repository=new DirectorWorkstationTimelineRepository(client)
  const current=await repository.load(projectId)
  if(!current)throw new Error('DIRECTOR_ASSEMBLY_TIMELINE_NOT_FOUND')
  if(Number(row.timeline_revision)!==current.revision){
    await client.from('director_edit_assembly_proposals').update({
      status:'stale',error:'DIRECTOR_ASSEMBLY_TIMELINE_REVISION_CHANGED',updated_at:new Date().toISOString(),
    }).eq('id',proposalId)
    throw new Error('DIRECTOR_ASSEMBLY_TIMELINE_REVISION_CHANGED')
  }
  const existingClipCount=current.timeline.tracks.reduce((sum,track)=>sum+track.clips.length,0)
  if(existingClipCount>0)throw new Error('DIRECTOR_ASSEMBLY_TIMELINE_NO_LONGER_EMPTY')

  const raw=(row.proposal??{}) as {timeline?:EditableTimeline}
  if(!raw.timeline||raw.timeline.projectId!==projectId)throw new Error('DIRECTOR_ASSEMBLY_TIMELINE_PROPOSAL_INVALID')
  const proposed={...raw.timeline,versions:[...current.timeline.versions]} as EditableTimeline
  const snap=snapshot(proposed)
  const previous=proposed.versions.at(-1)
  const version:TimelineVersion={
    id:crypto.randomUUID(),
    version:(previous?.version??0)+1,
    ...(previous?.id?{parentVersionId:previous.id}:{}),
    createdAt:new Date().toISOString(),
    createdBy:'jhadina',
    message:'Automatic rough cut from evidence-selected Director takes',
    snapshotHash:snapshotHash(snap),
    snapshot:snap,
  }
  const timeline={...proposed,versions:[...proposed.versions,version]}
  const saved=await repository.save({
    projectId,
    userId,
    expectedRevision:current.revision,
    mutationId:'auto-assembly:'+plan.id+':v1',
    timeline,
    reason:'Materialize automatic Director rough cut from approved selected takes',
  })
  const now=new Date().toISOString()
  const {error:proposalError}=await client.from('director_edit_assembly_proposals').update({
    status:'materialized',
    timeline_revision:saved.revision,
    required_approval_asset_ids:[],
    error:null,
    materialized_at:now,
    updated_at:now,
  }).eq('id',proposalId)
  if(proposalError)throw new Error('DIRECTOR_ASSEMBLY_MATERIALIZE_RECEIPT_FAILED:'+proposalError.message)

  const {error:editError}=await client.from('director_creative_stages').update({
    status:'review',
    output_artifact_ids:['workstation-timeline:'+projectId+':revision:'+saved.revision],
    updated_at:now,
  }).eq('id','stage:business:'+plan.id+':edit').eq('project_id',projectId)
  if(editError)throw new Error('DIRECTOR_EDIT_STAGE_REVIEW_FAILED:'+editError.message)
  const {error:runError}=await client.from('director_production_runs').update({
    status:'review',updated_at:now,
  }).eq('id',runId).eq('project_id',projectId)
  if(runError)throw new Error('DIRECTOR_ASSEMBLY_RUN_REVIEW_FAILED:'+runError.message)

  return Object.freeze({
    proposalId,
    status:'materialized' as const,
    alreadyMaterialized:false,
    revision:saved.revision,
    timeline:saved.timeline,
    nextBoundary:'DIRECTOR_AUDIO_POST',
    publicationAuthority:'NONE' as const,
    paidMediaAuthority:'NONE' as const,
  })
}
