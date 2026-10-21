import {sealRecastEvidence} from './recast-review-digest'
import {describe,expect,it,vi} from 'vitest'
import {readRecastReviewLedgerStatus} from './recast-review-ledger-repository'

const sha=(c:string)=>c.repeat(64)
const now='2026-10-21T18:00:00Z'
const selection={projectId:'p',ownerUserId:'u',
  sourceVideoAssetId:'v',characterImageAssetId:'i',sourceAudioAssetId:'a'}
const assets=[
  {id:'v',role:'footage' as const,label:'Video',mimeType:'video/mp4',sizeBytes:100,sha256:sha('a'),clean:true,ownerMatched:true},
  {id:'i',role:'reference' as const,label:'Photo',mimeType:'image/png',sizeBytes:100,sha256:sha('b'),clean:true,ownerMatched:true},
  {id:'a',role:'audio' as const,label:'Audio',mimeType:'audio/wav',sizeBytes:100,sha256:sha('c'),clean:true,ownerMatched:true},
]
const media={projectId:'p',ownerUserId:'u',verified:true,sourceVideoAssetId:'v',sourceVideoSha256:sha('a'),
  characterImageAssetId:'i',characterImageSha256:sha('b'),sourceAudioAssetId:'a',sourceAudioSha256:sha('c'),
  decodedDurationSeconds:12.2}
const probe={projectId:'p',sourceVideoAssetId:'v',sourceVideoSha256:sha('a'),durationSeconds:12.2,
  hasVideoStream:true,hasAudioStream:true,frameWidth:1080,frameHeight:1920,
  probeVersion:'recast-ffprobe-v1',measuredBy:'trusted-local-media-probe',evidenceSha256:sha('d')}
const track={projectId:'p',sourceVideoAssetId:'v',sourceVideoSha256:sha('a'),trackingArtifactId:'track:1',
  reviewedByUserId:'u',reviewReceiptId:'track:review',approved:true,
  tracks:[{trackId:'track:one',class:'character',instanceId:'actor:one',frameStart:0,frameEnd:100,
    annotations:[],source:'human',confidence:.95,approved:true}]}
const voice={projectId:'p',sourceVideoAssetId:'v',sourceAudioAssetId:'a',sourceAudioSha256:sha('c'),
  reviewerUserId:'u',reviewReceiptId:'voice:review',evidenceIds:['voice:alignment'],approved:true,
  tracks:[{startMs:0,endMs:1000,confidence:.9}]}
const rights={projectId:'p',ownerUserId:'u',sourceVideoAssetId:'v',characterImageAssetId:'i',
  sourceAudioAssetId:'a',consentReceiptId:'consent:review',rightsReceiptId:'media:rights',
  reviewedByUserId:'u',approved:true}
const payloads:Record<string,unknown>={
  'media-probe':{media,probe},tracking:track,voice,rights,
}
const reviewRows=()=>['media-probe','tracking','voice','rights'].map((kind,i)=>({
  id:'receipt:'+i,project_id:'p',owner_user_id:'u',kind,
  source_video_asset_id:'v',character_image_asset_id:'i',source_audio_asset_id:'a',
  source_video_sha256:sha('a'),character_image_sha256:sha('b'),source_audio_sha256:sha('c'),
  reviewed_by_user_id:'u',reviewed_at:'2026-10-21T17:55:00Z',expires_at:'2026-10-21T18:25:00Z',
  status:'approved',method:kind==='media-probe'?'trusted-media-probe':'human-review',
  evidence:payloads[kind],evidence_sha256:sealRecastEvidence(payloads[kind]),
}))
function client(rows:unknown,error:unknown=null){
  const eq=vi.fn()
  const query:any={
    select:()=>query,
    eq:(name:string,value:unknown)=>{eq(name,value);return query},
    limit:async()=>({data:rows,error}),
  }
  return {from:vi.fn(()=>query),eq} as any
}
describe('Recast review registry resolver',()=>{
  it('only reports reviewed when four real valid payloads and source probe match',async()=>{
    const db=client(reviewRows())
    const status=await readRecastReviewLedgerStatus(db,selection,assets,now,12.2)
    expect(status.reviewStore).toBe('REVIEWED_READ_ONLY')
    expect(status.reviewReceiptsComplete).toBe(true)
    expect(status.renderAuthorized).toBe(false)
    expect(db.eq).toHaveBeenCalledWith('project_id','p')
    expect(db.eq).toHaveBeenCalledWith('owner_user_id','u')
    expect(db.eq).toHaveBeenCalledWith('source_video_asset_id','v')
  })
  it('rejects uncommissioned table without an exception or permit',async()=>{
    const db=client(null,{message:'relation does not exist'})
    const status=await readRecastReviewLedgerStatus(db,selection,assets,now,12.2)
    expect(status.reviewStore).toBe('NOT_COMMISSIONED')
    expect(status.reviewReceiptsComplete).toBe(false)
    expect(status.renderAuthorized).toBe(false)
  })
  it('rejects stale, conflicting, duplicate and malformed reviews',async()=>{
    const conflict=reviewRows()
    ;(conflict[0].evidence as any)={media,probe:{...probe,durationSeconds:31}}
    expect((await readRecastReviewLedgerStatus(client(conflict),selection,assets,now,12.2)).reviewReceiptsComplete).toBe(false)
    const duplicates=[...reviewRows(),reviewRows()[1]]
    expect((await readRecastReviewLedgerStatus(client(duplicates),selection,assets,now,12.2)).reviewReceiptsComplete).toBe(false)
    const bad=reviewRows()
    ;(bad[3].evidence as any)={...rights,consentReceiptId:''}
    expect((await readRecastReviewLedgerStatus(client(bad),selection,assets,now,12.2)).reviewReceiptsComplete).toBe(false)
  })
  it('rejects tampering of a stored receipt, even when its metadata and hash field look valid',async()=>{
    const edited=reviewRows()
    edited[2].evidence={...voice,tracks:[{startMs:0,endMs:3000,confidence:1}]}
    const result=await readRecastReviewLedgerStatus(client(edited),selection,assets,now,12.2)
    expect(result.reviewReceiptsComplete).toBe(false)
    expect(result.renderAuthorized).toBe(false)
  })
  it('refuses unbound and wrong-owner files before querying the ledger',async()=>{
    const db=client(reviewRows())
    const status=await readRecastReviewLedgerStatus(db,selection,[{...assets[0],clean:false},...assets.slice(1)],now,12.2)
    expect(status.reviewReceiptsComplete).toBe(false)
    expect(db.from).not.toHaveBeenCalled()
  })
})