export type FinancialAccount = {
  id: string
  name: string
  type: "CHECKING" | "SAVINGS" | "CREDIT_CARD" | "LOAN" | "OTHER"
  currentBalance: number
  availableBalance?: number
  creditLimit?: number
  currency: string
  institution?: string
}

export type Liability = {
  accountId: string
  name: string
  type: "CREDIT_CARD" | "LOAN" | "OTHER"
  balance: number
  minimumPayment?: number
  dueDate?: string
  apr?: number
  creditLimit?: number
  currency: string
}

export type RecurringCharge = {
  id: string
  merchant: string
  amount: number
  currency: string
  frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" | "UNKNOWN"
  nextDate?: string
  category?: string
}

export type FinancialSnapshot = {
  accounts: FinancialAccount[]
  liabilities: Liability[]
  recurring: RecurringCharge[]
  fetchedAt: string
  provider: string
}

/** Read-only boundary. Providers may return data; they cannot move money. */
export interface FinancialDataProvider {
  readonly name: string
  getSnapshot(): Promise<FinancialSnapshot>
}

export function creditUtilization(liability: Liability) {
  if (!liability.creditLimit || liability.creditLimit <= 0) return null
  return liability.balance / liability.creditLimit
}

export function toFinancialAttention(snapshot: FinancialSnapshot) {
  const now = Date.now()
  const items = [
    ...snapshot.liabilities.map(l => {
      const due = l.dueDate ? new Date(l.dueDate).getTime() : Infinity
      const days = due === Infinity ? Infinity : Math.ceil((due - now) / 86400000)
      return {
        id: `liability_${l.accountId}`,
        type: "CREDIT_CARD" as const,
        title: `${l.name} payment`,
        amount: l.minimumPayment ?? l.balance,
        currency: l.currency,
        dueAt: l.dueDate,
        severity: days <= 1 ? "URGENT" as const : days <= 7 ? "SOON" as const : "REVIEW" as const,
        action: "Review payment",
        requiresApproval: true,
      }
    }),
    ...snapshot.recurring.map(r => ({
      id: `recurring_${r.id}`,
      type: "SUBSCRIPTION" as const,
      title: `${r.merchant} recurring charge`,
      amount: r.amount,
      currency: r.currency,
      dueAt: r.nextDate,
      severity: "REVIEW" as const,
      action: "Review subscription",
      requiresApproval: true,
    })),
  ]
  return items
}
