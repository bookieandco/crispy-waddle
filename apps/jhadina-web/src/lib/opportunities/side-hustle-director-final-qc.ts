import type {SupabaseClient} from '@supabase/supabase-js'
import {
  evaluateDirectorProjectFinalQc,
  type DirectorHierarchicalCoherenceDecision,
  type DirectorProjectFinalQcDecision,
  type DirectorProjectFinalQcFormat,
  type FinalExportInspection,
} from '@jhadina/director-core'
import {DirectorWorkstationTimelineRepository} from '@/lib/director-workstation-timeline-repository'
import type {SideHustleDirectorProductionPlan} from './side-hustle-director-bridge'

type EvidenceRow={
  final_master_asset_id:string|null
  timeline_version_id:string|null
  final_inspection:FinalExportInspection|null
  coherence:DirectorHierarchicalCoherenceDecision|null
  audio_stem_roles:string[]|null
  audio_evidence_ids:string[]|null
  narration_evidence_ids:string[]|null
  lip_sync_evidence_ids:string[]|null
  nle_export_evidence_ids:string[]|null
  evidence_ids:string[]|null
  source:string
  updated_at:string
}

type SelectionRow={
  selected_take_id:string|null
  evidence_ids:string[]|null
  status:string
}

type AudioPlanRow={
  timeline_revision:number|string
  post_plan:{
    stems?:{roles?:string[]}
    lipSync?:{required?:boolean}
    speechSegments?:Array<{role?:string}>
  }|null
}

export type DirectorProjectFinalQcReadiness=Readonly<{
  projectId:string
  format:DirectorProjectFinalQcFormat
  readyForEvaluation:boolean
  admissible:boolean
  blockers:readonly string[]
  plannedAudioStemRoles:readonly string[]
  executedAudioStemRoles:readonly string[]
  selectedTakeIds:readonly string[]
  rehearsalGraduationReceiptIds:readonly string[]
  rightsEvidenceIds:readonly string[]
  timelineVersionId:string
  finalMasterAssetId:string|null
  decision:DirectorProjectFinalQcDecision|null
  evidenceUpdatedAt:string|null
  authority:'DIRECTOR_PROJECT_FINAL_QC_READINESS'
  canPublish:false
}>

const SUPPORTED=new Set<DirectorProjectFinalQcFormat>([
  'faceless_youtube','music_video','short_film','feature_film',
])

function unique(values:readonly string[]):string[]{
  return [...new Set(values.map(value=>String(value).trim()).filter(Boolean))]
}

function requiredStemRoles(format:DirectorProjectFinalQcFormat):readonly string[]{
  switch(format){
    case 'faceless_youtube': return ['voiceover','music','ambience']
    case 'music_video': return ['music','dialogue','ambience']
    case 'short_film':
    case 'feature_film': return ['dialogue','music','foley','sfx','ambience']
  }
}

export async function evaluateSideHustleDirectorFinalQcReadiness(input:{
  client:SupabaseClient
  userId:string
  projectId:string
  persistReceipt?:boolean
}):Promise<DirectorProjectFinalQcReadiness>{
  const {client,userId,projectId}=input
  const {data:context,error:contextError}=await client.from('director_project_business_context')
    .select('plan,production_run_id')
    .eq('project_id',projectId).eq('owner_user_id',userId).maybeSingle()
  if(contextError)throw new Error('DIRECTOR_PROJECT_FINAL_QC_CONTEXT_READ_FAILED:'+contextError.message)
  if(!context)throw new Error('DIRECTOR_PROJECT_FINAL_QC_CONTEXT_NOT_FOUND')
  const plan=context.plan as SideHustleDirectorProductionPlan
  if(!plan||plan.directorProjectId!==projectId)throw new Error('DIRECTOR_PROJECT_FINAL_QC_CONTEXT_INVALID')
  if(!SUPPORTED.has(plan.format as DirectorProjectFinalQcFormat)){
    throw new Error('DIRECTOR_PROJECT_FINAL_QC_FORMAT_USES_WHOLE_VIDEO_REVIEW:'+plan.format)
  }
  const format=plan.format as DirectorProjectFinalQcFormat

  const timelineRecord=await new DirectorWorkstationTimelineRepository(client).load(projectId)
  if(!timelineRecord)throw new Error('DIRECTOR_PROJECT_FINAL_QC_TIMELINE_REQUIRED')
  const timelineVersionId=
    timelineRecord.timeline.versions.at(-1)?.id??
    'workstation:'+projectId+':revision:'+timelineRecord.revision

  const [{data:evidenceRaw,error:evidenceError},{data:selectionsRaw,error:selectionError},{data:rehearsal,error:rehearsalError},{data:audioRaw,error:audioError}]=await Promise.all([
    client.from('director_project_final_qc_evidence')
      .select('final_master_asset_id,timeline_version_id,final_inspection,coherence,audio_stem_roles,audio_evidence_ids,narration_evidence_ids,lip_sync_evidence_ids,nle_export_evidence_ids,evidence_ids,source,updated_at')
      .eq('project_id',projectId).eq('owner_user_id',userId).maybeSingle(),
    client.from('director_take_selections')
      .select('selected_take_id,evidence_ids,status')
      .eq('project_id',projectId).eq('owner_user_id',userId).eq('status','selected'),
    client.from('director_creative_stages')
      .select('id,status,output_artifact_ids,approved_at,approved_by')
      .eq('project_id',projectId).eq('kind','rehearsal').maybeSingle(),
    client.from('director_audio_post_plans')
      .select('timeline_revision,post_plan')
      .eq('project_id',projectId).eq('owner_user_id',userId)
      .order('updated_at',{ascending:false}).limit(1).maybeSingle(),
  ])
  if(evidenceError)throw new Error('DIRECTOR_PROJECT_FINAL_QC_EVIDENCE_READ_FAILED:'+evidenceError.message)
  if(selectionError)throw new Error('DIRECTOR_PROJECT_FINAL_QC_SELECTION_READ_FAILED:'+selectionError.message)
  if(rehearsalError)throw new Error('DIRECTOR_PROJECT_FINAL_QC_REHEARSAL_READ_FAILED:'+rehearsalError.message)
  if(audioError)throw new Error('DIRECTOR_PROJECT_FINAL_QC_AUDIO_PLAN_READ_FAILED:'+audioError.message)

  const evidence=(evidenceRaw??null) as EvidenceRow|null
  const selections=(selectionsRaw??[]) as SelectionRow[]
  const audio=(audioRaw??null) as AudioPlanRow|null

  const selectedTakeIds=unique(selections.map(row=>row.selected_take_id??''))
  const selectedTakeEvidenceIds=unique(selections.flatMap(row=>row.evidence_ids??[]))
  const rehearsalGraduationReceiptIds=
    rehearsal?.status==='approved'
      ?unique([
        ...(Array.isArray(rehearsal.output_artifact_ids)?rehearsal.output_artifact_ids.map(String):[]),
        rehearsal.approved_at?'rehearsal-approved-at:'+String(rehearsal.approved_at):'',
        rehearsal.approved_by?'rehearsal-approved-by:'+String(rehearsal.approved_by):'',
      ])
      :[]
  const rightsEvidenceIds=unique(plan.rightsRefs)
  const plannedAudioStemRoles=unique(audio?.post_plan?.stems?.roles??[])
  const executedAudioStemRoles=unique(evidence?.audio_stem_roles??[])
  const blockers:string[]=[]

  if(!evidence)blockers.push('DIRECTOR_PROJECT_FINAL_QC_WORKER_EVIDENCE_REQUIRED')
  if(!evidence?.final_master_asset_id)blockers.push('DIRECTOR_PROJECT_FINAL_QC_FINAL_MASTER_REQUIRED')
  if(!evidence?.final_inspection)blockers.push('DIRECTOR_PROJECT_FINAL_QC_FINAL_WATCH_REQUIRED')
  if(!evidence?.coherence)blockers.push('DIRECTOR_PROJECT_FINAL_QC_COHERENCE_EVIDENCE_REQUIRED')
  if(!selectedTakeIds.length)blockers.push('DIRECTOR_PROJECT_FINAL_QC_SELECTED_TAKES_REQUIRED')
  if(!selectedTakeEvidenceIds.length)blockers.push('DIRECTOR_PROJECT_FINAL_QC_SELECTED_TAKE_EVIDENCE_REQUIRED')
  if(!rightsEvidenceIds.length)blockers.push('DIRECTOR_PROJECT_FINAL_QC_RIGHTS_EVIDENCE_REQUIRED')
  if(format!=='faceless_youtube'&&!rehearsalGraduationReceiptIds.length){
    blockers.push('DIRECTOR_PROJECT_FINAL_QC_REHEARSAL_GRADUATION_REQUIRED')
  }
  for(const role of requiredStemRoles(format)){
    if(!executedAudioStemRoles.includes(role)){
      blockers.push('DIRECTOR_PROJECT_FINAL_QC_EXECUTED_AUDIO_STEM_REQUIRED:'+role)
    }
  }
  if(!(evidence?.audio_evidence_ids??[]).length)blockers.push('DIRECTOR_PROJECT_FINAL_QC_AUDIO_EVIDENCE_REQUIRED')
  if(format==='faceless_youtube'&&!(evidence?.narration_evidence_ids??[]).length){
    blockers.push('DIRECTOR_PROJECT_FINAL_QC_NARRATION_EVIDENCE_REQUIRED')
  }
  if(format==='music_video'&&!(evidence?.lip_sync_evidence_ids??[]).length){
    blockers.push('DIRECTOR_PROJECT_FINAL_QC_LIP_SYNC_EVIDENCE_REQUIRED')
  }
  if(format==='feature_film'&&!(evidence?.nle_export_evidence_ids??[]).length){
    blockers.push('DIRECTOR_PROJECT_FINAL_QC_EDITABLE_NLE_EXPORT_REQUIRED')
  }
  if(evidence?.timeline_version_id&&evidence.timeline_version_id!==timelineVersionId){
    blockers.push('DIRECTOR_PROJECT_FINAL_QC_TIMELINE_VERSION_STALE')
  }

  let decision:DirectorProjectFinalQcDecision|null=null
  if(blockers.length===0&&evidence?.final_inspection&&evidence.coherence&&evidence.final_master_asset_id){
    decision=evaluateDirectorProjectFinalQc({
      projectId,
      format,
      finalMasterAssetId:evidence.final_master_asset_id,
      timelineVersionId,
      finalInspection:evidence.final_inspection,
      coherence:evidence.coherence,
      selectedTakeIds,
      selectedTakeEvidenceIds,
      rehearsalGraduationReceiptIds,
      rightsEvidenceIds,
      audioStemRoles:executedAudioStemRoles,
      audioEvidenceIds:unique(evidence.audio_evidence_ids??[]),
      narrationEvidenceIds:unique(evidence.narration_evidence_ids??[]),
      lipSyncEvidenceIds:unique(evidence.lip_sync_evidence_ids??[]),
      nleExportEvidenceIds:unique(evidence.nle_export_evidence_ids??[]),
      evidenceIds:unique([
        ...(evidence.evidence_ids??[]),
        ...selectedTakeEvidenceIds,
        ...rehearsalGraduationReceiptIds,
        ...rightsEvidenceIds,
        ...(evidence.audio_evidence_ids??[]),
      ]),
    })
  }

  const allReasons=unique([...blockers,...(decision?.reasons??[])])
  const readiness:DirectorProjectFinalQcReadiness=Object.freeze({
    projectId,
    format,
    readyForEvaluation:blockers.length===0,
    admissible:decision?.admissible===true,
    blockers:Object.freeze(allReasons),
    plannedAudioStemRoles:Object.freeze(plannedAudioStemRoles),
    executedAudioStemRoles:Object.freeze(executedAudioStemRoles),
    selectedTakeIds:Object.freeze(selectedTakeIds),
    rehearsalGraduationReceiptIds:Object.freeze(rehearsalGraduationReceiptIds),
    rightsEvidenceIds:Object.freeze(rightsEvidenceIds),
    timelineVersionId,
    finalMasterAssetId:evidence?.final_master_asset_id??null,
    decision,
    evidenceUpdatedAt:evidence?.updated_at??null,
    authority:'DIRECTOR_PROJECT_FINAL_QC_READINESS',
    canPublish:false,
  })

  if(input.persistReceipt===true&&decision){
    const {error}=await client.from('director_project_final_qc_receipts').insert({
      project_id:projectId,
      owner_user_id:userId,
      admissible:decision.admissible,
      reasons:decision.reasons,
      decision,
      evidence_snapshot:{
        format,
        finalMasterAssetId:evidence?.final_master_asset_id,
        timelineVersionId,
        selectedTakeIds,
        rehearsalGraduationReceiptIds,
        rightsEvidenceIds,
        audioStemRoles:executedAudioStemRoles,
        audioEvidenceIds:evidence?.audio_evidence_ids??[],
        narrationEvidenceIds:evidence?.narration_evidence_ids??[],
        lipSyncEvidenceIds:evidence?.lip_sync_evidence_ids??[],
        nleExportEvidenceIds:evidence?.nle_export_evidence_ids??[],
        evidenceUpdatedAt:evidence?.updated_at,
      },
    })
    if(error)throw new Error('DIRECTOR_PROJECT_FINAL_QC_RECEIPT_WRITE_FAILED:'+error.message)
  }

  return readiness
}
