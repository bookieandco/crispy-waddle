import { describe, expect, it } from 'vitest'
import { buildSharkMarketIqSnapshot } from './market-iq-bridge'

describe('MARKET-IQ.13 SHARK bridge', () => {
  it('reuses shared intelligence without gaining execution authority', () => {
    const snapshot = buildSharkMarketIqSnapshot({
      tokenAddress: 'Token111111111111111111111111111111111',
      venue: 'dex-a',
      currentPrice: 1,
      independentFairValue: 1.2,
      observedAt: '2026-10-04T18:00:00.000Z',
      availableAt: '2026-10-04T18:00:00.000Z',
      informationCutoff: '2026-10-04T18:00:00.000Z',
      liquidityUsd: 100000,
      evidenceRefs: ['e:price'],
      provenanceHash: 'p:price',
      actorId: 'wallet:1',
      actorEvidence: [{ className: 'FAST_INFORMATION', strength: 0.8, evidenceRefs: ['e:actor'] }],
      truthLayers: [
        { kind: 'LIQUIDITY', status: 'VERIFIED', confidence: 1, evidenceRefs: ['e:liq'] },
        { kind: 'SUPPLY', status: 'PARTIAL', confidence: 0.6, evidenceRefs: ['e:supply'] },
      ],
      edgeCosts: [{ kind: 'SLIPPAGE', amount: 0.05, evidenceRefs: ['e:slippage'] }],
    })
    expect(snapshot.authority).toBe('INTELLIGENCE_ONLY')
    expect(snapshot.financialAuthority).toBe('NONE')
    expect(snapshot.canAuthorizeTrade).toBe(false)
    expect(snapshot.canExecute).toBe(false)
    expect(snapshot.actor?.primaryClass).toBe('FAST_INFORMATION')
    expect(snapshot.executableEdge?.netEdge).toBe(0.15)
  })
})
