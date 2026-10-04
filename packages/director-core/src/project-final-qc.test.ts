import {describe,expect,it} from 'vitest'
import {evaluateDirectorProjectFinalQc} from './project-final-qc.js'

const inspection={
  id:'inspection:1',
  projectId:'project:1',
  variants:[{id:'publish',assetId:'master:1',purpose:'publish' as const,evidenceIds:['watch:publish']}],
  watchedStartToFinish:true,
  watchPasses:1,
  defects:[],
  evidenceIds:['watch:full'],
  authority:'DIRECTOR_FINAL_EXPORT_INSPECTION' as const,
}
const coherence={
  admissible:true,
  levels:[],
  reasons:[],
  rerunScopes:[],
  authority:'DIRECTOR_HIERARCHICAL_COHERENCE_QC' as const,
}

describe('normal Director project final QC',()=>{
  it('passes a fully evidenced faceless production',()=>{
    const result=evaluateDirectorProjectFinalQc({
      projectId:'project:1',
      format:'faceless_youtube',
      finalMasterAssetId:'master:1',
      timelineVersionId:'timeline:v2',
      finalInspection:inspection,
      coherence,
      selectedTakeIds:['take:1'],
      selectedTakeEvidenceIds:['take-qc:1'],
      rehearsalGraduationReceiptIds:[],
      rightsEvidenceIds:['rights:1'],
      audioStemRoles:['voiceover','music','ambience'],
      audioEvidenceIds:['mix:1'],
      narrationEvidenceIds:['voiceover:1'],
      evidenceIds:['final:1'],
    })
    expect(result.admissible).toBe(true)
  })

  it('requires real music-video lip-sync evidence',()=>{
    const result=evaluateDirectorProjectFinalQc({
      projectId:'project:1',
      format:'music_video',
      finalMasterAssetId:'master:1',
      timelineVersionId:'timeline:v2',
      finalInspection:inspection,
      coherence,
      selectedTakeIds:['take:1'],
      selectedTakeEvidenceIds:['take-qc:1'],
      rehearsalGraduationReceiptIds:['rehearsal:1'],
      rightsEvidenceIds:['rights:1'],
      audioStemRoles:['music','dialogue','ambience'],
      audioEvidenceIds:['mix:1'],
      evidenceIds:['final:1'],
    })
    expect(result.admissible).toBe(false)
    expect(result.reasons).toContain('DIRECTOR_PROJECT_FINAL_QC_LIP_SYNC_EVIDENCE_REQUIRED')
  })

  it('requires an editable NLE export for feature-film final admission',()=>{
    const result=evaluateDirectorProjectFinalQc({
      projectId:'project:1',
      format:'feature_film',
      finalMasterAssetId:'master:1',
      timelineVersionId:'timeline:v2',
      finalInspection:inspection,
      coherence,
      selectedTakeIds:['take:1'],
      selectedTakeEvidenceIds:['take-qc:1'],
      rehearsalGraduationReceiptIds:['rehearsal:1'],
      rightsEvidenceIds:['rights:1'],
      audioStemRoles:['dialogue','music','foley','sfx','ambience'],
      audioEvidenceIds:['mix:1'],
      evidenceIds:['final:1'],
    })
    expect(result.admissible).toBe(false)
    expect(result.reasons).toContain('DIRECTOR_PROJECT_FINAL_QC_EDITABLE_NLE_EXPORT_REQUIRED')
  })

  it('never treats an unwatched final master as admissible',()=>{
    const result=evaluateDirectorProjectFinalQc({
      projectId:'project:1',
      format:'short_film',
      finalMasterAssetId:'master:1',
      timelineVersionId:'timeline:v2',
      finalInspection:{...inspection,watchedStartToFinish:false,watchPasses:0},
      coherence,
      selectedTakeIds:['take:1'],
      selectedTakeEvidenceIds:['take-qc:1'],
      rehearsalGraduationReceiptIds:['rehearsal:1'],
      rightsEvidenceIds:['rights:1'],
      audioStemRoles:['dialogue','music','foley','sfx','ambience'],
      audioEvidenceIds:['mix:1'],
      evidenceIds:['final:1'],
    })
    expect(result.admissible).toBe(false)
    expect(result.reasons).toContain('DIRECTOR_FINAL_EXPORT_FULL_WATCH_REQUIRED')
  })
})
