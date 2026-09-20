import { describe, expect, it } from "vitest"
import { buildMoneyCommandCenterModel } from "./command-center-model"
import { createApprovalReview, prioritizeFinancialAttention } from "./financial-attention"

describe("Money command-center presentation boundary", () => {
  it("sums available cash only from governed account-read balances with one currency", () => {
    const model = buildMoneyCommandCenterModel([
      { id:"1", provider:"plaid", externalId:"a", type:"checking", currency:"USD", availableBalance:100, currentBalance:120 },
      { id:"2", provider:"plaid", externalId:"b", type:"savings", currency:"USD", currentBalance:50 },
      { id:"3", provider:"plaid", externalId:"c", type:"credit card", currency:"USD", currentBalance:500 },
    ])
    expect(model.availableCash).toBe(150)
    expect(model.currency).toBe("USD")
    expect(model.attention).toEqual([])
    expect(model.transactionAttentionAvailable).toBe(false)
  })

  it("does not invent a cash total when balances or currencies are incomplete", () => {
    expect(buildMoneyCommandCenterModel([
      { id:"1", provider:"plaid", externalId:"a", type:"checking", currency:"USD" },
    ]).availableCash).toBeNull()
    expect(buildMoneyCommandCenterModel([
      { id:"1", provider:"plaid", externalId:"a", type:"checking", currency:"USD", availableBalance:100 },
      { id:"2", provider:"plaid", externalId:"b", type:"savings", currency:"EUR", availableBalance:100 },
    ]).availableCash).toBeNull()
  })

  it("keeps review preparation non-executing and approval-required", () => {
    const item = { id:"bill-1", type:"BILL" as const, title:"Bill", severity:"SOON" as const, action:"Review bill", requiresApproval:true }
    expect(prioritizeFinancialAttention([item])).toEqual([item])
    expect(createApprovalReview(item, "2026-09-20T00:00:00.000Z")).toMatchObject({
      targetId:"bill-1", status:"PENDING_APPROVAL", requiresApproval:true,
    })
  })
})
