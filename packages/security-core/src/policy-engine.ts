import type { AuthoritativePolicyDecision } from './authoritative-policy-decision.js';
import { createAuthoritativePolicyDecision } from './authoritative-policy-decision.js';
import { evaluateRiskBoundaries, mostRestrictiveDecision, type RiskContext } from './risk-boundary-policy.js';
import type { JhadinaValuesConfiguration } from './values-configuration.js';
import { JHADINA_BASE_SECURITY_POLICY, type SecurityDecision, type SecurityPolicy } from './security-policy.js';

/** Objective request facts. Decision/approval/override fields are intentionally absent. */
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

function evaluateCapabilityPolicy(capability: string, policy: SecurityPolicy): SecurityDecision {
  if (policy.deniedCapabilities?.includes(capability)) return 'deny';
  if (!policy.allowedCapabilities.includes(capability)) return 'deny';
  return policy.approvalCapabilities.includes(capability) ? 'approval_required' : 'allow';
}

/**
 * Canonical policy engine and sole issuer of AuthoritativePolicyDecision.
 * Capability policy and values/risk policy are defense-in-depth layers;
 * most-restrictive wins, so no adapter can loosen the result.
 */
export class JhadinaPolicyEngine implements PolicyEngine {
  constructor(
    private readonly values: JhadinaValuesConfiguration,
    private readonly securityPolicy: SecurityPolicy = JHADINA_BASE_SECURITY_POLICY,
  ) {}

  decide(request: AuthoritativePolicyRequest): AuthoritativePolicyDecision {
    const capabilityDecision = evaluateCapabilityPolicy(request.capability, this.securityPolicy);
    const riskDecision = evaluateRiskBoundaries({
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
      decision: mostRestrictiveDecision(capabilityDecision, riskDecision),
      policyVersion: `values-v${this.values.version}`,
      decidedAt: request.issuedAt,
      expiresAt: request.expiresAt,
    });
  }
}
