import type { ActionPolicy, ActionRequest, ActionPolicyDecision } from './action-executor.js';
import {
  JhadinaPolicyEngine,
  JHADINA_DEFAULT_VALUES_CONFIGURATION,
  JhadinaSecurityCore,
  JHADINA_BASE_SECURITY_POLICY,
  type JhadinaValuesConfiguration,
  type SecurityPolicy,
} from '../../security-core/src/index.js';

export interface ActionRiskMetadata {
  amountMinor?: number;
  recipient?: string;
  platform?: string;
}

/**
 * Compatibility adapter for ActionExecutor.
 *
 * It no longer performs authorization itself: every decision is issued by
 * JhadinaPolicyEngine. The legacy JhadinaSecurityCore instance supplies only
 * its immutable capability policy; it is not called as a second authority.
 */
export class SecurityCoreActionPolicy<TAction = unknown> implements ActionPolicy<TAction> {
  private readonly engine: JhadinaPolicyEngine;

  constructor(
    security: JhadinaSecurityCore,
    private readonly domain = 'jhadina-action',
    values: JhadinaValuesConfiguration = JHADINA_DEFAULT_VALUES_CONFIGURATION,
    private readonly extractRiskMetadata: (action: TAction) => ActionRiskMetadata = () => ({}),
  ) {
    this.engine = new JhadinaPolicyEngine(values, security.getPolicy());
  }

  async evaluate(request: ActionRequest<TAction>): Promise<ActionPolicyDecision> {
    const issuedAt = Date.parse(request.requestedAt);
    if (!Number.isFinite(issuedAt)) return 'deny';

    const metadata = this.extractRiskMetadata(request.action);
    const decision = this.engine.decide({
      requestId: request.id,
      actorId: request.userId,
      domain: this.domain,
      capability: request.type,
      amountMinor: metadata.amountMinor,
      recipient: metadata.recipient,
      platform: metadata.platform,
      issuedAt,
      expiresAt: issuedAt + 30_000,
    });

    return decision.decision;
  }
}

export function createBaseSecurityCoreActionPolicy<TAction = unknown>(domain?: string) {
  return new SecurityCoreActionPolicy<TAction>(
    new JhadinaSecurityCore(JHADINA_BASE_SECURITY_POLICY),
    domain,
  );
}

export type { SecurityPolicy };
