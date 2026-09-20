import { describe, expect, it } from "vitest"
import { confirmRoyaltyEntry, type RoyaltyLedgerEntry } from "./royaltyLedger"
import { assertMusicCannotMintFinancialAction, toMoneyCoreIncomeObservation } from "./moneyCoreBridge"
import { approveWithdrawal, requestWithdrawal } from "./moneyCoreWithdrawal"

const reconciled:RoyaltyLedgerEntry={id:"r1",statementId:"s1",periodStart:"2026-08-01",periodEnd:"2026-08-31",source:"spotify",releaseId:"release-1",streams:100,grossAmount:42.5,currency:"USD",status:"RECONCILED"}

describe("JH-034 music to Money boundary",()=>{
  it("requires reconciliation then explicit confirmation before Money ingress",()=>{
    expect(()=>toMoneyCoreIncomeObservation(reconciled)).toThrow(/confirmed/i)
    const observation=toMoneyCoreIncomeObservation(confirmRoyaltyEntry(reconciled))
    expect(observation).toMatchObject({kind:"MUSIC_ROYALTY_INCOME",amount:42.5,currency:"USD",externalReference:"s1"})
  })
  it("does not let music mint a canonical financial action",()=>{
    const observation=toMoneyCoreIncomeObservation(confirmRoyaltyEntry(reconciled))
    expect(()=>assertMusicCannotMintFinancialAction(observation)).toThrow("MUSIC_INCOME_REQUIRES_MONEY_CORE_INGRESS")
  })
  it("keeps withdrawal approval non-executing",()=>{
    const request=requestWithdrawal({accountId:"music",currency:"USD",available:100,reserved:0},25,"bank-destination")
    const approved=approveWithdrawal(request)
    expect(approved.status).toBe("APPROVED")
    expect((approved as unknown as Record<string,unknown>).providerReference).toBeUndefined()
    expect((approved as unknown as Record<string,unknown>).status).not.toBe("EXECUTED")
  })
  it("fails closed when withdrawal exceeds the Money-provided balance",()=>{
    expect(()=>requestWithdrawal({accountId:"music",currency:"USD",available:10,reserved:0},25,"bank-destination")).toThrow(/exceeds/)
  })
})
