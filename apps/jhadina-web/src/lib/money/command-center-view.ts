import type { MoneyAccount } from "@jhadina/money-core"

export type FinancialAttention = Readonly<{
  id: string
  type: "CREDIT_CARD"
  title: string
  detail: string
  amount?: number
  currency: string
  severity: "REVIEW" | "INFO"
  action: "Review credit card"
  requiresApproval: true
}>

function isCreditAccount(account: MoneyAccount): boolean {
  return account.type.toLowerCase().includes("credit")
}

export function availableCash(accounts: readonly MoneyAccount[]): number {
  return accounts
    .filter((account) => !isCreditAccount(account))
    .reduce((sum, account) => sum + (account.availableBalance ?? account.currentBalance ?? 0), 0)
}

/**
 * Account-read-only attention projection.
 *
 * This intentionally does not infer bills, subscriptions or transactions.
 * Those require separately governed capabilities/data and must not be invented
 * from account metadata.
 */
export function buildAccountAttention(accounts: readonly MoneyAccount[]): FinancialAttention[] {
  return accounts.filter(isCreditAccount).map((account) => ({
    id: `card_${account.id}`,
    type: "CREDIT_CARD",
    title: `Review ${account.maskedName ?? "credit account"}`,
    detail: account.currentBalance === undefined
      ? "Connected credit account. Balance is unavailable from the current read."
      : `Current balance ${account.currentBalance.toFixed(2)} ${account.currency}.`,
    amount: account.currentBalance,
    currency: account.currency,
    severity: account.currentBalance !== undefined && account.currentBalance > 0 ? "REVIEW" : "INFO",
    action: "Review credit card",
    requiresApproval: true,
  }))
}

export function prepareApprovalReview(item: FinancialAttention, now = new Date()) {
  return Object.freeze({
    id: `review_${item.id}`,
    targetId: item.id,
    action: item.action,
    status: "PENDING_APPROVAL" as const,
    requiresApproval: true as const,
    createdAt: now.toISOString(),
  })
}
