import type { ApprovalReceipt, ApprovalReceiptStore } from './approval-receipt.js';
import type { AuditRpcClient } from './supabase-audit-ledger.js';

type ApprovalReceiptRow = {
  id: string;
  action_id: string;
  user_id: string;
  type: string;
  fingerprint: string;
  status: ApprovalReceipt['status'];
  requested_at: string;
  approved_at: string | null;
  expires_at: string;
  consumed_at: string | null;
};

function toReceipt(row: ApprovalReceiptRow): ApprovalReceipt {
  return {
    id: row.id,
    actionId: row.action_id,
    userId: row.user_id,
    type: row.type,
    fingerprint: row.fingerprint,
    status: row.status,
    requestedAt: row.requested_at,
    ...(row.approved_at ? { approvedAt: row.approved_at } : {}),
    expiresAt: row.expires_at,
    ...(row.consumed_at ? { consumedAt: row.consumed_at } : {}),
  };
}

/**
 * Durable approval store backed by atomic Postgres RPCs.
 *
 * The database owns the state transition for approve/consume so two workers
 * cannot both consume the same approval receipt. The ActionExecutor remains
 * the authorization boundary; this class only makes its receipt state durable.
 */
export class SupabaseApprovalReceiptStore implements ApprovalReceiptStore {
  constructor(private readonly client: AuditRpcClient) {}

  async createPending(input: {
    actionId: string;
    userId: string;
    type: string;
    fingerprint: string;
    expiresAt: string;
  }): Promise<ApprovalReceipt> {
    const { data, error } = await this.client.rpc<ApprovalReceiptRow>('create_jhadina_approval_receipt', {
      p_action_id: input.actionId,
      p_user_id: input.userId,
      p_type: input.type,
      p_fingerprint: input.fingerprint,
      p_expires_at: input.expiresAt,
    });
    if (error) throw new Error(`DURABLE_APPROVAL_CREATE_FAILED:${error.message}`);
    if (!data) throw new Error('DURABLE_APPROVAL_CREATE_FAILED:NO_RECEIPT');
    return toReceipt(data);
  }

  async approve(receiptId: string, userId: string): Promise<ApprovalReceipt> {
    const { data, error } = await this.client.rpc<ApprovalReceiptRow>('approve_jhadina_approval_receipt', {
      p_receipt_id: receiptId,
      p_user_id: userId,
    });
    if (error) throw new Error(`DURABLE_APPROVAL_APPROVE_FAILED:${error.message}`);
    if (!data) throw new Error('Approval receipt cannot be approved');
    return toReceipt(data);
  }

  async consume(
    receiptId: string,
    expected: { actionId: string; userId: string; type: string; fingerprint: string },
  ): Promise<boolean> {
    const { data, error } = await this.client.rpc<boolean>('consume_jhadina_approval_receipt', {
      p_receipt_id: receiptId,
      p_action_id: expected.actionId,
      p_user_id: expected.userId,
      p_type: expected.type,
      p_fingerprint: expected.fingerprint,
    });
    if (error) throw new Error(`DURABLE_APPROVAL_CONSUME_FAILED:${error.message}`);
    return data === true;
  }
}
