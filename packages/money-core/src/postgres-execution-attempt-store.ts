import type { SqlClient } from './postgres-idempotency-store.js';
import type { ExecutionAttempt, ExecutionAttemptOutcome, ExecutionAttemptStore, ExecutionAttemptState } from './execution-attempt.js';

type AttemptRow = Omit<ExecutionAttempt, 'attemptId' | 'requestId' | 'permitId' | 'actionFingerprint' | 'provider' | 'operation' | 'idempotencyKey' | 'state' | 'providerReference' | 'errorCode' | 'errorMessage' | 'startedAt' | 'completedAt' | 'recoveryRequired'> & {
  attempt_id: string; request_id: string; permit_id: string; action_fingerprint: string; provider: string;
  operation: string; idempotency_key: string; state: ExecutionAttemptState; provider_reference: string | null;
  error_code: string | null; error_message: string | null; started_at: string | Date; completed_at: string | Date | null;
  recovery_required: boolean;
};

export type PostgresExecutionAttemptStoreOptions = { client: SqlClient; tableName?: string };
function tableIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('MONEY_EXECUTION_ATTEMPT_TABLE_INVALID');
  return value;
}
function iso(value: string | Date | null): string | undefined { return value == null ? undefined : value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }
function mapRow(row: AttemptRow): ExecutionAttempt {
  return { attemptId: row.attempt_id, requestId: row.request_id, permitId: row.permit_id, actionFingerprint: row.action_fingerprint, provider: row.provider, operation: row.operation, idempotencyKey: row.idempotency_key, state: row.state, providerReference: row.provider_reference ?? undefined, errorCode: row.error_code ?? undefined, errorMessage: row.error_message ?? undefined, startedAt: iso(row.started_at)!, completedAt: iso(row.completed_at), recoveryRequired: row.recovery_required };
}

export class PostgresExecutionAttemptStore implements ExecutionAttemptStore {
  private readonly client: SqlClient; private readonly table: string;
  constructor(options: PostgresExecutionAttemptStoreOptions) { this.client = options.client; this.table = tableIdentifier(options.tableName ?? 'money_execution_attempts'); }
  async start(attempt: ExecutionAttempt): Promise<void> {
    await this.client.query(`INSERT INTO ${this.table} (attempt_id, request_id, permit_id, action_fingerprint, provider, operation, idempotency_key, state, started_at, recovery_required) VALUES ($1,$2,$3,$4,$5,$6,$7,'STARTED',$8,FALSE)`, [attempt.attemptId, attempt.requestId, attempt.permitId, attempt.actionFingerprint, attempt.provider, attempt.operation, attempt.idempotencyKey, attempt.startedAt]);
  }
  async complete(attemptId: string, outcome: ExecutionAttemptOutcome, completedAt = new Date().toISOString()): Promise<void> {
    const result = await this.client.query(`UPDATE ${this.table} SET state=$2, provider_reference=$3, error_code=$4, error_message=$5, recovery_required=$6, completed_at=$7, updated_at=CURRENT_TIMESTAMP WHERE attempt_id=$1 AND state='STARTED'`, [attemptId, outcome.state, outcome.providerReference ?? null, outcome.errorCode ?? null, outcome.errorMessage ?? null, outcome.recoveryRequired, completedAt]);
    if ((result.rowCount ?? 0) !== 1) throw new Error('MONEY_EXECUTION_ATTEMPT_NOT_STARTABLE');
  }
  async resolve(attemptId: string, outcome: ExecutionAttemptOutcome, completedAt = new Date().toISOString()): Promise<void> {
    const result = await this.client.query(`UPDATE ${this.table} SET state=$2, provider_reference=$3, error_code=$4, error_message=$5, recovery_required=$6, completed_at=$7, updated_at=CURRENT_TIMESTAMP WHERE attempt_id=$1 AND state IN ('UNKNOWN','RECOVERY_REQUIRED')`, [attemptId, outcome.state, outcome.providerReference ?? null, outcome.errorCode ?? null, outcome.errorMessage ?? null, outcome.recoveryRequired, completedAt]);
    if ((result.rowCount ?? 0) !== 1) throw new Error('MONEY_EXECUTION_ATTEMPT_NOT_RECOVERABLE');
  }
  async get(attemptId: string): Promise<ExecutionAttempt | undefined> {
    const result = await this.client.query<AttemptRow>(`SELECT attempt_id, request_id, permit_id, action_fingerprint, provider, operation, idempotency_key, state, provider_reference, error_code, error_message, started_at, completed_at, recovery_required FROM ${this.table} WHERE attempt_id=$1 LIMIT 1`, [attemptId]);
    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }
}
