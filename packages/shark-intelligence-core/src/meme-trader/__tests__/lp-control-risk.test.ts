import { describe, expect, it } from 'vitest'
import { assessLPControlRisk } from '../lp-control-risk'
import { deriveLiquidityHistory } from '../liquidity-history'

describe('LP control risk', () => {
  it('detects a rapid liquidity drain', () => {
    const history = deriveLiquidityHistory([
      { observedAt: '2026-01-01T00:00:00Z', liquidityUsd: 100000, source: 'dex', evidenceId: 'l1' },
      { observedAt: '2026-01-01T00:05:00Z', liquidityUsd: 60000, source: 'dex', evidenceId: 'l2' },
      { observedAt: '2026-01-01T00:06:00Z', liquidityUsd: 20000, source: 'dex', evidenceId: 'l3' },
    ])
    const risk = assessLPControlRisk({ lpOwnerKnown: true, lpOwnerIsDeployer: true, lpLockedPct: 0, liquidityHistory: history, evidenceIds: history.evidenceIds })
    expect(history.drawdownFromPeak).toBe(0.8)
    expect(risk.band).toBe('critical')
    expect(risk.reasons).toContain('rapid-liquidity-drain')
  })

  it('flags substantial controllable liquidity even without a drain', () => {
    const risk = assessLPControlRisk({ lpOwnerKnown: true, lpOwnerIsDeployer: true, lpBurnedPct: 0, lpLockedPct: 0, evidenceIds: ['e1'] })
    expect(risk.controllableLiquidityPct).toBe(1)
    expect(risk.reasons).toContain('substantial-lp-remains-controllable')
  })

  it('does not treat burned liquidity as zero risk when other control risks remain', () => {
    const risk = assessLPControlRisk({ lpOwnerKnown: true, lpBurnedPct: 100, lpLockedPct: 0, authorityCanChange: true, evidenceIds: ['e1'] })
    expect(risk.score).toBeGreaterThan(0)
    expect(risk.reasons).toContain('lp-authority-can-change')
  })
})
