import type { MoneyAccount } from "@jhadina/money-core"
import type { FinancialAttention } from "./financial-attention"

export type MoneyCommandCenterModel = Readonly<{
  accounts: readonly MoneyAccount[]
  availableCash: number | null
  currency: string | null
  attention: readonly FinancialAttention[]
  transactionAttentionAvailable: false
}>

/**
 * Account-read data may populate balances and account cards. Bills,
 * subscriptions and transaction-derived attention remain empty until the
 * separately governed money.transaction.read capability is implemented.
 */
export function buildMoneyCommandCenterModel(accounts: readonly MoneyAccount[]): MoneyCommandCenterModel {
  const cashAccounts = accounts.filter((account) =>
    ["checking", "savings", "depository", "cash"].includes(account.type.toLowerCase()),
  )
  const currencies = new Set(cashAccounts.map((account) => account.currency).filter(Boolean))
  const balances = cashAccounts.map((account) => account.availableBalance ?? account.currentBalance)
  const complete = cashAccounts.length > 0 && balances.every((balance) => typeof balance === "number")

  return Object.freeze({
    accounts: [...accounts],
    availableCash: complete && currencies.size === 1
      ? (balances as number[]).reduce((sum, balance) => sum + balance, 0)
      : null,
    currency: complete && currencies.size === 1 ? [...currencies][0] ?? null : null,
    attention: [],
    transactionAttentionAvailable: false,
  })
}
