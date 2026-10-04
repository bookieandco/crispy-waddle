import { describe, expect, it } from 'vitest'
import {
  createDirectorArchetypePlan,
  directorProductionArchetypeProfile,
} from './production-archetypes.js'

describe('production archetype registry', () => {
  it('maps talking-head enhancement to deterministic editing capabilities', () => {
    const profile = directorProductionArchetypeProfile('talking_head_enhancement')
    expect(profile.requiredCapabilities).toContain('transcript-timecode')
    expect(profile.requiredCapabilities).toContain('timeline-editing')
    expect(profile.publicationAuthority).toBe('NONE')
  })

  it('keeps creative-factory media families on the governed Director production stages', () => {
    const social=directorProductionArchetypeProfile('social_short')
    const faceless=directorProductionArchetypeProfile('faceless_owned_media')
    const musicVideo=directorProductionArchetypeProfile('music_video')
    expect(social.requiredStages).toContain('frame_qc')
    expect(faceless.optionalSourceKinds).toContain('shotlist-production-recipe')
    expect(musicVideo.requiredSourceKinds).toContain('music-source')
    expect(musicVideo.requiredStages).toContain('rehearsal')
    expect([social,faceless,musicVideo].every(profile=>profile.publicationAuthority==='NONE')).toBe(true)
  })

  it('requires rights evidence before an archetype plan is admitted', () => {
    expect(() => createDirectorArchetypePlan({
      id: 'plan:1',
      projectId: 'director:1',
      archetype: 'product_demo',
      sourceRefs: ['website:snapshot:1'],
      rightsEvidenceRefs: [],
      createdAt: '2026-09-28T18:00:00.000Z',
    })).toThrow(/RIGHTS_REQUIRED/)
  })

  it('keeps archetype plans non-publishing and evidence bound', () => {
    const plan = createDirectorArchetypePlan({
      id: 'plan:2',
      projectId: 'director:1',
      archetype: 'data_story',
      sourceRefs: ['dataset:1'],
      rightsEvidenceRefs: ['rights:dataset:1'],
      createdAt: '2026-09-28T18:00:00.000Z',
    })
    expect(plan.authority).toBe('PLANNING_ONLY')
    expect(plan.publicationAuthority).toBe('NONE')
    expect(plan.profile.requiredStages).toContain('frame_qc')
  })
})
