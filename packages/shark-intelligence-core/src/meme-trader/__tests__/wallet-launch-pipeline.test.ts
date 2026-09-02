import { describe, expect, it } from 'vitest'
import { buildSniperCandidate, deriveLaunchBehaviorSignal } from '../wallet-launch-pipeline'

describe('wallet -> launch -> sniper pipeline', () => {
  it('learns historical bad-launch rate without treating unknowns as failures', () => {
    const signal = deriveLaunchBehaviorSignal({
      walletId: 'dev-1',
      launches: [
        { launchId: 'a', chainId: 'solana', tokenAddress: 'A', launchedAt: '2026-01-01T00:00:00Z', outcome: 'RUG', evidenceIds: ['e1'], liquidityRemoved: true },
        { launchId: 'b', chainId: 'solana', tokenAddress: 'B', launchedAt: '2026-01-02T00:00:00Z', outcome: 'HEALTHY', evidenceIds: ['e2'], liquidityRemoved: false },
        { launchId: 'c', chainId: 'solana', tokenAddress: 'C', launchedAt: '2026-01-03T00:00:00Z', outcome: 'UNKNOWN', evidenceIds: ['e3'] },
      ],
    })
    expect(signal.priorLaunches).toBe(3)
    expect(signal.healthyLaunches).toBe(1)
    expect(signal.badLaunches).toBe(1)
    expect(signal.rugRate).toBeCloseTo(1 / 3)
    expect(signal.confidence).toBe(0.3)
  })

  it('blocks a candidate when developer history is strongly adverse', () => {
    const signal = deriveLaunchBehaviorSignal({
      walletId: 'dev-1',
      launches: Array.from({ length: 10 }, (_, i) => ({
        launchId: `rug-${i}`,
        chainId: 'solana',
        tokenAddress: `TOKEN-${i}`,
        launchedAt: '2026-01-01T00:00:00Z',
        outcome: 'RUG' as const,
        evidenceIds: [`e-${i}`],
      })),
    })
    const candidate = buildSniperCandidate({
      launch: { launchId: 'new', chainId: 'solana', tokenAddress: 'NEW', deployerWalletId: 'dev-1', launchedAt: '2026-02-01T00:00:00Z', outcome: 'UNKNOWN', evidenceIds: ['launch-e'] },
      behaviorSignals: [signal],
      observedAt: '2026-02-01T00:00:01Z',
    })
    expect(candidate.disposition).toBe('BLOCK')
    expect(candidate.blockers).toContain('developer-or-cluster-has-high-bad-launch-rate')
  })

  it('never upgrades positive history into execution authority', () => {
    const signal = deriveLaunchBehaviorSignal({
      walletId: 'dev-1',
      launches: [{ launchId: 'good', chainId: 'solana', tokenAddress: 'GOOD', launchedAt: '2026-01-01T00:00:00Z', outcome: 'HEALTHY', evidenceIds: ['e1'] }],
    })
    const candidate = buildSniperCandidate({
      launch: { launchId: 'new', chainId: 'solana', tokenAddress: 'NEW', deployerWalletId: 'dev-1', launchedAt: '2026-02-01T00:00:00Z', outcome: 'UNKNOWN', evidenceIds: ['launch-e'] },
      behaviorSignals: [signal],
      observedAt: '2026-02-01T00:00:01Z',
    })
    expect(candidate.disposition).not.toBe('BLOCK')
    expect(candidate.reasons.join(' ')).toContain('not execution authority')
  })
})
