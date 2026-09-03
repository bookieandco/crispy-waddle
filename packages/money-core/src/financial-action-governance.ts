/**
 * Canonical Money Core boundary between agent intent and financial execution.
 *
 * This is deliberately dependency-light: action-core owns runtime execution,
 * while Money Core owns the financial meaning and bindings that must survive
 * the hand-off. The executor must re-check the same bindings before mutation.
 */

import type { AllocationDecision, CapitalAllocationDecision, OpportunityCandidate } from './financial-intelligence-contracts.js';
import type { RiskDecision } from './opportunity-risk-allocation.js';

export type PolicyDecision = 'ALLOW' | 'DENY' | 'APPROVAL_REQUIRED' | 'HALT';

export interface ActionProposal {
  actionId: string;
  userId: string;
  capability: string;
  instrumentId?: string;
  provider?: string;
  accountId?: string;
  amount?: number;
  currency?: string;
  opportunityId?: string;
  allocationDecisionId?: string;
  riskDecisionId?: string;
  actionFingerprint: string;
  policyVersion: string;
  requestedAt: string;
  expiresAt: string;
}

export interface PolicyDecisionRecord {
  decisionId: string;
  actionId: string;
  userId: string;
  decision: PolicyDecision;
  reasonCodes: string[];
  policyVersion: string;
  policyHash: string;
  evaluatedAt: string;
  expiresAt: string;
}

export interface AuditReceipt {
  receiptId: string;
  actionId: string;
  decisionId: string;
  userId: string;
  actionFingerprint: string;
  policyHash: string;
  evidenceIds: string[];
  riskDecisionId?: string;
  allocationDecisionId?: string;
  authorizationState: PolicyDecision;
  issuedAt: string;
  expiresAt: string;
  resultHash?: string;
}

export interface FinancialActionBinding {
  proposal: ActionProposal;
  policy: PolicyDecisionRecord;
  receipt: AuditReceipt;
}

const FINANCIAL_MUTATION_PREFIXES = [
  'money.payment.',
  'money.transfer.',
  'money.account.change',
  'money.order.',
  'money.trade.',
  'money.borrow.',
  'money.allocate.',
];

export function assertProposalIsFinanciallyBound(proposal: ActionProposal): void {
  if (!proposal.actionId || !proposal.userId || !proposal.capability) {
    throw new Error('MONEY_ACTION_PROPOSAL_INCOMPLETE');
  }
  if (!proposal.actionFingerprint || !proposal.policyVersion) {
    throw new Error('MONEY_ACTION_BINDING_INCOMPLETE');
  }
  if (proposal.expiresAt <= proposal.requestedAt) {
    throw new Error('MONEY_ACTION_EXPIRY_INVALID');
  }
}

export function isFinancialMutationCapability(capability: string): boolean {
  return FINANCIAL_MUTATION_PREFIXES.some((prefix) => capability.startsWith(prefix));
}

export function assertPolicyAllowsExecution(binding: FinancialActionBinding, now: string): void {
  assertProposalIsFinanciallyBound(binding.proposal);
  if (binding.policy.actionId !== binding.proposal.actionId || binding.policy.userId !== binding.proposal.userId) {
    throw new Error('MONEY_POLICY_BINDING_MISMATCH');
  }
  if (binding.receipt.actionId !== binding.proposal.actionId || binding.receipt.decisionId !== binding.policy.decisionId) {
    throw new Error('MONEY_RECEIPT_BINDING_MISMATCH');
  }
  if (binding.proposal.actionFingerprint !== binding.receipt.actionFingerprint) {
    throw new Error('MONEY_ACTION_FINGERPRINT_MISMATCH');
  }
  if (binding.policy.policyHash !== binding.receipt.policyHash) {
    throw new Error('MONEY_POLICY_HASH_MISMATCH');
  }
  if (now >= binding.proposal.expiresAt || now >= binding.policy.expiresAt || now >= binding.receipt.expiresAt) {
    throw new Error('MONEY_AUTHORIZATION_EXPIRED');
  }
  if (binding.policy.decision !== 'ALLOW') {
    throw new Error(`MONEY_EXECUTION_NOT_ALLOWED:${binding.policy.decision}`);
  }
}

export function createActionProposalFromAllocation(
  opportunity: OpportunityCandidate,
  risk: RiskDecision,
  allocation: CapitalAllocationDecision,
  input: {
    actionId: string;
    userId: string;
    capability: string;
    amount: number;
    currency: string;
    provider?: string;
    accountId?: string;
    now: string;
    expiresAt: string;
  },
): ActionProposal {
  if (allocation.decision !== ('APPROVE' as AllocationDecision)) {
    throw new Error(`MONEY_ALLOCATION_NOT_EXECUTABLE:${allocation.decision}`);
  }
  if (risk.decision !== 'PASS') throw new Error(`MONEY_RISK_NOT_EXECUTABLE:${risk.decision}`);
  if (allocation.request.opportunityId !== opportunity.opportunityId) throw new Error('MONEY_OPPORTUNITY_BINDING_MISMATCH');
  if (allocation.request.riskDecisionId !== risk.riskDecisionId) throw new Error('MONEY_RISK_BINDING_MISMATCH');
  if (allocation.approvedAmount !== input.amount) throw new Error('MONEY_ALLOCATION_AMOUNT_MISMATCH');

  return {
    actionId: input.actionId,
    userId: input.userId,
    capability: input.capability,
    instrumentId: opportunity.instrumentId,
    provider: input.provider,
    accountId: input.accountId,
    amount: input.amount,
    currency: input.currency,
    opportunityId: opportunity.opportunityId,
    allocationDecisionId: allocation.allocationDecisionId,
    riskDecisionId: risk.riskDecisionId,
    actionFingerprint: opportunity.prediction.inputHash,
    policyVersion: allocation.request.policyVersion,
    requestedAt: input.now,
    expiresAt: input.expiresAt,
  };
}
