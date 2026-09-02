import type { LPWithdrawalAttribution } from './lp-withdrawal-attribution'

export type MigrationKind =
  | 'LEGITIMATE_MIGRATION'
  | 'POOL_MIGRATION'
  | 'LIQUIDITY_REMOVAL'
  | 'RUG'
  | 'FAILED_LAUNCH'
  | 'PUMP_AND_DUMP'
  | 'UNKNOWN'

export type TokenMigrationEvidence = {
  migrationId: string
  oldToken: string
  newToken: string
  migrationProgram?: string
  migrationObservedAt: string
  exchangeRatio?: number
  sourcePool?: string
  destinationPool?: string
  evidenceIds: string[]
  confidence: number
  kind: 'TOKEN_MIGRATION' | 'POOL_MIGRATION'
}

export type MigrationAwareClassification = {
  kind: MigrationKind
  confidence: number
  evidenceIds: string[]
  migrationId?: string
  withdrawalEventId?: string
  withdrawalSignature?: string
  reason: string
  hardBlockRug: boolean
}

const clamp = (n: number) => Math.max(0, Math.min(1, n))

function near(a: string, b: string, windowMs = 10 * 60_000): boolean {
  const aa = Date.parse(a), bb = Date.parse(b)
  return Number.isFinite(aa) && Number.isFinite(bb) && Math.abs(aa - bb) <= windowMs
}

export function classifyMigrationAwareWithdrawal(input: {
  withdrawal: LPWithdrawalAttribution
  migrations?: TokenMigrationEvidence[]
  tokenAddress: string
}): MigrationAwareClassification {
  const migrations = input.migrations ?? []
  const matching = migrations.filter(m =>
    (m.oldToken === input.tokenAddress || m.sourcePool === input.withdrawal.poolAddress) &&
    near(m.migrationObservedAt, input.withdrawal.observedAt),
  ).sort((a, b) => b.confidence - a.confidence)[0]

  const evidenceIds = [...new Set([
    ...input.withdrawal.evidenceIds,
    ...(matching?.evidenceIds ?? []),
  ])]

  if (matching && matching.confidence >= 0.7) {
    const kind: MigrationKind = matching.kind === 'TOKEN_MIGRATION'
      ? 'LEGITIMATE_MIGRATION'
      : 'POOL_MIGRATION'
    return {
      kind,
      confidence: clamp(Math.min(input.withdrawal.confidence, matching.confidence)),
      evidenceIds,
      migrationId: matching.migrationId,
      withdrawalEventId: input.withdrawal.raydiumWithdrawalEventId,
      withdrawalSignature: input.withdrawal.signature,
      reason: `${kind.toLowerCase()}:${matching.migrationId}`,
      hardBlockRug: false,
    }
  }

  return {
    kind: 'LIQUIDITY_REMOVAL',
    confidence: clamp(input.withdrawal.confidence),
    evidenceIds,
    withdrawalEventId: input.withdrawal.raydiumWithdrawalEventId,
    withdrawalSignature: input.withdrawal.signature,
    reason: 'no-verified-migration-evidence',
    hardBlockRug: false,
  }
}
