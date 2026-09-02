import type { TokenLaunch } from './wallet-launch-pipeline'

export type PoolCandidate = {
  poolAddress: string
  dexId?: string
  programId?: string
  baseMint?: string
  quoteMint?: string
  liquidityUsd?: number
  observedAt: string
  source: string
  evidenceId: string
}

export interface PoolDiscoverySource {
  discoverPools(launch: TokenLaunch): Promise<PoolCandidate[]>
}

function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) }
function stringValue(value: unknown): string | undefined { return typeof value === 'string' && value.length > 0 ? value : undefined }

/** DexScreener discovers candidate pools only; it is not a historical reserve or LP-control oracle. */
export class DexScreenerPoolDiscoverySource implements PoolDiscoverySource {
  constructor(private readonly options: { baseUrl?: string; fetchImpl?: typeof fetch; now?: () => string } = {}) {}

  async discoverPools(launch: TokenLaunch): Promise<PoolCandidate[]> {
    const fetchImpl = this.options.fetchImpl ?? fetch
    const baseUrl = this.options.baseUrl ?? 'https://api.dexscreener.com'
    const response = await fetchImpl(`${baseUrl}/token-pairs/v1/${encodeURIComponent(launch.chainId)}/${encodeURIComponent(launch.tokenAddress)}`)
    if (!response.ok) throw new Error(`DexScreener pool discovery failed: ${response.status}`)
    const body: unknown = await response.json()
    if (!Array.isArray(body)) return []
    const observedAt = this.options.now?.() ?? new Date().toISOString()
    return body.flatMap((raw, index) => {
      if (!raw || typeof raw !== 'object') return []
      const pair = raw as Record<string, unknown>
      const baseToken = pair.baseToken && typeof pair.baseToken === 'object' ? pair.baseToken as Record<string, unknown> : undefined
      const quoteToken = pair.quoteToken && typeof pair.quoteToken === 'object' ? pair.quoteToken as Record<string, unknown> : undefined
      const poolAddress = stringValue(pair.pairAddress)
      if (!poolAddress) return []
      const liquidity = pair.liquidity && typeof pair.liquidity === 'object' ? pair.liquidity as Record<string, unknown> : undefined
      return [{
        poolAddress,
        dexId: stringValue(pair.dexId),
        baseMint: stringValue(baseToken?.address),
        quoteMint: stringValue(quoteToken?.address),
        liquidityUsd: finite(liquidity?.usd) ? liquidity.usd : undefined,
        observedAt,
        source: 'dexscreener-pool-discovery',
        evidenceId: `dexscreener:pool:${launch.tokenAddress}:${poolAddress}:${observedAt}:${index}`,
      }]
    })
  }
}
