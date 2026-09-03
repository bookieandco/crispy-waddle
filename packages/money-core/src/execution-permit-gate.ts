import type { ActionRequest } from '@jhadina/action-core';
import {
  consumeExecutionPermit,
  verifyExecutionPermit,
  type ExecutionAction,
  type PermitStore,
} from './execution-permit.js';

export type MoneyExecutionPermit = {
  permitId: string;
  nonce: string;
  policyVersion: string;
  policyHash: string;
  approvalId?: string;
  opportunityId?: string;
  riskDecisionId?: string;
  allocationDecisionId?: string;
};

/**
 * Converts a governed Money write into the canonical execution action used by
 * the permit fingerprint. Permit metadata is intentionally kept outside the
 * economic action so changing the permit cannot mutate the economics.
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

export async function authorizeAndConsumeMoneyPermit(
  store: PermitStore,
  permit: MoneyExecutionPermit,
  action: ExecutionAction,
  now: string,
): Promise<void> {
  const stored = await store.get(permit.permitId);
  if (!stored) throw new Error('MONEY_EXECUTION_PERMIT_NOT_FOUND');

  verifyExecutionPermit(stored, {
    action,
    policyVersion: permit.policyVersion,
    policyHash: permit.policyHash,
    now,
    approvalId: permit.approvalId,
    opportunityId: permit.opportunityId,
    riskDecisionId: permit.riskDecisionId,
    allocationDecisionId: permit.allocationDecisionId,
  });

  await consumeExecutionPermit(store, permit.permitId, permit.nonce);
}
