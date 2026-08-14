import type { ActionAuditEvent, ActionLedger } from './action-executor.js';

export interface AuditRpcClient {
  rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<{ data: T | null; error: { message: string } | null }>;
}

export type SupabaseAuditLedgerOptions = {
  client: AuditRpcClient;
  domain?: string;
  capabilityForType?: (type: string) => string;
};

export type ActionAuditListFilter = {
  domain: string;
  actorId: string;
};

type SupabaseAuditEventRow = {
  event_id: string;
  request_id: string;
  actor_id: string;
  capability: string;
  status: ActionAuditEvent['status'];
  occurred_at: string;
  metadata: Record<string, unknown> | null;
};

export class SupabaseAuditLedger implements ActionLedger {
  constructor(private readonly options: SupabaseAuditLedgerOptions) {}

  async append(event: ActionAuditEvent): Promise<void> {
    const decision = event.status === 'denied' ? 'deny' : 'allow';
    const domain = this.options.domain ?? 'jhadina-action';
    const capability = this.options.capabilityForType?.(event.type) ?? event.type;

    const { error } = await this.options.client.rpc('append_jhadina_audit_event', {
      p_event_id: event.id,
      p_request_id: event.actionId,
      p_actor_id: event.userId,
      p_domain: domain,
      p_capability: capability,
      p_decision: decision,
      p_status: event.status,
      p_occurred_at: event.timestamp,
      p_metadata: event.metadata ?? {},
    });

    if (error) {
      throw new Error(`DURABLE_AUDIT_APPEND_FAILED:${error.message}`);
    }
  }

  /**
   * Reads back events for exactly one domain/actor pair — never "all
   * events." Not part of the ActionLedger interface (append-only by
   * design, matching an audit ledger's actual invariant); this is
   * SupabaseAuditLedger's own extra capability, mirroring
   * InMemoryActionLedger's list() in spirit while matching what a
   * real, multi-tenant durable store needs: a scoped query, not
   * "return everything and let the caller filter."
   *
   * The reconstructed event's `type` is read back from the stored
   * `capability` column, so it is only faithful when this ledger was
   * configured without a many-to-one capabilityForType mapping — true
   * for every current caller, since each domain's action `type`
   * already *is* its capability string.
   */
  async list(filter: ActionAuditListFilter): Promise<ActionAuditEvent[]> {
    const { data, error } = await this.options.client.rpc<SupabaseAuditEventRow[]>('list_jhadina_audit_events', {
      p_domain: filter.domain,
      p_actor_id: filter.actorId,
    });

    if (error) {
      throw new Error(`DURABLE_AUDIT_LIST_FAILED:${error.message}`);
    }

    return (data ?? []).map((row) => ({
      id: row.event_id,
      actionId: row.request_id,
      userId: row.actor_id,
      type: row.capability,
      status: row.status,
      timestamp: row.occurred_at,
      metadata: row.metadata ?? undefined,
    }));
  }
}
