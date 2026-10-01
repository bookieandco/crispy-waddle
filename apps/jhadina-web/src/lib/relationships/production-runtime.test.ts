import {describe,expect,it} from 'vitest'
import {
  DEFAULT_RELATIONSHIP_PIPELINES,
  buildSafeRelationshipWork,
  deriveRelationshipIntelligence,
} from '@jhadina/relationship-core'
import {relationshipContextAdapters} from './context-fusion'

describe('CRM-PROD web runtime contracts',()=>{
  it('exposes every required production pipeline',()=>{
    expect(DEFAULT_RELATIONSHIP_PIPELINES.map(row=>row.pipeline.id)).toEqual(expect.arrayContaining([
      'sam_teaming','public_buyer','subcontractor_acquisition',
      'commercial_prospecting','affiliate_vendor','customer_lifecycle',
    ]))
  })

  it('maps communication into evidence-backed context without authority',()=>{
    const event=relationshipContextAdapters.email({
      entityId:'org:1',
      messageRef:'email:1',
      occurredAt:'2026-10-01T23:45:00.000Z',
      evidenceRefs:['gmail:message:1'],
      direction:'received',
    })
    expect(event.kind).toBe('email')
    expect(event.relation).toBe('received_from')
    expect(event.evidenceRefs).toEqual(['gmail:message:1'])
  })

  it('creates relationship worker work with zero execution authority',()=>{
    const work=buildSafeRelationshipWork({
      id:'work:1',ownerUserId:'user:1',entityId:'org:1',
      capability:'relationship.refresh_provider',
      reason:'Refresh capacity.',dueAt:'2026-10-01T23:45:00.000Z',
      correlationId:'corr:1',evidenceRefs:['sam:1'],
    })
    expect(work.executionAuthorized).toBe(false)
  })

  it('keeps derived intelligence analysis-only',()=>{
    const signals=deriveRelationshipIntelligence({
      entityId:'org:1',
      now:'2026-10-01T23:45:00.000Z',
      activities:[],
      links:[],
      suggestions:[],
      identities:[],
      roles:[],
    })
    expect(signals.length).toBeGreaterThan(0)
    expect(signals.every(row=>row.authority==='ANALYSIS_ONLY')).toBe(true)
  })
})
