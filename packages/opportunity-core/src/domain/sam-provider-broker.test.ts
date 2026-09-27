import assert from 'node:assert/strict'
import { assessBrokerProvider } from './sam-provider-broker.js'

const intent={
  requirementId:'req-1',
  keywords:['cloud'],
  naicsCodes:['541512'],
  pscCodes:['D302'],
  allowForeign:true as const,
}

const awardOnly=assessBrokerProvider(intent,{
  id:'peer-1',
  legalName:'Peer Cloud LLC',
  naicsCodes:['541512'],
  keywords:['cloud migration','PSC D302'],
  awardCount:1,
  evidence:[{
    id:'usaspending:peer-1',
    source:'usaspending',
    details:{discoveryMode:'award_neighbor',seedProviderIds:['winner-1']},
  }],
})
assert.equal(awardOnly.reasons.includes('similarity to prior federal award winners observed'),true)
assert.equal(awardOnly.status,'review_required')
assert.equal(awardOnly.score,95)

const corroborated=assessBrokerProvider(intent,{
  id:'peer-1',
  legalName:'Peer Cloud LLC',
  naicsCodes:['541512'],
  keywords:['cloud migration','PSC D302'],
  awardCount:1,
  evidence:[
    {
      id:'usaspending:peer-1',
      source:'usaspending',
      details:{discoveryMode:'award_neighbor',seedProviderIds:['winner-1']},
    },
    {id:'sam-entity:peer-1',source:'sam_entity'},
  ],
})
assert.equal(corroborated.status,'candidate')
assert.equal(corroborated.score,100)

console.log('sam-provider-broker award-neighbor tests passed')
