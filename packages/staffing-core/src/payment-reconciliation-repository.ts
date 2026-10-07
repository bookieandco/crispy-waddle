import type { ID } from "./agency-agreements.js";
import type { PaymentReceipt, PaymentReconciliationResult, PaymentReconciliationStore, InvoicePaymentStatus } from "./payment-reconciliation.js";
import type { SqlExecutor } from "./postgres-adapters.js";

export class PostgresPaymentReconciliationRepository implements PaymentReconciliationStore {
  constructor(private readonly db: SqlExecutor, private readonly ids: { next(prefix: string): string }) {}

  async findByExternalId(key: { organizationId: ID; provider: string; externalPaymentId: string }): Promise<PaymentReconciliationResult | null> {
    const rows = await this.db.query<PaymentReconciliationResult>(
      `select p.id as "paymentId",
              p.invoice_id as "invoiceId",
              case when i.status = 'PAID' then 'PAID' else 'PARTIALLY_PAID' end as status,
              p.amount as "appliedAmount",
              greatest(
                0,
                i.subtotal - coalesce((
                  select sum(p2.amount)
                  from staffing_payments p2
                  where p2.invoice_id = i.id
                    and p2.organization_id = i.organization_id
                    and p2.status in ('RECEIVED','SETTLED')
                ), 0)
              ) as "remainingAmount"
         from staffing_payments p
         join staffing_invoices i on i.id = p.invoice_id
        where p.organization_id=$1 and p.provider=$2 and p.external_payment_id=$3
        limit 1`,
      [key.organizationId, key.provider, key.externalPaymentId],
    );
    return rows[0] ?? null;
  }

  async lockInvoice(invoiceId: ID, organizationId: ID) {
    // Lock first, then read totals in a second statement. Under PostgreSQL
    // READ COMMITTED, a SELECT that starts before waiting on FOR UPDATE keeps
    // the statement snapshot for subqueries; computing the payment sum in that
    // same statement can therefore see a stale balance after the lock wait.
    const locked = await this.db.query<{ id: ID }>(
      `select id
         from staffing_invoices
        where id=$1 and organization_id=$2
        for update`,
      [invoiceId, organizationId],
    );
    if (!locked[0]) return null;

    const rows = await this.db.query<{ id: ID; total: number; paid: number; currency: string; status: string }>(
      `select i.id,
              i.subtotal as total,
              coalesce((
                select sum(p.amount)
                from staffing_payments p
                where p.invoice_id = i.id
                  and p.organization_id = i.organization_id
                  and p.status in ('RECEIVED','SETTLED')
              ), 0) as paid,
              i.currency,
              i.status
         from staffing_invoices i
        where i.id=$1 and i.organization_id=$2`,
      [invoiceId, organizationId],
    );
    return rows[0] ?? null;
  }

  async recordPayment(payment: PaymentReceipt): Promise<string> {
    const id = this.ids.next("payment");
    const rows = await this.db.query<{ id: string }>(
      `insert into staffing_payments
        (id,organization_id,provider,external_payment_id,invoice_id,employer_id,amount,currency,status,received_at,created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'RECEIVED',$9,$9)
       on conflict (organization_id,provider,external_payment_id)
       where provider is not null and external_payment_id is not null
       do nothing
       returning id`,
      [id, payment.organizationId, payment.provider, payment.externalPaymentId, payment.invoiceId, payment.employerId, payment.amount, payment.currency, payment.receivedAt],
    );
    if (rows[0]?.id) return rows[0].id;
    const existing = await this.db.query<{ id: string }>(
      `select id from staffing_payments
        where organization_id=$1 and provider=$2 and external_payment_id=$3`,
      [payment.organizationId, payment.provider, payment.externalPaymentId],
    );
    if (!existing[0]) throw new Error("Payment reservation lost without a durable payment record");
    return existing[0].id;
  }

  async updateInvoicePaid(invoiceId: ID, organizationId: ID, paid: number, status: InvoicePaymentStatus): Promise<void> {
    if (!Number.isFinite(paid) || paid < 0) throw new Error("Invoice paid amount is invalid");
    const rows = await this.db.query<{ id: ID; status: InvoicePaymentStatus }>(
      `update staffing_invoices
          set status=$3
        where id=$1 and organization_id=$2
      returning id,status`,
      [invoiceId, organizationId, status],
    );
    if (!rows[0]) throw new Error("Invoice payment update did not persist");
  }

  async recordCashLedgerEntry(input: { organizationId: ID; invoiceId: ID; paymentId: string; amount: number; currency: string; occurredAt: string }): Promise<void> {
    await this.db.query(
      `insert into staffing_cash_ledger_entries
        (id,organization_id,invoice_id,payment_id,amount,currency,occurred_at)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (organization_id,payment_id) do nothing`,
      [this.ids.next("cash"), input.organizationId, input.invoiceId, input.paymentId, input.amount, input.currency, input.occurredAt],
    );
  }
}
