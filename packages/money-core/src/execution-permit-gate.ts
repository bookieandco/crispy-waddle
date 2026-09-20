import type { ActionRequest } from '@jhadina/action-core';
import {
  bindActionCoreAuthority,
  fingerprintActionRequest,
} from './action-core-authority-bridge.js';
import {
  consumeExecutionPermit,
  verifyExecutionPermit,
  type ExecutionAction,
  type PermitStore,
} from './execution-permit.js';

export type MoneyExecutionPermit = Readonly<{
  permitId: string;
  nonce: string;
  authorityId: string;
  actionRequestFingerprint: string;
  policyVersion: string;
  policyHash: string;
  approvalId?: string;
  opportunityId?: string;
  riskDecisionId?: string;
  allocationDecisionId?: string;
}>;

/**
 * Converts a governed Money write into the exact economic action fingerprinted
 * by the execution permit. Authority metadata stays outside the economics.
 */
export function toExecutionAction(
  action: {
    capability: string;
    provider: string;
    accountId?: string;
    fromAccountId?: string;
    toAccountId?: string;
    payeeId?: string;
    instrumentId?: string;
    amount: number;
    currency: string;
  },
  request: ActionRequest<unknown>,
): ExecutionAction {
  if (!request.userId) throw new Error('MONEY_USER_REQUIRED');
  return {
    actionId: request.id,
    userId: request.userId,
    capability: action.capability,
    provider: action.provider,
    accountId: action.accountId,
    fromAccountId: action.fromAccountId,
    toAccountId: action.toAccountId,
    payeeId: action.payeeId,
    instrumentId: action.instrumentId,
    amount: String(action.amount),
    currency: action.currency,
  };
}

/**
 * Final Money execution gate.
 *
 * Action Core policy/approval has already completed before its handler runs.
 * This gate does not perform a second policy or approval decision. It proves
 * that the exact ActionRequest is bound to the exact single-use Money permit,
 * verifies every economic/policy binding, then consumes that permit atomically.
 */
export async function authorizeAndConsumeMoneyPermit(
  store: PermitStore,
  permit: MoneyExecutionPermit,
  request: ActionRequest<unknown>,
  action: ExecutionAction,
  now: string,
): Promise<void> {
  const stored = await store.get(permit.permitId);
  if (!stored) {
    throw new Error('MONEY_EXECUTION_PERMIT_NOT_FOUND');
  }

  const requestFingerprint = fingerprintActionRequest(request);
  if (permit.actionRequestFingerprint !== requestFingerprint) {
    throw new Error('MONEY_EXECUTION_REQUEST_FINGERPRINT_MISMATCH');
  }
  if (permit.authorityId !== stored.binding.authorityId) {
    throw new Error('MONEY_EXECUTION_AUTHORITY_MISMATCH');
  }

  bindActionCoreAuthority(request, action, stored);

  verifyExecutionPermit(stored, {
    action,
    actionRequestFingerprint: permit.actionRequestFingerprint,
    authorityId: permit.authorityId,
    policyVersion: permit.policyVersion,
    policyHash: permit.policyHash,
    now,
    approvalId: permit.approvalId,
    opportunityId: permit.opportunityId,
    riskDecisionId: permit.riskDecisionId,
    allocationDecisionId: permit.allocationDecisionId,
  });

  await consumeExecutionPermit(
    store,
    permit.permitId,
    permit.nonce,
  );
}
