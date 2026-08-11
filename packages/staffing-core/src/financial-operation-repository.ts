import type { FinancialIdempotencyStore, FinancialOperationKey, FinancialOperationRecord } from "./financial-idempotency.js";
import type { SqlExecutor } from "./postgres-adapters.js";

export class PostgresFinancialOperationRepository implements FinancialIdempotencyStore {
  constructor(private readonly db: SqlExecutor) {}

  async find(key: FinancialOperationKey): Promise<FinancialOperationRecord | null> {
    const rows = await this.db.query<any>(`select organization_id as "organizationId", operation_key as "idempotencyKey", 'PLACEMENT_FINANCIAL_FINALIZE' as operation, invoice_id as "invoiceId", created_at as "createdAt", status, result_json as "resultJson", completed_at as "completedAt" from staffing_financial_operations where organization_id=$1 and operation_key=$2 limit 1`, [key.organizationId, key.idempotencyKey]);
    return rows[0] ?? null;
  }

  async reserve(record: FinancialOperationRecord): Promise<boolean> {
    const result = await this.db.query<any>(`insert into staffing_financial_operations (operation_key,organization_id,placement_id,timesheet_id,invoice_id,status,created_at) values ($1,$2,$3,$4,$5,'PROCESSING',$6) on conflict (operation_key) do nothing returning operation_key`, [record.idempotencyKey, record.organizationId, (record as any).placementId ?? "unknown", (record as any).timesheetId ?? "unknown", record.invoiceId, record.createdAt]);
    return result.length > 0;
  }

  async complete(key: FinancialOperationKey, result: unknown, completedAt: string): Promise<void> {
    await this.db.query(`update staffing_financial_operations set status='COMPLETED',result_json=$3,completed_at=$2 where organization_id=$1 and operation_key=$4`, [key.organizationId, completedAt, JSON.stringify(result), key.idempotencyKey]);
  }

  async fail(key: FinancialOperationKey, failedAt: string): Promise<void> {
    await this.db.query(`update staffing_financial_operations set status='FAILED',completed_at=$2 where organization_id=$1 and operation_key=$3`, [key.organizationId, failedAt, key.idempotencyKey]);
  }
}
