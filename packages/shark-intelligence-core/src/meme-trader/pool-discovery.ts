import type { TokenLaunch } from './wallet-launch-pipeline'

export type PoolAccountMetadata = { address: string; role: 'pool' | 'token-vault' | 'lp-vault' | 'authority'; mint?: string; source: string; evidenceId: string }
export type PoolCandidate = { poolAddress: string; dexId?: string; programId?: string; baseMint?: string; quoteMint?: string; liquidityUsd?: number; observedAt: string; source: string; evidenceId: string; metadata?: { accounts?: PoolAccountMetadata[] } }
export interface PoolDiscoverySource { discoverPools(launch: TokenLaunch): Promise<PoolCandidate[]> }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) }
function stringValue(value: unknown): string | undefined { return typeof value === 'string' && value.length > 0 ? value : undefined }
const PROGRAM_IDS: Record<string, string> = {
  raydium: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  pumpswap: 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA',
  meteora: 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
  meteora_dlmm: 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
}
function nonNegativeFinite(value: unknown): value is number { return finite(value) && value >= 0 }

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
    const candidates = body.flatMap((raw, index) => {
      if (!raw || typeof raw !== 'object') return []
      const pair = raw as Record<string, unknown>
      const pairChainId = stringValue(pair.chainId)?.toLowerCase()
      if (pairChainId !== launch.chainId.toLowerCase()) return []
      const baseToken = pair.baseToken && typeof pair.baseToken === 'object' ? pair.baseToken as Record<string, unknown> : undefined
      const quoteToken = pair.quoteToken && typeof pair.quoteToken === 'object' ? pair.quoteToken as Record<string, unknown> : undefined
      const poolAddress = stringValue(pair.pairAddress); if (!poolAddress) return []
      const dexId = stringValue(pair.dexId)?.toLowerCase()
      const programId = dexId ? PROGRAM_IDS[dexId] : undefined
      const baseMint = stringValue(baseToken?.address), quoteMint = stringValue(quoteToken?.address)
      if (baseMint !== launch.tokenAddress && quoteMint !== launch.tokenAddress) return []
      const liquidity = pair.liquidity && typeof pair.liquidity === 'object' ? pair.liquidity as Record<string, unknown> : undefined
      const liquidityUsd = nonNegativeFinite(liquidity?.usd) ? liquidity.usd : undefined
      return [{ poolAddress, dexId, programId, baseMint, quoteMint, liquidityUsd, observedAt, source: 'dexscreener-pool-discovery', evidenceId: `dexscreener:pool:${launch.chainId}:${launch.tokenAddress}:${poolAddress}:${observedAt}:${index}` }]
    })
    const byPool = new Map<string, PoolCandidate>()
    for (const candidate of candidates) {
      const existing = byPool.get(candidate.poolAddress)
      if (!existing || (existing.liquidityUsd === undefined && candidate.liquidityUsd !== undefined)) byPool.set(candidate.poolAddress, candidate)
    }
    return [...byPool.values()]
  }
}
