import { SupabaseAuditLedger, type AuditRpcClient } from './supabase-audit-ledger.js';
import type { ActionAuditEvent } from './action-executor.js';

class FakeRpcClient implements AuditRpcClient {
  calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  listResponse: unknown = [];

  async rpc<T = unknown>(fn: string, args: Record<string, unknown>) {
    this.calls.push({ fn, args });
    if (fn === 'list_jhadina_audit_events') {
      return { data: this.listResponse as T, error: null };
    }
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

// list() — a ledger not configured with a lossy capabilityForType, so
// the stored capability column round-trips faithfully as `type`.
const growthLedger = new SupabaseAuditLedger({ client, domain: 'growth' });
client.listResponse = [
  {
    event_id: 'growth-draft-approve:draft_1:1:abc',
    request_id: 'growth-draft-approve:draft_1:1',
    actor_id: 'user-1',
    capability: 'growth.draft.approve',
    status: 'completed',
    occurred_at: '2026-08-14T00:00:00.000Z',
    metadata: { decision: 'approval_required' },
  },
];

const events = await growthLedger.list({ domain: 'growth', actorId: 'user-1' });
if (events.length !== 1) throw new Error('DURABLE_AUDIT_LIST_WRONG_LENGTH');
if (events[0].id !== 'growth-draft-approve:draft_1:1:abc') throw new Error('DURABLE_AUDIT_LIST_WRONG_ID');
if (events[0].userId !== 'user-1') throw new Error('DURABLE_AUDIT_LIST_WRONG_ACTOR');
if (events[0].type !== 'growth.draft.approve') throw new Error('DURABLE_AUDIT_LIST_WRONG_TYPE');
if (events[0].status !== 'completed') throw new Error('DURABLE_AUDIT_LIST_WRONG_STATUS');

const listCall = client.calls[client.calls.length - 1];
if (listCall.fn !== 'list_jhadina_audit_events') throw new Error('DURABLE_AUDIT_LIST_WRONG_RPC');
if (listCall.args.p_domain !== 'growth' || listCall.args.p_actor_id !== 'user-1') {
  throw new Error('DURABLE_AUDIT_LIST_WRONG_ARGS');
}

console.log('Supabase audit ledger passed');
