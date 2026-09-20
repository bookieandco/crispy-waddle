import { describe, expect, it } from 'vitest'
import { applyLaunchOutcome, deriveActorOutcomeHistory, evaluateLaunchOutcome } from '../launch-outcome-engine'
import type { TokenLaunch } from '../wallet-launch-pipeline'

const launch = (outcome: TokenLaunch['outcome'] = 'UNKNOWN'): TokenLaunch => ({ launchId: 'launch:solana-mainnet:TOKEN', chainId: 'solana-mainnet', tokenAddress: 'TOKEN', deployerWalletId: 'dev1', launchedAt: '2026-09-01T00:00:00Z', outcome, evidenceIds: ['launch-e1'] })
const evidence = [{ evidenceId: 'e1', observedAt: '2026-09-02T00:00:00Z', kind: 'liquidity' as const, label: 'liquidity-drain' }]

describe('launch outcome engine', () => {
  it('labels a liquidity-removal event as RUG and preserves evidence', () => {
    const assessment = evaluateLaunchOutcome({ launch: launch(), evaluatedAt: '2026-09-02T00:00:00Z', liquidityRemoved: true, developerSoldPct: 0.8, holderExitPct: 0.9, evidence })
    expect(assessment.outcome).toBe('RUG')
    expect(assessment.confidence).toBeGreaterThan(0)
    expect(assessment.evidenceIds).toContain('e1')
    expect(applyLaunchOutcome(launch(), assessment).outcome).toBe('RUG')
  })

  it('does not turn incomplete evidence into a false positive outcome', () => {
    const assessment = evaluateLaunchOutcome({ launch: launch(), evaluatedAt: '2026-09-02T00:00:00Z', evidence })
    expect(assessment.outcome).toBe('UNKNOWN')
  })

  it('allows newer evidence to revise an earlier classification and ignores stale revisions', () => {
    const existing = { ...launch('HEALTHY'), outcomeObservedAt: '2026-09-01T12:00:00Z' }
    const newer = evaluateLaunchOutcome({ launch: launch(), evaluatedAt: '2026-09-02T00:00:00Z', liquidityRemoved: true, evidence })
    expect(applyLaunchOutcome(existing, newer).outcome).toBe('RUG')

    const stale = { ...newer, evaluatedAt: '2026-09-01T00:00:00Z', outcome: 'FAILED' as const }
    expect(applyLaunchOutcome(existing, stale).outcome).toBe('HEALTHY')
  })

  it('does not call a price/developer collapse a rug without liquidity evidence', () => {
    const assessment = evaluateLaunchOutcome({
      launch: launch(),
      evaluatedAt: '2026-09-02T00:00:00Z',
      peakReturnPct: 400,
      priceReturnFromLaunchPct: -90,
      maxDrawdownPct: .95,
      developerSoldPct: .9,
      holderExitPct: .9,
      holderBehavior: 'PANIC_EXIT',
      evidence,
    })
    expect(assessment.outcome).toBe('PUMP_AND_DUMP')
    expect(assessment.outcome).not.toBe('RUG')
  })

  it('labels a terminal collapse without pump or liquidity-removal evidence as FAILED', () => {
    const assessment = evaluateLaunchOutcome({
      launch: launch(),
      evaluatedAt: '2026-09-02T00:00:00Z',
      priceReturnFromLaunchPct: -90,
      holderExitPct: .8,
      evidence,
    })
    expect(assessment.outcome).toBe('FAILED')
  })

  it('derives actor history without counting UNKNOWN as good or bad', () => {
    const history = deriveActorOutcomeHistory('dev1', [launch('RUG'), { ...launch('HEALTHY'), launchId: 'launch:solana-mainnet:T2' }, { ...launch('UNKNOWN'), launchId: 'launch:solana-mainnet:T3' }])
    expect(history.launches).toBe(3)
    expect(history.healthyLaunches).toBe(1)
    expect(history.badLaunches).toBe(1)
    expect(history.outcomeCoverage).toBeCloseTo(2 / 3)
  })
})
