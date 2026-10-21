import { createRecastPreviewWorkerHandoff, type RecastPreviewWorkerHandoff } from './recast-preview-worker-handoff'
import type { RecastPreviewPlan } from './recast-preview'

export interface RecastWorkerSequence {
  contract:'director.recast.preview.sequence.v1'
  handoff:RecastPreviewWorkerHandoff
  operationOrder:readonly ['character-replace','voice-sync','preview-qc','owner-review']
  originalAudioRetained:true
  sourceEnvironmentRetained:true
  expectedOutput:'LOCAL_UNAPPROVED_PREVIEW'
  backendState:'UNCOMMISSIONED'
  dispatchEnabled:false
  runPermit:null
  publishPermit:null
}
export interface RecastWorkerTransport {
  post(path:string,payload:unknown):Promise<unknown>
}

/**
 * Non-networking planning adapter for the existing character-replacement and
 * voice-sync worker services. Deliberately DOES NOT forward any plan to either
 * service. A separate canonical ActionExecutor-controlled runtime adapter,
 * with live receipt verification, must be commissioned before any execution.
 */
export function prepareRecastWorkerSequence(plan:RecastPreviewPlan):RecastWorkerSequence {
  const handoff=createRecastPreviewWorkerHandoff(plan)
  if(plan.source.stages.join(',')!=='character-replace,voice-sync,qc,asset-approval' ||
     plan.source.replacement.action.parameters?.preserveMotion!==true ||
     plan.source.replacement.action.parameters?.preserveLighting!==true ||
     plan.source.replacement.action.parameters?.preserveOrientation!==true ||
     plan.source.replacement.action.parameters?.environmentMode!=='preserve-source' ||
     !plan.source.lipSync?.tracks.length){
    throw new Error('DIRECTOR_RECAST_PREVIEW_SOURCE_SEQUENCE_INVALID')
  }
  return Object.freeze({
    contract:'director.recast.preview.sequence.v1',
    handoff,
    operationOrder:Object.freeze(['character-replace','voice-sync','preview-qc','owner-review'] as const),
    originalAudioRetained:true,
    sourceEnvironmentRetained:true,
    expectedOutput:'LOCAL_UNAPPROVED_PREVIEW',
    backendState:'UNCOMMISSIONED',
    dispatchEnabled:false,
    runPermit:null,publishPermit:null,
  })
}

/** The presence of a configured WorkerTransport is NOT a render approval.
 * A caller invoking this method cannot accidentally bypass canonical action
 * governance or mint a non-null permit. */
export function createUncommissionedRecastWorkerPort(_transport:RecastWorkerTransport){
  return {
    inspect:prepareRecastWorkerSequence,
    dispatch(_sequence:RecastWorkerSequence):never {
      throw new Error('DIRECTOR_RECAST_PREVIEW_WORKER_NOT_COMMISSIONED')
    },
  }
}
