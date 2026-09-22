import { describe, expect, it } from 'vitest'
import { deriveActorOutcomeHistories, evaluateLaunchOutcomeBatch } from '../launch-outcome-worker'
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

describe('deriveActorOutcomeHistories', () => {
  it('groups Base actor history by canonical wallet identity across checksum casing', () => {
    const upper = '0xFfEeDd0000000000000000000000000000005678'
    const lower = '0xffeedd0000000000000000000000000000005678'
    const histories = deriveActorOutcomeHistories([
      launch({
        launchId: 'base-a',
        chainId: 'base-mainnet',
        tokenAddress: '0xabcdef0000000000000000000000000000001111',
        deployerWalletId: upper,
        outcome: 'RUG',
        developerEntityId: undefined,
        clusterId: undefined,
      }),
      launch({
        launchId: 'base-b',
        chainId: 'base-mainnet',
        tokenAddress: '0xabcdef0000000000000000000000000000002222',
        deployerWalletId: lower,
        outcome: 'HEALTHY',
        developerEntityId: undefined,
        clusterId: undefined,
      }),
    ])

    const wallet = histories.find(x => x.actorKey === `wallet:${lower}`)
    expect(histories.filter(x => x.actorKind === 'wallet')).toHaveLength(1)
    expect(wallet?.history.launches).toBe(2)
    expect(wallet?.history.rugRate).toBe(.5)
  })
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

  it('derives canonical actor history from the full launch set instead of a recent worker window', () => {
    const histories = deriveActorOutcomeHistories([
      launch({ launchId: 'old-rug', tokenAddress: 'OLD', outcome: 'RUG', evidenceIds: ['old-evidence'] }),
      launch({ launchId: 'recent-healthy', tokenAddress: 'RECENT', outcome: 'HEALTHY', evidenceIds: ['recent-evidence'] }),
    ])

    const developer = histories.find(x => x.actorKey === 'developer:developer-1')
    expect(developer?.history.launches).toBe(2)
    expect(developer?.history.badLaunches).toBe(1)
    expect(developer?.history.healthyLaunches).toBe(1)
    expect(developer?.history.rugRate).toBe(.5)
    expect(developer?.history.evidenceIds).toEqual(expect.arrayContaining(['old-evidence', 'recent-evidence']))
  })
})
