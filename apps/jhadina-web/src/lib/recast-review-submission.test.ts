import {describe,expect,it} from 'vitest'
import {stageRecastReviewSubmission,type RecastSubmissionEvidence} from './recast-review-submission'
const sha=(char:string)=>char.repeat(64)
const selection={projectId:'p1',ownerUserId:'owner1',sourceVideoAssetId:'v1',characterImageAssetId:'i1',sourceAudioAssetId:'a1'}
const media=[
  {id:'v1',role:'footage' as const,label:'V',mimeType:'video/mp4',sizeBytes:50,sha256:sha('a'),clean:true,ownerMatched:true},
  {id:'i1',role:'reference' as const,label:'I',mimeType:'image/jpeg',sizeBytes:50,sha256:sha('b'),clean:true,ownerMatched:true},
  {id:'a1',role:'audio' as const,label:'A',mimeType:'audio/wav',sizeBytes:50,sha256:sha('c'),clean:true,ownerMatched:true},
]
const reviewer={
  reviewerUserId:'owner1',authenticatedUserId:'owner1',authorityRole:'owner' as const,
  explicitlyReviewed:true,reviewedAt:'2026-10-21T21:00:00Z',
  expiresAt:'2026-10-21T21:15:00Z',
  evidenceSource:'trusted-server-adapter' as const,
}
const probed:RecastSubmissionEvidence={kind:'media-probe',payload:{
  media:{projectId:'p1',ownerUserId:'owner1',verified:true,
    sourceVideoAssetId:'v1',characterImageAssetId:'i1',sourceAudioAssetId:'a1',
    sourceVideoSha256:sha('a'),characterImageSha256:sha('b'),sourceAudioSha256:sha('c'),
    decodedDurationSeconds:8},
  probe:{projectId:'p1',sourceVideoAssetId:'v1',sourceVideoSha256:sha('a'),durationSeconds:8,
    hasVideoStream:true,hasAudioStream:false,frameWidth:1080,frameHeight:1920,
    probeVersion:'recast-ffprobe-v1',measuredBy:'trusted-local-media-probe',evidenceSha256:sha('d')},
}}
const voice:RecastSubmissionEvidence={kind:'voice',payload:{
  projectId:'p1',sourceVideoAssetId:'v1',sourceAudioAssetId:'a1',sourceAudioSha256:sha('c'),
  reviewerUserId:'owner1',reviewReceiptId:'voice:receipt',evidenceIds:['sync:proof'],
  approved:true,tracks:[{startMs:100,endMs:1000,confidence:.9}],
}}
const rights:RecastSubmissionEvidence={kind:'rights',payload:{
  projectId:'p1',ownerUserId:'owner1',sourceVideoAssetId:'v1',characterImageAssetId:'i1',
  sourceAudioAssetId:'a1',reviewedByUserId:'owner1',consentReceiptId:'consent:1',
  rightsReceiptId:'rights:1',approved:true,
}}
const tracking:RecastSubmissionEvidence={kind:'tracking',payload:{
  projectId:'p1',sourceVideoAssetId:'v1',sourceVideoSha256:sha('a'),
  reviewedByUserId:'owner1',reviewReceiptId:'track:receipt',trackingArtifactId:'track:artifact',
  approved:true,tracks:[{trackId:'track:one',class:'character',instanceId:'actor:one',
    frameStart:0,frameEnd:100,annotations:[],source:'human',confidence:.99,approved:true}],
}}
const run=(evidence:RecastSubmissionEvidence,extra:Record<string,unknown>={})=>
  stageRecastReviewSubmission({selection,attachedMedia:media,reviewer,checkedAt:'2026-10-21T21:01:00Z',
    declaredDurationSeconds:8,evidence,...extra})
describe('Director Recast protected review submission staging',()=>{
  it('stages distinct independently vetted payloads without persistent approval',()=>{
    for(const evidence of [probed,voice,rights,tracking]){
      expect(run(evidence)).toMatchObject({
        project_id:'p1',owner_user_id:'owner1',kind:evidence.kind,
        reviewed_by_user_id:'owner1',status:'approved',
        disposition:'UNPERSISTED_REVIEW_PROPOSAL',
      })
    }
  })
  it('denies forged reviewer, stale clock, and missing explicit review',()=>{
    expect(()=>run(rights,{reviewer:{...reviewer,authenticatedUserId:'other'}})).toThrow()
    expect(()=>run(rights,{reviewer:{...reviewer,explicitlyReviewed:false}})).toThrow()
    expect(()=>run(rights,{reviewer:{...reviewer,expiresAt:'2026-10-21T20:59:00Z'}})).toThrow()
  })
  it('denies foreign or altered hashes and unverified media',()=>{
    expect(()=>run(probed,{attachedMedia:[{...media[0],sha256:sha('f')},...media.slice(1)]})).toThrow()
    expect(()=>run(probed,{attachedMedia:[{...media[0],ownerMatched:false},...media.slice(1)]})).toThrow()
    expect(()=>run(probed,{selection:{...selection,projectId:'foreign'}})).toThrow()
  })
  it('rejects incorrect duration, unreviewed voice, unsanctioned track and invalid rights',()=>{
    expect(()=>run(probed,{declaredDurationSeconds:15})).toThrow()
    expect(()=>run({...voice,payload:{...voice.payload,tracks:[{startMs:0,endMs:20000,confidence:1}]}})).toThrow()
    expect(()=>run({...tracking,payload:{...tracking.payload,tracks:[{...tracking.payload.tracks[0],source:'model'}]}})).toThrow()
    expect(()=>run({...rights,payload:{...rights.payload,consentReceiptId:''}})).toThrow()
  })
})
