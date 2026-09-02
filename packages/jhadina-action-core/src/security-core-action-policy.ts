import type { ActionPolicy, ActionRequest, ActionPolicyDecision } from './action-executor.js';
import {
  createSecurityRequest,
  JhadinaSecurityCore,
  JHADINA_BASE_SECURITY_POLICY,
  type SecurityPolicy,
} from '../../security-core/src/index.js';

/** Adapts deterministic Security Core decisions without collapsing approval_required into deny. */
export class SecurityCoreActionPolicy<TAction = unknown> implements ActionPolicy<TAction> {
  constructor(
    private readonly security: JhadinaSecurityCore,
    private readonly domain = 'jhadina-action',
  ) {}

  async evaluate(request: ActionRequest<TAction>): Promise<ActionPolicyDecision> {
    const securityRequest = createSecurityRequest({
      requestId: request.id,
      actorId: request.userId,
      domain: this.domain,
      capability: request.type,
      nonce: request.nonce ?? request.id,
    });

    return this.security.evaluateAuthorization(securityRequest);
  }
}

export function createBaseSecurityCoreActionPolicy<TAction = unknown>(domain?: string) {
  return new SecurityCoreActionPolicy<TAction>(
    new JhadinaSecurityCore(JHADINA_BASE_SECURITY_POLICY),
    domain,
  );
}

export type { SecurityPolicy };
