export type FinancialAttentionType = "CREDIT_CARD" | "BILL" | "SUBSCRIPTION" | "CREDIT" | "OTHER"
export type FinancialAttention = { id:string; type:FinancialAttentionType; title:string; amount?:number; currency?:string; dueAt?:string; severity:"URGENT"|"SOON"|"REVIEW"|"INFO"; action:string; requiresApproval:boolean }

export function prioritizeFinancialAttention(items: FinancialAttention[], now = new Date()) {
  return [...items].sort((a,b) => {
    const rank = (x:FinancialAttention) => x.severity === "URGENT" ? 0 : x.severity === "SOON" ? 1 : x.severity === "REVIEW" ? 2 : 3
    const r = rank(a) - rank(b); if (r) return r
    const ad = a.dueAt ? new Date(a.dueAt).getTime() : Infinity
    const bd = b.dueAt ? new Date(b.dueAt).getTime() : Infinity
    return ad - bd
  })
}

export function createApprovalAction(item: FinancialAttention) {
  return { id:`action_${item.id}`, targetId:item.id, action:item.action, status:"PENDING_APPROVAL" as const, requiresApproval:item.requiresApproval, createdAt:new Date().toISOString() }
}
