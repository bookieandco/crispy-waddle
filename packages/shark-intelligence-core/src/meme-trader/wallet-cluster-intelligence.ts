export type WalletClusterTrade = {
  walletId: string
  tokenMint: string
  observedAt: string
  side: 'BUY' | 'SELL'
  valueUsd?: number
  walletScore?: number
  funderIds?: string[]
  infrastructureIds?: string[]
}

export type WalletClusterExclusion = {
  walletId: string
  reason: 'EXCHANGE' | 'MARKET_MAKER' | 'ARBITRAGE' | 'PROTOCOL' | 'COPY_TRADER' | 'KNOWN_INFRASTRUCTURE'
}

export type WalletClusterObservation = {
  clusterId: string
  chainId: string
  tokenMint: string
  wallets: string[]
  walletScores: Record<string, number>
  observedFrom: string
  observedTo: string
  buyCount: number
  sellCount: number
  totalBuyValueUsd?: number
  temporalConcentration: number
  fundingRelationshipScore: number
  sharedInfrastructureScore: number
  behavioralSimilarityScore: number
  crossTokenRelationshipScore: number
  confidence: number
  hypothesis: 'TEMPORAL_CONVERGENCE' | 'COORDINATED_BEHAVIOR' | 'COORDINATED_EXIT'
  evidenceIds: string[]
  exclusions: WalletClusterExclusion[]
  source: string
}

export type WalletClusterConfig = {
  windowSeconds: number
  minWallets: number
  minTotalScore: number
  source: string
}

const DEFAULT_CONFIG: WalletClusterConfig = {
  windowSeconds: 15 * 60,
  minWallets: 3,
  minTotalScore: 0,
  source: 'shark-wallet-cluster-intelligence',
}

function finite01(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function normalizedWalletScore(score: number | undefined): number {
  if (score === undefined || !Number.isFinite(score)) return 0
  return clamp(score > 1 ? score / 10 : score)
}

function stableClusterId(chainId: string, tokenMint: string, wallets: string[], from: string, to: string): string {
  return `wallet-cluster:${chainId}:${tokenMint}:${[...wallets].sort().join(',')}:${from}:${to}`
}

function temporalConcentration(times: number[], windowSeconds: number): number {
  if (times.length < 2) return 0
  const sorted = [...times].sort((a, b) => a - b)
  let best = 1
  let left = 0
  for (let right = 0; right < sorted.length; right += 1) {
    while (sorted[right] - sorted[left] > windowSeconds) left += 1
    best = Math.max(best, right - left + 1)
  }
  return best / sorted.length
}

function overlapScore(values: string[][]): number {
  const usable = values.filter(value => value.length > 0)
  if (usable.length < 2) return 0
  const counts = new Map<string, number>()
  for (const group of usable) for (const value of group) counts.set(value, (counts.get(value) ?? 0) + 1)
  const shared = [...counts.values()].filter(count => count >= 2).length
  return clamp(shared / Math.max(1, usable.length))
}

/**
 * Defensive wallet-cluster detector. A cluster is a confidence-weighted
 * hypothesis about coordinated behavior, never an ownership assertion.
 */
export function detectWalletClusters(
  trades: WalletClusterTrade[],
  options: Partial<WalletClusterConfig> = {},
  exclusions: WalletClusterExclusion[] = [],
): WalletClusterObservation[] {
  const config = { ...DEFAULT_CONFIG, ...options }
  if (config.windowSeconds <= 0 || config.minWallets < 2) return []

  const excluded = new Map(exclusions.map(item => [item.walletId, item]))
  const buys = trades
    .filter(trade => trade.side === 'BUY' && !excluded.has(trade.walletId))
    .filter(trade => Number.isFinite(Date.parse(trade.observedAt)))
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))

  const groups = new Map<string, WalletClusterTrade[]>()
  for (const trade of buys) {
    const current = groups.get(trade.tokenMint) ?? []
    current.push(trade)
    groups.set(trade.tokenMint, current)
  }

  const results: WalletClusterObservation[] = []
  for (const [tokenMint, tokenTrades] of groups) {
    for (let start = 0; start < tokenTrades.length; start += 1) {
      const firstTime = Date.parse(tokenTrades[start].observedAt)
      const windowTrades = tokenTrades.filter(trade => {
        const delta = Date.parse(trade.observedAt) - firstTime
        return delta >= 0 && delta <= config.windowSeconds * 1000
      })
      const byWallet = new Map<string, WalletClusterTrade>()
      for (const trade of windowTrades) if (!byWallet.has(trade.walletId)) byWallet.set(trade.walletId, trade)
      if (byWallet.size < config.minWallets) continue

      const wallets = [...byWallet.keys()].sort()
      const selected = [...byWallet.values()]
      const walletScores = Object.fromEntries(selected.map(trade => [trade.walletId, normalizedWalletScore(trade.walletScore)]))
      const totalScore = Object.values(walletScores).reduce((sum, score) => sum + score, 0)
      if (totalScore < config.minTotalScore) continue

      const times = selected.map(trade => Date.parse(trade.observedAt) / 1000)
      const from = new Date(Math.min(...times) * 1000).toISOString()
      const to = new Date(Math.max(...times) * 1000).toISOString()
      const temporal = temporalConcentration(times, config.windowSeconds)
      const funding = overlapScore(selected.map(trade => trade.funderIds ?? []))
      const infrastructure = overlapScore(selected.map(trade => trade.infrastructureIds ?? []))
      const behavior = temporal
      const confidence = clamp(0.45 * temporal + 0.25 * funding + 0.15 * behavior + 0.15 * (totalScore / Math.max(1, wallets.length)))
      const evidenceIds = [...new Set(selected.flatMap(trade => [`wallet:${trade.walletId}:${trade.observedAt}`, ...(trade.funderIds ?? []).map(id => `funder:${id}`)]))]
      const clusterId = stableClusterId('solana', tokenMint, wallets, from, to)

      results.push({
        clusterId,
        chainId: 'solana',
        tokenMint,
        wallets,
        walletScores,
        observedFrom: from,
        observedTo: to,
        buyCount: selected.length,
        sellCount: 0,
        totalBuyValueUsd: selected.some(trade => trade.valueUsd !== undefined)
          ? selected.reduce((sum, trade) => sum + (trade.valueUsd ?? 0), 0)
          : undefined,
        temporalConcentration: temporal,
        fundingRelationshipScore: funding,
        sharedInfrastructureScore: infrastructure,
        behavioralSimilarityScore: behavior,
        crossTokenRelationshipScore: 0,
        confidence,
        hypothesis: 'TEMPORAL_CONVERGENCE',
        evidenceIds,
        exclusions,
        source: config.source,
      })
      break
    }
  }

  return results.sort((a, b) => Date.parse(a.observedFrom) - Date.parse(b.observedFrom))
}

export function enrichClusterWithCrossTokenRelationship(
  cluster: WalletClusterObservation,
  relatedTrades: WalletClusterTrade[],
): WalletClusterObservation {
  const clusterWallets = new Set(cluster.wallets)
  const relatedTokens = new Set(
    relatedTrades
      .filter(trade => clusterWallets.has(trade.walletId) && trade.tokenMint !== cluster.tokenMint)
      .map(trade => trade.tokenMint),
  )
  const score = clamp(relatedTokens.size / Math.max(1, cluster.wallets.length))
  return { ...cluster, crossTokenRelationshipScore: score }
}
