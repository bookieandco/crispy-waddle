import { describe, expect, it } from "vitest";
import { PaymentReconciliationService, type PaymentReceipt, type PaymentReconciliationStore } from "./payment-reconciliation.js";

class SerializedStore implements PaymentReconciliationStore {
  private paid = 0;
  private payment?: { id:string; amount:number };
  private locked = false;

  async findByExternalId(key:{organizationId:string;provider:string;externalPaymentId:string}) {
    if (this.payment) return { paymentId:this.payment.id, invoiceId:"inv-1", status:"PAID" as const, appliedAmount:this.payment.amount, remainingAmount:0 };
    return null;
  }
  async lockInvoice() {
    while (this.locked) await new Promise(resolve => setTimeout(resolve, 1));
    this.locked = true;
    return { id:"inv-1", total:100, paid:this.paid, currency:"USD", status:this.paid >= 100 ? "PAID" : "OPEN" };
  }
  async recordPayment(payment:PaymentReceipt) {
    if (this.payment) return this.payment.id;
    this.payment = { id:"pay-1", amount:payment.amount };
    return "pay-1";
  }
  async updateInvoicePaid(_invoiceId:string,_org:string,paid:number) { this.paid = paid; this.locked = false; }
  async recordCashLedgerEntry() {}
}

describe("concurrent payment webhook reconciliation", () => {
  const payment:PaymentReceipt = { organizationId:"org-1", provider:"stripe", externalPaymentId:"evt-1", invoiceId:"inv-1", employerId:"emp-1", amount:100, currency:"USD", receivedAt:"2026-08-11T00:00:00Z" };

  it("applies the same webhook only once when delivered concurrently", async () => {
    const store = new SerializedStore();
    const service = new PaymentReconciliationService(store, { next: prefix => `${prefix}-1` });
    const [a,b] = await Promise.allSettled([service.reconcile(payment), service.reconcile(payment)]);
    const fulfilled = [a,b].filter(x => x.status === "fulfilled");
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(new Set(fulfilled.map(x => (x as PromiseFulfilledResult<any>).value.paymentId)).size).toBe(1);
  });

  it("does not allow two distinct payments to consume the same balance", async () => {
    const store = new SerializedStore();
    const service = new PaymentReconciliationService(store, { next: prefix => `${prefix}-${Math.random()}` });
    const p2 = { ...payment, externalPaymentId:"evt-2" };
    const [a,b] = await Promise.allSettled([service.reconcile(payment), service.reconcile(p2)]);
    const fulfilled = [a,b].filter(x => x.status === "fulfilled");
    expect(fulfilled.length).toBe(1);
  });
});
