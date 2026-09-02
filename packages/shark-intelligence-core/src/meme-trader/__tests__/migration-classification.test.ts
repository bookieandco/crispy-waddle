import { describe, expect, it } from 'vitest'
import { classifyMigrationAwareWithdrawal, type TokenMigrationEvidence } from '../migration-classification'
import type { LPWithdrawalAttribution } from '../lp-withdrawal-attribution'

const withdrawal: LPWithdrawalAttribution = {
  signature: 'sig-1', observedAt: '2026-09-02T10:00:00.000Z', poolAddress: 'pool-1',
  ownerBefore: 'dev-wallet', lpAmountRaw: 100n, lpStateEventId: 'lp-1',
  evidenceIds: ['withdrawal-1'], confidence: 0.9,
}

const migration: TokenMigrationEvidence = {
  migrationId: 'migration-1', oldToken: 'token-old', newToken: 'token-new',
  migrationObservedAt: '2026-09-02T10:01:00.000Z', sourcePool: 'pool-1',
  destinationPool: 'pool-2', evidenceIds: ['migration-1'], confidence: 0.95,
  kind: 'TOKEN_MIGRATION',
}

describe('classifyMigrationAwareWithdrawal', () => {
  it('does not hard-block a verified token migration as a rug', () => {
    const result = classifyMigrationAwareWithdrawal({ withdrawal, migrations: [migration], tokenAddress: 'token-old' })
    expect(result.kind).toBe('LEGITIMATE_MIGRATION')
    expect(result.hardBlockRug).toBe(false)
    expect(result.migrationId).toBe('migration-1')
    expect(result.evidenceIds).toEqual(expect.arrayContaining(['withdrawal-1', 'migration-1']))
  })

  it('does not invent migration evidence when none is present', () => {
    const result = classifyMigrationAwareWithdrawal({ withdrawal, tokenAddress: 'token-old' })
    expect(result.kind).toBe('LIQUIDITY_REMOVAL')
    expect(result.migrationId).toBeUndefined()
  })

  it('requires high-confidence migration evidence before overriding liquidity-removal classification', () => {
    const lowConfidence = { ...migration, confidence: 0.69 }
    const result = classifyMigrationAwareWithdrawal({ withdrawal, migrations: [lowConfidence], tokenAddress: 'token-old' })
    expect(result.kind).toBe('LIQUIDITY_REMOVAL')
  })
})
