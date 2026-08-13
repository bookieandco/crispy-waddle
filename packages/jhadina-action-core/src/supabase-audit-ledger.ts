import type { ActionAuditEvent, ActionLedger } from './action-executor.js';

export interface AuditRpcClient {
  rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<{ data: T | null; error: { message: string } | null }>;
}

export type SupabaseAuditLedgerOptions = {
  client: AuditRpcClient;
  domain?: string;
  capabilityForType?: (type: string) => string;
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
}
