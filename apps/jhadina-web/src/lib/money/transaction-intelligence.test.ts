import { describe,expect,it } from "vitest"
import { analyzeMoneyTransactions } from "./transaction-intelligence"

describe("Money transaction intelligence",()=>{
 it("derives recurring and duplicate review signals without execution authority",()=>{const rows=[
  {id:"t1",accountId:"plaid:a",amount:12,currency:"USD",occurredAt:"2026-09-01",description:"StreamCo"},
  {id:"t2",accountId:"plaid:a",amount:12,currency:"USD",occurredAt:"2026-09-20",description:"StreamCo"},
  {id:"t3",accountId:"plaid:a",amount:12,currency:"USD",occurredAt:"2026-09-20",description:"StreamCo"},
 ];const out=analyzeMoneyTransactions(rows);expect(out.recurringMerchants).toContain("streamco");expect(out.attention.some(x=>x.type==="SUBSCRIPTION")).toBe(true);expect(out.attention.some(x=>x.title.startsWith("Possible duplicate"))).toBe(true);expect(out.attention.every(x=>x.requiresApproval)).toBe(true)})
})
