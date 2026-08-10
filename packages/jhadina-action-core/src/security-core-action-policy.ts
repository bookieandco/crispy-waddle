import type { ActionPolicy, ActionRequest } from './action-executor.js';
import { createSecurityRequest, JhadinaSecurityCore, type SecurityPolicy } from '../../security-core/src/index.js';

/** Adapts the deterministic Security Core into the Action Executor policy contract.
 * Approval-required decisions remain blocked until the approval-receipt layer is wired in.
 */
export class SecurityCoreActionPolicy<TAction = unknown> implements ActionPolicy<TAction> {
  constructor(
    private readonly security: JhadinaSecurityCore,
    private readonly domain = 'jhadina-action',
  ) {}

  async evaluate(request: ActionRequest<TAction>): Promise<'allow' | 'deny'> {
    const securityRequest = createSecurityRequest({
      requestId: request.id,
      actorId: request.userId,
      domain: this.domain,
      capability: request.type,
    });

    const decision = this.security.authorize(securityRequest);
    return decision === 'allow' ? 'allow' : 'deny';
  }
}

export function createBaseSecurityCoreActionPolicy<TAction = unknown>(domain?: string) {
  return new SecurityCoreActionPolicy<TAction>(
    new JhadinaSecurityCore(JHADINA_BASE_SECURITY_POLICY),
    domain,
  );
}

export type { SecurityPolicy };
