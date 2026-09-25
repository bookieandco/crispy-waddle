import { describe, expect, it } from 'vitest'
import { planSourceDrivenCharacterSwap } from './source-driven-character-swap'

const track={
  trackId:'track-1',
  class:'character' as const,
  instanceId:'actor-1',
  frameStart:0,
  frameEnd:120,
  annotations:[],
  source:'human' as const,
  confidence:1,
  approved:true,
}

const voiceTrack={
  trackId:'voice-1',
  startMs:0,
  endMs:4000,
  confidence:.95,
  source:'model' as const,
  approved:true,
}

describe('source-driven character swap planner',()=> {
  it('plans the simple preserve-background / preserve-motion workflow without filename conventions',()=> {
    const plan=planSourceDrivenCharacterSwap({
      id:'swap-1',
      userId:'u',
      requestedAt:'now',
      projectId:'p',
      sourceVideoAssetId:'video:source',
      replacementCharacterAssetId:'image:character',
      trackingArtifactId:'tracking:1',
      tracks:[track],
      sourceDimensions:{width:1080,height:1920},
      replacementDimensions:{width:1080,height:1920},
      environmentMode:'reference-frame',
      environmentReferenceAssetId:'frame:background',
      continuityRef:'character:mary:v1',
    })

    expect(plan.replacement.action.inputAssetIds).toEqual(['video:source','image:character'])
    expect(plan.replacement.action.parameters).toMatchObject({
      preserveMotion:true,
      preserveFacialMotion:true,
      preserveLighting:true,
      preserveOrientation:true,
      environmentMode:'reference-frame',
      environmentReferenceAssetId:'frame:background',
      motionReferenceAssetId:'video:source',
      aspectRatioPolicy:'strict-match',
    })
    expect(plan.lipSync).toBeUndefined()
    expect(plan.stages).toEqual(['character-replace','qc','asset-approval'])
  })

  it('creates a separate governed lip-sync handoff only when resync is requested',()=> {
    const plan=planSourceDrivenCharacterSwap({
      id:'swap-2',
      userId:'u',
      requestedAt:'now',
      projectId:'p',
      sourceVideoAssetId:'video:source',
      replacementCharacterAssetId:'image:character',
      trackingArtifactId:'tracking:1',
      tracks:[track],
      lipSyncMode:'resync-after-swap',
      sourceAudioAssetId:'audio:source',
      voiceSyncTracks:[voiceTrack],
      characterTrackId:'track-1',
      continuityRef:'character:mary:v1',
    })

    expect(plan.lipSync).toMatchObject({
      mode:'lip-sync',
      sourceAudioAssetId:'audio:source',
      characterTrackId:'track-1',
      authority:'DIRECTOR_CHARACTER_SWAP_LIP_SYNC_HANDOFF',
    })
    expect(plan.stages).toEqual(['character-replace','voice-sync','qc','asset-approval'])
  })

  it('fails closed if reference-frame background preservation has no anchor',()=> {
    expect(()=>planSourceDrivenCharacterSwap({
      id:'swap-3',
      userId:'u',
      requestedAt:'now',
      projectId:'p',
      sourceVideoAssetId:'video:source',
      replacementCharacterAssetId:'image:character',
      trackingArtifactId:'tracking:1',
      tracks:[track],
      environmentMode:'reference-frame',
    })).toThrow('DIRECTOR_CHARACTER_SWAP_ENVIRONMENT_REFERENCE_REQUIRED')
  })

  it('requires audio and voice tracks for explicit post-swap lip resync',()=> {
    expect(()=>planSourceDrivenCharacterSwap({
      id:'swap-4',
      userId:'u',
      requestedAt:'now',
      projectId:'p',
      sourceVideoAssetId:'video:source',
      replacementCharacterAssetId:'image:character',
      trackingArtifactId:'tracking:1',
      tracks:[track],
      lipSyncMode:'resync-after-swap',
    })).toThrow('DIRECTOR_CHARACTER_SWAP_AUDIO_REQUIRED_FOR_RESYNC')
  })
})
