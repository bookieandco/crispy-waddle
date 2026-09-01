import type { AuthoritativePolicyDecision } from './authoritative-policy-decision.js';
import { createAuthoritativePolicyDecision } from './authoritative-policy-decision.js';
import { evaluateRiskBoundaries, type RiskContext } from './risk-boundary-policy.js';
import { JHADINA_DEFAULT_VALUES_CONFIGURATION, type JhadinaValuesConfiguration } from './values-configuration.js';

/**
 * The single authoritative decision issuer for security-sensitive callers.
 *
 * Callers provide objective request facts; they do not provide a decision.
 * The engine evaluates the request against the active values configuration
 * and stamps the resulting decision with the exact request binding and
 * policy version. Model output is never consulted here.
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
  constructor(
    private readonly values: JhadinaValuesConfiguration = JHADINA_DEFAULT_VALUES_CONFIGURATION,
  ) {}

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
