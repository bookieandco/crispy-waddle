export type FinancialAttentionType = "CREDIT_CARD" | "BILL" | "SUBSCRIPTION" | "CREDIT" | "OTHER"
export type FinancialAttention = {
  id: string
  type: FinancialAttentionType
  title: string
  amount?: number
  currency?: string
  dueAt?: string
  severity: "URGENT" | "SOON" | "REVIEW" | "INFO"
  action: string
  requiresApproval: boolean
}

export function prioritizeFinancialAttention(items: readonly FinancialAttention[]) {
  const rank = (item: FinancialAttention) =>
    item.severity === "URGENT" ? 0 : item.severity === "SOON" ? 1 : item.severity === "REVIEW" ? 2 : 3

  return [...items].sort((a, b) => {
    const severity = rank(a) - rank(b)
    if (severity) return severity
    const aDue = a.dueAt ? Date.parse(a.dueAt) : Number.POSITIVE_INFINITY
    const bDue = b.dueAt ? Date.parse(b.dueAt) : Number.POSITIVE_INFINITY
    return aDue - bDue
  })
}

/**
 * This only prepares an approval-shaped UI intent. It is not an ActionProposal,
 * approval receipt, payment, transfer, withdrawal, or execution authority.
 */
export function createApprovalReview(item: FinancialAttention, createdAt = new Date().toISOString()) {
  return {
    id: `review_${item.id}`,
    targetId: item.id,
    action: item.action,
    status: "PENDING_APPROVAL" as const,
    requiresApproval: true as const,
    createdAt,
  }
}
