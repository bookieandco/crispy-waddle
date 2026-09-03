/**
 * Deterministic spine from intelligence opportunity to governed allocation.
 * This module intentionally stops before execution/provider mutation.
 */

import {
  assertPositiveAmount,
  assertProbability,
  type CapitalAllocationDecision,
  type CapitalAllocationRequest,
  type OpportunityCandidate,
} from './financial-intelligence-contracts.js';

export interface RiskDecision {
  riskDecisionId: string;
  decision: 'PASS' | 'FAIL' | 'REVIEW' | 'HALT';
  maxLoss: number;
  confidence: number;
  policyVersion: string;
  inputHash: string;
  resultHash: string;
}

export interface AllocationContext {
  deployableCapital: number;
  protectedReserveFloor: number;
  existingAllocatedCapital: number;
  domainAllocatedCapital: number;
  domainBudget: number;
  risk: RiskDecision;
  policyVersion: string;
  policyHash: string;
  now: string;
}

export function evaluateOpportunity(
  opportunity: OpportunityCandidate,
  requestedAmount: number,
  context: AllocationContext,
): CapitalAllocationDecision {
  assertPositiveAmount(requestedAmount);
  assertProbability(opportunity.confidence);

  const reasons: string[] = [];
  let decision: CapitalAllocationDecision['decision'] = 'APPROVE';
  let approvedAmount = requestedAmount;

  if (context.risk.decision === 'HALT') {
    decision = 'HALT';
    approvedAmount = 0;
    reasons.push('RISK_HALT');
  } else if (context.risk.decision === 'FAIL') {
    decision = 'DENY';
    approvedAmount = 0;
    reasons.push('RISK_FAILED');
  } else if (context.risk.decision === 'REVIEW') {
    decision = 'REQUIRE_APPROVAL';
    reasons.push('RISK_REVIEW_REQUIRED');
  }

  if (requestedAmount > context.deployableCapital - context.protectedReserveFloor) {
    decision = 'DENY';
    approvedAmount = 0;
    reasons.push('PROTECTED_RESERVE_OR_DEPLOYABLE_CAPITAL_BREACH');
  }

  const remainingDomainBudget = Math.max(0, context.domainBudget - context.domainAllocatedCapital);
  if (requestedAmount > remainingDomainBudget) {
    decision = 'DENY';
    approvedAmount = 0;
    reasons.push('DOMAIN_BUDGET_BREACH');
  }

  if (opportunity.confidence <= 0) {
    decision = 'DENY';
    approvedAmount = 0;
    reasons.push('NO_CONFIDENCE');
  }

  const request: CapitalAllocationRequest = {
    allocationRequestId: `${opportunity.opportunityId}:${context.now}`,
    opportunityId: opportunity.opportunityId,
    userId: 'runtime-user',
    requestedAmount,
    currency: 'USD',
    domain: opportunity.assetClass,
    protectedReserveFloor: context.protectedReserveFloor,
    deployableCapitalSnapshotId: context.now,
    riskDecisionId: context.risk.riskDecisionId,
    policyVersion: context.policyVersion,
    actionFingerprint: opportunity.prediction.inputHash,
  };

  const resultHash = `${opportunity.opportunityId}:${approvedAmount}:${decision}:${context.policyHash}`;
  return {
    allocationDecisionId: `${request.allocationRequestId}:decision`,
    request,
    decision,
    approvedAmount,
    reasonCodes: reasons,
    expiresAt: opportunity.expiresAt,
    policyHash: context.policyHash,
    resultHash,
  };
}
