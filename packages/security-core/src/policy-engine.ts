import type { AuthoritativePolicyDecision } from './authoritative-policy-decision.js';
import { createAuthoritativePolicyDecision } from './authoritative-policy-decision.js';
import { evaluateRiskBoundaries, type RiskContext } from './risk-boundary-policy.js';
import type { JhadinaValuesConfiguration } from './values-configuration.js';

/**
 * The single authoritative decision issuer for security-sensitive callers.
 * Callers provide objective request facts; they never provide a decision.
 * Model output is not an input to this engine.
 */
export type AuthoritativePolicyRequest = {
  requestId: string;
  actorId: string;
  domain: string;
  capability: string;
  resourceId?: string;
  amountMinor?: number;
  recipient?: string;
  platform?: string;
  issuedAt: number;
  expiresAt: number;
};

export interface PolicyEngine {
  decide(request: AuthoritativePolicyRequest): AuthoritativePolicyDecision;
}

export class JhadinaPolicyEngine implements PolicyEngine {
  constructor(private readonly values: JhadinaValuesConfiguration) {}

  decide(request: AuthoritativePolicyRequest): AuthoritativePolicyDecision {
    const decision = evaluateRiskBoundaries({
      capability: request.capability,
      amountMinor: request.amountMinor,
      recipient: request.recipient,
      platform: request.platform,
    } satisfies RiskContext, this.values);

    return createAuthoritativePolicyDecision({
      requestId: request.requestId,
      actorId: request.actorId,
      domain: request.domain,
      capability: request.capability,
      resourceId: request.resourceId,
      decision,
      policyVersion: `values-v${this.values.version}`,
      decidedAt: request.issuedAt,
      expiresAt: request.expiresAt,
    });
  }
}
