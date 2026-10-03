import {describe,expect,it} from 'vitest'
import {socialObservationToSharkSignal} from './social-signal-bridge'

describe('SHARK social signal bridge',()=>{
  it('bridges X into evidence-only token candidates',()=>{
    const signal=socialObservationToSharkSignal({observation:{
      id:'x1',kind:'trend',source:'social-provider',platform:'x',providerProfileId:'acct-x',
      observedAt:'2026-10-03T03:00:00Z',evidence:['CA 11111111111111111111111111111111'],attributes:{title:'new token'},
    }})
    expect(signal?.platform).toBe('X')
    expect(signal?.candidates.some(candidate=>candidate.kind==='SOLANA_ADDRESS')).toBe(true)
    expect(signal?.canAuthorizeTrade).toBe(false)
  })

  it('bridges Reddit through the same contract and ignores unrelated platforms',()=>{
    const reddit=socialObservationToSharkSignal({observation:{
      id:'r1',kind:'trend',source:'reddit-listener',platform:'reddit',observedAt:'2026-10-03T03:00:00Z',
      evidence:['https://dexscreener.com/solana/11111111111111111111111111111111'],
    },sourceHandle:'r/memecoins'})
    expect(reddit?.platform).toBe('REDDIT')
    expect(reddit?.sourceHandle).toBe('r/memecoins')
    expect(reddit?.authority).toBe('EVIDENCE_ONLY')

    const youtube=socialObservationToSharkSignal({observation:{
      id:'y1',kind:'trend',source:'youtube',platform:'youtube',observedAt:'2026-10-03T03:00:00Z',evidence:['nothing'],
    }})
    expect(youtube).toBeNull()
  })
})
