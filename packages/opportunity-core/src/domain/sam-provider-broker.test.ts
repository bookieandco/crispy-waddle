import assert from 'node:assert/strict'
import { assessBrokerProvider } from './sam-provider-broker.js'

const intent={
  requirementId:'req-1',
  keywords:['cloud migration'],
  naicsCodes:['541512'],
  pscCodes:['D302'],
  allowForeign:true as const,
}

const lookalikeOnly=assessBrokerProvider(intent,{
  id:'p1',
  legalName:'Peer Systems LLC',
  naicsCodes:['541512'],
  keywords:['cloud migration','PSC D302'],
  previousWinSimilarity:{
    score:100,
    anchorProviderIds:['winner-1'],
    reasons:['NAICS overlaps a previous federal winner'],
    evidenceRefs:['usaspending:award-1'],
  },
  evidence:[{id:'sam:p1',source:'sam_entity'}],
})
assert.equal(lookalikeOnly.status,'review_required')
assert.ok(lookalikeOnly.reasons.includes('capability profile resembles previous public/federal winners'))

const corroborated=assessBrokerProvider(intent,{
  id:'p2',
  legalName:'Peer Systems Two LLC',
  naicsCodes:['541512'],
  keywords:['cloud migration','PSC D302'],
  previousWinSimilarity:{
    score:100,
    anchorProviderIds:['winner-1'],
    reasons:['NAICS overlaps a previous federal winner'],
    evidenceRefs:['usaspending:award-1'],
  },
  evidence:[
    {id:'sam:p2',source:'sam_entity'},
    {id:'web:p2',source:'web_search'},
  ],
})
assert.equal(corroborated.status,'candidate')

console.log('sam provider broker tests passed')
