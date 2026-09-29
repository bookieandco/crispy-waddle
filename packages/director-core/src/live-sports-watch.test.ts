import {describe,expect,it} from 'vitest'
import {createDirectorSportsWatchEnvelope} from './live-sports-watch'

const base=()=>({
  observationId:'director:nba:g1:f1:tempo',
  eventId:'nba:g1',
  subjectId:'team:home',
  frameId:'frame:1',
  kind:'TEMPO' as const,
  value:0.72,
  confidence:0.91,
  observedAt:'2026-09-29T02:00:00.000Z',
  availableAt:'2026-09-29T02:00:00.250Z',
  sourceLocator:'licensed-feed://nba/g1',
  evidenceIds:['frame:sha256:abc'],
  rightsVerified:true,
  sourceAuthorized:true,
})

describe('Director live sports watch',()=>{
  it('emits inference-only observations with no betting authority',()=>{
    const observation=createDirectorSportsWatchEnvelope(base())
    expect(observation.authority).toBe('DIRECTOR_INFERENCE_ONLY')
    expect(observation.canAuthorizeBet).toBe(false)
    expect(observation.canExecute).toBe(false)
    expect(observation.requiresOfficialReconciliation).toBe(false)
  })

  it('forces score/clock-like detections through official reconciliation',()=>{
    const observation=createDirectorSportsWatchEnvelope({...base(),kind:'SCORE_CANDIDATE',value:'81-79'})
    expect(observation.requiresOfficialReconciliation).toBe(true)
    expect(observation.canEstablishOfficialScore).toBe(false)
  })

  it('fails closed without source rights',()=>{
    expect(()=>createDirectorSportsWatchEnvelope({...base(),rightsVerified:false})).toThrow('DIRECTOR_SPORTS_RIGHTS_NOT_VERIFIED')
  })
})
