/**
 * SHARK-BOTS.PAPER.02 — SniperBot is a specialist consuming canonical
 * SHARK's existing actor-aware assessment and Pump migration radar.
 *
 * No new score engine, duplicate paper-fill calculator, quote request,
 * trading intent, wallet access or actionable entry authorization.
 */
import type { DecisionDisposition } from '@jhadina/core-spine'
import {
  assessmentToDecisionProposal,
  type MemeTradeAssessment,
  type PumpMigrationRadarCandidate,
} from '@jhadina/shark-intelligence-core/meme-trader'
import {
  parseResearchUtc,
  validateSharkBotPaperContext,
  type SharkBotPaperContext,
  SHARK_BOTS_PAPER_AUTHORITY,
} from './bots-paper-context'

export type SniperBotPaperInput = Readonly<{
  assessment?: MemeTradeAssessment
  migration?: PumpMigrationRadarCandidate
}>

export type SniperBotPaperReview = Readonly<{
  schema: 'SHARK-SNIPER-PAPER-02'
  specialist: 'SNIPER_BOT'
  caseId: string
  receiptIdentity: string
  tokenMint: string
  pairAddress: string
  asOf: string
  disposition: 'WATCH_PAPER' | 'DEFER' | 'BLOCK'
  canonicalDecisionId: string | null
  canonicalDisposition: DecisionDisposition | null
  migrationStage: PumpMigrationRadarCandidate['stage'] | null
  reasons: readonly string[]
  evidenceIds: readonly string[]
  availableAt: string
  informationBasis: 'POINT_IN_TIME_RESEARCH_NOT_EXECUTABLE_ROUTE'
  simulatedFills: 0
  actualFills: 0
  sourcePriceConfirmsSellability: false
  canEnterLivePosition: false
  canEnterPaperPosition: false
  authority: typeof SHARK_BOTS_PAPER_AUTHORITY
}>

const MAX_PAPER_FRESHNESS_MS = 15 * 60 * 1000

export function buildSniperBotPaperReview(
  context: SharkBotPaperContext,
  input: SniperBotPaperInput = {},
): SniperBotPaperReview {
  const validated = validateSharkBotPaperContext(context)
  const reasons: string[] = []
  const assessment = input.assessment
  const migration = input.migration
  let canonicalDecisionId: string | null = null
  let canonicalDisposition: SniperBotPaperReview['canonicalDisposition'] = null

  if (assessment) {
    const assessedAtMs = parseResearchUtc(assessment.assessedAt, 'ASSESSMENT_TIME')
    if (assessment.token.tokenAddress !== validated.source.tokenMint ||
        !['solana', 'solana-mainnet'].includes(assessment.token.chainId) ||
        !assessment.assessmentId || !Array.isArray(assessment.evidenceIds) ||
        !assessment.evidenceIds.includes(validated.source.evidenceId) ||
        assessedAtMs < validated.availableAtMs || assessedAtMs > validated.asOfMs) {
      throw new Error('SHARK_SNIPER_ASSESSMENT_LINEAGE_INVALID')
    }
    const decision = assessmentToDecisionProposal(assessment, { contextId: validated.caseId })
    canonicalDecisionId = decision.id
    canonicalDisposition = decision.disposition
    if (decision.disposition !== 'ASK') reasons.push('canonical-assessment-not-reviewable')
  } else {
    reasons.push('missing-canonical-actor-aware-assessment')
  }

  if (migration) {
    const observedMs = parseResearchUtc(migration.observedAt, 'MIGRATION_OBSERVED')
    const availableMs = parseResearchUtc(migration.availableAt, 'MIGRATION_AVAILABLE')
    if (migration.mint !== validated.source.tokenMint ||
        observedMs > availableMs || availableMs > validated.asOfMs ||
        migration.authority !== 'RESEARCH_ONLY' ||
        migration.canAuthorizeTrade !== false ||
        !migration.evidenceIds.includes(validated.source.evidenceId)) {
      throw new Error('SHARK_SNIPER_MIGRATION_LINEAGE_INVALID')
    }
    if (migration.disposition === 'BLOCK') reasons.push('migration-defense-block')
    if (migration.disposition === 'REVIEW') reasons.push('migration-checks-incomplete')
    reasons.push(...migration.blockers.map(b => 'migration-block:' + b))
    reasons.push(...migration.missingChecks.map(b => 'migration-missing:' + b))
  } else {
    reasons.push('missing-point-in-time-migration-evidence')
  }

  if (validated.source.sourceClass !== 'SHARK_CANONICAL_RESEARCH') {
    reasons.push('dex-only-sampler-is-not-a-canonical-risk-assessment')
  }
  if (validated.asOfMs - validated.availableAtMs > MAX_PAPER_FRESHNESS_MS) {
    reasons.push('market-snapshot-too-old-for-15-minute-paper-review')
  }

  const disposition: SniperBotPaperReview['disposition'] =
    canonicalDisposition === 'DECLINE' || migration?.disposition === 'BLOCK'
      ? 'BLOCK'
      : canonicalDisposition === 'ASK' && migration?.disposition === 'WATCH' &&
        validated.source.sourceClass === 'SHARK_CANONICAL_RESEARCH' &&
        validated.asOfMs - validated.availableAtMs <= MAX_PAPER_FRESHNESS_MS
        ? 'WATCH_PAPER' : 'DEFER'

  return Object.freeze({
    schema: 'SHARK-SNIPER-PAPER-02' as const,
    specialist: 'SNIPER_BOT' as const,
    caseId: validated.caseId,
    receiptIdentity: validated.receiptIdentity + ':sniper',
    tokenMint: validated.source.tokenMint,
    pairAddress: validated.source.pairAddress,
    asOf: validated.asOf,
    disposition,
    canonicalDecisionId,
    canonicalDisposition,
    migrationStage: migration?.stage ?? null,
    reasons: Object.freeze([...new Set(reasons)]),
    evidenceIds: Object.freeze([...new Set([
      ...validated.source.evidenceIds,
      ...(assessment?.evidenceIds ?? []),
      ...(migration?.evidenceIds ?? []),
    ])].sort()),
    availableAt: validated.source.availableAt,
    informationBasis: 'POINT_IN_TIME_RESEARCH_NOT_EXECUTABLE_ROUTE' as const,
    simulatedFills: 0 as const,
    actualFills: 0 as const,
    sourcePriceConfirmsSellability: false as const,
    canEnterLivePosition: false as const,
    canEnterPaperPosition: false as const,
    authority: SHARK_BOTS_PAPER_AUTHORITY,
  })
}
