import { describe, expect, it } from "vitest"
import type { MoneyAccount } from "@jhadina/money-core"
import { availableCash, buildAccountAttention, prepareApprovalReview } from "./command-center-view"

const accounts: MoneyAccount[] = [
  { id:"checking", provider:"plaid", externalId:"a1", type:"checking", currency:"USD", maskedName:"Checking ••••1111", currentBalance:1200, availableBalance:1000 },
  { id:"card", provider:"plaid", externalId:"a2", type:"credit card", currency:"USD", maskedName:"Card ••••2222", currentBalance:300, availableBalance:700 },
]

describe("Money command center account projection",()=>{
  it("uses available non-credit cash without counting credit availability as cash",()=>{
    expect(availableCash(accounts)).toBe(1000)
  })

  it("creates approval-required credit review items only from governed account data",()=>{
    const items=buildAccountAttention(accounts)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({type:"CREDIT_CARD",amount:300,requiresApproval:true})
  })

  it("prepares review state without executing money movement",()=>{
    const action=prepareApprovalReview(buildAccountAttention(accounts)[0],new Date("2026-09-20T00:00:00.000Z"))
    expect(action.status).toBe("PENDING_APPROVAL")
    expect((action as unknown as Record<string,unknown>).providerReference).toBeUndefined()
  })

  it("does not invent bill subscription or transaction attention from account metadata",()=>{
    expect(JSON.stringify(buildAccountAttention(accounts))).not.toMatch(/BILL|SUBSCRIPTION|TRANSACTION/)
  })
})
