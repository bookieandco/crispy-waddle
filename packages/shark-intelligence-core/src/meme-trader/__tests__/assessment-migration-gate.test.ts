import { describe, expect, it } from 'vitest'
import { createMemeTradeAssessment } from '../assessment'

const migration = {
  kind: 'LEGITIMATE_MIGRATION' as const,
  confidence: 0.95,
  migrationId: 'migration-1',
  reason: 'legitimate_migration:migration-1',
  hardBlockRug: false,
  evidenceIds: ['migration-1'],
}

const base = {
  assessmentId: 'assessment-1',
  assessedAt: '2026-09-02T10:00:00Z',
  market: {
    observationId: 'market-1',
    source: 'dexscreener' as const,
    observedAt: '2026-09-02T09:59:00Z',
    receivedAt: '2026-09-02T10:00:00Z',
    chainId: 'solana-mainnet',
    subjectId: 'token-1',
    payload: { liquidityUsd: 100000, volume24hUsd: 200000, buys24h: 100, sells24h: 100 },
  },
  tradeType: 'swing-hold' as const,
  strategyFit: { score: 0.7, matchedSignals: ['migration'], conflicts: [] },
  lpControlRisk: {
    score: 0.95,
    band: 'critical' as const,
    controllableLiquidityPct: 0.9,
    lockExpiryRisk: 0,
    withdrawalRisk: 0.5,
    reasons: ['deployer-controls-lp', 'historical-liquidity-withdrawal-observed', 'rapid-liquidity-drain'],
    evidenceIds: ['lp-1'],
  },
  liquidityHistory: {
    snapshots: [],
    initialLiquidityUsd: 100000,
    currentLiquidityUsd: 10000,
    peakLiquidityUsd: 100000,
    drawdownFromPeak: 0.9,
    drainRate: 0.4,
    drainAcceleration: 0.2,
    stabilityScore: 0.1,
    evidenceIds: ['liq-1'],
  },
  rugProtectionInput: {
    liquidityDrainRate: 0.4,
    liquidityDrainAcceleration: 0.2,
    liquidityDrawdownFromPeak: 0.9,
    lpBurnPct: 10,
    lpLockedPct: 10,
  },
  thesis: 'Migration continuation thesis',
  invalidation: { conditions: ['destination pool fails to establish'], severity: 'high' as const },
  positionPlan: { maxPositionFraction: 0.01, entryConditions: ['verified migration'], profitTakingConditions: [], exitConditions: ['migration invalidated'] },
  confidence: 0.8,
}

describe('canonical MemeTradeAssessment migration gate', () => {
  it('uses verified migration evidence to suppress liquidity-drain escalation while preserving evidence', () => {
    const result = createMemeTradeAssessment({ ...base, migrationClassification: migration })
    expect(result.migrationClassification?.migrationId).toBe('migration-1')
    expect(result.evidenceIds).toContain('migration-1')
    expect(result.rugProtection.hardBlockers).not.toContain('liquidity is draining rapidly (0.4)')
  })

  it('keeps low-confidence migration from suppressing liquidity risk', () => {
    const result = createMemeTradeAssessment({
      ...base,
      migrationClassification: { ...migration, confidence: 0.69 },
    })
    expect(result.rugProtection.hardBlockers).toContain('liquidity is draining rapidly (0.4)')
  })
})
