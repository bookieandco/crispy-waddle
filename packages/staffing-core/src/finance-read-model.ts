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

export interface FinanceInvoice {
  id: string; placementId: string; timesheetId: string; agreementId: string;
  currency: string; subtotal: number; received: number; outstanding: number;
  status: string; issuedAt: string;
}

export interface FinancePayment {
  id: string; invoiceId: string; amount: number; currency: string;
  status: string; receivedAt?: string; createdAt: string;
}

export interface FinanceLedgerEntry {
  id: string; placementId?: string; invoiceId?: string; paymentId?: string;
  agreementId?: string; type: string; amount: number; currency: string;
  occurredAt: string; sourceId: string;
}

export interface FinanceReadModel {
  summary(organizationId: string, currency: string): Promise<FinanceSummary>;
  activity(organizationId: string, limit?: number): Promise<FinanceActivity[]>;
  invoices(organizationId: string, currency: string, limit?: number): Promise<FinanceInvoice[]>;
  payments(organizationId: string, currency: string, limit?: number): Promise<FinancePayment[]>;
  ledger(organizationId: string, currency: string, limit?: number): Promise<FinanceLedgerEntry[]>;
}

function boundedLimit(limit = 50) { return Math.min(Math.max(Math.floor(limit), 1), 100); }

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
    return this.db.query<FinanceActivity>(`select * from (
      select 'INVOICE' kind, id, placement_id as "placementId", subtotal amount, currency, status, issued_at as "occurredAt" from staffing_invoices where organization_id=$1
      union all select 'PAYMENT' kind, id, null "placementId", amount, currency, status, coalesce(received_at,created_at) "occurredAt" from staffing_payments where organization_id=$1
      union all select 'LEDGER' kind, id, placement_id as "placementId", amount, currency, 'POSTED' status, posted_at "occurredAt" from staffing_payment_ledger_postings where organization_id=$1
    ) events order by "occurredAt" desc limit ${boundedLimit(limit)}`, [organizationId]);
  }

  async invoices(organizationId: string, currency: string, limit = 50): Promise<FinanceInvoice[]> {
    return this.db.query<FinanceInvoice>(`select i.id, i.placement_id as "placementId", i.timesheet_id as "timesheetId", i.agreement_id as "agreementId", i.currency, i.subtotal, coalesce(p.received,0) received, i.subtotal-coalesce(p.received,0) outstanding, i.status, i.issued_at as "issuedAt" from staffing_invoices i left join (select invoice_id,sum(amount) received from staffing_payments where status='RECEIVED' group by invoice_id) p on p.invoice_id=i.id where i.organization_id=$1 and i.currency=$2 order by i.issued_at desc limit ${boundedLimit(limit)}`, [organizationId, currency.toUpperCase()]);
  }

  async payments(organizationId: string, currency: string, limit = 50): Promise<FinancePayment[]> {
    return this.db.query<FinancePayment>(`select id, invoice_id as "invoiceId", amount, currency, status, received_at as "receivedAt", created_at as "createdAt" from staffing_payments where organization_id=$1 and currency=$2 order by coalesce(received_at,created_at) desc limit ${boundedLimit(limit)}`, [organizationId, currency.toUpperCase()]);
  }

  async ledger(organizationId: string, currency: string, limit = 50): Promise<FinanceLedgerEntry[]> {
    return this.db.query<FinanceLedgerEntry>(`select id, placement_id as "placementId", invoice_id as "invoiceId", payment_id as "paymentId", agreement_id as "agreementId", type, amount, currency, occurred_at as "occurredAt", source_id as "sourceId" from staffing_ledger_entries where organization_id=$1 and currency=$2 order by occurred_at desc limit ${boundedLimit(limit)}`, [organizationId, currency.toUpperCase()]);
  }
}
