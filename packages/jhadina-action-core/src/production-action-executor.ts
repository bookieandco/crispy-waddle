import type { ActionHandler, ActionPolicy, ActionRequest } from './action-executor.js';
import type { ApprovalReceiptVerifier } from './approval-receipt.js';
import { SupabaseAuditLedger, type AuditRpcClient } from './supabase-audit-ledger.js';
import { VerifiedActionExecutor, type ActionIdentityVerifier } from './verified-action-executor.js';

export type ProductionActionExecutorOptions<TAction = unknown, TResult = unknown> = {
  identityVerifier: ActionIdentityVerifier;
  policy: ActionPolicy<TAction>;
  handlers: readonly ActionHandler<TAction, TResult>[];
  supabase: AuditRpcClient;
  approvalReceipts?: ApprovalReceiptVerifier<TAction>;
  domain?: string;
  capabilityForType?: (type: string) => string;
};

/** Production composition root: verified identity + policy + durable audit + optional durable approval. */
export function createProductionActionExecutor<TAction = unknown, TResult = unknown>(
  options: ProductionActionExecutorOptions<TAction, TResult>,
): VerifiedActionExecutor<TAction, TResult> {
  const ledger = new SupabaseAuditLedger({
    client: options.supabase,
    domain: options.domain,
    capabilityForType: options.capabilityForType,
  });

  return new VerifiedActionExecutor(
    options.identityVerifier,
    options.policy,
    ledger,
    options.handlers,
    options.approvalReceipts,
  );
}

export type { ActionRequest };
