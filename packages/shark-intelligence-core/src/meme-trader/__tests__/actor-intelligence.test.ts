import { describe, expect, it } from 'vitest'
import { buildEntityGraph, deriveTokenActorGraph } from '../entity-graph'
import { ingestTokenLaunch, resetTokenLaunchIngestForTests } from '../token-launch-ingest'
import { applyActorRiskIntelligence } from '../actor-risk-integration'

describe('actor intelligence graph and launch ingestion', () => {
  it('clusters wallets connected by funding relationships', () => {
    const graph = buildEntityGraph([
      { id: 'w1', kind: 'wallet', observedAt: '2026-01-01T00:00:00Z', confidence: 1, evidenceIds: ['e1'] },
      { id: 'w2', kind: 'wallet', observedAt: '2026-01-01T00:00:00Z', confidence: 1, evidenceIds: ['e2'] },
    ], [{ id: 'f1', from: 'w1', to: 'w2', relation: 'funded-by', observedAt: '2026-01-01T00:00:00Z', confidence: .9, evidenceIds: ['e3'] }])
    expect(graph.clusters).toHaveLength(1)
    expect(graph.clusters[0].nodeIds).toEqual(expect.arrayContaining(['w1', 'w2']))
  })

  it('ingests a token launch once and preserves actor evidence', () => {
    resetTokenLaunchIngestForTests()
    const first = ingestTokenLaunch({ observationId: 'obs1', chainId: 'solana', tokenAddress: 'TokenA', observedAt: '2026-01-01T00:00:00Z', deployerWalletId: 'dev1', funderWalletIds: ['fund1'], liquidityProviderWalletIds: ['lp1'], earlyBuyerWalletIds: ['buyer1'], evidenceIds: ['e1'], source: 'launch-source' })
    const second = ingestTokenLaunch({ observationId: 'obs2', chainId: 'solana', tokenAddress: 'TokenA', observedAt: '2026-01-01T00:01:00Z', deployerWalletId: 'dev1', evidenceIds: ['e2'], source: 'launch-source' })
    expect(first.duplicate).toBe(false)
    expect(second.duplicate).toBe(true)
    expect(first.launch.outcome).toBe('UNKNOWN')
    expect(first.graph.edges.some(e => e.relation === 'deployed')).toBe(true)
    expect(first.launch.evidenceIds).toEqual(expect.arrayContaining(['obs1', 'e1']))
  })

  it('feeds historical actor risk and LP control into the assessment', () => {
    const base = {
      assessmentId: 'a1', assessedAt: '2026-01-01T00:00:00Z', token: { chainId: 'solana', tokenAddress: 'TokenA' }, tradeType: 'new-pair-speculation' as const,
      marketActivityQuality: { score: .8, volumeScore: .8, liquidityScore: .8, flowScore: .8, manipulationPenalty: 0, reasons: [] }, supplyControl: { score: 0, deployerRisk: 0, concentrationRisk: 0, bundledSupplyRisk: 0, liquidityControlRisk: 0, reasons: [] }, holderCohort: { score: .5, profitableTrackedWallets: 0, accumulatingWallets: 0, distributingWallets: 0, reasons: [] }, attention: { score: .8, crossSourceConfirmation: .8, engagementQuality: .8, sourceCredibility: .8, manipulationPenalty: 0, reasons: [] }, strategyFit: { score: .8, matchedSignals: [], conflicts: [] }, riskAssessment: { marketIntegrity: .1, liquidityRisk: .1, supplyControlRisk: 0, holderConcentrationRisk: .1, walletCohortRisk: 0, socialManipulationRisk: 0, narrativeFragilityRisk: .1, developerRisk: 0, contractRisk: 0, networkRisk: .1, attentionQuality: .8, exitLiquidityRisk: .1, overallRisk: .1, band: 'candidate' as const }, thesis: 'test', invalidation: { conditions: ['liquidity loss'], severity: 'high' as const }, positionPlan: { maxPositionFraction: .01, entryConditions: [], profitTakingConditions: [], exitConditions: [] }, confidence: .5, evidenceIds: ['m1'], assessmentVersion: 'test'
    }
    const enriched = applyActorRiskIntelligence(base, { launchBehavior: [{ walletId: 'dev1', priorLaunches: 10, healthyLaunches: 2, badLaunches: 8, rugRate: .8, evidenceIds: ['actor1'], confidence: 1 }], lpControlRisk: { score: .8, band: 'critical', controllableLiquidityPct: 1, lockExpiryRisk: 0, withdrawalRisk: 0, reasons: [], evidenceIds: ['lp1'] }, rugProtection: { disposition: 'BLOCK', score: 100, hardBlockers: ['LP control risk is critical'], warnings: [], evidenceIds: ['rug1'] }, evidenceIds: ['actor-root'] })
    expect(enriched.supplyControl.deployerRisk).toBe(.8)
    expect(enriched.supplyControl.liquidityControlRisk).toBe(.8)
    expect(enriched.riskAssessment.band).toBe('blocked')
    expect(enriched.evidenceIds).toEqual(expect.arrayContaining(['actor1', 'lp1', 'rug1']))
  })

  it('keeps the graph observational only', () => {
    const graph = deriveTokenActorGraph({ chainId: 'solana', tokenAddress: 'TokenB', observedAt: '2026-01-01T00:00:00Z', deployerWalletId: 'dev2', earlyBuyerWalletIds: ['b1'], evidenceIds: ['e'] })
    expect(graph.nodes.some(n => n.kind === 'token')).toBe(true)
    expect(graph.edges.some(e => e.relation === 'bought-early')).toBe(true)
    expect(JSON.stringify(graph)).not.toContain('execute')
  })
})
