import {describe,expect,it} from 'vitest'
import {evaluateRecastRuntimePrerequisites,type RecastRuntimePrerequisites} from './recast-runtime-readiness'
const all:RecastRuntimePrerequisites={
  projectInputsReadable:true,reviewReceiptsReadable:true,
  scannedArtifactStoreReadable:true,approvedCastStoreReadable:true,
  decodedMediaProbeAvailable:true,independentReviewWriterCommissioned:true,
  actionExecutorCommissioned:true,previewWorkerCommissioned:true,
  physicalIPhoneAccepted:true,
}
describe('Recast deploy prerequisites stay fail-closed',()=>{
  it('identifies missing canonical Workstation migration before worker authorization',()=>{
    const result=evaluateRecastRuntimePrerequisites({
      ...all,projectInputsReadable:false,reviewReceiptsReadable:false,
    })
    expect(result.sourceUploadReady).toBe(false)
    expect(result.nextBlockingGate).toBe('DIRECTOR_RECAST_WORKSTATION_PROJECT_INPUTS_MIGRATION_MISSING')
    expect(result.reviewStoreReady).toBe(false)
    expect(result.readyForLivePreview).toBe(false)
  })
  it('does not mistake an available table for human-approved render authority',()=>{
    const result=evaluateRecastRuntimePrerequisites(all)
    expect(result.blockers).toEqual(['DIRECTOR_RECAST_PER_JOB_CANONICAL_EXECUTION_APPROVAL_REQUIRED'])
    expect(result.executionAuthority).toBe('NONE')
    expect(result.publicationAuthority).toBe('NONE')
  })
  it('separates working uploads from an uncommissioned review and preview worker',()=>{
    const result=evaluateRecastRuntimePrerequisites({...all,
      reviewReceiptsReadable:false,previewWorkerCommissioned:false,
    })
    expect(result.sourceUploadReady).toBe(true)
    expect(result.reviewStoreReady).toBe(false)
    expect(result.blockers).toContain('DIRECTOR_RECAST_PREVIEW_WORKER_NOT_COMMISSIONED')
  })
  it('rejects undocumented or untested owner device and human approval assumptions',()=>{
    const result=evaluateRecastRuntimePrerequisites({...all,
      physicalIPhoneAccepted:false,independentReviewWriterCommissioned:false,
    })
    expect(result.blockers).toContain('DIRECTOR_RECAST_INDEPENDENT_REVIEW_WORKFLOW_NOT_COMMISSIONED')
    expect(result.blockers).toContain('DIRECTOR_RECAST_PHYSICAL_IPHONE_ACCEPTANCE_REQUIRED')
    expect(result.readyForLivePreview).toBe(false)
  })
})