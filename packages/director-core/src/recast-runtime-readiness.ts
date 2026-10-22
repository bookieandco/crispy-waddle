export interface RecastRuntimePrerequisites {
  projectInputsReadable: boolean
  reviewReceiptsReadable: boolean
  scannedArtifactStoreReadable: boolean
  approvedCastStoreReadable: boolean
  decodedMediaProbeAvailable: boolean
  independentReviewWriterCommissioned: boolean
  actionExecutorCommissioned: boolean
  previewWorkerCommissioned: boolean
  physicalIPhoneAccepted: boolean
}
export interface RecastRuntimeStatus {
  readyForLivePreview: false
  sourceUploadReady: boolean
  reviewStoreReady: boolean
  nextBlockingGate: string
  blockers: readonly string[]
  executionAuthority: 'NONE'
  publicationAuthority: 'NONE'
}
export function evaluateRecastRuntimePrerequisites(p: RecastRuntimePrerequisites): RecastRuntimeStatus {
  const rules: readonly [boolean, string][] = [
    [p.scannedArtifactStoreReadable, 'ARTIFACT_CORE_UNAVAILABLE'],
    [p.projectInputsReadable, 'WORKSTATION_PROJECT_INPUTS_MIGRATION_MISSING'],
    [p.approvedCastStoreReadable, 'APPROVED_CAST_RECORDS_UNAVAILABLE'],
    [p.reviewReceiptsReadable, 'RECAST_REVIEW_REGISTRY_MISSING'],
    [p.decodedMediaProbeAvailable, 'REAL_MEDIA_PROBE_NOT_COMMISSIONED'],
    [p.independentReviewWriterCommissioned, 'INDEPENDENT_REVIEW_WORKFLOW_NOT_COMMISSIONED'],
    [p.actionExecutorCommissioned, 'ACTION_EXECUTOR_RENDER_APPROVAL_REQUIRED'],
    [p.previewWorkerCommissioned, 'PREVIEW_WORKER_NOT_COMMISSIONED'],
    [p.physicalIPhoneAccepted, 'PHYSICAL_IPHONE_ACCEPTANCE_REQUIRED'],
  ]
  const blockers=rules.filter(([available])=>!available).map(([,reason])=>'DIRECTOR_RECAST_'+reason)
  // Even with every infrastructure gate present, a specific request requires
  // fresh content review, immutable approvals, cost/rights permit and QC.
  blockers.push('DIRECTOR_RECAST_PER_JOB_CANONICAL_EXECUTION_APPROVAL_REQUIRED')
  return Object.freeze({
    readyForLivePreview:false,
    sourceUploadReady:p.scannedArtifactStoreReadable&&p.projectInputsReadable,
    reviewStoreReady:p.reviewReceiptsReadable,
    nextBlockingGate:blockers[0],
    blockers:Object.freeze(blockers),
    executionAuthority:'NONE',publicationAuthority:'NONE',
  })
}
