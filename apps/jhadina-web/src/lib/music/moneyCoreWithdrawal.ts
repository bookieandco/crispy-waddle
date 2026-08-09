export type WithdrawableBalance = {
  accountId: string
  currency: string
  available: number
  reserved: number
}

export type WithdrawalRequest = {
  id: string
  accountId: string
  amount: number
  currency: string
  destinationAccountId: string
  status: "PENDING_APPROVAL" | "APPROVED" | "EXECUTED" | "REJECTED"
  source: "MONEY_CORE"
  createdAt: string
}

export function requestWithdrawal(balance: WithdrawableBalance, amount: number, destinationAccountId: string): WithdrawalRequest {
  if (!destinationAccountId.trim()) throw new Error("A destination account is required")
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Withdrawal amount must be greater than zero")
  if (amount > balance.available) throw new Error("Withdrawal exceeds available balance")
  return {
    id: `withdrawal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    accountId: balance.accountId,
    amount,
    currency: balance.currency,
    destinationAccountId,
    status: "PENDING_APPROVAL",
    source: "MONEY_CORE",
    createdAt: new Date().toISOString(),
  }
}

/** External transfer execution remains a separate, explicitly authorized step. */
export function approveWithdrawal(request: WithdrawalRequest): WithdrawalRequest {
  if (request.status !== "PENDING_APPROVAL") throw new Error("Only pending withdrawals can be approved")
  return { ...request, status: "APPROVED" }
}
