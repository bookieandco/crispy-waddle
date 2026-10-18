import {describe,expect,it} from 'vitest'
import {socialObservationToSharkSignal} from './social-signal-bridge'
const observedAt='2026-10-03T03:00:00Z',receivedAt='2026-10-03T03:09:00Z',availableAt='2026-10-03T03:09:03Z'
describe('SHARK social signal bridge',()=>{
  it('bridges X into evidence-only token candidates with accurate capture latency',()=>{
    const signal=socialObservationToSharkSignal({
      observation:{id:'x1',kind:'trend',source:'social-provider',platform:'x',providerProfileId:'acct-x',
        observedAt,evidence:['CA 11111111111111111111111111111111'],attributes:{title:'new token'}},
      receivedAt,availableAt,upstreamOriginId:'original-x-post',
    })
    expect(signal?.platform).toBe('X')
    expect(signal?.candidates.some(candidate=>candidate.kind==='SOLANA_ADDRESS')).toBe(true)
    expect(signal?.provenance.latencyMs).toBe(543000)
    expect(signal?.provenance.originalEventId).toBe('original-x-post')
    expect(signal?.canAuthorizeTrade).toBe(false)
  })
  it('bridges Reddit without guessing that it was available at publication time',()=>{
    const signal=socialObservationToSharkSignal({
      observation:{id:'r1',kind:'trend',source:'reddit-listener',platform:'reddit',observedAt,
        evidence:['https://dexscreener.com/solana/11111111111111111111111111111111']},
      sourceHandle:'r/memecoins',receivedAt,availableAt,
    })
    expect(signal?.platform).toBe('REDDIT')
    expect(signal?.provenance.receivedAt).toBe(receivedAt)
    expect(signal?.availableAt).toBe(availableAt)
    expect(signal?.authority).toBe('EVIDENCE_ONLY')
  })
  it('fails closed for missing clocks, backdated availability, and unrelated platforms',()=>{
    const observation={id:'x2',kind:'trend' as const,source:'social-provider',platform:'x' as const,observedAt,evidence:['hello']}
    expect(()=>socialObservationToSharkSignal({observation,receivedAt,availableAt:observedAt})).toThrow('clock_order')
    expect(()=>socialObservationToSharkSignal({observation,receivedAt:'',availableAt})).toThrow()
    expect(socialObservationToSharkSignal({
      observation:{...observation,platform:'youtube'},receivedAt,availableAt,
    })).toBeNull()
  })
})
