import { createHash } from 'node:crypto'
import type { AuthoritativeActionProposal } from './governed-action.js'
import type { PolicyDecision } from './action-governance.js'

export interface ApprovalRequest {
  readonly id: string
  readonly proposalId: string
  readonly proposalHash: string
  readonly correlationId: string
  readonly approverIdentityId: string
  readonly policyVersion: string
  readonly createdAt: string
}

export interface ApprovalGrant {
  readonly approvalId: string
  readonly proposalId: string
  readonly proposalHash: string
  readonly approverIdentityId: string
  readonly approvedAt: string
  readonly expiresAt: string
}

export function hashActionProposal(proposal: AuthoritativeActionProposal): string {
  const canonical = JSON.stringify({
    id: proposal.id,
    actor: proposal.actor,
    sessionId: proposal.sessionId,
    capability: proposal.capability,
    intent: proposal.intent,
    target: proposal.target,
    parameters: proposal.parameters,
    evidence: proposal.evidence,
    risk: proposal.risk,
    reversibility: proposal.reversibility,
    correlationId: proposal.correlationId,
  })
  return createHash('sha256').update(canonical).digest('hex')
}

export function createApprovalRequest(
  proposal: AuthoritativeActionProposal,
  decision: PolicyDecision,
  approverIdentityId: string,
): ApprovalRequest {
  if (decision.effect !== 'approval_required') throw new Error('Approval is not required for this proposal')
  return {
    id: `approval_request_${proposal.id}`,
    proposalId: proposal.id,
    proposalHash: hashActionProposal(proposal),
    correlationId: proposal.correlationId,
    approverIdentityId,
    policyVersion: decision.policyVersion,
    createdAt: new Date().toISOString(),
  }
}

export function verifyApproval(
  proposal: AuthoritativeActionProposal,
  approval: ApprovalGrant,
  approverIdentityId: string,
  now = new Date(),
): void {
  if (approval.proposalId !== proposal.id) throw new Error('Approval proposal mismatch')
  if (approval.proposalHash !== hashActionProposal(proposal)) throw new Error('Approved proposal has changed')
  if (approval.approverIdentityId !== approverIdentityId) throw new Error('Approval identity mismatch')
  if (new Date(approval.expiresAt).getTime() <= now.getTime()) throw new Error('Approval has expired')
}
