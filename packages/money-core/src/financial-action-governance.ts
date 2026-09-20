/**
 * MONEY-R1C — preparation boundary from financial research/allocation into
 * Jhadina Action Core.
 *
 * This file deliberately does NOT define a second Money policy/approval/audit
 * authority model. It only prepares an ActionRequest. Action Core owns policy
 * and approval authority; Money's execution permit is issued downstream and
 * must bind back to the exact ActionRequest.
 */
import type { ActionRequest } from '@jhadina/action-core';
import type {
  AllocationDecision,
  CapitalAllocationDecision,
  OpportunityCandidate,
} from './financial-intelligence-contracts.js';
import type { RiskDecision } from './opportunity-risk-allocation.js';

export type FinancialExecutionIntent = Readonly<{
  capability: string;
  provider: string;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  payeeId?: string;
  instrumentId?: string;
  amount: number;
  currency: string;
  opportunityId: string;
  riskDecisionId: string;
  allocationDecisionId: string;
}>;

const FINANCIAL_MUTATION_PREFIXES = [
  'money.payment.',
  'money.transfer.',
  'money.account.change',
  'money.order.',
  'money.trade.',
  'money.borrow.',
  'money.allocate.',
] as const;

export function isFinancialMutationCapability(capability: string): boolean {
  return FINANCIAL_MUTATION_PREFIXES.some((prefix) =>
    capability.startsWith(prefix),
  );
}

export function createFinancialActionRequestFromAllocation(
  opportunity: OpportunityCandidate,
  risk: RiskDecision,
  allocation: CapitalAllocationDecision,
  input: Readonly<{
    actionId: string;
    userId: string;
    capability: string;
    provider: string;
    accountId?: string;
    fromAccountId?: string;
    toAccountId?: string;
    payeeId?: string;
    amount: number;
    currency: string;
    requestedAt: string;
  }>,
): ActionRequest<FinancialExecutionIntent> {
  if (allocation.decision !== ('APPROVE' as AllocationDecision)) {
    throw new Error(
      `MONEY_ALLOCATION_NOT_ACTION_REQUEST_ELIGIBLE:${allocation.decision}`,
    );
  }
  if (risk.decision !== 'PASS') {
    throw new Error(
      `MONEY_RISK_NOT_ACTION_REQUEST_ELIGIBLE:${risk.decision}`,
    );
  }
  if (allocation.request.opportunityId !== opportunity.opportunityId) {
    throw new Error('MONEY_OPPORTUNITY_BINDING_MISMATCH');
  }
  if (allocation.request.riskDecisionId !== risk.riskDecisionId) {
    throw new Error('MONEY_RISK_BINDING_MISMATCH');
  }
  if (allocation.approvedAmount !== input.amount) {
    throw new Error('MONEY_ALLOCATION_AMOUNT_MISMATCH');
  }
  if (!isFinancialMutationCapability(input.capability)) {
    throw new Error('MONEY_FINANCIAL_MUTATION_CAPABILITY_REQUIRED');
  }
  if (!input.actionId || !input.userId || !input.provider) {
    throw new Error('MONEY_ACTION_REQUEST_INCOMPLETE');
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('MONEY_ACTION_REQUEST_AMOUNT_INVALID');
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    throw new Error('MONEY_ACTION_REQUEST_CURRENCY_INVALID');
  }
  if (Number.isNaN(Date.parse(input.requestedAt))) {
    throw new Error('MONEY_ACTION_REQUEST_TIME_INVALID');
  }

  return Object.freeze({
    id: input.actionId,
    userId: input.userId,
    type: input.capability,
    requestedAt: input.requestedAt,
    action: Object.freeze({
      capability: input.capability,
      provider: input.provider,
      accountId: input.accountId,
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      payeeId: input.payeeId,
      instrumentId: opportunity.instrumentId,
      amount: input.amount,
      currency: input.currency,
      opportunityId: opportunity.opportunityId,
      riskDecisionId: risk.riskDecisionId,
      allocationDecisionId: allocation.allocationDecisionId,
    }),
  });
}
