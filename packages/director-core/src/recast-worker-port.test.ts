import {describe,expect,it,vi} from 'vitest'
import {prepareRecastPreview} from './recast-preview'
import {createUncommissionedRecastWorkerPort,prepareRecastWorkerSequence} from './recast-worker-port'

const plan=()=>prepareRecastPreview({
  id:'recast:req:1',projectId:'p',userId:'u',requestedAt:'2026-10-21T22:00:00Z',
  sourceVideoAssetId:'video:one',characterImageAssetId:'image:one',
  trackingArtifactId:'tracking:one',
  approvedCharacterTracks:[{
    trackId:'track:one',instanceId:'character:one',class:'character',
    frameStart:0,frameEnd:180,annotations:[],source:'human',approved:true,confidence:.96,
  }],
  sourceAudioAssetId:'audio:one',
  approvedVoiceTracks:[{startMs:0,endMs:1200,confidence:.95}],
  verifiedVoiceSyncEvidenceIds:['sync:receipt:one'],
  sourceDurationSeconds:6,
  consentReceiptId:'consent:one',mediaRightsReceiptId:'rights:one',
})
describe('Recast preview worker port',()=>{
  it('builds a deterministic, local preview handoff with no permit',()=>{
    const sequence=prepareRecastWorkerSequence(plan())
    expect(sequence.operationOrder).toEqual(['character-replace','voice-sync','preview-qc','owner-review'])
    expect(sequence.handoff).toMatchObject({
      workerConnection:'DISABLED',executionPermit:null,
      costAuthority:'NONE',publicationAuthority:'NONE',
      sourceVideoAssetId:'video:one',sourceAudioAssetId:'audio:one',
    })
    expect(sequence.originalAudioRetained).toBe(true)
    expect(sequence.sourceEnvironmentRetained).toBe(true)
    expect(sequence.dispatchEnabled).toBe(false)
    expect(sequence.runPermit).toBeNull()
  })
  it('does not contact any worker even when one is injected',()=>{
    const post=vi.fn().mockResolvedValue({artifactId:'forged:video'})
    const port=createUncommissionedRecastWorkerPort({post})
    const handoff=port.inspect(plan())
    expect(()=>port.dispatch(handoff)).toThrow('DIRECTOR_RECAST_PREVIEW_WORKER_NOT_COMMISSIONED')
    expect(post).not.toHaveBeenCalled()
  })
  it('rejects tampered camera/motion source preservation',()=>{
    const p=plan()
    p.source.replacement.action.parameters={...p.source.replacement.action.parameters,preserveLighting:false}
    expect(()=>prepareRecastWorkerSequence(p)).toThrow('DIRECTOR_RECAST_PREVIEW_SOURCE_SEQUENCE_INVALID')
  })
})
