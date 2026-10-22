import {describe,expect,it} from 'vitest'
import {evaluateRecastCastAppearance,type RecastCastRow,type RecastAppearanceRow} from './recast-cast-admission'
const project='project:owner'
const sha='a'.repeat(64)
const cast:RecastCastRow={project_id:project,character_id:'bonez',canonical_appearance_variant_id:'appearance:bonez',
  approved_at:'2026-10-20T00:00:00Z',approved_by:'owner'}
const variant:RecastAppearanceRow={id:'appearance:bonez',project_id:project,character_id:'bonez',
  reference_sha256s:[sha],approved_at:'2026-10-20T00:00:00Z',approved_by:'owner'}
describe('Recast Cast appearance admission',()=>{
  it('recognizes a source image SHA present in an existing reviewed Cast appearance without allowing rendering',()=>{
    const result=evaluateRecastCastAppearance(project,sha,[cast],[variant])
    expect(result).toMatchObject({castAppearanceMatched:true,characterId:'bonez',appearanceVariantId:'appearance:bonez',
      blocker:null,evidenceStatus:'READ_ONLY_CAST_MATCH',readyForRender:false})
  })
  it('rejects cross-project, mismatched hash and unapproved rows',()=>{
    expect(evaluateRecastCastAppearance('other',sha,[cast],[variant]).castAppearanceMatched).toBe(false)
    expect(evaluateRecastCastAppearance(project,'b'.repeat(64),[cast],[variant]).castAppearanceMatched).toBe(false)
    expect(evaluateRecastCastAppearance(project,sha,[{...cast,approved_by:''}],[variant]).castAppearanceMatched).toBe(false)
    expect(evaluateRecastCastAppearance(project,sha,[cast],[{...variant,approved_at:''}]).castAppearanceMatched).toBe(false)
    expect(evaluateRecastCastAppearance(project,sha,[cast],[{...variant,project_id:'other'}]).castAppearanceMatched).toBe(false)
  })
  it('rejects multiple different approved appearance matches as ambiguous',()=>{
    const result=evaluateRecastCastAppearance(project,sha,[cast],[variant,{...variant,id:'appearance:alt'}])
    expect(result.castAppearanceMatched).toBe(false)
    expect(result.blocker).toBe('DIRECTOR_RECAST_CAST_APPEARANCE_AMBIGUOUS')
  })
  it('does not conflate Cast appearance approval with consent or tracking approval',()=>{
    const result=evaluateRecastCastAppearance(project,sha,[cast],[variant])
    expect('executionAuthority' in result).toBe(false)
    expect(result.readyForRender).toBe(false)
  })
})