import { describe, expect, it } from 'vitest'
import { applyActorRiskIntelligence } from '../actor-risk-integration'
import type { LPWithdrawalAttribution } from '../lp-withdrawal-attribution'
import type { MigrationAwareClassification } from '../migration-classification'

const base = {
  assessmentId: 'migration-actor', assessedAt: '2026-01-01T00:00:00Z', token: { chainId: 'solana', tokenAddress: 'TokenA' }, tradeType: 'new-pair-speculation' as const,
  marketActivityQuality: { score: .8, volumeScore: .8, liquidityScore: .8, flowScore: .8, buyerGrowthScore: .8, manipulationPenalty: 0, reasons: [] },
  supplyControl: { score: 0, deployerRisk: 0, concentrationRisk: 0, bundledSupplyRisk: 0, liquidityControlRisk: 0, reasons: [] },
  holderCohort: { score: .8, profitableTrackedWallets: 0, accumulatingWallets: 0, distributingWallets: 0, reasons: [] },
  attention: { score: .8, crossSourceConfirmation: .8, engagementQuality: .8, sourceCredibility: .8, manipulationPenalty: 0, reasons: [] },
  strategyFit: { score: .8, matchedSignals: [], conflicts: [] },
  riskAssessment: { marketIntegrity: .1, liquidityRisk: .1, supplyControlRisk: 0, holderConcentrationRisk: .1, walletCohortRisk: 0, socialManipulationRisk: 0, narrativeFragilityRisk: .1, developerRisk: 0, contractRisk: 0, networkRisk: .1, attentionQuality: .8, exitLiquidityRisk: .1, overallRisk: .1, band: 'candidate' as const },
  thesis: 'test', invalidation: { conditions: ['liquidity loss'], severity: 'high' as const }, positionPlan: { maxPositionFraction: .01, entryConditions: [], profitTakingConditions: [], exitConditions: [] }, confidence: .5, evidenceIds: ['base'], assessmentVersion: 'test'
}

const withdrawal: LPWithdrawalAttribution = {
  signature: 'SIG', observedAt: '2026-01-01T00:00:00Z', poolAddress: 'POOL', lpMint: 'LP', lpTokenAccount: 'LP_ACCOUNT', lpAmountRaw: 1000n,
  ownerBefore: 'DEVELOPER', lpStateEventId: 'lp-event', raydiumWithdrawalEventId: 'withdrawal-event', developerAssociation: 'MATCHED', evidenceIds: ['withdrawal-evidence'], confidence: .9
}

const migration: MigrationAwareClassification = {
  kind: 'LEGITIMATE_MIGRATION', confidence: .9, evidenceIds: ['migration-evidence'], migrationId: 'migration-1',
  withdrawalEventId: 'withdrawal-event', withdrawalSignature: 'SIG', reason: 'legitimate_migration:migration-1', hardBlockRug: false
}

describe('migration-aware actor risk', () => {
  it('suppresses only the developer-withdrawal signal for an exact verified migration', () => {
    const enriched = applyActorRiskIntelligence(base, { verifiedLPWithdrawals: [withdrawal], migrationClassifications: { 'withdrawal-event': migration } })
    expect(enriched.riskAssessment.developerRisk).toBe(0)
    expect(enriched.supplyControl.deployerRisk).toBe(0)
    expect(enriched.supplyControl.reasons).toContain('migration-suppressed-developer-lp-withdrawal:1')
    expect(enriched.evidenceIds).toEqual(expect.arrayContaining(['withdrawal-evidence', 'migration-evidence']))
  })

  it('does not suppress a low-confidence migration', () => {
    const low = { ...migration, confidence: .69 }
    const enriched = applyActorRiskIntelligence(base, { verifiedLPWithdrawals: [withdrawal], migrationClassifications: { 'withdrawal-event': low } })
    expect(enriched.riskAssessment.developerRisk).toBe(.8)
    expect(enriched.supplyControl.deployerRisk).toBe(.8)
  })

  it('preserves independent historical actor risk while suppressing the migration-specific withdrawal signal', () => {
    const enriched = applyActorRiskIntelligence(base, {
      launchBehavior: [{ walletId: 'DEVELOPER', priorLaunches: 10, healthyLaunches: 2, badLaunches: 8, rugRate: .8, evidenceIds: ['history-signal'], confidence: 1 }],
      verifiedLPWithdrawals: [withdrawal], migrationClassifications: { 'withdrawal-event': migration }
    })
    expect(enriched.riskAssessment.developerRisk).toBe(.8)
    expect(enriched.supplyControl.reasons).not.toContain('verified-developer-lp-withdrawal:1')
    expect(enriched.supplyControl.reasons).toContain('historical-actor-bad-launch-rate:.800')
  })

  it('does not suppress when migration identity does not match the withdrawal', () => {
    const unrelated = { ...migration, withdrawalEventId: 'other-event', withdrawalSignature: 'OTHER-SIG' }
    const enriched = applyActorRiskIntelligence(base, { verifiedLPWithdrawals: [withdrawal], migrationClassifications: { 'other-event': unrelated } })
    expect(enriched.riskAssessment.developerRisk).toBe(.8)
    expect(enriched.supplyControl.reasons).toContain('verified-developer-lp-withdrawal:1')
  })

  it('requires a non-blocking verified migration', () => {
    const blocked = { ...migration, hardBlockRug: true }
    const enriched = applyActorRiskIntelligence(base, { verifiedLPWithdrawals: [withdrawal], migrationClassifications: { 'withdrawal-event': blocked } })
    expect(enriched.riskAssessment.developerRisk).toBe(.8)
  })
})
