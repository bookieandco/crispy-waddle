import { describe, expect, it } from 'vitest'
import { deriveTokenActorGraph } from '../entity-graph'
import { createActorAwareMemeTradeAssessment } from '../actor-aware-assessment'
import type { TokenLaunch } from '../wallet-launch-pipeline'
import type { EvidenceEnvelope, MarketObservation } from '../contracts'

const market: EvidenceEnvelope<MarketObservation> = {
  observationId: 'market-1', source: 'dexscreener', observedAt: '2026-09-02T00:00:00Z', receivedAt: '2026-09-02T00:00:01Z', chainId: 'solana-mainnet', subjectId: 'TOKEN-NEW',
  payload: { liquidityUsd: 100000, volume24hUsd: 200000, buys24h: 100, sells24h: 20 },
}

const historical = (outcome: TokenLaunch['outcome'], launchId: string): TokenLaunch => ({ launchId, chainId: 'solana-mainnet', tokenAddress: launchId.split(':').at(-1)!, deployerWalletId: 'DEV-1', launchedAt: '2026-08-01T00:00:00Z', outcome, evidenceIds: [`evidence:${launchId}`] })

describe('actor-aware meme assessment', () => {
  it('uses graph-linked historical outcomes to derive genuine deployer risk', () => {
    const graph = deriveTokenActorGraph({ chainId: 'solana-mainnet', tokenAddress: 'TOKEN-NEW', observedAt: '2026-09-02T00:00:00Z', deployerWalletId: 'DEV-1', evidenceIds: ['graph-1'] })
    const assessment = createActorAwareMemeTradeAssessment({
      assessmentId: 'assessment-1', assessedAt: '2026-09-02T00:00:00Z', market, tradeType: 'new-pair-speculation', strategyFit: { score: .5, matchedSignals: [], conflicts: [] }, thesis: 'test', invalidation: { conditions: ['liquidity collapses'], severity: 'high' }, positionPlan: { maxPositionFraction: .01, entryConditions: [], profitTakingConditions: [], exitConditions: [] }, confidence: .5,
      actorGraph: graph,
      historicalLaunches: [historical('RUG', 'launch:solana-mainnet:OLD-1'), historical('RUG', 'launch:solana-mainnet:OLD-2'), historical('HEALTHY', 'launch:solana-mainnet:OLD-3')],
    })
    expect(assessment.riskAssessment.developerRisk).toBe(2 / 3)
    expect(assessment.supplyControl.deployerRisk).toBe(2 / 3)
    expect(assessment.supplyControl.reasons.some(reason => reason.includes('historical-actor-bad-launch-rate'))).toBe(true)
    expect(assessment.evidenceIds).toContain('graph-1')
  })

  it('does not create actor risk when the graph has no historical actor match', () => {
    const graph = deriveTokenActorGraph({ chainId: 'solana-mainnet', tokenAddress: 'TOKEN-NEW', observedAt: '2026-09-02T00:00:00Z', deployerWalletId: 'DEV-NEW', evidenceIds: ['graph-2'] })
    const assessment = createActorAwareMemeTradeAssessment({
      assessmentId: 'assessment-2', assessedAt: '2026-09-02T00:00:00Z', market, tradeType: 'new-pair-speculation', strategyFit: { score: .5, matchedSignals: [], conflicts: [] }, thesis: 'test', invalidation: { conditions: ['liquidity collapses'], severity: 'high' }, positionPlan: { maxPositionFraction: .01, entryConditions: [], profitTakingConditions: [], exitConditions: [] }, confidence: .5,
      actorGraph: graph,
      historicalLaunches: [historical('RUG', 'launch:solana-mainnet:OLD-4')],
    })
    expect(assessment.riskAssessment.developerRisk).toBe(0)
  })
})
