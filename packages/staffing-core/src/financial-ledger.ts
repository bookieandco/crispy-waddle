import type { SqlExecutor } from "./postgres-adapters.js";

export type LedgerEntryType = "AGENCY_REVENUE" | "PLATFORM_REVENUE" | "PAYMENT_RECEIVED";

export interface LedgerEntry {
  id: string;
  organizationId: string;
  placementId?: string;
  invoiceId?: string;
  paymentId?: string;
  agreementId?: string;
  type: LedgerEntryType;
  amount: number;
  currency: string;
  occurredAt: string;
  sourceId: string;
}

export class FinancialLedgerService {
  constructor(private readonly db: SqlExecutor, private readonly ids: { next(prefix: string): string }) {}

  async post(entry: Omit<LedgerEntry, "id">): Promise<LedgerEntry> {
    return this.db.transaction(async (tx) => {
      const existing = await tx.query<LedgerEntry>(
        `select id, organization_id as "organizationId", placement_id as "placementId", invoice_id as "invoiceId",
                payment_id as "paymentId", agreement_id as "agreementId", type, amount, currency,
                occurred_at as "occurredAt", source_id as "sourceId"
         from staffing_ledger_entries where organization_id=$1 and source_id=$2 and type=$3 limit 1`,
        [entry.organizationId, entry.sourceId, entry.type],
      );
      if (existing[0]) return existing[0];
      if (!Number.isFinite(entry.amount) || entry.amount <= 0) throw new Error("Ledger amount must be greater than zero");
      const row: LedgerEntry = { ...entry, id: this.ids.next("ledger") };
      const rows = await tx.query<LedgerEntry>(
        `insert into staffing_ledger_entries
         (id,organization_id,placement_id,invoice_id,payment_id,agreement_id,type,amount,currency,occurred_at,source_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         returning id, organization_id as "organizationId", placement_id as "placementId", invoice_id as "invoiceId",
                   payment_id as "paymentId", agreement_id as "agreementId", type, amount, currency,
                   occurred_at as "occurredAt", source_id as "sourceId"`,
        [row.id,row.organizationId,row.placementId ?? null,row.invoiceId ?? null,row.paymentId ?? null,row.agreementId ?? null,row.type,row.amount,row.currency.toUpperCase(),row.occurredAt,row.sourceId],
      );
      if (!rows[0]) throw new Error("Ledger insert returned no row");
      return rows[0];
    });
  }
}
