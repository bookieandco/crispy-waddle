import { describe, expect, it } from "vitest";
import { PaymentReconciliationService, type PaymentReceipt, type PaymentReconciliationStore } from "./payment-reconciliation.js";

class SerializedStore implements PaymentReconciliationStore {
  private paid = 0;
  private payments = new Map<string, { id:string; amount:number }>();
  private locked = false;

  async findByExternalId(key:{organizationId:string;provider:string;externalPaymentId:string}) {
    const payment = this.payments.get(`${key.organizationId}:${key.provider}:${key.externalPaymentId}`);
    if (payment) return { paymentId:payment.id, invoiceId:"inv-1", status:"PAID" as const, appliedAmount:payment.amount, remainingAmount:Math.max(0,100-this.paid) };
    return null;
  }
  async lockInvoice() {
    while (this.locked) await new Promise(resolve => setTimeout(resolve, 1));
    this.locked = true;
    return { id:"inv-1", total:100, paid:this.paid, currency:"USD", status:this.paid >= 100 ? "PAID" : "ISSUED" };
  }
  async recordPayment(payment:PaymentReceipt) {
    const key=`${payment.organizationId}:${payment.provider}:${payment.externalPaymentId}`;
    const existing=this.payments.get(key);
    if (existing) return existing.id;
    const id=`pay-${this.payments.size+1}`;
    this.payments.set(key,{id,amount:payment.amount});
    return id;
  }
  async updateInvoicePaid(_invoiceId:string,_org:string,paid:number) { this.paid = paid; this.locked = false; }
  async recordCashLedgerEntry() {}
}

describe("concurrent payment webhook reconciliation", () => {
  const payment:PaymentReceipt = { organizationId:"org-1", provider:"stripe", externalPaymentId:"evt-1", invoiceId:"inv-1", employerId:"emp-1", amount:100, currency:"USD", receivedAt:"2026-10-07T00:00:00Z" };

  it("applies the same webhook only once when delivered concurrently", async () => {
    const store = new SerializedStore();
    const service = new PaymentReconciliationService(store);
    const [a,b] = await Promise.allSettled([service.reconcile(payment), service.reconcile(payment)]);
    const fulfilled = [a,b].filter(x => x.status === "fulfilled");
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(new Set(fulfilled.map(x => (x as PromiseFulfilledResult<any>).value.paymentId)).size).toBe(1);
  });

  it("does not allow two distinct payments to consume the same balance", async () => {
    const store = new SerializedStore();
    const service = new PaymentReconciliationService(store);
    const p2 = { ...payment, externalPaymentId:"evt-2" };
    const [a,b] = await Promise.allSettled([service.reconcile(payment), service.reconcile(p2)]);
    const fulfilled = [a,b].filter(x => x.status === "fulfilled");
    expect(fulfilled.length).toBe(1);
  });
});
