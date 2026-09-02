import type { ActionRequest, PolicyDecision } from './types.js';

export interface AuthoritativeActionProposal {
  id: string;
  capability: string;
  operation: string;
  input: unknown;
  reversible: boolean;
  consequenceLevel: ActionRequest['consequenceLevel'];
  reason: string;
}

export interface CapabilityAuthorization {
  authorize(proposal: AuthoritativeActionProposal): Promise<PolicyDecision>;
}

/** Single authorization boundary for capabilities. Research and ordinary actions use the same gate. */
export interface CapabilityGateway {
  authorize(proposal: AuthoritativeActionProposal): Promise<PolicyDecision>;
  toActionRequest(proposal: AuthoritativeActionProposal, policy: PolicyDecision): ActionRequest | undefined;
}

export class PolicyBackedCapabilityGateway implements CapabilityGateway {
  constructor(private readonly authorization: CapabilityAuthorization) {}

  authorize(proposal: AuthoritativeActionProposal): Promise<PolicyDecision> {
    return this.authorization.authorize(proposal);
  }

  toActionRequest(proposal: AuthoritativeActionProposal, policy: PolicyDecision): ActionRequest | undefined {
    if (!policy.allowed) return undefined;
    return { id: proposal.id, proposalId: proposal.id, capability: proposal.capability, operation: proposal.operation, input: proposal.input, reversible: proposal.reversible, consequenceLevel: proposal.consequenceLevel };
  }
}
