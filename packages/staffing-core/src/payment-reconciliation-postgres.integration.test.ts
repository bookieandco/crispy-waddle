import { describe, expect, it } from "vitest";
import { PaymentReconciliationService, type PaymentReceipt } from "./payment-reconciliation.js";
import { PostgresPaymentReconciliationRepository } from "./payment-reconciliation-repository.js";
import { PostgresPaymentTransaction } from "./payment-reconciliation-postgres.js";

describe("Postgres payment reconciliation locking", () => {
  it("locks the invoice before taking the balance snapshot", async () => {
    const queries: string[] = [];
    let transactionCalls = 0;
    let paymentInserted = false;
    const executor:any = {
      query: async (sql:string) => {
        queries.push(sql);
        if (sql.includes("for update")) return [{ id:"inv-1" }];
        if (sql.includes('i.subtotal as total')) return [{ id:"inv-1", total:100, paid:0, currency:"USD", status:"ISSUED" }];
        if (sql.includes("from staffing_payments p")) return paymentInserted ? [{ paymentId:"pay-1", invoiceId:"inv-1", status:"PAID", appliedAmount:100, remainingAmount:0 }] : [];
        if (sql.includes("insert into staffing_payments")) { if (paymentInserted) return []; paymentInserted = true; return [{ id:"pay-1" }]; }
        if (sql.includes("update staffing_invoices")) return [{id:"inv-1",status:"PAID"}];
        return [];
      },
      transaction: async (work:any) => { transactionCalls++; return work(executor); }
    };
    const transaction = new PostgresPaymentTransaction(executor, { next: prefix => `${prefix}-1` });
    const service = new PaymentReconciliationService(
      new PostgresPaymentReconciliationRepository(executor, { next: prefix => `${prefix}-1` }),
      transaction,
    );
    const payment:PaymentReceipt = { organizationId:"org-1", provider:"stripe", externalPaymentId:"evt-1", invoiceId:"inv-1", employerId:"emp-1", amount:100, currency:"USD", receivedAt:"2026-10-07T00:00:00Z" };
    const result = await service.reconcile(payment);
    expect(result.paymentId).toBe("pay-1");
    expect(transactionCalls).toBe(1);
    const lockIndex=queries.findIndex(q=>q.includes("for update"));
    const balanceIndex=queries.findIndex(q=>q.includes("i.subtotal as total"));
    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(balanceIndex).toBeGreaterThan(lockIndex);
  });
});
