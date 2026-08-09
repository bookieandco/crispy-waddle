export type PlaidAccountSnapshot = {
  id: string
  name: string
  mask?: string
  type: string
  subtype?: string
  current?: number
  available?: number
  currency?: string
}

export type PlaidTransactionSnapshot = {
  id: string
  accountId: string
  merchantName?: string
  name: string
  amount: number
  date: string
  pending: boolean
  category?: string[]
  recurring?: boolean
}

/**
 * Provider-neutral normalized shape for Plaid data. Keep Plaid secrets and
 * access tokens server-side; the browser only receives the normalized data.
 */
export type FinancialProviderSnapshot = {
  provider: "PLAID"
  fetchedAt: string
  accounts: PlaidAccountSnapshot[]
  transactions: PlaidTransactionSnapshot[]
}

export function normalizePlaidSnapshot(input: FinancialProviderSnapshot): FinancialProviderSnapshot {
  return {
    provider: "PLAID",
    fetchedAt: input.fetchedAt,
    accounts: input.accounts.map(a => ({ ...a, current: Number(a.current || 0), available: a.available == null ? undefined : Number(a.available) })),
    transactions: input.transactions.map(t => ({ ...t, amount: Number(t.amount || 0) })),
  }
}
