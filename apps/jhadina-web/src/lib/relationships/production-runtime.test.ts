import {describe,expect,it} from 'vitest'
import {
  DEFAULT_RELATIONSHIP_PIPELINES,
  buildSafeRelationshipWork,
  deriveRelationshipIntelligence,
} from '@jhadina/relationship-core'
import {getSideHustleRelationshipScope,relationshipPipelinesForSideHustle,SIDE_HUSTLE_DEFINITIONS} from '@jhadina/opportunity-core'
import {relationshipContextAdapters} from './context-fusion'
import {awardProviderIdentityCandidates} from './backfill'
import {resolvePublicWorkPackagePrimeRef} from './prime-subcontractor-runtime'
import {mergeRelationshipEvidenceRefs} from './production-repository'

describe('CRM-PROD web runtime contracts',()=>{
  it('exposes every required production pipeline',()=>{
    expect(DEFAULT_RELATIONSHIP_PIPELINES.map(row=>row.pipeline.id)).toEqual(expect.arrayContaining([
      'sam_teaming','public_buyer','subcontractor_acquisition',
      'commercial_prospecting','affiliate_vendor','customer_lifecycle',
    ]))
  })

  it('keeps all Side Hustle relationship work separated by family',()=>{
    expect(SIDE_HUSTLE_DEFINITIONS).toHaveLength(26)
    for(const definition of SIDE_HUSTLE_DEFINITIONS){
      const scope=getSideHustleRelationshipScope(definition.family,definition.label)
      expect(scope.lanes.length).toBeGreaterThan(0)
      expect(scope.externalActionAuthorized).toBe(false)
    }
    expect(relationshipPipelinesForSideHustle('procurement_subcontracting')).toEqual(expect.arrayContaining([
      'public_buyer','sam_teaming','subcontractor_acquisition',
    ]))
  })

  it('uses only strong award UEI identifiers for cross-source provider identity',()=>{
    expect(awardProviderIdentityCandidates('provider:award:W3ZFGM6RF485',['usaspending:1'])).toEqual([
      {scheme:'uei',value:'W3ZFGM6RF485',evidenceRefs:['usaspending:1']},
    ])
    expect(awardProviderIdentityCandidates('local-prime:example-company',['award:1'])).toEqual([])
    expect(awardProviderIdentityCandidates('provider:award:not-a-uei',['award:1'])).toEqual([])
  })

  it('resolves local award packages to the deterministic prime profile id',()=>{
    expect(resolvePublicWorkPackagePrimeRef({
      awardedPrimeName:'Bound Tree Medical, LLC',
    })).toBe('local-prime:bound-tree-medical-llc')
    expect(resolvePublicWorkPackagePrimeRef({
      awardedPrimeRef:'prime:verified:123',
      awardedPrimeName:'Different Display Name',
    })).toBe('prime:verified:123')
    expect(resolvePublicWorkPackagePrimeRef({})).toBeUndefined()
  })

  it('preserves provenance when the same canonical entity is seen by another source',()=>{
    expect(mergeRelationshipEvidenceRefs(
      ['sam:entity:1','usaspending:award:1'],
      ['usaspending:award:1','local-gov:award:2'],
    )).toEqual(['sam:entity:1','usaspending:award:1','local-gov:award:2'])
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
