import type { ActionResult } from './types.js';

/**
 * Structural contract for the authoritative policy result. The core-spine
 * package does not implement policy; security-core supplies the authority.
 */
export interface CanonicalPolicyDecision {
  id: string;
  requestId: string;
  actorId: string;
  domain: string;
  capability: string;
  resourceId?: string;
  decision: 'allow' | 'approval_required' | 'deny';
  policyVersion: string;
  decidedAt: string;
  expiresAt: string;
  reason?: string;
}

/**
 * Concrete action request produced by an application adapter before policy.
 * No side effect is implied by preparation.
 */
export interface CanonicalActionRequest {
  id: string;
  proposalId: string;
  actorId: string;
  capability: string;
  operation: string;
  input: unknown;
  reversible: boolean;
  consequenceLevel: 'low' | 'medium' | 'high' | 'critical';
  resourceId?: string;
  requestedAt: string;
  expiresAt: string;
  amountMinor?: number;
  recipient?: string;
  platform?: string;
}

export interface CanonicalActionPort {
  prepare(proposal: import('./types.js').DecisionProposal): Promise<CanonicalActionRequest | undefined>;
  execute(request: CanonicalActionRequest, policy: CanonicalPolicyDecision): Promise<ActionResult>;
}

export interface CanonicalPolicyPort {
  evaluate(request: CanonicalActionRequest): Promise<CanonicalPolicyDecision>;
}
