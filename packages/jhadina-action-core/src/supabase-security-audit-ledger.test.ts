import { SupabaseSecurityAuditLedger } from './supabase-security-audit-ledger.js';
import type { AuditRpcClient } from './supabase-audit-ledger.js';
import type { AuditSecurityEvent } from '../../security-core/src/index.js';

class FakeRpcClient implements AuditRpcClient {
  calls: Array<{ fn: string; args: Record<string, unknown> }> = [];

  async rpc<T = unknown>(fn: string, args: Record<string, unknown>) {
    this.calls.push({ fn, args });
    return {
      data: { previous_hash: 'prev-1', hash: 'hash-1' } as T,
      error: null,
    };
  }
}

const client = new FakeRpcClient();
const ledger = new SupabaseSecurityAuditLedger({ client, domain: 'money' });

const event: AuditSecurityEvent = {
  id: 'security-1',
  requestId: 'request-1',
  actorId: 'user-1',
  domain: 'security',
  capability: 'financial.execute',
  decision: 'approval_required',
  occurredAt: '2026-09-01T00:00:00.000Z',
  previousHash: 'DURABLE',
  eventHash: 'DURABLE',
};

const result = await ledger.append(event);
const call = client.calls[0];
if (call.fn !== 'append_jhadina_audit_event') throw new Error('SECURITY_AUDIT_WRONG_RPC');
if (call.args.p_domain !== 'money') throw new Error('SECURITY_AUDIT_WRONG_DOMAIN');
if (call.args.p_actor_id !== 'user-1') throw new Error('SECURITY_AUDIT_WRONG_ACTOR');
if (call.args.p_decision !== 'approval_required') throw new Error('SECURITY_AUDIT_DECISION_LOST');
if (call.args.p_status !== 'approval_required') throw new Error('SECURITY_AUDIT_STATUS_WRONG');
if ((call.args.p_metadata as Record<string, unknown>).securityDecision !== 'approval_required') {
  throw new Error('SECURITY_AUDIT_METADATA_WRONG');
}
if (result.previousHash !== 'prev-1' || result.eventHash !== 'hash-1') {
  throw new Error('SECURITY_AUDIT_HASHES_NOT_RETURNED');
}

console.log('Supabase security audit ledger passed');
