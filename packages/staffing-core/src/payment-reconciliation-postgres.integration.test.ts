import { describe, expect, it } from "vitest";
import { PaymentReconciliationService, type PaymentReceipt } from "./payment-reconciliation.js";
import { PostgresPaymentReconciliationRepository } from "./payment-reconciliation-repository.js";
import { PostgresPaymentTransaction } from "./payment-reconciliation-postgres.js";

describe("Postgres payment reconciliation concurrency", () => {
  it("runs concurrent webhook deliveries through one transaction boundary", async () => {
    const queries: string[] = [];
    let transactionCalls = 0;
    let invoicePaid = 0;
    let paymentInserted = false;
    const executor:any = {
      query: async (sql:string, params:any[]) => {
        queries.push(sql);
        if (sql.includes("from staffing_payments")) return paymentInserted ? [{ paymentId:"pay-1", invoiceId:"inv-1", status:"PAID", appliedAmount:100, remainingAmount:0 }] : [];
        if (sql.includes("for update")) return [{ id:"inv-1", total:100, paid:invoicePaid, currency:"USD", status:invoicePaid >= 100 ? "PAID" : "OPEN" }];
        if (sql.includes("insert into staffing_payments")) { if (paymentInserted) return []; paymentInserted = true; return [{ id:"pay-1" }]; }
        if (sql.includes("update invoices")) { invoicePaid=params[2]; return []; }
        return [];
      },
      transaction: async (work:any) => { transactionCalls++; return work(executor); }
    };
    const transaction = new PostgresPaymentTransaction(executor, { next: prefix => `${prefix}-1` });
    const service = new PaymentReconciliationService(new PostgresPaymentReconciliationRepository(executor, { next: prefix => `${prefix}-1` }), { next: prefix => `${prefix}-1` }, transaction);
    const payment:PaymentReceipt = { organizationId:"org-1", provider:"stripe", externalPaymentId:"evt-1", invoiceId:"inv-1", employerId:"emp-1", amount:100, currency:"USD", receivedAt:"2026-08-11T00:00:00Z" };
    const [a,b] = await Promise.all([service.reconcile(payment), service.reconcile(payment)]);
    expect(a.paymentId).toBe("pay-1");
    expect(b.paymentId).toBe("pay-1");
    expect(transactionCalls).toBe(2);
    expect(queries.some(q => q.includes("for update"))).toBe(true);
  });
});
