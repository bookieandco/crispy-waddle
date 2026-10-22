import {describe,expect,it} from 'vitest'
import {classifyRecastRelationProbe,diagnoseRecastSchema} from './recast-schema-diagnostics'
describe('Recast live schema error differentiation',()=>{
  it('distinguishes truly missing relation from read denial and transient failures',()=>{
    expect(classifyRecastRelationProbe({code:'PGRST205'})).toBe('MISSING_TABLE')
    expect(classifyRecastRelationProbe({code:'42P01'})).toBe('MISSING_TABLE')
    expect(classifyRecastRelationProbe({code:'42501',message:'permission denied'})).toBe('ACCESS_DENIED')
    expect(classifyRecastRelationProbe({code:'PGRST503',message:'offline'})).toBe('SERVICE_UNAVAILABLE')
    expect(classifyRecastRelationProbe(null)).toBe('READABLE')
  })
  it('does not suggest migrating when service role simply lacks grants',()=>{
    const r=diagnoseRecastSchema({
      projectInputs:{code:'42501'},reviewReceipts:{code:'PGRST205'},
      artifactStore:null,castStore:null,
    })
    expect(r.sourceBindingAvailable).toBe(false)
    expect(r.schemaDiagnostics.projectInputs).toBe('ACCESS_DENIED')
    expect(r.schemaDiagnostics.reviewReceipts).toBe('MISSING_TABLE')
    expect(r.canMigrateAutomatically).toBe(false)
    expect(r.canRender).toBe(false)
  })
})