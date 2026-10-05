import type { StalkChainReadOnlyProvider } from './stalkchain-provider'
import {
  createStalkChainThesisEvidence,
  createStalkChainTraderIdentity,
  rankEmergingStalkChainTraders,
  summarizeStalkChainTraderTrackRecord,
  traderIdentityKey,
  type StalkChainEmergingTraderRank,
  type StalkChainThesisEvidence,
  type StalkChainTraderIdentity,
  type StalkChainTraderPositionOutcome,
  type StalkChainTraderTrackRecord,
} from './stalkchain-trader-intelligence'

export type StalkChainTraderResearchRow = Readonly<{
  identity: StalkChainTraderIdentity
  trackRecord: StalkChainTraderTrackRecord
  theses: readonly StalkChainThesisEvidence[]
}>

export type StalkChainResearchBrief = Readonly<{
  briefId: string
  generatedAt: string
  leaderboardWindow: '24h' | '7d' | '30d' | 'all'
  traders: readonly StalkChainTraderResearchRow[]
  emerging: readonly StalkChainEmergingTraderRank[]
  providerEvidenceIds: readonly string[]
  providerCreditsRemaining?: number
  failures: readonly Readonly<{ subject: string; reason: string }>[]
  authority: 'RESEARCH_ONLY'
  canExecute: false
  canAuthorizeTrade: false
}>

const obj = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined

const text = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined
const num = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined
const bool = (value: unknown): boolean | undefined => typeof value === 'boolean' ? value : undefined
const isoOr = (value: unknown, fallback: string): string => {
  const candidate = text(value)
  return candidate && !Number.isNaN(Date.parse(candidate)) ? candidate : fallback
}
const unique = (values: readonly string[]): readonly string[] => Object.freeze([...new Set(values.filter(Boolean))].sort())

const tokenAddressFromPosition = (row: Record<string, unknown>): string | undefined => {
  const token = obj(row.token)
  return text(token?.address) ?? text(row.tokenAddress) ?? text(row.address)
}

const dataRows = (data: unknown, keys: readonly string[]): readonly unknown[] => {
  if (Array.isArray(data)) return data
  const root = obj(data)
  if (!root) return []
  for (const key of keys) {
    const candidate = root[key]
    if (Array.isArray(candidate)) return candidate
  }
  return []
}

function normalizePosition(
  traderKey: string,
  raw: unknown,
  observedAt: string,
  index: number,
): StalkChainTraderPositionOutcome | undefined {
  const row = obj(raw)
  if (!row) return undefined
  const tokenAddress = tokenAddressFromPosition(row)
  if (!tokenAddress) return undefined
  const openedAt = isoOr(row.openedAt ?? row.createdAt, observedAt)
  const closedAtRaw = text(row.closedAt)
  const closedAt = closedAtRaw && !Number.isNaN(Date.parse(closedAtRaw)) ? closedAtRaw : undefined
  const realizedPnlUsd = num(row.realizedPnlUsd)
  const costBasisUsd = num(row.costBasisUsd)
  const executableReturnBps = realizedPnlUsd !== undefined && costBasisUsd !== undefined && costBasisUsd > 0
    ? realizedPnlUsd / costBasisUsd * 10_000
    : undefined
  const tradeId = text(row.tradeId) ?? text(row.id) ?? String(index)
  return Object.freeze({
    outcomeId: 'stalkchain-position:' + traderKey + ':' + tradeId,
    traderKey,
    tokenAddress,
    chain: text(row.chain),
    openedAt,
    closedAt,
    realizedPnlUsd,
    unrealizedPnlUsd: num(row.unrealizedPnlUsd),
    costBasisUsd,
    executableReturnBps,
    evidenceIds: Object.freeze(['stalkchain:fomo-position:' + tradeId]),
  })
}

function normalizeThesis(
  traderKey: string,
  raw: unknown,
  observedAt: string,
  index: number,
): StalkChainThesisEvidence | undefined {
  const row = obj(raw)
  if (!row) return undefined
  const value = text(row.text ?? row.thesis)
  const token = obj(row.token)
  const tokenAddress = text(row.tokenAddress) ?? text(row.address) ?? text(token?.address)
  if (!value || !tokenAddress) return undefined
  const thesisId = text(row.id) ?? text(row.thesisId) ?? text(row.tradeId) ?? String(index)
  return createStalkChainThesisEvidence({
    thesisId,
    traderKey,
    tokenAddress,
    text: value,
    writtenAt: isoOr(row.ts ?? row.createdAt ?? row.writtenAt, observedAt),
    tradeId: text(row.tradeId),
    positionValueUsd: num(row.equity ?? row.positionValueUsd),
    tradeUsd: num(row.tradeUsd),
    likes: num(row.likes ?? row.thesisLikes),
    isDev: bool(row.isDev),
    evidenceIds: ['stalkchain:fomo-thesis:' + thesisId],
  })
}

export async function runStalkChainTraderResearch(
  provider: StalkChainReadOnlyProvider,
  input: Readonly<{
    generatedAt?: string
    leaderboardWindow?: '24h' | '7d' | '30d' | 'all'
    limit?: number
    positionLimit?: number
    includeTheses?: boolean
    thesisLimit?: number
    followerSoftCap?: number
    minClosedSamples?: number
  }> = {},
): Promise<StalkChainResearchBrief> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  if (Number.isNaN(Date.parse(generatedAt))) throw new Error('stalkchain_research_generated_at_invalid')
  const leaderboardWindow = input.leaderboardWindow ?? '7d'
  const limit = input.limit ?? 10
  const positionLimit = input.positionLimit ?? 100
  const thesisLimit = input.thesisLimit ?? 50
  for (const [name, value, max] of [
    ['limit', limit, 50],
    ['positionLimit', positionLimit, 250],
    ['thesisLimit', thesisLimit, 200],
  ] as const) {
    if (!Number.isInteger(value) || value < 1 || value > max) throw new Error('stalkchain_research_' + name + '_invalid')
  }

  const leaderboard = await provider.call('stalkchain_fomo_leaderboard', { window: leaderboardWindow, limit })
  const leaderboardRows = dataRows(leaderboard.data, ['traders', 'users', 'results'])
  const failures: Array<Readonly<{ subject: string; reason: string }>> = []
  const traders: StalkChainTraderResearchRow[] = []
  const providerEvidenceIds: string[] = ['stalkchain:leaderboard:' + leaderboardWindow + ':' + leaderboard.observedAt]

  for (let index = 0; index < leaderboardRows.length; index++) {
    const row = obj(leaderboardRows[index])
    if (!row) continue
    const handle = text(row.handle)
    if (!handle) continue
    try {
      const wallets = obj(row.wallets)
      const identity = createStalkChainTraderIdentity({
        stableUserId: text(row.userId),
        handle,
        displayName: text(row.displayName),
        solanaWallet: text(wallets?.solana),
        evmWallet: text(wallets?.evm),
        followers: num(row.followers),
        verified: bool(row.verified),
        observedAt: leaderboard.observedAt,
        evidenceId: 'stalkchain:leaderboard-trader:' + (text(row.userId) ?? handle.toLowerCase()),
      })
      const traderKey = traderIdentityKey(identity)
      const positionsResponse = await provider.call('stalkchain_fomo_trader_positions', {
        handle: identity.stableUserId ?? identity.handle,
        limit: positionLimit,
      })
      const positions = dataRows(positionsResponse.data, ['positions', 'trades', 'results'])
        .map((position, positionIndex) => normalizePosition(traderKey, position, positionsResponse.observedAt, positionIndex))
        .filter((position): position is StalkChainTraderPositionOutcome => position !== undefined)
      const trackRecord = summarizeStalkChainTraderTrackRecord(traderKey, positions)
      providerEvidenceIds.push('stalkchain:positions:' + traderKey + ':' + positionsResponse.observedAt)

      let theses: readonly StalkChainThesisEvidence[] = Object.freeze([])
      if (input.includeTheses === true) {
        const thesisResponse = await provider.call('stalkchain_fomo_theses_by_trader', {
          handle: identity.stableUserId ?? identity.handle,
          limit: thesisLimit,
        })
        theses = Object.freeze(dataRows(thesisResponse.data, ['theses', 'results'])
          .map((thesis, thesisIndex) => normalizeThesis(traderKey, thesis, thesisResponse.observedAt, thesisIndex))
          .filter((thesis): thesis is StalkChainThesisEvidence => thesis !== undefined))
        providerEvidenceIds.push('stalkchain:theses:' + traderKey + ':' + thesisResponse.observedAt)
      }

      traders.push(Object.freeze({ identity, trackRecord, theses }))
    } catch (error) {
      failures.push(Object.freeze({
        subject: handle,
        reason: error instanceof Error ? error.message : String(error),
      }))
    }
  }

  const emerging = rankEmergingStalkChainTraders(
    traders.map(row => ({
      traderKey: traderIdentityKey(row.identity),
      followers: row.identity.followers,
      trackRecord: row.trackRecord,
    })),
    { followerSoftCap: input.followerSoftCap, minClosedSamples: input.minClosedSamples },
  )

  return Object.freeze({
    briefId: 'stalkchain-research:' + leaderboardWindow + ':' + generatedAt,
    generatedAt,
    leaderboardWindow,
    traders: Object.freeze(traders),
    emerging,
    providerEvidenceIds: unique(providerEvidenceIds),
    providerCreditsRemaining: leaderboard.creditsRemaining,
    failures: Object.freeze(failures),
    authority: 'RESEARCH_ONLY',
    canExecute: false,
    canAuthorizeTrade: false,
  })
}
