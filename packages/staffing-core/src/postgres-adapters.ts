import type { Job, JobRepository } from "./jobs.js";
import type { JobStore, JobStoreTransaction, OutboxEvent } from "./outbox.js";
import type { CommercialLedgerEntry } from "./placement-financials.js";

export interface SqlExecutor {
  query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}

export class PostgresJobRepository implements JobRepository {
  constructor(private readonly db: SqlExecutor) {}

  async create(job: Job): Promise<Job> {
    const rows = await this.db.query<Job>(
      `insert into staffing_jobs
       (id, organization_id, employer_id, title, description, location, pay_rate, currency, remote, status, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
       returning id, organization_id as "organizationId", employer_id as "employerId", title, description,
                 location, pay_rate as "payRate", currency, remote, status,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [job.id, job.organizationId, job.employerId, job.title, job.description, job.location, job.payRate, job.currency, job.remote, job.status, job.createdAt],
    );
    if (!rows[0]) throw new Error("Job insert returned no row");
    return rows[0];
  }
}

export class PostgresJobStore implements JobStore {
  constructor(private readonly db: SqlExecutor) {}

  transaction<T>(work: (tx: JobStoreTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction(async (connection) => {
      let committed = false;
      const tx: JobStoreTransaction = {
        insertJob: async (job) => {
          const rows = await connection.query<Job>(
            `insert into staffing_jobs
             (id, organization_id, employer_id, title, description, location, pay_rate, currency, remote, status, created_at, updated_at)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) returning *`,
            [job.id, job.organizationId, job.employerId, job.title, job.description, job.location, job.payRate, job.currency, job.remote, job.status, job.createdAt],
          );
          if (!rows[0]) throw new Error("Job insert returned no row");
          return job;
        },
        enqueueEvent: async (event: OutboxEvent) => {
          await connection.query(
            `insert into staffing_event_outbox
             (id, event_type, aggregate_id, organization_id, occurred_at, payload, status, attempts)
             values ($1,$2,$3,$4,$5,$6,'PENDING',0)
             on conflict (id) do nothing`,
            [event.id, event.type, event.aggregateId, event.organizationId, event.occurredAt, JSON.stringify(event.payload)],
          );
        },
        commit: async () => { committed = true; },
        rollback: async () => { committed = false; throw new Error("Transaction rolled back"); },
      };
      try {
        const result = await work(tx);
        if (!committed) throw new Error("Transaction must explicitly commit");
        return result;
      } catch (error) {
        throw error;
      }
    });
  }
}

export class PostgresCommercialLedgerRepository {
  constructor(private readonly db: SqlExecutor) {}

  async saveCommercialLedgerEntry(entry: CommercialLedgerEntry): Promise<void> {
    await this.db.query(
      `insert into staffing_commercial_ledger
       (id, organization_id, placement_id, invoice_id, agreement_id, entry_type, amount, currency, occurred_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (id) do nothing`,
      [entry.id, entry.organizationId, entry.placementId, entry.invoiceId, entry.agreementId, entry.type, entry.amount, entry.currency, entry.occurredAt],
    );
  }
}

// Note: financial idempotency persistence lives in
// PostgresFinancialOperationRepository (financial-operation-repository.ts),
// which targets the staffing_financial_operations table introduced by
// migration 0021. An earlier, incomplete duplicate of this adapter
// (targeting the older staffing_financial_idempotency table from migration
// 0005, and missing the required complete()/fail() methods) was removed
// from here -- it was never imported anywhere outside this file.
