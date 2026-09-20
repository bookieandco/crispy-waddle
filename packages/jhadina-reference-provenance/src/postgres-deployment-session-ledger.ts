import type { ArtifactLedgerSqlClient } from './postgres-artifact-admission-ledger.js';
import type {
  ArtifactRevocationReceipt,
  DeploymentSession,
  DeploymentSessionEvent,
  DeploymentSessionLedger,
} from './deployment-session.js';

type SessionRow = { session_json: DeploymentSession | string };
type RevocationRow = { receipt_json: ArtifactRevocationReceipt | string };

function parse<T>(value: T | string): T {
  return typeof value === 'string' ? JSON.parse(value) as T : value;
}

export class PostgresDeploymentSessionLedger
  implements DeploymentSessionLedger
{
  constructor(private readonly client: ArtifactLedgerSqlClient) {}

  async appendSession(session: DeploymentSession): Promise<void> {
    const result = await this.client.query<{ session_id: string }>(
      `INSERT INTO reference_deployment_sessions (
        session_id,deployment_id,subsystem,runtime_instance_id,
        artifact_id,pin_id,artifact_digest,admission_id,state,
        started_at,last_heartbeat_at,heartbeat_expires_at,
        stopped_at,invalidated_at,invalidation_revocation_id,
        session_hash,session_json
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb
      ) ON CONFLICT (session_id) DO NOTHING RETURNING session_id`,
      [
        session.sessionId, session.deploymentId, session.subsystem,
        session.runtimeInstanceId, session.artifactId, session.pinId,
        session.artifactDigest, session.admissionId, session.state,
        session.startedAt, session.lastHeartbeatAt, session.heartbeatExpiresAt,
        session.stoppedAt ?? null, session.invalidatedAt ?? null,
        session.invalidationRevocationId ?? null, session.sessionHash,
        JSON.stringify(session),
      ],
    );
    if (result.rows.length !== 1) throw new Error('REF_PROV_08_SESSION_EXISTS');
  }

  async getSession(sessionId: string): Promise<DeploymentSession | undefined> {
    const result = await this.client.query<SessionRow>(
      `SELECT session_json FROM reference_deployment_sessions
       WHERE session_id=$1 LIMIT 1`,
      [sessionId],
    );
    return result.rows[0] ? parse(result.rows[0].session_json) : undefined;
  }

  async replaceSession(
    expectedSessionHash: string,
    session: DeploymentSession,
  ): Promise<boolean> {
    const result = await this.client.query<{ session_id: string }>(
      `UPDATE reference_deployment_sessions SET
        state=$2,last_heartbeat_at=$3,heartbeat_expires_at=$4,
        stopped_at=$5,invalidated_at=$6,invalidation_revocation_id=$7,
        session_hash=$8,session_json=$9::jsonb,updated_at=CURRENT_TIMESTAMP
       WHERE session_id=$1 AND session_hash=$10
       RETURNING session_id`,
      [
        session.sessionId, session.state, session.lastHeartbeatAt,
        session.heartbeatExpiresAt, session.stoppedAt ?? null,
        session.invalidatedAt ?? null, session.invalidationRevocationId ?? null,
        session.sessionHash, JSON.stringify(session), expectedSessionHash,
      ],
    );
    return result.rows.length === 1;
  }

  async appendEvent(event: DeploymentSessionEvent): Promise<void> {
    const result = await this.client.query<{ event_id: string }>(
      `INSERT INTO reference_deployment_session_events (
        event_id,session_id,kind,occurred_at,session_hash,event_json
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb)
      ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
      [
        event.eventId, event.sessionId, event.kind, event.occurredAt,
        event.sessionHash, JSON.stringify(event),
      ],
    );
    if (result.rows.length === 1) return;
    const existing = await this.client.query<{ session_hash: string }>(
      `SELECT session_hash FROM reference_deployment_session_events
       WHERE event_id=$1 LIMIT 1`,
      [event.eventId],
    );
    if (existing.rows[0]?.session_hash !== event.sessionHash) {
      throw new Error('REF_PROV_08_EVENT_IMMUTABLE');
    }
  }

  async appendRevocation(receipt: ArtifactRevocationReceipt): Promise<void> {
    const result = await this.client.query<{ revocation_id: string }>(
      `INSERT INTO reference_artifact_revocations (
        revocation_id,target_type,target_id,reason,revoked_at,
        superseded_by,receipt_hash,receipt_json
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
      ON CONFLICT (revocation_id) DO NOTHING RETURNING revocation_id`,
      [
        receipt.revocationId, receipt.targetType, receipt.targetId,
        receipt.reason, receipt.revokedAt, receipt.supersededBy ?? null,
        receipt.receiptHash, JSON.stringify(receipt),
      ],
    );
    if (result.rows.length === 1) return;
    const existing = await this.client.query<{ receipt_hash: string }>(
      `SELECT receipt_hash FROM reference_artifact_revocations
       WHERE revocation_id=$1 LIMIT 1`,
      [receipt.revocationId],
    );
    if (existing.rows[0]?.receipt_hash !== receipt.receiptHash) {
      throw new Error('REF_PROV_08_REVOCATION_IMMUTABLE');
    }
  }

  async getRevocationsForDeployment(
    admissionId: string,
    pinId: string,
    artifactDigest: string,
  ): Promise<readonly ArtifactRevocationReceipt[]> {
    const result = await this.client.query<RevocationRow>(
      `SELECT receipt_json FROM reference_artifact_revocations
       WHERE (target_type='ADMISSION' AND target_id=$1)
          OR (target_type='ARTIFACT_PIN' AND target_id=$2)
          OR (target_type='ARTIFACT_DIGEST' AND target_id=$3)
       ORDER BY revoked_at ASC, revocation_id ASC`,
      [admissionId, pinId, artifactDigest],
    );
    return result.rows.map((row) => parse(row.receipt_json));
  }
}
