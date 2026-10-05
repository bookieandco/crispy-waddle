import { summarizeTrackedWalletCohort, type TrackedWalletCohortSummary } from './tracked-wallet-cohort'
import { assessCopyTradeReflexivity, observeWalletTradeSignal, type CopyTradeReflexivityAssessment, type CopyTradeVenue } from './copy-trade-observation'

export type StalkChainTrackedHolder = Readonly<{
  evidenceId: string
  tokenAddress: string
  traderKey: string
  walletId: string
  observedAt: string
  availableAt: string
  side?: 'BUY' | 'SELL'
  controlGroupId?: string
  followers?: number
  historicalQualityScore?: number
  historicalSampleSize?: number
  profileFreshnessScore?: number
}>

export type StalkChainHolderFusion = Readonly<{
  tokenAddress: string
  cohort: TrackedWalletCohortSummary
  trackedHolderCount: number
  followerCoverage: number
  meanFollowers?: number
  maxFollowers?: number
  crowdingBand: 'UNKNOWN' | 'LOW' | 'CAUTION' | 'HIGH'
  authority: 'RESEARCH_EVIDENCE_ONLY'
  canAuthorizeTrade: false
  canAutoCopy: false
}>

export type StalkChainKolExitRow = Readonly<{
  evidenceId: string
  traderKey: string
  tokenAddress: string
  state: 'HOLDING' | 'REDUCED' | 'EXITED' | 'UNKNOWN'
  observedAt: string
  positionValueUsd?: number
}>

export type StalkChainExitPressure = Readonly<{
  tokenAddress: string
  sampleSize: number
  holdingCount: number
  reducedCount: number
  exitedCount: number
  unknownCount: number
  knownExitPressure?: number
  valueWeightedExitPressure?: number
  band: 'UNKNOWN' | 'LOW' | 'CAUTION' | 'HIGH'
  evidenceIds: readonly string[]
  authority: 'DEFENSIVE_EVIDENCE_ONLY'
  canAuthorizeTrade: false
}>

export type StalkChainObservedSwap = Readonly<{
  evidenceId: string
  chainId: string
  walletId: string
  tokenAddress: string
  side: 'BUY' | 'SELL'
  venue: CopyTradeVenue
  transactionId: string
  observedAt: string
  availableAt: string
  tokenAmountRaw?: string
  quoteAmountRaw?: string
}>

export type StalkChainVerificationState = Readonly<{
  tokenAddress: string
  providerEvidenceIds: readonly string[]
  independentEvidenceIds: readonly string[]
  contradictions: readonly string[]
  providerClaimsChecked: number
  independentlyCorroboratedClaims: number
  verificationBand: 'UNVERIFIED' | 'PARTIAL' | 'CORROBORATED' | 'CONTRADICTED'
  authority: 'EVIDENCE_ONLY'
  canAuthorizeTrade: false
}>

const iso = (value: string, code: string): void => {
  if (!value || Number.isNaN(Date.parse(value))) throw new Error(code)
}
const nonNegative = (value: number | undefined, code: string): void => {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) throw new Error(code)
}
const unit = (value: number): number => Math.max(0, Math.min(1, value))

export function fuseStalkChainTrackedHolders(input: Readonly<{
  tokenAddress: string
  holders: readonly StalkChainTrackedHolder[]
  informationCutoff: string
  followerSoftCap?: number
}>): StalkChainHolderFusion {
  if (!input.tokenAddress.trim()) throw new Error('stalkchain_holder_fusion_token_required')
  iso(input.informationCutoff, 'stalkchain_holder_fusion_cutoff_invalid')
  const followerSoftCap = input.followerSoftCap ?? 25_000
  if (!Number.isFinite(followerSoftCap) || followerSoftCap < 1) throw new Error('stalkchain_holder_fusion_follower_cap_invalid')

  const eligible = input.holders.filter(holder => Date.parse(holder.availableAt) <= Date.parse(input.informationCutoff))
  const followerValues: number[] = []
  const cohort = summarizeTrackedWalletCohort({
    tokenAddress: input.tokenAddress,
    informationCutoff: input.informationCutoff,
    observations: eligible.map(holder => {
      if (holder.tokenAddress !== input.tokenAddress) throw new Error('stalkchain_holder_fusion_token_mismatch')
      iso(holder.observedAt, 'stalkchain_holder_fusion_observed_at_invalid')
      iso(holder.availableAt, 'stalkchain_holder_fusion_available_at_invalid')
      nonNegative(holder.followers, 'stalkchain_holder_fusion_followers_invalid')
      if (holder.followers !== undefined) followerValues.push(holder.followers)
      const visibility = holder.followers === undefined ? undefined : unit(holder.followers / followerSoftCap)
      return {
        evidenceId: holder.evidenceId,
        walletId: holder.walletId,
        tokenAddress: holder.tokenAddress,
        side: holder.side ?? 'BUY',
        observedAt: holder.observedAt,
        availableAt: holder.availableAt,
        controlGroupId: holder.controlGroupId,
        historicalQualityScore: holder.historicalQualityScore,
        historicalSampleSize: holder.historicalSampleSize,
        profileFreshnessScore: holder.profileFreshnessScore,
        publicVisibilityScore: visibility,
      }
    }),
  })

  const meanFollowers = followerValues.length
    ? followerValues.reduce((sum, value) => sum + value, 0) / followerValues.length
    : undefined
  const maxFollowers = followerValues.length ? Math.max(...followerValues) : undefined
  const publicCrowding = cohort.publicCrowdingScore
  const crowdingBand = publicCrowding === undefined
    ? 'UNKNOWN'
    : publicCrowding >= 0.8
      ? 'HIGH'
      : publicCrowding >= 0.5
        ? 'CAUTION'
        : 'LOW'

  return Object.freeze({
    tokenAddress: input.tokenAddress,
    cohort,
    trackedHolderCount: eligible.length,
    followerCoverage: eligible.length ? followerValues.length / eligible.length : 0,
    meanFollowers,
    maxFollowers,
    crowdingBand,
    authority: 'RESEARCH_EVIDENCE_ONLY',
    canAuthorizeTrade: false,
    canAutoCopy: false,
  })
}

export function assessStalkChainKolExitPressure(rows: readonly StalkChainKolExitRow[]): StalkChainExitPressure {
  if (!rows.length) throw new Error('stalkchain_exit_pressure_rows_required')
  const tokenAddress = rows[0]!.tokenAddress
  if (!tokenAddress.trim() || rows.some(row => row.tokenAddress !== tokenAddress)) throw new Error('stalkchain_exit_pressure_token_mismatch')

  for (const row of rows) {
    if (!row.evidenceId.trim() || !row.traderKey.trim()) throw new Error('stalkchain_exit_pressure_identity_required')
    iso(row.observedAt, 'stalkchain_exit_pressure_observed_at_invalid')
    nonNegative(row.positionValueUsd, 'stalkchain_exit_pressure_value_invalid')
  }

  const holding = rows.filter(row => row.state === 'HOLDING')
  const reduced = rows.filter(row => row.state === 'REDUCED')
  const exited = rows.filter(row => row.state === 'EXITED')
  const unknown = rows.filter(row => row.state === 'UNKNOWN')
  const known = holding.length + reduced.length + exited.length
  const knownExitPressure = known ? (exited.length + 0.5 * reduced.length) / known : undefined

  const weightedKnown = rows.filter(row => row.state !== 'UNKNOWN' && row.positionValueUsd !== undefined)
  const totalWeight = weightedKnown.reduce((sum, row) => sum + row.positionValueUsd!, 0)
  const exitWeight = weightedKnown.reduce((sum, row) => {
    if (row.state === 'EXITED') return sum + row.positionValueUsd!
    if (row.state === 'REDUCED') return sum + 0.5 * row.positionValueUsd!
    return sum
  }, 0)
  const valueWeightedExitPressure = totalWeight > 0 ? exitWeight / totalWeight : undefined
  const pressure = valueWeightedExitPressure ?? knownExitPressure
  const band = pressure === undefined
    ? 'UNKNOWN'
    : pressure >= 0.65
      ? 'HIGH'
      : pressure >= 0.35
        ? 'CAUTION'
        : 'LOW'

  return Object.freeze({
    tokenAddress,
    sampleSize: rows.length,
    holdingCount: holding.length,
    reducedCount: reduced.length,
    exitedCount: exited.length,
    unknownCount: unknown.length,
    knownExitPressure,
    valueWeightedExitPressure,
    band,
    evidenceIds: Object.freeze([...new Set(rows.map(row => row.evidenceId))].sort()),
    authority: 'DEFENSIVE_EVIDENCE_ONLY',
    canAuthorizeTrade: false,
  })
}

export function assessStalkChainSwapReflexivity(
  swaps: readonly StalkChainObservedSwap[],
  options: Readonly<{ rapidWindowMs?: number; smallRepeatFraction?: number }> = {},
): CopyTradeReflexivityAssessment {
  if (!swaps.length) throw new Error('stalkchain_reflexivity_swaps_required')
  const signals = swaps.map(swap => observeWalletTradeSignal({
    evidenceId: swap.evidenceId,
    chainId: swap.chainId,
    walletId: swap.walletId,
    tokenAddress: swap.tokenAddress,
    side: swap.side,
    venue: swap.venue,
    transactionId: swap.transactionId,
    observedAt: swap.observedAt,
    availableAt: swap.availableAt,
    tokenAmountRaw: swap.tokenAmountRaw,
    quoteAmountRaw: swap.quoteAmountRaw,
  }))
  return assessCopyTradeReflexivity(signals, options)
}

/**
 * Independent-verification gate for vendor evidence. Provider observations can
 * increase research priority only after downstream chain/market evidence checks;
 * contradictions dominate missing corroboration.
 */
export function verifyStalkChainTokenEvidence(input: Readonly<{
  tokenAddress: string
  providerEvidenceIds: readonly string[]
  independentEvidenceIds: readonly string[]
  providerClaimsChecked: number
  independentlyCorroboratedClaims: number
  contradictions?: readonly string[]
}>): StalkChainVerificationState {
  if (!input.tokenAddress.trim() || !input.providerEvidenceIds.length) throw new Error('stalkchain_verification_identity_required')
  if (!Number.isInteger(input.providerClaimsChecked) || input.providerClaimsChecked < 1) throw new Error('stalkchain_verification_claim_count_invalid')
  if (!Number.isInteger(input.independentlyCorroboratedClaims) || input.independentlyCorroboratedClaims < 0 || input.independentlyCorroboratedClaims > input.providerClaimsChecked) {
    throw new Error('stalkchain_verification_corroboration_invalid')
  }
  const contradictions = [...new Set(input.contradictions ?? [])].filter(Boolean).sort()
  const ratio = input.independentlyCorroboratedClaims / input.providerClaimsChecked
  const verificationBand = contradictions.length
    ? 'CONTRADICTED'
    : ratio >= 0.8
      ? 'CORROBORATED'
      : ratio > 0
        ? 'PARTIAL'
        : 'UNVERIFIED'

  return Object.freeze({
    tokenAddress: input.tokenAddress,
    providerEvidenceIds: Object.freeze([...new Set(input.providerEvidenceIds)].sort()),
    independentEvidenceIds: Object.freeze([...new Set(input.independentEvidenceIds)].sort()),
    contradictions: Object.freeze(contradictions),
    providerClaimsChecked: input.providerClaimsChecked,
    independentlyCorroboratedClaims: input.independentlyCorroboratedClaims,
    verificationBand,
    authority: 'EVIDENCE_ONLY',
    canAuthorizeTrade: false,
  })
}
