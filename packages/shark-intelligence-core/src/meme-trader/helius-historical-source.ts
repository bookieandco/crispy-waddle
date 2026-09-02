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
    const result = await this.rpc('getTransfersByAddress', [launch.deployerWalletId, { filters: { mint: launch.tokenAddress, blockTime: { gte: Math.floor(Date.parse(launch.launchedAt) / 1000) } }, limit: 100 }])
    const rows = Array.isArray(result?.data) ? result.data : []
    return rows.map((row: any) => {
      const direction = row.direction === 'out' ? 'TRANSFER_OUT' : row.direction === 'in' ? 'TRANSFER_IN' : 'TRANSFER_IN'
      const timestamp = Number(row.timestamp ?? row.blockTime ?? 0) * (Number(row.timestamp ?? 0) > 10_000_000_000 ? 1 : 1000)
      return { observedAt: new Date(timestamp || Date.parse(launch.launchedAt)).toISOString(), actorId: launch.deployerWalletId!, direction, amountUsd: Number(row.valueUsd ?? row.amountUsd ?? NaN), source: 'helius-transfers', evidenceId: `helius:transfer:${row.signature ?? row.txSignature ?? `${launch.launchId}:${timestamp}`}` }
    })
  }
}
