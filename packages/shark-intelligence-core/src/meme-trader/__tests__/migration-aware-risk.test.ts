import { describe, expect, it } from 'vitest'
import { assessMigrationAwareRisk } from '../migration-aware-risk'
import type { MigrationAwareClassification } from '../migration-classification'

const base = {
  lpControlRisk: {
    lpOwnerKnown: true,
    lpOwnerIsDeployer: true,
    withdrawalObserved: true,
    liquidityHistory: { drawdownFromPeak: 0.9, drainRate: 0.4, drainAcceleration: 0.2 },
    evidenceIds: ['lp-1'],
  },
  rugProtection: {
    liquidityDrainRate: 0.4,
    liquidityDrainAcceleration: 0.2,
    liquidityDrawdownFromPeak: 0.9,
    evidence: [{ source: 'dex', observedAt: '2026-09-02T10:00:00Z', label: 'market-1' }],
  },
}

const migration: MigrationAwareClassification = {
  kind: 'LEGITIMATE_MIGRATION',
  confidence: 0.95,
  evidenceIds: ['migration-1'],
  migrationId: 'migration-1',
  reason: 'legitimate_migration:migration-1',
  hardBlockRug: false,
}

describe('migration-aware risk wiring', () => {
  it('suppresses withdrawal and drain escalation for a verified migration', () => {
    const result = assessMigrationAwareRisk({ ...base, migrationClassification: migration })
    expect(result.migrationSuppressedLiquidityRisk).toBe(true)
    expect(result.lpControlRisk.reasons).not.toContain('historical-liquidity-withdrawal-observed')
    expect(result.lpControlRisk.reasons).not.toContain('rapid-liquidity-drain')
    expect(result.rugProtection.hardBlockers).not.toContain('liquidity is draining rapidly (0.4)')
    expect(result.rugProtection.disposition).not.toBe('BLOCK')
    expect(result.lpControlRisk.evidenceIds).toContain('migration-1')
  })

  it('keeps ordinary liquidity-removal risk active without migration evidence', () => {
    const result = assessMigrationAwareRisk(base)
    expect(result.migrationSuppressedLiquidityRisk).toBe(false)
    expect(result.lpControlRisk.reasons).toContain('historical-liquidity-withdrawal-observed')
    expect(result.lpControlRisk.reasons).toContain('rapid-liquidity-drain')
    expect(result.rugProtection.disposition).toBe('BLOCK')
  })

  it('does not let low-confidence migration evidence suppress risk', () => {
    const result = assessMigrationAwareRisk({
      ...base,
      migrationClassification: { ...migration, confidence: 0.69 },
    })
    expect(result.migrationSuppressedLiquidityRisk).toBe(false)
    expect(result.lpControlRisk.reasons).toContain('rapid-liquidity-drain')
  })

  it('does not suppress unrelated contract risk during migration', () => {
    const result = assessMigrationAwareRisk({
      ...base,
      migrationClassification: migration,
      rugProtection: { ...base.rugProtection, nonTransferable: true },
    })
    expect(result.migrationSuppressedLiquidityRisk).toBe(true)
    expect(result.rugProtection.disposition).toBe('BLOCK')
    expect(result.rugProtection.hardBlockers).toContain('token is non-transferable')
  })
})
