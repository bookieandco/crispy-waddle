import { createHash } from 'node:crypto';
import type { SqlClient } from './postgres-idempotency-store.js';
import type { ExecutionAttempt } from './execution-attempt.js';
import type { ExecutionRecoveryLedger, RecoveryObservation } from './execution-recovery.js';

export type PostgresExecutionRecoveryLedgerOptions = {
  client: SqlClient;
  ledgerTableName?: string;
  reconciliationTableName?: string;
};

function tableIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('MONEY_RECOVERY_TABLE_INVALID');
  return value;
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(',')}}`;
}

export function recoveryEvidenceHash(observation: Omit<RecoveryObservation, 'evidenceHash'>): string {
  const identity = {
    executionId: observation.executionId,
    proposalHash: observation.proposalHash,
    providerOperation: observation.providerOperation,
    providerReference: observation.providerReference ?? null,
    observedState: observation.observedState,
    evidence: observation.evidence,
    adapterId: observation.adapterId,
    adapterVersion: observation.adapterVersion,
    checkedAt: observation.checkedAt,
  };
  return createHash('sha256').update(`jhadina-money-recovery:v2:${stable(identity)}`, 'utf8').digest('hex');
}

export class PostgresExecutionRecoveryLedger implements ExecutionRecoveryLedger {
  private readonly client: SqlClient;
  private readonly ledger: string;
  private readonly reconciliation: string;

  constructor(options: PostgresExecutionRecoveryLedgerOptions) {
    this.client = options.client;
    this.ledger = tableIdentifier(options.ledgerTableName ?? 'jhadina_connector_execution_ledger');
    this.reconciliation = tableIdentifier(options.reconciliationTableName ?? 'jhadina_connector_execution_reconciliation');
  }

  async recordObservation(input: RecoveryObservation): Promise<void> {
    const status = input.observedState === 'SUCCEEDED'
      ? 'confirmed_executed'
      : input.observedState === 'FAILED' || input.observedState === 'NOT_FOUND'
        ? 'confirmed_not_executed'
        : input.observedState === 'CONFLICT'
          ? 'indeterminate'
          : 'unknown';

    await this.client.query(
      `INSERT INTO ${this.reconciliation} (execution_id, proposal_hash, status, provider_operation, provider_reference, observed_state, evidence, evidence_hash, adapter_id, adapter_version, checked_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11)
       ON CONFLICT (execution_id, evidence_hash) DO NOTHING`,
      [input.executionId, input.proposalHash, status, input.providerOperation, input.providerReference ?? null, input.observedState, JSON.stringify(input.evidence), input.evidenceHash, input.adapterId, input.adapterVersion, input.checkedAt],
    );
  }

  async markAttemptResolved(input: {
    attemptId: string;
    state: 'SUCCEEDED' | 'FAILED' | 'UNKNOWN' | 'RECOVERY_REQUIRED';
    providerReference?: string;
    reason: string;
    observation: RecoveryObservation;
  }): Promise<void> {
    const state = input.state === 'SUCCEEDED' ? 'recovered' : input.state === 'FAILED' ? 'failed' : 'recovery_required';
    await this.client.query(
      `UPDATE ${this.ledger}
       SET state=$2, response=$3::jsonb, error=$4, completed_at=CASE WHEN $2 IN ('recovered','failed') THEN $5 ELSE completed_at END, updated_at=CURRENT_TIMESTAMP
       WHERE execution_id=$1`,
      [input.attemptId, state, JSON.stringify({ providerReference: input.providerReference, reason: input.reason, observation: input.observation }), input.state === 'FAILED' ? input.reason : null, input.observation.checkedAt],
    );
  }

  async ensureExecutionLedger(attempt: ExecutionAttempt, approvalId?: string): Promise<void> {
    await this.client.query(
      `INSERT INTO ${this.ledger} (execution_id, approval_id, proposal_id, proposal_hash, idempotency_key, connector_id, operation, actor_id, correlation_id, state, started_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'recovery_required',$10)
       ON CONFLICT (execution_id) DO NOTHING`,
      [attempt.attemptId, approvalId ?? null, attempt.requestId, attempt.actionFingerprint, attempt.idempotencyKey, attempt.provider, attempt.operation, null, attempt.requestId, attempt.startedAt],
    );
  }
}
