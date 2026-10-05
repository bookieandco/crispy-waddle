export type StalkChainReadTool =
  | 'stalkchain_fomo_leaderboard'
  | 'stalkchain_fomo_search'
  | 'stalkchain_fomo_resolve_trader'
  | 'stalkchain_fomo_trader_balances'
  | 'stalkchain_fomo_trader_positions'
  | 'stalkchain_fomo_trader_swaps'
  | 'stalkchain_fomo_trader_spotlight'
  | 'stalkchain_fomo_trader_report'
  | 'stalkchain_fomo_compare_traders'
  | 'stalkchain_fomo_trader_following'
  | 'stalkchain_fomo_trader_followers'
  | 'stalkchain_fomo_theses_by_trader'
  | 'stalkchain_fomo_token_holders'
  | 'stalkchain_fomo_kol_holders'
  | 'stalkchain_fomo_kol_sell_pressure'
  | 'stalkchain_fomo_token_stats'
  | 'stalkchain_fomo_token_devs'
  | 'stalkchain_fomo_theses_for_token'
  | 'stalkchain_fomo_analyze_token'
  | 'stalkchain_fomo_top_traders_for_tokens'
  | 'stalkchain_fomo_token_launch_research'
  | 'stalkchain_fomo_token_snapshot'
  | 'stalkchain_fomo_compare_snapshots'
  | 'stalkchain_fomo_token_board'
  | 'stalkchain_fomo_trending_analysis'
  | 'stalkchain_fomo_alerts'
  | 'stalkchain_fomo_watch_stream'
  | 'stalkchain_fomo_multi_trader_entries'
  | 'stalkchain_fomo_coordinated_activity'
  | 'stalkchain_fomo_theses_recent'
  | 'stalkchain_fomo_trade_detail'
  | 'stalkchain_fomo_trade_comments'
  | 'stalkchain_wallet_pnl'
  | 'stalkchain_token_onchain'
  | 'stalkchain_token_quality'
  | 'stalkchain_token_deployer'
  | 'stalkchain_token_early_buyers'
  | 'stalkchain_token_pnl_leaders'
  | 'stalkchain_token_exit_check'
  | 'stalkchain_token_prices'
  | 'stalkchain_token_prices_multichain'
  | 'stalkchain_price_history'
  | 'stalkchain_token_info'
  | 'stalkchain_wallet_portfolio'
  | 'stalkchain_wallet_transfers'
  | 'stalkchain_wallet_age'
  | 'stalkchain_chain_health'
  | 'stalkchain_price_confidence'

export type StalkChainQueryValue = string | number | boolean | readonly string[] | undefined

export type StalkChainToolResponse<T = unknown> = Readonly<{
  data: T
  creditsRemaining?: number
  tool: StalkChainReadTool
  durationMs?: number
  observedAt: string
  authority: 'EVIDENCE_ONLY'
  canAuthorizeTrade: false
  canSign: false
  canBroadcast: false
}>

export type StalkChainReadOnlyProvider = Readonly<{
  call<T = unknown>(
    tool: StalkChainReadTool,
    query?: Readonly<Record<string, StalkChainQueryValue>>,
  ): Promise<StalkChainToolResponse<T>>
}>

export type StalkChainProviderOptions = Readonly<{
  apiKey: string
  baseUrl?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
  now?: () => Date
}>

const DEFAULT_BASE_URL = 'https://data.stalkchain.com/api/v1/tools'
const DEFAULT_TIMEOUT_MS = 15_000

const finiteNonNegative = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined

const encodeQuery = (query: Readonly<Record<string, StalkChainQueryValue>>): string => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item)
      continue
    }
    params.set(key, String(value))
  }
  const encoded = params.toString()
  return encoded ? '?' + encoded : ''
}

const asObject = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined

/**
 * Read-only StalkChain transport. The public surface accepts only explicitly
 * enumerated research/data tools, so vendor-side execution tools cannot be
 * reached through this adapter even if they are added upstream later.
 */
export function createStalkChainReadOnlyProvider(options: StalkChainProviderOptions): StalkChainReadOnlyProvider {
  const apiKey = options.apiKey.trim()
  if (!apiKey) throw new Error('stalkchain_api_key_required')
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
  if (!/^https:\/\//i.test(baseUrl)) throw new Error('stalkchain_https_required')
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  if (!Number.isFinite(timeoutMs) || timeoutMs < 250 || timeoutMs > 120_000) throw new Error('stalkchain_timeout_invalid')
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? (() => new Date())

  return Object.freeze({
    async call<T = unknown>(
      tool: StalkChainReadTool,
      query: Readonly<Record<string, StalkChainQueryValue>> = {},
    ): Promise<StalkChainToolResponse<T>> {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetchImpl(baseUrl + '/' + tool + encodeQuery(query), {
          method: 'GET',
          headers: {
            accept: 'application/json',
            authorization: 'Bearer ' + apiKey,
          },
          signal: controller.signal,
        })
        const parsed: unknown = await response.json().catch(() => undefined)
        if (!response.ok) {
          const body = asObject(parsed)
          const code = typeof body?.code === 'string' ? body.code : 'http_' + response.status
          throw new Error('stalkchain_request_failed:' + code)
        }
        const envelope = asObject(parsed)
        if (!envelope || !('data' in envelope)) throw new Error('stalkchain_response_invalid')
        const credits = asObject(envelope.credits)
        const meta = asObject(envelope.meta)
        const observedAt = now().toISOString()
        return Object.freeze({
          data: envelope.data as T,
          creditsRemaining: finiteNonNegative(credits?.remaining),
          tool,
          durationMs: finiteNonNegative(meta?.durationMs),
          observedAt,
          authority: 'EVIDENCE_ONLY' as const,
          canAuthorizeTrade: false as const,
          canSign: false as const,
          canBroadcast: false as const,
        })
      } finally {
        clearTimeout(timer)
      }
    },
  })
}

export const STALKCHAIN_PROVIDER_AUTHORITY = Object.freeze({
  role: 'READ_ONLY_RESEARCH' as const,
  canAuthorizeTrade: false as const,
  canSign: false as const,
  canBroadcast: false as const,
  canMoveFunds: false as const,
})
