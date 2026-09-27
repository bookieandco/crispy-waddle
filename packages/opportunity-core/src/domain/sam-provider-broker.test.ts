import { describe,expect,it } from 'vitest'
import { assessBrokerProvider } from './sam-provider-broker.js'

describe('SAM provider broker award-neighbor signal',()=>{
  it('adds a bounded similarity signal without bypassing multi-source verification',()=>{
    const assessment=assessBrokerProvider({
      requirementId:'req-1',
      keywords:['cloud'],
      naicsCodes:['541512'],
      pscCodes:['D302'],
      allowForeign:true,
    },{
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

    expect(assessment.reasons).toContain('similarity to prior federal award winners observed')
    expect(assessment.status).toBe('review_required')
    expect(assessment.score).toBe(95)
  })

  it('can become a candidate only after a distinct second source corroborates the company',()=>{
    const assessment=assessBrokerProvider({
      requirementId:'req-1',
      keywords:['cloud'],
      naicsCodes:['541512'],
      pscCodes:['D302'],
      allowForeign:true,
    },{
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

    expect(assessment.status).toBe('candidate')
    expect(assessment.score).toBe(100)
  })
})
