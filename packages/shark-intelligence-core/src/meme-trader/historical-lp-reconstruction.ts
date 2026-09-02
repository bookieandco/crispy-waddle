import type { HistoricalPoolTransaction, PoolAccountRef, PoolHistory } from './solana-pool-history'
import type { DexLiquidityVenue } from './dex-liquidity-decoder'

export type HistoricalReserveSnapshot = {
  observedAt: string
  poolAddress: string
  venue: DexLiquidityVenue
  baseMint: string
  quoteMint: string
  baseReserve: number
  quoteReserve: number
  liquidityUsd?: number
  source: string
  evidenceIds: string[]
  kind: 'SNAPSHOT' | 'LIQUIDITY_ADD' | 'LIQUIDITY_REMOVE'
}

export type HistoricalLpEvent = HistoricalReserveSnapshot & {
  baseDelta: number
  quoteDelta: number
}

export type HistoricalLpReconstruction = {
  poolAddress: string
  venue: DexLiquidityVenue
  baseMint: string
  quoteMint: string
  baseVault: string
  quoteVault: string
  snapshots: HistoricalReserveSnapshot[]
  events: HistoricalLpEvent[]
  firstObservedAt: string
  lastObservedAt: string
  evidenceIds: string[]
  usdValuationCoverage: number
}

type TokenBalance = {
  accountIndex?: number
  account?: string
  mint?: string
  uiTokenAmount?: { uiAmount?: number | null; uiAmountString?: string; decimals?: number }
  amount?: string
  decimals?: number
}

function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) }

function accountKeyStrings(raw: any): string[] {
  const keys = raw?.transaction?.message?.accountKeys ?? raw?.message?.accountKeys ?? []
  return keys.map((key: any) => typeof key === 'string' ? key : key?.pubkey ?? key?.publicKey ?? '').filter(Boolean)
}

function balanceValue(balance: TokenBalance): number | undefined {
  const ui = balance.uiTokenAmount
  if (finite(ui?.uiAmount)) return ui!.uiAmount!
  if (typeof ui?.uiAmountString === 'string' && Number.isFinite(Number(ui.uiAmountString))) return Number(ui.uiAmountString)
  if (typeof balance.amount === 'string' && Number.isFinite(Number(balance.amount))) {
    const decimals = ui?.decimals ?? balance.decimals ?? 0
    return Number(balance.amount) / 10 ** decimals
  }
  return undefined
}

function balancesByAccount(raw: any): Map<string, { mint: string; value: number }> {
  const keys = accountKeyStrings(raw)
  const result = new Map<string, { mint: string; value: number }>()
  const all = [
    ...(Array.isArray(raw?.meta?.postTokenBalances) ? raw.meta.postTokenBalances : []),
    ...(Array.isArray(raw?.transaction?.meta?.postTokenBalances) ? raw.transaction.meta.postTokenBalances : []),
  ] as TokenBalance[]
  for (const balance of all) {
    const account = typeof balance.account === 'string'
      ? balance.account
      : Number.isInteger(balance.accountIndex) ? keys[balance.accountIndex!] : undefined
    const mint = typeof balance.mint === 'string' ? balance.mint : undefined
    const value = balanceValue(balance)
    if (account && mint && finite(value)) result.set(account, { mint, value })
  }
  return result
}

function accountByRole(accounts: PoolAccountRef[], role: PoolAccountRef['role']): string | undefined {
  return accounts.find(account => account.role === role)?.address
}

function classify(baseDelta: number, quoteDelta: number): HistoricalReserveSnapshot['kind'] {
  if (baseDelta > 0 && quoteDelta > 0) return 'LIQUIDITY_ADD'
  if (baseDelta < 0 && quoteDelta < 0) return 'LIQUIDITY_REMOVE'
  return 'SNAPSHOT'
}

/**
 * Reconstructs historical pool reserves from transaction postTokenBalances.
 * It deliberately operates in token units. USD valuation is accepted only
 * when a trusted point-in-time quote is supplied by the caller.
 */
export function reconstructHistoricalPoolLiquidity(input: {
  history: PoolHistory
  venue: DexLiquidityVenue
  baseMint: string
  quoteMint: string
  baseVault: string
  quoteVault: string
  quoteUsdPrice?: (input: { mint: string; observedAt: string; transaction: HistoricalPoolTransaction }) => number | undefined
}): HistoricalLpReconstruction {
  const snapshots: HistoricalReserveSnapshot[] = []
  const events: HistoricalLpEvent[] = []
  let previousBase: number | undefined
  let previousQuote: number | undefined

  for (const transaction of [...input.history.transactions].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))) {
    const balances = balancesByAccount(transaction.raw)
    const base = balances.get(input.baseVault)
    const quote = balances.get(input.quoteVault)
    if (!base || !quote || base.mint !== input.baseMint || quote.mint !== input.quoteMint) continue
    if (!finite(base.value) || !finite(quote.value)) continue

    const baseDelta = previousBase === undefined ? 0 : base.value - previousBase
    const quoteDelta = previousQuote === undefined ? 0 : quote.value - previousQuote
    const kind = previousBase === undefined ? 'SNAPSHOT' : classify(baseDelta, quoteDelta)
    const quoteUsdPrice = input.quoteUsdPrice?.({ mint: input.quoteMint, observedAt: transaction.observedAt, transaction })
    const liquidityUsd = finite(quoteUsdPrice) ? (base.value * (quoteUsdPrice! * (quote.value / Math.max(base.value, Number.EPSILON))) + quote.value * quoteUsdPrice!) : undefined
    const evidenceIds = [transaction.evidenceId]
    const snapshot: HistoricalReserveSnapshot = {
      observedAt: transaction.observedAt,
      poolAddress: input.history.pool.poolAddress,
      venue: input.venue,
      baseMint: input.baseMint,
      quoteMint: input.quoteMint,
      baseReserve: base.value,
      quoteReserve: quote.value,
      ...(finite(liquidityUsd) ? { liquidityUsd } : {}),
      source: `historical-token-balances:${transaction.signature}`,
      evidenceIds,
      kind,
    }
    snapshots.push(snapshot)
    if (previousBase !== undefined && previousQuote !== undefined) events.push({ ...snapshot, baseDelta, quoteDelta })
    previousBase = base.value
    previousQuote = quote.value
  }

  if (!snapshots.length) throw new Error('No historical vault reserve snapshots could be reconstructed.')
  const evidenceIds = [...new Set([
    ...input.history.evidenceIds,
    ...input.history.accounts.map(account => account.evidenceId),
    ...snapshots.flatMap(snapshot => snapshot.evidenceIds),
  ])]
  return {
    poolAddress: input.history.pool.poolAddress,
    venue: input.venue,
    baseMint: input.baseMint,
    quoteMint: input.quoteMint,
    baseVault: input.baseVault,
    quoteVault: input.quoteVault,
    snapshots,
    events,
    firstObservedAt: snapshots[0].observedAt,
    lastObservedAt: snapshots.at(-1)!.observedAt,
    evidenceIds,
    usdValuationCoverage: snapshots.filter(snapshot => finite(snapshot.liquidityUsd)).length / snapshots.length,
  }
}

/** Resolve vault identities from already verified pool account metadata. */
export function resolvePoolVaults(accounts: PoolAccountRef[], mints: { baseMint: string; quoteMint: string }): { baseVault: string; quoteVault: string } {
  const vaults = accounts.filter(account => account.role === 'token-vault')
  const base = vaults.find(account => account.mint === mints.baseMint)?.address
  const quote = vaults.find(account => account.mint === mints.quoteMint)?.address
  if (!base || !quote) throw new Error('Verified base/quote vault accounts are required for historical reconstruction.')
  return { baseVault: base, quoteVault: quote }
}
