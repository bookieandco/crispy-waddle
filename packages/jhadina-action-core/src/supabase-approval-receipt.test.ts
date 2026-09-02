import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { SupabaseApprovalReceiptStore } from './supabase-approval-receipt.js';

type RpcCall = { fn: string; args: Record<string, unknown> };

function fakeClient() {
  const calls: RpcCall[] = [];
  const row = {
    id: '00000000-0000-0000-0000-000000000001',
    action_id: 'action-1',
    user_id: 'user-1',
    type: 'financial.execute',
    fingerprint: 'fp-1',
    status: 'pending' as const,
    requested_at: '2026-09-01T00:00:00.000Z',
    approved_at: null,
    expires_at: '2026-09-01T00:05:00.000Z',
    consumed_at: null,
  };
  return {
    calls,
    client: {
      async rpc<T = unknown>(fn: string, args: Record<string, unknown>) {
        calls.push({ fn, args });
        if (fn === 'create_jhadina_approval_receipt') return { data: row as T, error: null };
        if (fn === 'approve_jhadina_approval_receipt') {
          return { data: { ...row, status: 'approved', approved_at: '2026-09-01T00:01:00.000Z' } as T, error: null };
        }
        return { data: true as T, error: null };
      },
    },
  };
}

describe('SupabaseApprovalReceiptStore', () => {
  it('uses the durable create RPC and reconstructs the canonical receipt', async () => {
    const { client, calls } = fakeClient();
    const store = new SupabaseApprovalReceiptStore(client);
    const receipt = await store.createPending({
      actionId: 'action-1', userId: 'user-1', type: 'financial.execute', fingerprint: 'fp-1',
      expiresAt: '2026-09-01T00:05:00.000Z',
    });
    assert.equal(receipt.id, '00000000-0000-0000-0000-000000000001');
    assert.equal(calls[0]?.fn, 'create_jhadina_approval_receipt');
    assert.equal(calls[0]?.args.p_user_id, 'user-1');
  });

  it('binds approval to the authenticated user supplied by the application boundary', async () => {
    const { client, calls } = fakeClient();
    const store = new SupabaseApprovalReceiptStore(client);
    await store.approve('00000000-0000-0000-0000-000000000001', 'user-1');
    assert.equal(calls[0]?.fn, 'approve_jhadina_approval_receipt');
    assert.equal(calls[0]?.args.p_user_id, 'user-1');
  });

  it('consumes with the complete action binding and returns the atomic RPC result', async () => {
    const { client, calls } = fakeClient();
    const store = new SupabaseApprovalReceiptStore(client);
    assert.equal(await store.consume('00000000-0000-0000-0000-000000000001', {
      actionId: 'action-1', userId: 'user-1', type: 'financial.execute', fingerprint: 'fp-1',
    }), true);
    assert.deepEqual(calls[0]?.args, {
      p_receipt_id: '00000000-0000-0000-0000-000000000001',
      p_action_id: 'action-1',
      p_user_id: 'user-1',
      p_type: 'financial.execute',
      p_fingerprint: 'fp-1',
    });
  });
});
