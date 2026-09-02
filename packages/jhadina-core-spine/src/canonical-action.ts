import type { ActionResult } from './types.js';

/**
 * Structural contract for security-core's authoritative policy result.
 * The spine does not issue policy decisions and intentionally does not import
 * security-core, preserving the package layering boundary.
 */
export interface CanonicalPolicyDecision {
  decisionId: string;
  requestId: string;
  actorId: string;
  domain: string;
  capability: string;
  resourceId?: string;
  decision: 'allow' | 'approval_required' | 'deny';
  policyVersion: string;
  decidedAt: number;
  expiresAt: number;
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
  requestedAt: number;
  expiresAt: number;
  amountMinor?: number;
  recipient?: string;
  platform?: string;
}

export interface CanonicalActionPort {
  /** Preparation must be side-effect free; authorization happens afterward. */
  prepare(proposal: import('./types.js').DecisionProposal): Promise<CanonicalActionRequest | undefined>;
  execute(request: CanonicalActionRequest, policy: CanonicalPolicyDecision): Promise<ActionResult>;
}

export interface CanonicalPolicyPort {
  evaluate(request: CanonicalActionRequest): Promise<CanonicalPolicyDecision>;
}
