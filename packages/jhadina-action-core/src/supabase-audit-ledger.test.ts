import { SupabaseAuditLedger, type AuditRpcClient } from './supabase-audit-ledger.js';
import type { ActionAuditEvent } from './action-executor.js';

class FakeRpcClient implements AuditRpcClient {
  calls: Array<{ fn: string; args: Record<string, unknown> }> = [];

  async rpc<T = unknown>(fn: string, args: Record<string, unknown>) {
    this.calls.push({ fn, args });
    return { data: null as T | null, error: null };
  }
}

const client = new FakeRpcClient();
const ledger = new SupabaseAuditLedger({
  client,
  domain: 'money',
  capabilityForType: (type) => `money.${type}`,
});

const event: ActionAuditEvent = {
  id: 'action-1:completed',
  actionId: 'action-1',
  userId: '00000000-0000-0000-0000-000000000001',
  type: 'account.read',
  status: 'completed',
  timestamp: '2026-08-10T00:00:00.000Z',
};

await ledger.append(event);

if (client.calls.length !== 1) throw new Error('DURABLE_AUDIT_RPC_NOT_CALLED');
const call = client.calls[0];
if (call.fn !== 'append_jhadina_audit_event') throw new Error('DURABLE_AUDIT_WRONG_RPC');
if (call.args.p_actor_id !== event.userId) throw new Error('DURABLE_AUDIT_WRONG_ACTOR');
if (call.args.p_event_id !== event.id) throw new Error('DURABLE_AUDIT_WRONG_EVENT');
if (call.args.p_capability !== 'money.account.read') throw new Error('DURABLE_AUDIT_WRONG_CAPABILITY');
