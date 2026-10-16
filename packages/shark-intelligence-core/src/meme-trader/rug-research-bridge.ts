import type { RugModelSignal } from './rug-self-protection'

/**
 * Historical EVM incident research is an unverified hypothesis ONLY.
 *
 * The upstream dianxiang-sun dataset is old, positive-only, has no
 * verified permissive license, no point-in-time negative controls, and
 * contains no Solana incidents. This adapter cannot issue a calibrated
 * probability, change deterministic protection, or grant Money authority.
 *
 * Consumer: the existing evaluateRugSelfProtection modelSignals option.
 * This module intentionally does not auto-register in any live route.
 */
export const PINNED_RUG_RESEARCH_REVISION = '5a52a33ddb6c5d1a0c52146a633085412b66af7d' as const

export type HistoricalRugResearchInput = Readonly<{
  modelId: string
  sourceRevision: string
  sourceChain: 'ETH' | 'BSC' | 'SOL'
  /** Uncalibrated research ranking in [0, 1], not a rug probability. */
  hypothesisScore: number
  observedAt: string
  availableAt: string
  informationCutoff: string
  evidenceIds: readonly string[]
}>

const ISO_WITH_OFFSET = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/
function instant(value: string, field: string): number {
  if (!ISO_WITH_OFFSET.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error('shark_historical_rug_' + field + '_invalid')
  }
  return Date.parse(value)
}

export function historicalRugResearchSignal(input: HistoricalRugResearchInput): RugModelSignal {
  if (input.sourceRevision !== PINNED_RUG_RESEARCH_REVISION) {
    throw new Error('shark_historical_rug_unpinned_source')
  }
  if (!input.modelId.trim() || !['ETH', 'BSC', 'SOL'].includes(input.sourceChain)) {
    throw new Error('shark_historical_rug_identity_invalid')
  }
  if (!Number.isFinite(input.hypothesisScore) ||
      input.hypothesisScore < 0 || input.hypothesisScore > 1) {
    throw new Error('shark_historical_rug_score_invalid')
  }
  const observed = instant(input.observedAt, 'observation_time')
  const available = instant(input.availableAt, 'availability_time')
  const cutoff = instant(input.informationCutoff, 'cutoff')
  if (observed > available || available > cutoff) {
    throw new Error('shark_historical_rug_lookahead_blocked')
  }
  if (!input.evidenceIds.length ||
      input.evidenceIds.some(id => typeof id !== 'string' || !id.trim())) {
    throw new Error('shark_historical_rug_evidence_required')
  }
  return Object.freeze({
    modelId: input.modelId,
    rugProbability: input.hypothesisScore, // Contract compatibility, NOT calibrated.
    calibration: input.sourceChain === 'SOL' ? 'OUT_OF_DOMAIN' : 'UNVERIFIED',
    evidenceIds: Object.freeze([...new Set(input.evidenceIds)].sort()),
  })
}
