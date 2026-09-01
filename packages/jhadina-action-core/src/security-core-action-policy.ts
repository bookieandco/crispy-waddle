import type { ActionPolicy, ActionRequest, ActionPolicyDecision } from './action-executor.js';
import {
  createSecurityRequest,
  JhadinaSecurityCore,
  JHADINA_BASE_SECURITY_POLICY,
  type NonceReplayGuard,
  type SecurityPolicy,
} from '../../security-core/src/index.js';

/** Adapts deterministic Security Core decisions without collapsing approval_required into deny. */
export class SecurityCoreActionPolicy<TAction = unknown> implements ActionPolicy<TAction> {
  constructor(
    private readonly security: JhadinaSecurityCore,
    private readonly domain = 'jhadina-action',
    private readonly replayGuard?: NonceReplayGuard,
  ) {}

  async evaluate(request: ActionRequest<TAction>): Promise<ActionPolicyDecision> {
    const securityRequest = createSecurityRequest({
      requestId: request.id,
      actorId: request.userId,
      domain: this.domain,
      capability: request.type,
      nonce: request.nonce ?? request.id,
    });

    if (this.replayGuard) return this.security.authorizeWithReplayGuard(securityRequest, this.replayGuard);
    return this.security.authorize(securityRequest);
  }
}

export function createBaseSecurityCoreActionPolicy<TAction = unknown>(domain?: string, replayGuard?: NonceReplayGuard) {
  return new SecurityCoreActionPolicy<TAction>(
    new JhadinaSecurityCore(JHADINA_BASE_SECURITY_POLICY),
    domain,
    replayGuard,
  );
}

export type { SecurityPolicy };
