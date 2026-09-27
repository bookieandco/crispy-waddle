import { describe,expect,it } from 'vitest'
import { buildAwardNeighborProfile,buildAwardNeighborSearches,isAwardNeighborEvidence } from './award-neighbor-discovery.js'
import type { BrokerProviderCandidate } from './sam-provider-broker.js'

const winner=(id:string,name:string,naics:string,psc:string,description:string,awardCount=1):BrokerProviderCandidate=>({
  id,legalName:name,naicsCodes:[naics],keywords:[description,`PSC ${psc}`],awardCount,
  evidence:[{id:`award:${id}`,source:'usaspending',details:{pscCode:psc}}],
})

describe('award-neighbor discovery',()=>{
  it('derives a bounded similarity profile from actual prior winners',()=>{
    const profile=buildAwardNeighborProfile([
      winner('a','Alpha','541512','D302','cloud migration cybersecurity',3),
      winner('b','Beta','541512','D302','cloud infrastructure migration',2),
      {id:'c',legalName:'Directory Only',naicsCodes:['999999'],keywords:['unrelated'],evidence:[{id:'manual:c',source:'manual'}]},
    ])
    expect(profile.seedProviderIds).toEqual(['a','b'])
    expect(profile.naicsCodes[0]).toBe('541512')
    expect(profile.pscCodes[0]).toBe('D302')
    expect(profile.keywords).toContain('cloud')
    expect(profile.keywords).toContain('migration')
    expect(profile.evidenceRefs).toEqual(['award:a','award:b'])
  })

  it('builds winner-derived searches without claiming qualification',()=>{
    const profile=buildAwardNeighborProfile([
      winner('a','Alpha','541512','D302','cloud migration cybersecurity',3),
      winner('b','Beta','541512','D302','cloud infrastructure migration',2),
    ])
    const searches=buildAwardNeighborSearches(profile,3)
    expect(searches.length).toBeGreaterThan(0)
    expect(searches[0]?.seedProviderIds).toEqual(['a','b'])
    expect(searches.some(search=>search.keywords.includes('cloud'))).toBe(true)
  })

  it('recognizes explicit award-neighbor provenance only',()=>{
    expect(isAwardNeighborEvidence({
      id:'peer',legalName:'Peer Co',naicsCodes:['541512'],keywords:['cloud'],awardCount:1,
      evidence:[{id:'award:peer',source:'usaspending',details:{discoveryMode:'award_neighbor',seedProviderIds:['a']}}],
    })).toBe(true)
    expect(isAwardNeighborEvidence(winner('a','Alpha','541512','D302','cloud migration'))).toBe(false)
  })
})
