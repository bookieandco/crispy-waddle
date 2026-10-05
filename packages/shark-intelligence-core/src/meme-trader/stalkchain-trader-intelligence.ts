export type StalkChainTraderIdentity = Readonly<{
  stableUserId?: string
  handle: string
  displayName?: string
  solanaWallet?: string
  evmWallet?: string
  followers?: number
  verified?: boolean
  observedAt: string
  evidenceId: string
  authority: 'EVIDENCE_ONLY'
  canAuthorizeTrade: false
}>

export type StalkChainTraderPositionOutcome = Readonly<{
  outcomeId: string
  traderKey: string
  tokenAddress: string
  chain?: string
  openedAt: string
  closedAt?: string
  realizedPnlUsd?: number
  unrealizedPnlUsd?: number
  costBasisUsd?: number
  executableReturnBps?: number
  rug?: boolean
  evidenceIds: readonly string[]
}>

export type StalkChainTraderTrackRecord = Readonly<{
  traderKey: string
  sampleSize: number
  closedSampleSize: number
  distinctTokenCount: number
  profitableCount: number
  losingCount: number
  winRate?: number
  totalRealizedPnlUsd: number
  medianRealizedPnlUsd?: number
  medianExecutableReturnBps?: number
  positiveExecutableRate?: number
  rugParticipationRate?: number
  maxCumulativeDrawdownUsd: number
  largestWinnerShare?: number
  lotteryDependence?: number
  repeatabilityScore?: number
  evidenceIds: readonly string[]
  authority: 'LEARNING_ONLY'
  canAutoCopy: false
  canAuthorizeTrade: false
}>

export type StalkChainThesisEvidence = Readonly<{
  thesisId: string
  traderKey: string
  tokenAddress: string
  text: string
  writtenAt: string
  tradeId?: string
  positionValueUsd?: number
  tradeUsd?: number
  likes?: number
  isDev?: boolean
  evidenceIds: readonly string[]
  authority: 'EVIDENCE_ONLY'
  canAuthorizeTrade: false
}>

const finite = (value: number | undefined, code: string): void => {
  if (value !== undefined && !Number.isFinite(value)) throw new Error(code)
}

const nonNegative = (value: number | undefined, code: string): void => {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) throw new Error(code)
}

const iso = (value: string, code: string): void => {
  if (!value || Number.isNaN(Date.parse(value))) throw new Error(code)
}

const median = (values: readonly number[]): number | undefined => {
  if (!values.length) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[index] : (sorted[index - 1]! + sorted[index]!) / 2
}

const unit = (value: number): number => Math.max(0, Math.min(1, value))

export function createStalkChainTraderIdentity(input: Omit<StalkChainTraderIdentity, 'authority' | 'canAuthorizeTrade'>): StalkChainTraderIdentity {
  const handle = input.handle.trim().replace(/^@/, '')
  if (!handle || !input.evidenceId.trim()) throw new Error('stalkchain_trader_identity_required')
  iso(input.observedAt, 'stalkchain_trader_observed_at_invalid')
  nonNegative(input.followers, 'stalkchain_trader_followers_invalid')
  return Object.freeze({
    ...input,
    handle,
    stableUserId: input.stableUserId?.trim() || undefined,
    displayName: input.displayName?.trim() || undefined,
    solanaWallet: input.solanaWallet?.trim() || undefined,
    evmWallet: input.evmWallet?.trim() || undefined,
    authority: 'EVIDENCE_ONLY',
    canAuthorizeTrade: false,
  })
}

export function traderIdentityKey(identity: StalkChainTraderIdentity): string {
  if (identity.stableUserId) return 'fomo-user:' + identity.stableUserId
  if (identity.solanaWallet) return 'solana:' + identity.solanaWallet
  if (identity.evmWallet) return 'evm:' + identity.evmWallet.toLowerCase()
  return 'fomo-handle:' + identity.handle.toLowerCase()
}

export function createStalkChainThesisEvidence(
  input: Omit<StalkChainThesisEvidence, 'authority' | 'canAuthorizeTrade'>,
): StalkChainThesisEvidence {
  if (!input.thesisId.trim() || !input.traderKey.trim() || !input.tokenAddress.trim() || !input.text.trim()) {
    throw new Error('stalkchain_thesis_identity_required')
  }
  iso(input.writtenAt, 'stalkchain_thesis_written_at_invalid')
  nonNegative(input.positionValueUsd, 'stalkchain_thesis_position_value_invalid')
  nonNegative(input.tradeUsd, 'stalkchain_thesis_trade_value_invalid')
  nonNegative(input.likes, 'stalkchain_thesis_likes_invalid')
  if (!input.evidenceIds.length) throw new Error('stalkchain_thesis_evidence_required')
  return Object.freeze({
    ...input,
    text: input.text.trim(),
    evidenceIds: Object.freeze([...new Set(input.evidenceIds)].sort()),
    authority: 'EVIDENCE_ONLY',
    canAuthorizeTrade: false,
  })
}

export function summarizeStalkChainTraderTrackRecord(
  traderKey: string,
  outcomes: readonly StalkChainTraderPositionOutcome[],
): StalkChainTraderTrackRecord {
  if (!traderKey.trim()) throw new Error('stalkchain_track_record_trader_required')
  const rows = outcomes.filter(row => row.traderKey === traderKey)
  if (rows.length !== outcomes.length) throw new Error('stalkchain_track_record_mixed_identity')

  for (const row of rows) {
    if (!row.outcomeId.trim() || !row.tokenAddress.trim() || !row.evidenceIds.length) throw new Error('stalkchain_track_record_outcome_invalid')
    iso(row.openedAt, 'stalkchain_track_record_opened_at_invalid')
    if (row.closedAt) {
      iso(row.closedAt, 'stalkchain_track_record_closed_at_invalid')
      if (Date.parse(row.closedAt) < Date.parse(row.openedAt)) throw new Error('stalkchain_track_record_clock_invalid')
    }
    finite(row.realizedPnlUsd, 'stalkchain_track_record_pnl_invalid')
    finite(row.unrealizedPnlUsd, 'stalkchain_track_record_pnl_invalid')
    nonNegative(row.costBasisUsd, 'stalkchain_track_record_cost_basis_invalid')
    finite(row.executableReturnBps, 'stalkchain_track_record_return_invalid')
  }

  const closed = rows
    .filter(row => row.closedAt !== undefined || row.realizedPnlUsd !== undefined)
    .sort((a, b) => Date.parse(a.closedAt ?? a.openedAt) - Date.parse(b.closedAt ?? b.openedAt))
  const realized = closed.flatMap(row => row.realizedPnlUsd === undefined ? [] : [row.realizedPnlUsd])
  const executable = closed.flatMap(row => row.executableReturnBps === undefined ? [] : [row.executableReturnBps])
  const profitable = realized.filter(value => value > 0)
  const losses = realized.filter(value => value < 0)
  const totalRealizedPnlUsd = realized.reduce((sum, value) => sum + value, 0)

  let cumulative = 0
  let peak = 0
  let maxCumulativeDrawdownUsd = 0
  for (const value of realized) {
    cumulative += value
    peak = Math.max(peak, cumulative)
    maxCumulativeDrawdownUsd = Math.max(maxCumulativeDrawdownUsd, peak - cumulative)
  }

  const positiveTotal = profitable.reduce((sum, value) => sum + value, 0)
  const largestWinnerShare = positiveTotal > 0 ? Math.max(...profitable) / positiveTotal : undefined
  const lotteryDependence = largestWinnerShare
  const winRate = realized.length ? profitable.length / realized.length : undefined
  const rugObserved = rows.filter(row => row.rug !== undefined)
  const rugParticipationRate = rugObserved.length ? rugObserved.filter(row => row.rug === true).length / rugObserved.length : undefined
  const tokenCount = new Set(rows.map(row => row.tokenAddress)).size
  const breadth = Math.min(1, tokenCount / 12)
  const sampleConfidence = Math.min(1, realized.length / 20)
  const repeatabilityScore = winRate === undefined
    ? undefined
    : unit(
        0.40 * winRate +
        0.25 * (1 - (lotteryDependence ?? 1)) +
        0.20 * breadth +
        0.15 * sampleConfidence,
      )

  return Object.freeze({
    traderKey,
    sampleSize: rows.length,
    closedSampleSize: closed.length,
    distinctTokenCount: tokenCount,
    profitableCount: profitable.length,
    losingCount: losses.length,
    winRate,
    totalRealizedPnlUsd,
    medianRealizedPnlUsd: median(realized),
    medianExecutableReturnBps: median(executable),
    positiveExecutableRate: executable.length ? executable.filter(value => value > 0).length / executable.length : undefined,
    rugParticipationRate,
    maxCumulativeDrawdownUsd,
    largestWinnerShare,
    lotteryDependence,
    repeatabilityScore,
    evidenceIds: Object.freeze([...new Set(rows.flatMap(row => row.evidenceIds))].sort()),
    authority: 'LEARNING_ONLY',
    canAutoCopy: false,
    canAuthorizeTrade: false,
  })
}

export type StalkChainEmergingTraderCandidate = Readonly<{
  traderKey: string
  followers?: number
  trackRecord: StalkChainTraderTrackRecord
}>

export type StalkChainEmergingTraderRank = Readonly<{
  traderKey: string
  score: number
  reasons: readonly string[]
  authority: 'RESEARCH_PRIORITY_ONLY'
  canAutoCopy: false
  canAuthorizeTrade: false
}>

/**
 * Research-priority ranking for discovering repeatable traders before they
 * become maximally crowded. It is intentionally not a copy-trading rule.
 */
export function rankEmergingStalkChainTraders(
  candidates: readonly StalkChainEmergingTraderCandidate[],
  options: Readonly<{ followerSoftCap?: number; minClosedSamples?: number }> = {},
): readonly StalkChainEmergingTraderRank[] {
  const followerSoftCap = options.followerSoftCap ?? 25_000
  const minClosedSamples = options.minClosedSamples ?? 5
  if (!Number.isFinite(followerSoftCap) || followerSoftCap < 1 || !Number.isInteger(minClosedSamples) || minClosedSamples < 1) {
    throw new Error('stalkchain_emerging_rank_options_invalid')
  }

  return Object.freeze(candidates.map(candidate => {
    const record = candidate.trackRecord
    if (record.traderKey !== candidate.traderKey) throw new Error('stalkchain_emerging_rank_identity_mismatch')
    const followers = candidate.followers
    nonNegative(followers, 'stalkchain_emerging_rank_followers_invalid')
    const crowdingPenalty = followers === undefined ? 0.25 : Math.min(1, followers / followerSoftCap)
    const sampleCoverage = Math.min(1, record.closedSampleSize / Math.max(minClosedSamples, 20))
    const repeatability = record.repeatabilityScore ?? 0
    const rugPenalty = record.rugParticipationRate ?? 0
    const score = unit(
      0.55 * repeatability +
      0.20 * sampleCoverage +
      0.15 * (1 - (record.lotteryDependence ?? 1)) +
      0.10 * (1 - crowdingPenalty) -
      0.25 * rugPenalty,
    )
    const reasons: string[] = []
    if (record.closedSampleSize < minClosedSamples) reasons.push('insufficient-closed-sample')
    if ((record.lotteryDependence ?? 1) > 0.6) reasons.push('tail-winner-dependent')
    if (crowdingPenalty > 0.8) reasons.push('high-public-crowding')
    if ((record.rugParticipationRate ?? 0) > 0.2) reasons.push('elevated-rug-participation')
    if ((record.repeatabilityScore ?? 0) >= 0.65) reasons.push('repeatability-supported')

    return Object.freeze({
      traderKey: candidate.traderKey,
      score,
      reasons: Object.freeze(reasons),
      authority: 'RESEARCH_PRIORITY_ONLY' as const,
      canAutoCopy: false as const,
      canAuthorizeTrade: false as const,
    })
  }).sort((a, b) => b.score - a.score))
}
