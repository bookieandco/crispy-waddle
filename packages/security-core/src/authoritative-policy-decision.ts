import type { SecurityDecision } from './index.js';

export type AuthoritativePolicyDecision = {
  decisionId: string;
  requestId: string;
  actorId: string;
  domain: string;
  capability: string;
  resourceId?: string;
  decision: SecurityDecision;
  policyVersion: string;
  decidedAt: number;
  expiresAt: number;
};

export type PolicyDecisionInput = Omit<AuthoritativePolicyDecision, 'decisionId' | 'decidedAt'> & {
  decisionId?: string;
  decidedAt?: number;
};

export function createAuthoritativePolicyDecision(input: PolicyDecisionInput): AuthoritativePolicyDecision {
  const decidedAt = input.decidedAt ?? Date.now();
  const expiresAt = input.expiresAt;
  if (!input.requestId || !input.actorId || !input.domain || !input.capability || !input.policyVersion) {
    throw new Error('POLICY_DECISION_BINDING_REQUIRED');
  }
  if (!Number.isSafeInteger(decidedAt) || !Number.isSafeInteger(expiresAt) || expiresAt <= decidedAt) {
    throw new Error('POLICY_DECISION_LIFETIME_INVALID');
  }
  return {
    decisionId: input.decisionId ?? crypto.randomUUID(),
    requestId: input.requestId,
    actorId: input.actorId,
    domain: input.domain,
    capability: input.capability,
    resourceId: input.resourceId,
    decision: input.decision,
    policyVersion: input.policyVersion,
    decidedAt,
    expiresAt,
  };
}

export function verifyAuthoritativePolicyDecision(
  decision: AuthoritativePolicyDecision,
  request: { requestId: string; actorId: string; domain: string; capability: string; resourceId?: string },
  now = Date.now(),
): boolean {
  return Boolean(decision.decisionId && decision.policyVersion)
    && decision.requestId === request.requestId
    && decision.actorId === request.actorId
    && decision.domain === request.domain
    && decision.capability === request.capability
    && decision.resourceId === request.resourceId
    && decision.expiresAt > now
    && decision.decidedAt <= now
    && (decision.decision === 'allow' || decision.decision === 'approval_required' || decision.decision === 'deny');
}
