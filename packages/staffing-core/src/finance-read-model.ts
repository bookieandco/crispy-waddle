import type { SqlExecutor } from "./postgres-adapters.js";

export interface FinanceSummary {
  outstanding: number;
  partiallyPaid: number;
  paid: number;
  paymentsReceived: number;
  agencyRevenue: number;
  platformRevenue: number;
  currency: string;
}

export interface FinanceActivity {
  kind: "INVOICE" | "PAYMENT" | "LEDGER";
  id: string;
  placementId?: string;
  amount: number;
  currency: string;
  status: string;
  occurredAt: string;
}

export interface FinanceReadModel {
  summary(organizationId: string, currency: string): Promise<FinanceSummary>;
  activity(organizationId: string, limit?: number): Promise<FinanceActivity[]>;
}

export class PostgresFinanceReadModel implements FinanceReadModel {
  constructor(private readonly db: SqlExecutor) {}

  async summary(organizationId: string, currency: string): Promise<FinanceSummary> {
    const invoice = await this.db.query<any>(
      `select coalesce(sum(case when i.status <> 'PAID' then i.subtotal - coalesce(p.received,0) else 0 end),0) outstanding,
              coalesce(sum(case when i.status <> 'PAID' and coalesce(p.received,0) > 0 then i.subtotal - p.received else 0 end),0) partially_paid,
              coalesce(sum(case when i.status='PAID' then i.subtotal else 0 end),0) paid
       from staffing_invoices i
       left join (select invoice_id, sum(amount) received from staffing_payments where status='RECEIVED' group by invoice_id) p on p.invoice_id=i.id
       where i.organization_id=$1 and i.currency=$2`, [organizationId, currency.toUpperCase()]);
    const payments = await this.db.query<any>(`select coalesce(sum(amount),0) payments from staffing_payments where organization_id=$1 and currency=$2 and status='RECEIVED'`, [organizationId, currency.toUpperCase()]);
    const revenue = await this.db.query<any>(`select coalesce(sum(case when type='AGENCY_REVENUE' then amount else 0 end),0) agency, coalesce(sum(case when type='PLATFORM_REVENUE' then amount else 0 end),0) platform from staffing_ledger_entries where organization_id=$1 and currency=$2`, [organizationId, currency.toUpperCase()]);
    return { outstanding:Number(invoice[0]?.outstanding ?? 0), partiallyPaid:Number(invoice[0]?.partially_paid ?? 0), paid:Number(invoice[0]?.paid ?? 0), paymentsReceived:Number(payments[0]?.payments ?? 0), agencyRevenue:Number(revenue[0]?.agency ?? 0), platformRevenue:Number(revenue[0]?.platform ?? 0), currency:currency.toUpperCase() };
  }

  async activity(organizationId: string, limit = 50): Promise<FinanceActivity[]> {
    const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
    return this.db.query<FinanceActivity>(
      `select 'INVOICE' kind, id, placement_id as "placementId", subtotal amount, currency, status, issued_at as "occurredAt" from staffing_invoices where organization_id=$1
       union all
       select 'PAYMENT' kind, id, null "placementId", amount, currency, status, coalesce(received_at,created_at) "occurredAt" from staffing_payments where organization_id=$1
       union all
       select 'LEDGER' kind, id, placement_id as "placementId", amount, currency, 'POSTED' status, posted_at "occurredAt" from staffing_payment_ledger_postings where organization_id=$1
       order by "occurredAt" desc limit ${safeLimit}`,
      [organizationId],
    );
  }
}
