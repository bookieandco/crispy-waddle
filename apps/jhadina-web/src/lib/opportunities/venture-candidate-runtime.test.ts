import { describe, expect, it } from 'vitest'
import type { VentureMarketSignal } from '@jhadina/opportunity-core'
import { runVentureCandidateSynthesis, VENTURE_CANDIDATE_PROFILES } from './venture-candidate-runtime'

function signal(id:string,sourceRef:string,kind:VentureMarketSignal['kind']):VentureMarketSignal{
  return{id,kind,sourceRef,observedAt:'2026-10-01T18:00:00.000Z',note:'evidence',confidence:0.8}
}

describe('venture candidate synthesis runtime',()=>{
  it('turns persisted scout evidence into a research candidate without execution authority',async()=>{
    let saved=0
    const profile=VENTURE_CANDIDATE_PROFILES[0]
    const result=await runVentureCandidateSynthesis({} as never,{
      profiles:[profile],
      generatedAt:'2026-10-01T18:05:00.000Z',
      repository:{
        async listScoutSignals(){
          return[
            {seedId:profile.seedId,family:profile.family,signal:signal('1','https://etsy.com/a','sales'),sourceTitle:'a'},
            {seedId:profile.seedId,family:profile.family,signal:signal('2','https://reddit.com/b','buyer_pain'),sourceTitle:'b'},
            {seedId:profile.seedId,family:profile.family,signal:signal('3','https://pinterest.com/c','search'),sourceTitle:'c'},
          ]
        },
        async upsertCandidates(candidates){saved=candidates.length;return candidates.length},
      },
    })
    expect(result.status).toBe('PROCESSED')
    expect(result.researchReady).toBe(1)
    expect(saved).toBe(1)
    expect(result.externalActionAuthorized).toBe(false)
    expect(result.automaticExperimentAuthorized).toBe(false)
  })
})
