import { assessLPControlRisk, type LPControlRisk, type LPControlRiskInput } from './lp-control-risk'
import { evaluateRugProtection, type RugProtectionInput, type RugProtectionResult } from './rug-protection'
import type { MigrationAwareClassification } from './migration-classification'

export type MigrationAwareRiskInput = {
  lpControlRisk: LPControlRiskInput
  rugProtection: Omit<RugProtectionInput, 'lpControlRisk' | 'lpControlRiskScore' | 'lpControlRiskBand'>
  migrationClassification?: MigrationAwareClassification
}

export type MigrationAwareRiskResult = {
  lpControlRisk: LPControlRisk
  rugProtection: RugProtectionResult
  migrationSuppressedLiquidityRisk: boolean
}

const VERIFIED_MIGRATIONS = new Set(['LEGITIMATE_MIGRATION', 'POOL_MIGRATION'])

function isVerifiedMigration(classification?: MigrationAwareClassification): boolean {
  return !!classification && classification.confidence >= 0.7 && VERIFIED_MIGRATIONS.has(classification.kind) && classification.hardBlockRug === false
}

/**
 * Wires verified migration evidence into both LP control and rug protection.
 * Migration suppresses only liquidity-withdrawal/drain signals caused by the
 * migration; independent contract, supply, holder, authority and control
 * risks remain active.
 */
export function assessMigrationAwareRisk(input: MigrationAwareRiskInput): MigrationAwareRiskResult {
  const migrated = isVerifiedMigration(input.migrationClassification)
  const migrationEvidence = input.migrationClassification?.evidenceIds ?? []

  const lpInput: LPControlRiskInput = {
    ...input.lpControlRisk,
    withdrawalObserved: migrated ? false : input.lpControlRisk.withdrawalObserved,
    liquidityHistory: migrated ? undefined : input.lpControlRisk.liquidityHistory,
    evidenceIds: [...new Set([...input.lpControlRisk.evidenceIds, ...migrationEvidence])],
  }
  const lpControlRisk = assessLPControlRisk(lpInput)

  const rugInput: RugProtectionInput = {
    ...input.rugProtection,
    liquidityDrainRate: migrated ? undefined : input.rugProtection.liquidityDrainRate,
    liquidityDrainAcceleration: migrated ? undefined : input.rugProtection.liquidityDrainAcceleration,
    liquidityDrawdownFromPeak: migrated ? undefined : input.rugProtection.liquidityDrawdownFromPeak,
    liquidityHistory: migrated ? undefined : input.rugProtection.liquidityHistory,
    lpControlRisk,
    evidence: [
      ...input.rugProtection.evidence,
      ...(migrated ? [{ source: 'migration-classification', observedAt: new Date().toISOString(), label: input.migrationClassification?.reason ?? 'verified-migration' }] : []),
    ],
  }
  const rugProtection = evaluateRugProtection(rugInput)
  return { lpControlRisk, rugProtection, migrationSuppressedLiquidityRisk: migrated }
}
