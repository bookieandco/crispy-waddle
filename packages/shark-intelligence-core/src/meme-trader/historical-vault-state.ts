import type { HistoricalPoolTransaction, PoolAccountRef, PoolHistory } from './solana-pool-history'
import type { NormalizedReserveState } from './dex-liquidity-decoder'

export type TokenBalancePoint = {
  accountIndex: number
  address: string
  mint: string
  amountRaw: bigint
  decimals: number
}

export type HistoricalVaultState = {
  observedAt: string
  signature: string
  poolAddress: string
  baseVault: TokenBalancePoint
  quoteVault: TokenBalancePoint
  baseDeltaRaw: bigint
  quoteDeltaRaw: bigint
  kind: NormalizedReserveState['kind']
  evidenceId: string
}

type AccountKey = string | { pubkey?: string }

type TokenBalance = {
  accountIndex?: unknown
  mint?: unknown
  owner?: unknown
  uiTokenAmount?: { amount?: unknown; decimals?: unknown }
}

function accountAddress(keys: unknown, index: number): string | undefined {
  if (!Array.isArray(keys)) return undefined
  const key = keys[index] as AccountKey | undefined
  if (typeof key === 'string') return key
  if (key && typeof key === 'object' && typeof key.pubkey === 'string') return key.pubkey
  return undefined
}

function parseBigInt(value: unknown): bigint | undefined {
  if (typeof value === 'bigint') return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value)
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value)
  return undefined
}

function parseDecimals(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255 ? value : undefined
}

function balancePoints(raw: unknown): TokenBalancePoint[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const row = entry as TokenBalance
    const accountIndex = typeof row.accountIndex === 'number' && Number.isInteger(row.accountIndex) ? row.accountIndex : undefined
    const mint = typeof row.mint === 'string' ? row.mint : undefined
    const amountRaw = parseBigInt(row.uiTokenAmount?.amount)
    const decimals = parseDecimals(row.uiTokenAmount?.decimals)
    if (accountIndex === undefined || !mint || amountRaw === undefined || decimals === undefined) return []
    return [{ accountIndex, address: '', mint, amountRaw, decimals }]
  })
}

function withAddresses(points: TokenBalancePoint[], accountKeys: unknown): TokenBalancePoint[] {
  return points.flatMap(point => {
    const address = accountAddress(accountKeys, point.accountIndex)
    return address ? [{ ...point, address }] : []
  })
}

function balancesFromTransaction(transaction: HistoricalPoolTransaction): { pre: TokenBalancePoint[]; post: TokenBalancePoint[] } {
  if (!transaction.raw || typeof transaction.raw !== 'object') return { pre: [], post: [] }
  const row = transaction.raw as Record<string, unknown>
  const tx = row.transaction && typeof row.transaction === 'object' ? row.transaction as Record<string, unknown> : row
  const meta = row.meta && typeof row.meta === 'object' ? row.meta as Record<string, unknown> : undefined
  const message = tx.message && typeof tx.message === 'object' ? tx.message as Record<string, unknown> : undefined
  const keys = message?.accountKeys ?? tx.accountKeys ?? row.accountKeys
  return {
    pre: withAddresses(balancePoints(meta?.preTokenBalances ?? row.preTokenBalances), keys),
    post: withAddresses(balancePoints(meta?.postTokenBalances ?? row.postTokenBalances), keys),
  }
}

function pointAt(points: TokenBalancePoint[], address: string, mint: string): TokenBalancePoint | undefined {
  return points.find(point => point.address === address && point.mint === mint)
}

function delta(post: TokenBalancePoint | undefined, pre: TokenBalancePoint | undefined): bigint {
  return (post?.amountRaw ?? 0n) - (pre?.amountRaw ?? 0n)
}

function classify(baseDelta: bigint, quoteDelta: bigint): NormalizedReserveState['kind'] {
  if (baseDelta > 0n && quoteDelta > 0n) return 'LIQUIDITY_ADD'
  if (baseDelta < 0n && quoteDelta < 0n) return 'LIQUIDITY_REMOVE'
  return 'SNAPSHOT'
}

/**
 * Reconstructs point-in-time vault balances from Solana transaction metadata.
 * It deliberately works in raw token units and refuses to invent USD valuation.
 */
export function reconstructHistoricalVaultState(input: {
  transaction: HistoricalPoolTransaction
  pool: PoolHistory['pool']
  accounts: PoolAccountRef[]
}): HistoricalVaultState | undefined {
  const baseVault = input.accounts.find(a => a.role === 'token-vault' && a.mint === input.pool.baseMint)
  const quoteVault = input.accounts.find(a => a.role === 'token-vault' && a.mint === input.pool.quoteMint)
  if (!baseVault || !quoteVault || !input.pool.baseMint || !input.pool.quoteMint) return undefined

  const balances = balancesFromTransaction(input.transaction)
  const preBase = pointAt(balances.pre, baseVault.address, input.pool.baseMint)
  const postBase = pointAt(balances.post, baseVault.address, input.pool.baseMint)
  const preQuote = pointAt(balances.pre, quoteVault.address, input.pool.quoteMint)
  const postQuote = pointAt(balances.post, quoteVault.address, input.pool.quoteMint)
  if (!postBase || !postQuote) return undefined

  const baseDeltaRaw = delta(postBase, preBase)
  const quoteDeltaRaw = delta(postQuote, preQuote)
  return {
    observedAt: input.transaction.observedAt,
    signature: input.transaction.signature,
    poolAddress: input.pool.poolAddress,
    baseVault: postBase,
    quoteVault: postQuote,
    baseDeltaRaw,
    quoteDeltaRaw,
    kind: classify(baseDeltaRaw, quoteDeltaRaw),
    evidenceId: input.transaction.evidenceId,
  }
}

export function historicalVaultStates(input: {
  history: PoolHistory
  accounts: PoolAccountRef[]
}): HistoricalVaultState[] {
  return input.history.transactions
    .map(transaction => reconstructHistoricalVaultState({ transaction, pool: input.history.pool, accounts: input.accounts }))
    .filter((state): state is HistoricalVaultState => state !== undefined)
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
}
