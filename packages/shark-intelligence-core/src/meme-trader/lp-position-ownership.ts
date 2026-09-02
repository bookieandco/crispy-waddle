import type { HistoricalPoolTransaction, PoolHistory } from './solana-pool-history'

export type HistoricalLPOwnership = {
  observedAt: string
  signature: string
  poolAddress: string
  lpMint: string
  tokenAccount: string
  owner?: string
  amountRaw: bigint
  evidenceId: string
}

function accountKey(raw: Record<string, unknown>, index: number): string | undefined {
  const tx = raw.transaction && typeof raw.transaction === 'object' ? raw.transaction as Record<string, unknown> : raw
  const message = tx.message && typeof tx.message === 'object' ? tx.message as Record<string, unknown> : undefined
  const keys = message?.accountKeys ?? tx.accountKeys ?? raw.accountKeys
  if (!Array.isArray(keys)) return undefined
  const key = keys[index]
  if (typeof key === 'string') return key
  if (key && typeof key === 'object' && typeof (key as Record<string, unknown>).pubkey === 'string') return (key as Record<string, unknown>).pubkey as string
  return undefined
}

function parseAmount(value: unknown): bigint | undefined {
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value)
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value)
  return undefined
}

/** Reconstructs point-in-time LP-token ownership from Solana post-token balances. */
export function reconstructLPOwnership(transaction: HistoricalPoolTransaction, pool: PoolHistory['pool'], lpMint: string): HistoricalLPOwnership[] {
  if (!transaction.raw || typeof transaction.raw !== 'object') return []
  const raw = transaction.raw as Record<string, unknown>
  const meta = raw.meta && typeof raw.meta === 'object' ? raw.meta as Record<string, unknown> : undefined
  const balances = Array.isArray(meta?.postTokenBalances) ? meta.postTokenBalances : []
  const result: HistoricalLPOwnership[] = []
  for (const item of balances) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (row.mint !== lpMint || typeof row.accountIndex !== 'number') continue
    const tokenAmount = row.uiTokenAmount && typeof row.uiTokenAmount === 'object' ? row.uiTokenAmount as Record<string, unknown> : undefined
    const amountRaw = parseAmount(tokenAmount?.amount ?? row.amount)
    const address = accountKey(raw, row.accountIndex)
    if (amountRaw === undefined || !address || amountRaw === 0n) continue
    result.push({ observedAt: transaction.observedAt, signature: transaction.signature, poolAddress: pool.poolAddress, lpMint, tokenAccount: address, owner: typeof row.owner === 'string' ? row.owner : undefined, amountRaw, evidenceId: transaction.evidenceId })
  }
  return result
}

export function historicalLPOwnership(input: { history: PoolHistory; lpMint: string }): HistoricalLPOwnership[] {
  return input.history.transactions.flatMap(tx => reconstructLPOwnership(tx, input.history.pool, input.lpMint)).sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
}
