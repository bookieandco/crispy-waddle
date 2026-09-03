import type { ExecutionPermit, PermitStore } from './execution-permit.js';
import type { SqlClient } from './postgres-idempotency-store.js';

type PermitRow = {
  permit_id: string;
  nonce: string;
  state: ExecutionPermit['state'];
  issued_at: string | Date;
  expires_at: string | Date;
  action_fingerprint: string;
  user_id: string;
  capability: string;
  provider: string;
  policy_version: string;
  policy_hash: string;
  approval_id: string | null;
  opportunity_id: string | null;
  risk_decision_id: string | null;
  allocation_decision_id: string | null;
};

export type PostgresPermitStoreOptions = {
  client: SqlClient;
  tableName?: string;
};

function assertSafeIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error('MONEY_PERMIT_TABLE_INVALID');
  }
  return value;
}

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toPermit(row: PermitRow): ExecutionPermit {
  return {
    permitId: row.permit_id,
    nonce: row.nonce,
    state: row.state,
    issuedAt: iso(row.issued_at),
    expiresAt: iso(row.expires_at),
    binding: {
      actionFingerprint: row.action_fingerprint,
      userId: row.user_id,
      capability: row.capability,
      provider: row.provider,
      policyVersion: row.policy_version,
      policyHash: row.policy_hash,
      approvalId: row.approval_id ?? undefined,
      opportunityId: row.opportunity_id ?? undefined,
      riskDecisionId: row.risk_decision_id ?? undefined,
      allocationDecisionId: row.allocation_decision_id ?? undefined,
    },
  };
}

/**
 * Durable PostgreSQL permit store.
 *
 * Single-use consumption is enforced by one conditional UPDATE. PostgreSQL
 * decides the race: exactly one concurrent caller can transition ISSUED to
 * CONSUMED, and expired permits cannot be consumed.
 */
export class PostgresPermitStore implements PermitStore {
  private readonly client: SqlClient;
  private readonly table: string;

  constructor(options: PostgresPermitStoreOptions) {
    this.client = options.client;
    this.table = assertSafeIdentifier(options.tableName ?? 'money_execution_permits');
  }

  async issue(permit: ExecutionPermit): Promise<void> {
    await this.client.query(
      `
        INSERT INTO ${this.table} (
          permit_id, nonce, state, issued_at, expires_at,
          action_fingerprint, user_id, capability, provider,
          policy_version, policy_hash, approval_id, opportunity_id,
          risk_decision_id, allocation_decision_id
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15
        )
      `,
      [
        permit.permitId,
        permit.nonce,
        permit.state,
        permit.issuedAt,
        permit.expiresAt,
        permit.binding.actionFingerprint,
        permit.binding.userId,
        permit.binding.capability,
        permit.binding.provider,
        permit.binding.policyVersion,
        permit.binding.policyHash,
        permit.binding.approvalId ?? null,
        permit.binding.opportunityId ?? null,
        permit.binding.riskDecisionId ?? null,
        permit.binding.allocationDecisionId ?? null,
      ],
    );
  }

  async get(permitId: string): Promise<ExecutionPermit | undefined> {
    const result = await this.client.query<PermitRow>(
      `
        SELECT permit_id, nonce, state, issued_at, expires_at,
               action_fingerprint, user_id, capability, provider,
               policy_version, policy_hash, approval_id, opportunity_id,
               risk_decision_id, allocation_decision_id
        FROM ${this.table}
        WHERE permit_id = $1
        LIMIT 1
      `,
      [permitId],
    );

    const row = result.rows[0];
    return row ? toPermit(row) : undefined;
  }

  async consume(permitId: string, nonce: string): Promise<boolean> {
    const result = await this.client.query<{ permit_id: string }>(
      `
        UPDATE ${this.table}
        SET state = 'CONSUMED',
            consumed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE permit_id = $1
          AND nonce = $2
          AND state = 'ISSUED'
          AND expires_at > CURRENT_TIMESTAMP
        RETURNING permit_id
      `,
      [permitId, nonce],
    );

    return result.rows.length === 1;
  }

  async revoke(permitId: string): Promise<void> {
    await this.client.query(
      `
        UPDATE ${this.table}
        SET state = 'REVOKED',
            revoked_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE permit_id = $1
          AND state = 'ISSUED'
          AND expires_at > CURRENT_TIMESTAMP
      `,
      [permitId],
    );
  }

  async haltAll(): Promise<void> {
    await this.client.query(
      `
        UPDATE ${this.table}
        SET state = 'HALTED',
            halted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE state = 'ISSUED'
          AND expires_at > CURRENT_TIMESTAMP
      `,
    );
  }
}
