export type PolicyDecisionEffect = 'allow' | 'deny' | 'approval_required'
export type AuditReceiptStatus = 'authorized' | 'denied' | 'approval_required' | 'executed' | 'failed'

export interface ActionProposal {
  id: string
  actor: { type: 'user' | 'agent'; id: string }
  sessionId: string
  intent: string
  capability: string
  target: string
  parameters: Record<string, unknown>
  evidence: string[]
  risk: 'low' | 'medium' | 'high' | 'critical'
  reversibility: 'reversible' | 'partially_reversible' | 'irreversible'
  correlationId: string
  createdAt: string
}

export interface PolicyDecision {
  effect: PolicyDecisionEffect
  proposalId: string
  capability: string
  reason: string
  policyVersion: string
  decidedAt: string
  approvalRequired: boolean
}

export interface AuditReceipt {
  id: string
  proposalId: string
  correlationId: string
  actorId: string
  capability: string
  target: string
  status: AuditReceiptStatus
  policy: PolicyDecision
  providerRequestId?: string
  resultHash?: string
  error?: string
  recordedAt: string
}

export interface PolicyEngine {
  decide(proposal: import('./governed-action.js').AuthoritativeActionProposal): PolicyDecision
}

export interface AuditSink { record(receipt: AuditReceipt): Promise<void> | void }

export function createAuditReceipt(proposal: ActionProposal, policy: PolicyDecision, status: AuditReceiptStatus, extra: Pick<AuditReceipt, 'providerRequestId' | 'resultHash' | 'error'> = {}): AuditReceipt {
  return { id: `audit_${proposal.id}_${policy.decidedAt}`, proposalId: proposal.id, correlationId: proposal.correlationId, actorId: proposal.actor.id, capability: proposal.capability, target: proposal.target, status, policy, ...extra, recordedAt: new Date().toISOString() }
}

export class DefaultPolicyEngine implements PolicyEngine {
  constructor(private readonly policyVersion = '1') {}
  decide(proposal: import('./governed-action.js').AuthoritativeActionProposal): PolicyDecision {
    const decidedAt = new Date().toISOString()
    if (proposal.risk === 'critical' || proposal.reversibility === 'irreversible') return { effect: 'approval_required', proposalId: proposal.id, capability: proposal.capability, reason: 'High-consequence actions require explicit approval.', policyVersion: this.policyVersion, decidedAt, approvalRequired: true }
    return { effect: 'allow', proposalId: proposal.id, capability: proposal.capability, reason: 'Action satisfies the default policy.', policyVersion: this.policyVersion, decidedAt, approvalRequired: false }
  }
}
