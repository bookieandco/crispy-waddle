import type { SqlExecutor } from "./postgres-adapters.js";

export class PaymentLedgerPostingService {
  constructor(private readonly db: SqlExecutor, private readonly ids: { next(prefix: string): string }, private readonly clock: { now(): string }) {}

  async postReceivedPayment(paymentId: string, organizationId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const rows = await tx.query<any>(
        `select p.id, p.invoice_id as "invoiceId", p.amount, p.currency, p.status,
                i.placement_id as "placementId", i.agreement_id as "agreementId"
         from staffing_payments p
         join staffing_invoices i on i.id = p.invoice_id
         where p.id=$1 and p.organization_id=$2 for update`,
        [paymentId, organizationId],
      );
      const payment = rows[0];
      if (!payment) throw new Error("Payment not found");
      if (payment.status !== "RECEIVED") throw new Error("Only received payments can be posted");
      const existing = await tx.query(`select 1 from staffing_payment_ledger_postings where payment_id=$1 limit 1`, [paymentId]);
      if (existing.length) return;
      const now = this.clock.now();
      await tx.query(
        `insert into staffing_payment_ledger_postings
         (id,payment_id,organization_id,invoice_id,placement_id,agreement_id,currency,amount,posted_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [this.ids.next("payment-ledger"), payment.id, organizationId, payment.invoiceId, payment.placementId, payment.agreementId, payment.currency, payment.amount, now],
      );
      await tx.query(
        `insert into staffing_event_outbox
         (id,event_type,aggregate_id,organization_id,occurred_at,payload,status,attempts,available_at)
         values ($1,'PAYMENT_LEDGER_POSTED',$2,$3,$4,$5,'PENDING',0,$4)`,
        [this.ids.next("event"), payment.id, organizationId, now, JSON.stringify({ paymentId: payment.id, invoiceId: payment.invoiceId, placementId: payment.placementId, agreementId: payment.agreementId, amount: payment.amount, currency: payment.currency })],
      );
    });
  }
}
