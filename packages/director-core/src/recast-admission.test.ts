import {describe,expect,it} from 'vitest'
import {verifyRecastReviewLedger,type RecastReviewReceipt} from './recast-review-ledger'
import {verifyRecastDuration} from './recast-duration-evidence'
import {evaluateRecastPreviewAdmission} from './recast-preview-admission'
import type {RecastPreviewWorkerHandoff} from './recast-preview-worker-handoff'
import type {RecastReviewedDecision} from './recast-reviewed-evidence'

const sha=(c:string)=>c.repeat(64)
const at='2026-10-21T18:00:00Z'
const selection={projectId:'director:1',ownerUserId:'owner:1',
  sourceVideoAssetId:'video:1',characterImageAssetId:'image:1',sourceAudioAssetId:'audio:1'}
const hashes={video:sha('a'),image:sha('b'),audio:sha('c')}
const kinds=['media-probe','tracking','voice','rights'] as const
const receipts:RecastReviewReceipt[]=kinds.map((kind,i)=>({
  id:'receipt:'+i,projectId:selection.projectId,ownerUserId:selection.ownerUserId,kind,
  sourceVideoAssetId:selection.sourceVideoAssetId,
  characterImageAssetId:selection.characterImageAssetId,sourceAudioAssetId:selection.sourceAudioAssetId,
  sourceVideoSha256:hashes.video,characterImageSha256:hashes.image,sourceAudioSha256:hashes.audio,
  reviewerId:'reviewer:1',reviewedAt:'2026-10-21T17:59:00Z',expiresAt:'2026-10-21T18:30:00Z',
  status:'approved',method:kind==='media-probe'?'trusted-media-probe':'human-review',
  evidence:{syntheticFixture:true},
}))
const probe={
  projectId:selection.projectId,sourceVideoAssetId:selection.sourceVideoAssetId,
  sourceVideoSha256:hashes.video,durationSeconds:12.2,hasVideoStream:true,
  hasAudioStream:true,frameWidth:1080,frameHeight:1920,
  probeVersion:'recast-ffprobe-v1' as const,measuredBy:'trusted-local-media-probe' as const,
  evidenceSha256:sha('d'),
}
const durationRequest={projectId:selection.projectId,sourceVideoAssetId:selection.sourceVideoAssetId,
  sourceVideoSha256:hashes.video,declaredDurationSeconds:12.2}
const handoff:RecastPreviewWorkerHandoff={
  schemaVersion:'director.recast.worker-handoff.v1',
  projectId:selection.projectId,requestId:'req:1',
  sourceVideoAssetId:selection.sourceVideoAssetId,
  replacementCharacterAssetId:selection.characterImageAssetId,
  sourceAudioAssetId:selection.sourceAudioAssetId,trackingArtifactId:'tracking:1',
  maxDurationSeconds:30,stages:['tracking-review','character-replace','voice-sync','render-preview','independent-qc','owner-review'],
  workerConnection:'DISABLED',executionPermit:null,outputPolicy:'UNAPPROVED_PREVIEW_ONLY',
  costAuthority:'NONE',publicationAuthority:'NONE',requiresFreshOwnerApproval:true,
}
const reviewed:RecastReviewedDecision={
  planningAdmissible:true,blockers:[],renderAdmissible:false,
  spendAuthority:'NONE',publicationAuthority:'NONE',
}
const approval={
  projectId:selection.projectId,requestId:'req:1',approvedByUserId:selection.ownerUserId,
  approved:true,reviewedAt:'2026-10-21T17:59:00Z',expiresAt:'2026-10-21T18:20:00Z',
  costCeilingUsd:1,expectedCostUsd:.5,allowedMode:'preview' as const,
  allowedWorkerId:'worker:approved',approvalReceiptId:'owner:receipt:1',
}
describe('Recast ledger, ffprobe and dry-run worker admission',()=>{
  it('ledger requires exactly four project/hash-bound current reviews and grants zero authority',()=>{
    const r=verifyRecastReviewLedger(selection,hashes,receipts,at)
    expect(r.receiptsComplete).toBe(true)
    expect(r.reviewIds).toHaveLength(4)
    expect(r.renderAuthorized).toBe(false)
    expect(r.workerInvocationAllowed).toBe(false)
    expect(verifyRecastReviewLedger(selection,hashes,receipts.slice(0,3),at).receiptsComplete).toBe(false)
    expect(verifyRecastReviewLedger({...selection,projectId:'foreign'},hashes,receipts,at).receiptsComplete).toBe(false)
    expect(verifyRecastReviewLedger(selection,{...hashes,video:sha('f')},receipts,at).receiptsComplete).toBe(false)
  })
  it('denies stale, replayed, rejected and worker-origin approvals',()=>{
    expect(verifyRecastReviewLedger(selection,hashes,[...receipts,receipts[0]],at).receiptsComplete).toBe(false)
    expect(verifyRecastReviewLedger(selection,hashes,receipts.map((r,i)=>i===1?{...r,status:'rejected'}:r),at).receiptsComplete).toBe(false)
    expect(verifyRecastReviewLedger(selection,hashes,receipts.map((r,i)=>i===2?{...r,expiresAt:'2026-10-21T17:30:00Z'}:r),at).receiptsComplete).toBe(false)
    expect(verifyRecastReviewLedger(selection,hashes,receipts.map((r,i)=>i===1?{...r,method:'trusted-media-probe'}:r),at).receiptsComplete).toBe(false)
  })
  it('only accepts hash-bound trusted decoded duration within quarter-second declared tolerance',()=>{
    expect(verifyRecastDuration(probe,durationRequest).verified).toBe(true)
    expect(verifyRecastDuration({...probe,durationSeconds:31},durationRequest).verified).toBe(false)
    expect(verifyRecastDuration({...probe,hasVideoStream:false},durationRequest).verified).toBe(false)
    expect(verifyRecastDuration({...probe,sourceVideoSha256:sha('f')},durationRequest).verified).toBe(false)
    expect(verifyRecastDuration(null,durationRequest).renderAllowed).toBe(false)
    expect(verifyRecastDuration(probe,{...durationRequest,declaredDurationSeconds:13}).verified).toBe(false)
  })
  it('never executes: even approved matching capped preview still needs ActionExecutor',()=>{
    const r=evaluateRecastPreviewAdmission({
      handoff,ledger:verifyRecastReviewLedger(selection,hashes,receipts,at),
      duration:verifyRecastDuration(probe,durationRequest),review:reviewed,
      ownerApproval:approval,ownerUserId:selection.ownerUserId,now:at,
    })
    expect(r.preflightPassed).toBe(true)
    expect(r.blockers).toEqual(['DIRECTOR_RECAST_ACTION_EXECUTOR_PERMIT_REQUIRED'])
    expect(r.executable).toBe(false)
    expect(r.workerCallAllowed).toBe(false)
    expect(r.canSpend).toBe(false)
  })
  it('denies forged owner identity, cost overage and expired owner approval',()=>{
    const base={handoff,ledger:verifyRecastReviewLedger(selection,hashes,receipts,at),
      duration:verifyRecastDuration(probe,durationRequest),review:reviewed,ownerUserId:selection.ownerUserId,now:at}
    expect(evaluateRecastPreviewAdmission({...base,ownerApproval:null}).preflightPassed).toBe(false)
    expect(evaluateRecastPreviewAdmission({...base,ownerApproval:{...approval,approvedByUserId:'foreign'}}).preflightPassed).toBe(false)
    expect(evaluateRecastPreviewAdmission({...base,ownerApproval:{...approval,expectedCostUsd:5}}).preflightPassed).toBe(false)
    expect(evaluateRecastPreviewAdmission({...base,ownerApproval:{...approval,expiresAt:'2026-10-21T17:50:00Z'}}).preflightPassed).toBe(false)
  })
})