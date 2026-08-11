import type { SqlExecutor } from "./postgres-adapters.js";

export type PaymentStatus = "PENDING" | "RECEIVED" | "FAILED" | "REFUNDED";

export interface Payment {
  id: string;
  organizationId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  receivedAt?: string;
  createdAt: string;
}

export class PaymentAllocationService {
  constructor(private readonly db: SqlExecutor, private readonly ids: { next(prefix: string): string }, private readonly clock: { now(): string }) {}

  async receive(invoiceId: string, organizationId: string, amount: number, currency: string): Promise<Payment> {
    return this.db.transaction(async (tx) => {
      const invoiceRows = await tx.query<any>(
        `select id, subtotal, currency, status from staffing_invoices where id=$1 and organization_id=$2 for update`,
        [invoiceId, organizationId],
      );
      const invoice = invoiceRows[0];
      if (!invoice) throw new Error("Invoice not found");
      if (invoice.status === "VOID") throw new Error("Cannot pay a void invoice");
      if (invoice.currency !== currency.toUpperCase()) throw new Error("Payment currency does not match invoice currency");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Payment amount must be greater than zero");
      const existingRows = await tx.query<{ amount: number }>(`select coalesce(sum(amount),0) amount from staffing_payments where invoice_id=$1 and status='RECEIVED'`, [invoiceId]);
      const received = Number(existingRows[0]?.amount ?? 0);
      if (received + amount > Number(invoice.subtotal)) throw new Error("Payment exceeds outstanding invoice balance");
      const now = this.clock.now();
      const payment: Payment = { id: this.ids.next("payment"), organizationId, invoiceId, amount: Number(amount.toFixed(2)), currency: currency.toUpperCase(), status: "RECEIVED", receivedAt: now, createdAt: now };
      await tx.query(`insert into staffing_payments (id,organization_id,invoice_id,amount,currency,status,received_at,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8)`, [payment.id,payment.organizationId,payment.invoiceId,payment.amount,payment.currency,payment.status,payment.receivedAt,payment.createdAt]);
      if (received + amount === Number(invoice.subtotal)) await tx.query(`update staffing_invoices set status='PAID' where id=$1`, [invoiceId]);
      await tx.query(`insert into staffing_event_outbox (id,event_type,aggregate_id,organization_id,occurred_at,payload,status,attempts,available_at) values ($1,'PAYMENT_RECEIVED',$2,$3,$4,$5,'PENDING',0,$4)`, [this.ids.next("event"), payment.id, organizationId, now, JSON.stringify(payment)]);
      return payment;
    });
  }
}
