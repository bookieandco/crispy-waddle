import type { AuditActorType, AuditEvent } from "../types.js";
import type { InMemoryStore } from "../storage/InMemoryStore.js";
import type { SqlClient } from "../storage/SqlClient.js";

export interface AppendAuditInput {
  actorType: AuditActorType;
  actorId: string;
  eventName: string;
  payload: Record<string, unknown>;
  triggeredBy: string;
  driverApproved: boolean | null;
}

export interface AuditRepository {
  append(input: AppendAuditInput): Promise<AuditEvent>;
  listRecent(limit?: number): Promise<AuditEvent[]>;
}

export class InMemoryAuditRepository implements AuditRepository {
  constructor(private readonly store: InMemoryStore) {}

  async append(input: AppendAuditInput): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: this.store.nextId("audit"),
      actorType: input.actorType,
      actorId: input.actorId,
      eventName: input.eventName,
      payload: input.payload,
      triggeredBy: input.triggeredBy,
      driverApproved: input.driverApproved,
      occurredAt: new Date().toISOString(),
    };
    this.store.auditEvents.push(event);
    return event;
  }

  async listRecent(limit = 50): Promise<AuditEvent[]> {
    return [...this.store.auditEvents]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, limit);
  }
}

export class PostgresAuditRepository implements AuditRepository {
  constructor(private readonly db: SqlClient) {}

  async append(input: AppendAuditInput): Promise<AuditEvent> {
    const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query<AuditRow>(
      `insert into truckeros_audit_events
         (id, actor_type, actor_id, event_name, payload, triggered_by, driver_approved)
       values ($1,$2,$3,$4,$5::jsonb,$6,$7)
       returning *`,
      [id, input.actorType, input.actorId, input.eventName, JSON.stringify(input.payload), input.triggeredBy, input.driverApproved]
    );
    return fromRow(result.rows[0]);
  }

  async listRecent(limit = 50): Promise<AuditEvent[]> {
    const result = await this.db.query<AuditRow>(
      `select * from truckeros_audit_events order by occurred_at desc limit $1`,
      [limit]
    );
    return result.rows.map(fromRow);
  }
}

interface AuditRow {
  id: string;
  actor_type: AuditActorType;
  actor_id: string;
  event_name: string;
  payload: Record<string, unknown>;
  triggered_by: string;
  driver_approved: boolean | null;
  occurred_at: string;
}

function fromRow(row: AuditRow): AuditEvent {
  return {
    id: row.id,
    actorType: row.actor_type,
    actorId: row.actor_id,
    eventName: row.event_name,
    payload: row.payload,
    triggeredBy: row.triggered_by,
    driverApproved: row.driver_approved,
    occurredAt: row.occurred_at,
  };
}
