export type PolicyDecision = 'allow' | 'deny' | 'approval_required';

export interface PolicyContext {
  readonly actorId: string;
  readonly sessionId: string;
  readonly capability: string;
  readonly connectorId: string;
  readonly operation: string;
  readonly risk: 'low' | 'medium' | 'high' | 'critical';
}

export interface PolicyEngine {
  evaluate(context: PolicyContext): Promise<PolicyDecision>;
}

export class DefaultPolicyEngine implements PolicyEngine {
  async evaluate(context: PolicyContext): Promise<PolicyDecision> {
    if (!context.actorId.trim() || !context.sessionId.trim()) return 'deny';
    if (!context.capability.trim()) return 'deny';
    if (context.risk === 'critical' || context.risk === 'high') return 'approval_required';
    return 'allow';
  }
}
