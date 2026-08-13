import { describe, expect, it } from "vitest";
import { PostgresFinancialOperationRepository } from "./financial-operation-repository.js";

function db(rows:any[]=[]){
  const calls:any[]=[];
  return { calls, query: async (sql:string, params:any[]) => { calls.push({sql,params}); return rows; } } as any;
}

describe("PostgresFinancialOperationRepository",()=>{
  it("maps a stored operation",async()=>{
    const executor=db([{organizationId:"org-1",idempotencyKey:"key-1",operation:"PLACEMENT_FINANCIAL_FINALIZE",placementId:"pl-1",timesheetId:"ts-1",invoiceId:"inv-1",createdAt:"2026-08-11T00:00:00Z",status:"COMPLETED",resultJson:{invoice:{id:"inv-1"}}}]);
    const repo=new PostgresFinancialOperationRepository(executor);
    const result=await repo.find({organizationId:"org-1",idempotencyKey:"key-1"});
    expect(result?.placementId).toBe("pl-1");
    expect(result?.timesheetId).toBe("ts-1");
    expect(result?.status).toBe("COMPLETED");
  });

  it("uses an atomic conflict-safe reservation",async()=>{
    const executor=db([{operation_key:"key-1"}]);
    const repo=new PostgresFinancialOperationRepository(executor);
    const reserved=await repo.reserve({organizationId:"org-1",idempotencyKey:"key-1",operation:"PLACEMENT_FINANCIAL_FINALIZE",placementId:"pl-1",timesheetId:"ts-1",invoiceId:"inv-1",createdAt:"2026-08-11T00:00:00Z"});
    expect(reserved).toBe(true);
    expect(executor.calls[0].sql).toContain("on conflict (operation_key) do nothing");
  });

  it("persists completion and failure",async()=>{
    const executor=db([]);
    const repo=new PostgresFinancialOperationRepository(executor);
    await repo.complete({organizationId:"org-1",idempotencyKey:"key-1"},{invoiceId:"inv-1"},"2026-08-11T00:01:00Z");
    await repo.fail({organizationId:"org-1",idempotencyKey:"key-1"},"2026-08-11T00:02:00Z");
    expect(executor.calls[0].sql).toContain("status='COMPLETED'");
    expect(executor.calls[1].sql).toContain("status='FAILED'");
  });
});
