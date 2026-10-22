import {describe,expect,it} from 'vitest'
import {evaluateRecastMediaSelection,type RecastBoundMedia} from './recast-media-readiness'

const hash='a'.repeat(64)
const media:RecastBoundMedia[]=[
  {id:'video:1',role:'footage',label:'Clip',mimeType:'video/mp4',sizeBytes:500,sha256:hash,clean:true,ownerMatched:true},
  {id:'image:1',role:'reference',label:'Photo',mimeType:'image/png',sizeBytes:100,sha256:hash,clean:true,ownerMatched:true},
  {id:'audio:1',role:'audio',label:'Voice',mimeType:'audio/wav',sizeBytes:100,sha256:hash,clean:true,ownerMatched:true},
]
const selection={sourceVideoAssetId:'video:1',replacementCharacterAssetId:'image:1',sourceAudioAssetId:'audio:1',durationSeconds:10}

describe('Recast media readiness',()=>{
  it('can verify attached clean media but NEVER grants a render or publication permit',()=>{
    const r=evaluateRecastMediaSelection(media,selection)
    expect(r.mediaVerified).toBe(true)
    expect(r.verifiedAssetIds).toEqual(['video:1','image:1','audio:1'])
    expect(r.readyForRender).toBe(false)
    expect(r.actionAuthority).toBe('NONE')
    expect(r.costAuthority).toBe('NONE')
    expect(r.blockers).toContain('DIRECTOR_RECAST_LIKENESS_CONSENT_UNVERIFIED')
    expect(r.blockers).toContain('DIRECTOR_RECAST_VOICE_SYNC_EVIDENCE_UNVERIFIED')
  })
  it('denies forged roles and missing owner-bound assets',()=>{
    const r=evaluateRecastMediaSelection(media,{...selection,sourceAudioAssetId:'image:1'})
    expect(r.mediaVerified).toBe(false)
    expect(r.blockers).toContain('DIRECTOR_RECAST_AUDIO_NOT_BOUND')
  })
  it('denies unscanned, wrong-owner and unprovenanced media',()=>{
    expect(evaluateRecastMediaSelection([{...media[0],clean:false},...media.slice(1)],selection).mediaVerified).toBe(false)
    expect(evaluateRecastMediaSelection([{...media[0],ownerMatched:false},...media.slice(1)],selection).mediaVerified).toBe(false)
    expect(evaluateRecastMediaSelection([{...media[0],sha256:''},...media.slice(1)],selection).mediaVerified).toBe(false)
    expect(evaluateRecastMediaSelection([{...media[0],mimeType:'text/html'},...media.slice(1)],selection).mediaVerified).toBe(false)
  })
  it('denies missing, duplicate, or oversized duration selection',()=>{
    expect(evaluateRecastMediaSelection(media,{...selection,sourceAudioAssetId:'video:1'}).mediaVerified).toBe(false)
    expect(evaluateRecastMediaSelection(media,{...selection,durationSeconds:40}).mediaVerified).toBe(false)
    expect(evaluateRecastMediaSelection(media,{...selection,durationSeconds:NaN}).mediaVerified).toBe(false)
  })
})
