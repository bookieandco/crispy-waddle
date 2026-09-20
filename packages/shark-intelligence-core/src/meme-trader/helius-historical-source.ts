import type { TokenLaunch } from './wallet-launch-pipeline'
import type { ActorMovement } from './historical-observation-backfill'

export type HeliusHistoricalSourceOptions = { apiKey: string; baseUrl?: string; fetchImpl?: typeof fetch; maxPages?: number }

export class HeliusHistoricalSource {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly maxPages: number
  constructor(private readonly options: HeliusHistoricalSourceOptions) {
    this.baseUrl = options.baseUrl ?? 'https://mainnet.helius-rpc.com'
    this.fetchImpl = options.fetchImpl ?? fetch
    this.maxPages = options.maxPages ?? 50
  }

  private async rpc(method: string, params: unknown[]): Promise<any> {
    const response = await this.fetchImpl(`${this.baseUrl}/?api-key=${encodeURIComponent(this.options.apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: `shark-${method}`, method, params }),
    })
    if (!response.ok) throw new Error(`Helius historical request failed: ${response.status}`)
    const json = await response.json()
    if (json.error) throw new Error(`Helius historical RPC ${method} failed`)
    return json.result
  }

  async deployerTransfers(launch: TokenLaunch): Promise<ActorMovement[]> {
    if (!launch.deployerWalletId) return []
    const rows: any[] = []
    let paginationToken: string | undefined

    for (let page = 0; page < this.maxPages; page += 1) {
      const options: Record<string, unknown> = {
        mint: launch.tokenAddress,
        filters: {
          blockTime: { gte: Math.floor(Date.parse(launch.launchedAt) / 1000) },
          status: 'succeeded',
        },
        sortOrder: 'asc',
        limit: 100,
      }
      if (paginationToken) options.paginationToken = paginationToken
      const result = await this.rpc('getTransfersByAddress', [launch.deployerWalletId, options])
      const pageRows = Array.isArray(result?.data) ? result.data : []
      rows.push(...pageRows)
      const next = typeof result?.paginationToken === 'string' && result.paginationToken ? result.paginationToken : undefined
      if (!next) { paginationToken = undefined; break }
      paginationToken = next
    }

    if (paginationToken) throw new Error('Helius transfer history exceeded configured pagination bound.')

    return rows.map((row: any): ActorMovement | undefined => {
      const direction: ActorMovement['direction'] | undefined = row.fromUserAccount === launch.deployerWalletId
        ? 'TRANSFER_OUT'
        : row.toUserAccount === launch.deployerWalletId
          ? 'TRANSFER_IN'
          : undefined
      if (!direction) return undefined
      const seconds = Number(row.blockTime ?? 0)
      if (!Number.isFinite(seconds) || seconds <= 0) return undefined
      const observedAt = new Date(seconds * 1000).toISOString()

      const uiAmount = Number(row.uiAmount)
      const rawAmount = Number(row.amount)
      const decimals = Number(row.decimals)
      const tokenAmount = Number.isFinite(uiAmount)
        ? uiAmount
        : Number.isFinite(rawAmount) && Number.isInteger(decimals) && decimals >= 0
          ? rawAmount / (10 ** decimals)
          : undefined
      if (tokenAmount === undefined || !Number.isFinite(tokenAmount) || tokenAmount < 0) return undefined

      const evidenceSuffix = [
        row.signature ?? launch.launchId,
        row.transactionIdx ?? '',
        row.instructionIdx ?? '',
        row.innerInstructionIdx ?? '',
      ].join(':')
      return {
        observedAt,
        actorId: launch.deployerWalletId!,
        direction,
        tokenAmount,
        source: 'helius-transfers',
        evidenceId: `helius:transfer:${evidenceSuffix}`,
      }
    }).filter((movement: ActorMovement | undefined): movement is ActorMovement => movement !== undefined)
  }
}
