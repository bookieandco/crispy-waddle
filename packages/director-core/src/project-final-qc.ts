import {
  evaluateFinalExportInspection,
  type FinalExportInspection,
  type FinalExportInspectionDecision,
} from './final-export-inspection.js'
import type {DirectorHierarchicalCoherenceDecision} from './hierarchical-production-coherence.js'

export type DirectorProjectFinalQcFormat=
  |'faceless_youtube'
  |'music_video'
  |'short_film'
  |'feature_film'

export interface DirectorProjectFinalQcInput{
  projectId:string
  format:DirectorProjectFinalQcFormat
  finalMasterAssetId:string
  timelineVersionId:string
  finalInspection:FinalExportInspection
  coherence:DirectorHierarchicalCoherenceDecision
  selectedTakeIds:readonly string[]
  selectedTakeEvidenceIds:readonly string[]
  rehearsalGraduationReceiptIds:readonly string[]
  rightsEvidenceIds:readonly string[]
  audioStemRoles:readonly string[]
  audioEvidenceIds:readonly string[]
  narrationEvidenceIds?:readonly string[]
  lipSyncEvidenceIds?:readonly string[]
  nleExportEvidenceIds?:readonly string[]
  evidenceIds:readonly string[]
}

export interface DirectorProjectFinalQcDecision{
  projectId:string
  format:DirectorProjectFinalQcFormat
  admissible:boolean
  reasons:readonly string[]
  finalInspection:FinalExportInspectionDecision
  authority:'DIRECTOR_PROJECT_FINAL_QC'
}

const requiredAudio:Readonly<Record<DirectorProjectFinalQcFormat,readonly string[]>>=Object.freeze({
  faceless_youtube:Object.freeze(['voiceover','music','ambience']),
  music_video:Object.freeze(['music','dialogue','ambience']),
  short_film:Object.freeze(['dialogue','music','foley','sfx','ambience']),
  feature_film:Object.freeze(['dialogue','music','foley','sfx','ambience']),
})

function unique(values:readonly string[]):string[]{
  return [...new Set(values.map(value=>value.trim()).filter(Boolean))]
}

export function evaluateDirectorProjectFinalQc(
  input:DirectorProjectFinalQcInput,
):DirectorProjectFinalQcDecision{
  const reasons:string[]=[]
  if(!input.projectId.trim()||!input.finalMasterAssetId.trim()||!input.timelineVersionId.trim()||!input.evidenceIds.length){
    reasons.push('DIRECTOR_PROJECT_FINAL_QC_IDENTITY_OR_EVIDENCE_REQUIRED')
  }

  const finalInspection=evaluateFinalExportInspection(input.finalInspection)
  if(input.finalInspection.projectId!==input.projectId){
    reasons.push('DIRECTOR_PROJECT_FINAL_QC_INSPECTION_PROJECT_MISMATCH')
  }
  if(!input.finalInspection.variants.some(variant=>variant.assetId===input.finalMasterAssetId)){
    reasons.push('DIRECTOR_PROJECT_FINAL_QC_MASTER_NOT_INSPECTED')
  }
  if(!finalInspection.admissible)reasons.push(...finalInspection.reasons)

  if(!input.coherence.admissible){
    reasons.push('DIRECTOR_PROJECT_FINAL_QC_COHERENCE_FAILED')
    reasons.push(...input.coherence.reasons)
  }
  if(!input.selectedTakeIds.length||!input.selectedTakeEvidenceIds.length){
    reasons.push('DIRECTOR_PROJECT_FINAL_QC_SELECTED_TAKE_EVIDENCE_REQUIRED')
  }
  if(!input.rightsEvidenceIds.length){
    reasons.push('DIRECTOR_PROJECT_FINAL_QC_RIGHTS_EVIDENCE_REQUIRED')
  }

  if(input.format!=='faceless_youtube'&&!input.rehearsalGraduationReceiptIds.length){
    reasons.push('DIRECTOR_PROJECT_FINAL_QC_REHEARSAL_GRADUATION_REQUIRED')
  }
  if(input.format==='faceless_youtube'&&!(input.narrationEvidenceIds??[]).length){
    reasons.push('DIRECTOR_PROJECT_FINAL_QC_NARRATION_EVIDENCE_REQUIRED')
  }
  if(input.format==='music_video'&&!(input.lipSyncEvidenceIds??[]).length){
    reasons.push('DIRECTOR_PROJECT_FINAL_QC_LIP_SYNC_EVIDENCE_REQUIRED')
  }

  const stems=new Set(input.audioStemRoles.map(value=>value.trim()).filter(Boolean))
  for(const role of requiredAudio[input.format]){
    if(!stems.has(role))reasons.push('DIRECTOR_PROJECT_FINAL_QC_AUDIO_STEM_REQUIRED:'+role)
  }
  if(!input.audioEvidenceIds.length){
    reasons.push('DIRECTOR_PROJECT_FINAL_QC_AUDIO_EVIDENCE_REQUIRED')
  }

  if(input.format==='feature_film'&&!(input.nleExportEvidenceIds??[]).length){
    reasons.push('DIRECTOR_PROJECT_FINAL_QC_EDITABLE_NLE_EXPORT_REQUIRED')
  }

  return Object.freeze({
    projectId:input.projectId,
    format:input.format,
    admissible:reasons.length===0,
    reasons:Object.freeze(unique(reasons)),
    finalInspection,
    authority:'DIRECTOR_PROJECT_FINAL_QC',
  })
}
