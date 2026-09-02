import { describe, expect, it } from 'vitest'
import { evaluateLaunchOutcomeBatch } from '../launch-outcome-worker'
import type { TokenLaunch } from '../wallet-launch-pipeline'

const launch = (overrides: Partial<TokenLaunch> = {}): TokenLaunch => ({
  launchId: 'launch-1',
  chainId: 'solana-mainnet',
  tokenAddress: 'TOKEN-1',
  deployerWalletId: 'wallet-1',
  developerEntityId: 'developer-1',
  clusterId: 'cluster-1',
  launchedAt: '2026-09-01T00:00:00.000Z',
  outcome: 'UNKNOWN',
  evidenceIds: ['launch:e1'],
  ...overrides,
})

describe('evaluateLaunchOutcomeBatch', () => {
  it('backfills a rug from persisted liquidity-removal evidence and derives actor history', () => {
    const result = evaluateLaunchOutcomeBatch({
      launches: [launch()],
      observations: [{
        observationId: 'obs-1',
        launchId: 'launch-1',
        observedAt: '2026-09-02T00:00:00.000Z',
        liquidityRemoved: true,
        evidenceIds: ['liquidity:removed'],
        source: 'historical-liquidity',
      }],
      evaluatedAt: '2026-09-02T00:01:00.000Z',
    })

    expect(result.changed).toBe(1)
    expect(result.assessments[0].updatedLaunch.outcome).toBe('RUG')
    expect(result.assessments[0].assessment.evidenceIds).toContain('liquidity:removed')
    expect(result.actorHistories.find(x => x.actorKey === 'developer:developer-1')?.history.rugRate).toBe(1)
  })

  it('does not turn missing observations into a false healthy result', () => {
    const result = evaluateLaunchOutcomeBatch({
      launches: [launch()],
      observations: [],
      evaluatedAt: '2026-09-02T00:01:00.000Z',
    })

    expect(result.evaluated).toBe(0)
    expect(result.unknown).toBe(1)
    expect(result.assessments).toHaveLength(0)
  })

  it('uses the newest observation per launch', () => {
    const result = evaluateLaunchOutcomeBatch({
      launches: [launch()],
      observations: [
        { observationId: 'old', launchId: 'launch-1', observedAt: '2026-09-01T01:00:00.000Z', evidenceIds: ['old'], source: 'x' },
        { observationId: 'new', launchId: 'launch-1', observedAt: '2026-09-02T01:00:00.000Z', liquidityRemoved: true, evidenceIds: ['new'], source: 'x' },
      ],
      evaluatedAt: '2026-09-02T02:00:00.000Z',
    })

    expect(result.assessments[0].updatedLaunch.outcome).toBe('RUG')
    expect(result.assessments[0].assessment.evidenceIds).toContain('new')
  })
})
