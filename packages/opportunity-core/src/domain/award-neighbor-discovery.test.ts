import assert from 'node:assert/strict'
import { buildAwardNeighborProfile,buildAwardNeighborSearches,isAwardNeighborEvidence } from './award-neighbor-discovery.js'
import type { BrokerProviderCandidate } from './sam-provider-broker.js'

const winner=(id:string,name:string,naics:string,psc:string,description:string,awardCount=1):BrokerProviderCandidate=>({
  id,legalName:name,naicsCodes:[naics],keywords:[description,`PSC ${psc}`],awardCount,
  evidence:[{id:`award:${id}`,source:'usaspending',details:{pscCode:psc}}],
})

const profile=buildAwardNeighborProfile([
  winner('a','Alpha','541512','D302','cloud migration cybersecurity',3),
  winner('b','Beta','541512','D302','cloud infrastructure migration',2),
  {id:'c',legalName:'Directory Only',naicsCodes:['999999'],keywords:['unrelated'],evidence:[{id:'manual:c',source:'manual'}]},
])
assert.deepEqual(profile.seedProviderIds,['a','b'])
assert.equal(profile.naicsCodes[0],'541512')
assert.equal(profile.pscCodes[0],'D302')
assert.equal(profile.keywords.includes('cloud'),true)
assert.equal(profile.keywords.includes('migration'),true)
assert.deepEqual(profile.evidenceRefs,['award:a','award:b'])

const searches=buildAwardNeighborSearches(profile,3)
assert.equal(searches.length>0,true)
assert.deepEqual(searches[0]?.seedProviderIds,['a','b'])
assert.equal(searches.some(search=>search.keywords.includes('cloud')),true)

assert.equal(isAwardNeighborEvidence({
  id:'peer',legalName:'Peer Co',naicsCodes:['541512'],keywords:['cloud'],awardCount:1,
  evidence:[{id:'award:peer',source:'usaspending',details:{discoveryMode:'award_neighbor',seedProviderIds:['a']}}],
}),true)
assert.equal(isAwardNeighborEvidence(winner('a','Alpha','541512','D302','cloud migration')),false)

console.log('award-neighbor-discovery tests passed')
