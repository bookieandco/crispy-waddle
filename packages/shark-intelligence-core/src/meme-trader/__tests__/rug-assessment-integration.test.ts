import { describe, expect, it } from 'vitest'
import { createMemeTradeAssessment } from '../assessment'
import { assessLPControlRisk } from '../lp-control-risk'
import { deriveLiquidityHistory } from '../liquidity-history'

const market = {
  observationId: 'market-1',
  source: 'dexscreener' as const,
  observedAt: '2026-09-02T00:00:00.000Z',
  receivedAt: '2026-09-02T00:00:01.000Z',
  chainId: 'solana',
  subjectId: 'TokenA',
  payload: { liquidityUsd: 100000, volume24hUsd: 250000, buys24h: 100, sells24h: 20 },
}

const baseInput = {
  assessmentId: 'assessment-1',
  assessedAt: '2026-09-02T00:10:00.000Z',
  market,
  tradeType: 'new-pair-speculation' as const,
  strategyFit: { score: .9, matchedSignals: ['flow'], conflicts: [] },
  attention: { score: .9, crossSourceConfirmation: .9, engagementQuality: .9, sourceCredibility: .9, manipulationPenalty: 0, reasons: [] },
  holderCohort: { score: .9, profitableTrackedWallets: 4, accumulatingWallets: 5, distributingWallets: 0, reasons: [] },
  thesis: 'strong test thesis',
  invalidation: { conditions: ['liquidity drain'], severity: 'high' as const },
  positionPlan: { maxPositionFraction: .01, entryConditions: [], profitTakingConditions: [], exitConditions: [] },
  confidence: .9,
}

describe('rug protection integration', () => {
  it('blocks an assessment when LP control and liquidity trajectory signal a rug', () => {
    const liquidityHistory = deriveLiquidityHistory([
      { observedAt: '2026-09-02T00:00:00.000Z', liquidityUsd: 100000, source: 'dex', evidenceId: 'liq-1' },
      { observedAt: '2026-09-02T00:05:00.000Z', liquidityUsd: 60000, source: 'dex', evidenceId: 'liq-2' },
      { observedAt: '2026-09-02T00:06:00.000Z', liquidityUsd: 20000, source: 'dex', evidenceId: 'liq-3' },
    ])
    const lpControlRisk = assessLPControlRisk({
      lpOwnerKnown: true,
      lpOwnerIsDeployer: true,
      lpLockedPct: 0,
      liquidityHistory,
      evidenceIds: liquidityHistory.evidenceIds,
    })

    const assessment = createMemeTradeAssessment({ ...baseInput, liquidityHistory, lpControlRisk })

    expect(lpControlRisk.band).toBe('critical')
    expect(assessment.rugProtection.disposition).toBe('BLOCK')
    expect(assessment.riskAssessment.band).toBe('blocked')
    expect(assessment.riskAssessment.overallRisk).toBe(1)
    expect(assessment.evidenceIds).toEqual(expect.arrayContaining(['liq-1', 'liq-2', 'liq-3']))
  })

  it('does not block a clean liquidity trajectory solely because liquidity is present', () => {
    const liquidityHistory = deriveLiquidityHistory([
      { observedAt: '2026-09-02T00:00:00.000Z', liquidityUsd: 100000, source: 'dex', evidenceId: 'liq-a' },
      { observedAt: '2026-09-02T00:05:00.000Z', liquidityUsd: 101000, source: 'dex', evidenceId: 'liq-b' },
      { observedAt: '2026-09-02T00:10:00.000Z', liquidityUsd: 100500, source: 'dex', evidenceId: 'liq-c' },
    ])
    const lpControlRisk = assessLPControlRisk({
      lpOwnerKnown: true,
      lpOwnerIsDeployer: false,
      lpBurnedPct: 100,
      lpLockedPct: 0,
      liquidityHistory,
      evidenceIds: liquidityHistory.evidenceIds,
    })

    const assessment = createMemeTradeAssessment({ ...baseInput, liquidityHistory, lpControlRisk })

    expect(assessment.rugProtection.disposition).not.toBe('BLOCK')
    expect(assessment.evidenceIds).toEqual(expect.arrayContaining(['liq-a', 'liq-b', 'liq-c']))
  })

  it('prevents a RugProtection review from becoming a favorable candidate', () => {
    const assessment = createMemeTradeAssessment({
      ...baseInput,
      rugProtectionInput: { mintAuthorityLive: true },
    })

    expect(assessment.rugProtection.disposition).toBe('REVIEW')
    expect(assessment.riskAssessment.band).toBe('watch')
  })
})
