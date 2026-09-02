import type { PoolCandidate } from './pool-discovery'

export type PoolAccountRef = { address: string; role: 'pool' | 'token-vault' | 'lp-vault' | 'authority'; mint?: string; source: string; evidenceId: string }
export type HistoricalPoolTransaction = { signature: string; observedAt: string; accountAddress: string; raw: unknown; evidenceId: string }
export type PoolHistory = { pool: PoolCandidate; accounts: PoolAccountRef[]; transactions: HistoricalPoolTransaction[]; source: string; evidenceIds: string[] }
export interface PoolAccountDiscoverySource { discoverAccounts(pool: PoolCandidate): Promise<PoolAccountRef[]> }
export interface PoolTransactionHistorySource { transactions(address: string, from: string, to?: string): Promise<HistoricalPoolTransaction[]> }

/** Helius archival access. Raw transactions are retained; reserve decoding stays DEX-specific. */
export class HeliusPoolTransactionHistorySource implements PoolTransactionHistorySource {
  constructor(private readonly options: { apiKey: string; baseUrl?: string; limit?: number; fetchImpl?: typeof fetch }) {}
  async transactions(address: string, from: string, to?: string): Promise<HistoricalPoolTransaction[]> {
    const fetchImpl = this.options.fetchImpl ?? fetch
    const url = this.options.baseUrl ?? 'https://mainnet.helius-rpc.com'
    const gte = Math.floor(Date.parse(from) / 1000); const lte = to ? Math.floor(Date.parse(to) / 1000) : undefined
    const body = { jsonrpc: '2.0', id: `jhadina-pool-history:${address}:${gte}`, method: 'getTransactionsForAddress', params: [address, { transactionDetails: 'full', sortOrder: 'asc', limit: this.options.limit ?? 1000, filters: { blockTime: { gte, ...(lte !== undefined ? { lte } : {}) }, status: 'succeeded' } }] }
    const response = await fetchImpl(`${url}/?api-key=${encodeURIComponent(this.options.apiKey)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (!response.ok) throw new Error(`Helius pool history failed: ${response.status}`)
    const payload: any = await response.json(); if (payload?.error) throw new Error('Helius pool history returned an RPC error.')
    const rows = Array.isArray(payload?.result?.data) ? payload.result.data : Array.isArray(payload?.result) ? payload.result : []
    return rows.flatMap((row: any) => {
      const signature = typeof row?.signature === 'string' ? row.signature : typeof row?.transaction?.signatures?.[0] === 'string' ? row.transaction.signatures[0] : undefined
      const blockTime = row?.blockTime ?? row?.transaction?.blockTime
      if (!signature || typeof blockTime !== 'number') return []
      return [{ signature, observedAt: new Date(blockTime * 1000).toISOString(), accountAddress: address, raw: row, evidenceId: `helius:pool-tx:${address}:${signature}` }]
    })
  }
}

export async function collectPoolHistory(input: { pool: PoolCandidate; accounts: PoolAccountRef[]; transactions: PoolTransactionHistorySource; from: string; to?: string }): Promise<PoolHistory> {
  const histories = await Promise.all(input.accounts.map(account => input.transactions.transactions(account.address, input.from, input.to)))
  const all = histories.flat().sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))
  return { pool: input.pool, accounts: input.accounts, transactions: all, source: 'helius-pool-history', evidenceIds: [...new Set([input.pool.evidenceId, ...input.accounts.map(a => a.evidenceId), ...all.map(t => t.evidenceId)])] }
}
