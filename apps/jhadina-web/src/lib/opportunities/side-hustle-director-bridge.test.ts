import {describe,expect,it} from 'vitest'
import {detectAskVideoCreationIntent} from '@jhadina/director-core'
import {compileSideHustleDirectorProductionPlan} from './side-hustle-director-bridge'

const base={
  id:'factory-media:1',
  opportunityId:'opportunity:1',
  sourceRef:'work-order:1',
  directorProjectId:'director:factory:1',
  intent:'Use original research and a strong opening hook.',
  sourceRefs:['evidence:topic'],
  rightsEvidenceRefs:['rights:owned-assets'],
  evidenceRefs:['evidence:brief'],
  createdAt:'2026-10-04T19:00:00.000Z',
}

describe('Side Hustle -> Director production bridge',()=>{
  it('routes faceless YouTube to a widescreen editable Director plan',()=>{
    const plan=compileSideHustleDirectorProductionPlan({...base,family:'owned_media',format:'faceless_youtube'})
    expect(plan).toMatchObject({
      family:'owned_media',
      archetype:'faceless_youtube',
      aspectRatio:'16:9',
      targetRuntimeSeconds:600,
      productionQuality:false,
      authority:'PLANNING_ONLY',
      publicationAuthority:'NONE',
      paidMediaAuthority:'NONE',
    })
    expect(plan.activeTask).toContain('faceless YouTube video')
  })

  it('routes ad/short work to vertical UGC production',()=>{
    const plan=compileSideHustleDirectorProductionPlan({...base,family:'creative_advertising',format:'tiktok_short'})
    expect(plan.archetype).toBe('ugc_ad')
    expect(plan.aspectRatio).toBe('9:16')
    expect(plan.targetRuntimeSeconds).toBe(30)
  })

  it('produces a UGC task that the canonical autonomous video detector can commission',()=>{
    const plan=compileSideHustleDirectorProductionPlan({...base,family:'creative_advertising',format:'ugc_ad'})
    const intent=detectAskVideoCreationIntent(plan.activeTask)
    expect(intent).toBeDefined()
    expect(intent?.aspectRatio).toBe('9:16')
    expect(intent?.targetDurationSeconds).toBe(30)
  })

  it('routes music videos through the music-video archetype',()=>{
    const plan=compileSideHustleDirectorProductionPlan({...base,family:'media_production',format:'music_video'})
    expect(plan.archetype).toBe('music_video')
    expect(plan.productionQuality).toBe(true)
    expect(plan.archetypePlan.profile.requiredCapabilities).toContain('music-lipsync')
    expect(plan.archetypePlan.profile.requiredCapabilities).toContain('beat-sync')
  })

  it('preserves feature length instead of truncating at one hour',()=>{
    const plan=compileSideHustleDirectorProductionPlan({
      ...base,family:'media_production',format:'feature_film',targetRuntimeSeconds:7200,
    })
    expect(plan.archetype).toBe('film')
    expect(plan.targetRuntimeSeconds).toBe(7200)
  })

  it('rejects non-media side-hustle families',()=>{
    expect(()=>compileSideHustleDirectorProductionPlan({
      ...base,family:'procurement_subcontracting',format:'faceless_youtube',
    })).toThrow('SIDE_HUSTLE_DIRECTOR_FAMILY_NOT_MEDIA_CAPABLE')
  })

  it('fails closed without rights evidence',()=>{
    expect(()=>compileSideHustleDirectorProductionPlan({
      ...base,family:'owned_media',format:'faceless_youtube',rightsEvidenceRefs:[],
    })).toThrow('SIDE_HUSTLE_DIRECTOR_RIGHTS_REQUIRED')
  })
})
