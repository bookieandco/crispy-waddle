import type { TokenLaunch } from './wallet-launch-pipeline'
import type { ActorMovement } from './historical-observation-backfill'

export type HeliusHistoricalSourceOptions = { apiKey: string; baseUrl?: string; fetchImpl?: typeof fetch }

export class HeliusHistoricalSource {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  constructor(private readonly options: HeliusHistoricalSourceOptions) { this.baseUrl = options.baseUrl ?? 'https://mainnet.helius-rpc.com'; this.fetchImpl = options.fetchImpl ?? fetch }

  private async rpc(method: string, params: unknown[]): Promise<any> {
    const response = await this.fetchImpl(`${this.baseUrl}/?api-key=${encodeURIComponent(this.options.apiKey)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: `shark-${method}`, method, params }) })
    if (!response.ok) throw new Error(`Helius historical request failed: ${response.status}`)
    const json = await response.json()
    if (json.error) throw new Error(`Helius historical RPC ${method} failed`)
    return json.result
  }

  async deployerTransfers(launch: TokenLaunch): Promise<ActorMovement[]> {
    if (!launch.deployerWalletId) return []
    const result = await this.rpc('getTransfersByAddress', [launch.deployerWalletId, { mint: launch.tokenAddress, filters: { blockTime: { gte: Math.floor(Date.parse(launch.launchedAt) / 1000) }, status: 'succeeded' }, limit: 100 }])
    const rows = Array.isArray(result?.data) ? result.data : []
    return rows.map((row: any) => {
      const direction = row.fromUserAccount === launch.deployerWalletId ? 'TRANSFER_OUT' : row.toUserAccount === launch.deployerWalletId ? 'TRANSFER_IN' : undefined
      if (!direction) return undefined
      const seconds = Number(row.blockTime ?? 0)
      const observedAt = Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : launch.launchedAt
      const tokenAmount = Number(row.tokenAmount ?? row.amount ?? NaN)
      return { observedAt, actorId: launch.deployerWalletId!, direction, tokenAmount: Number.isFinite(tokenAmount) ? tokenAmount : undefined, source: 'helius-transfers', evidenceId: `helius:transfer:${row.signature ?? `${launch.launchId}:${seconds}`}` }
    }).filter((movement: ActorMovement | undefined): movement is ActorMovement => movement !== undefined)
  }
}
