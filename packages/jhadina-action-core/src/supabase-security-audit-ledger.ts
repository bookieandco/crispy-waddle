import type { AuditSecurityEvent } from '../../security-core/src/index.js';
import type { AuditRpcClient } from './supabase-audit-ledger.js';

export type DurableSecurityAuditAppendResult = Pick<AuditSecurityEvent, 'previousHash' | 'eventHash'>;

export type SupabaseSecurityAuditLedgerOptions = {
  client: AuditRpcClient;
  domain?: string;
};

type SecurityAuditRow = {
  previous_hash: string;
  hash: string;
};

/**
 * SecurityCore's durable audit boundary. Reuses the canonical
 * append_jhadina_audit_event RPC/table; this adapter owns no second ledger.
 */
export class SupabaseSecurityAuditLedger {
  constructor(private readonly options: SupabaseSecurityAuditLedgerOptions) {}

  async append(event: AuditSecurityEvent): Promise<DurableSecurityAuditAppendResult> {
    const domain = this.options.domain ?? event.domain;
    const status = event.decision === 'approval_required'
      ? 'approval_required'
      : event.decision === 'deny'
        ? 'denied'
        : 'completed';

    const { data, error } = await this.options.client.rpc<SecurityAuditRow>('append_jhadina_audit_event', {
      p_event_id: event.id,
      p_request_id: event.requestId,
      p_actor_id: event.actorId,
      p_domain: domain,
      p_capability: event.capability,
      p_decision: event.decision,
      p_status: status,
      p_occurred_at: event.occurredAt,
      p_metadata: { securityDecision: event.decision },
    });

    if (error || !data) {
      throw new Error(`DURABLE_SECURITY_AUDIT_APPEND_FAILED:${error?.message ?? 'empty response'}`);
    }

    return { previousHash: data.previous_hash, eventHash: data.hash };
  }
}
