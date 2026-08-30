import { describe, expect, it } from 'vitest'
import { createApprovalRequest, hashActionProposal, verifyApproval } from './approval.js'
import type { AuthoritativeActionProposal } from './governed-action.js'
import type { PolicyDecision } from './action-governance.js'

const proposal: AuthoritativeActionProposal = {
  id: 'action-approval-1', actor: { type: 'user', id: 'user-1' }, sessionId: 'session-1', capability: 'github.repo.write',
  intent: 'Modify repository', target: 'github', parameters: { repo: 'crispy-waddle' }, evidence: ['user-request'], risk: 'high',
  reversibility: 'partially_reversible', correlationId: 'corr-approval-1', createdAt: '2026-08-30T12:00:00.000Z',
  authorization: { session: { sessionId: 'session-1', identityId: 'user-1', identityType: 'user', issuedAt: '2026-08-30T00:00:00.000Z', expiresAt: '2026-08-31T00:00:00.000Z', authenticationMethod: 'session', authContextHash: 'ctx' }, grant: { identityId: 'user-1', sessionId: 'session-1', capability: 'github.repo.write', grantId: 'grant-1', expiresAt: '2026-08-31T00:00:00.000Z' } },
}
const decision: PolicyDecision = { effect: 'approval_required', proposalId: proposal.id, capability: proposal.capability, reason: 'Approval required', policyVersion: '1', decidedAt: '2026-08-30T12:01:00.000Z', approvalRequired: true }

describe('exact proposal approval', () => {
  it('creates an approval request containing the proposal hash', () => {
    const request = createApprovalRequest(proposal, decision, 'user-1')
    expect(request.proposalHash).toBe(hashActionProposal(proposal))
  })

  it('accepts approval for the exact unchanged proposal', () => {
    const request = createApprovalRequest(proposal, decision, 'user-1')
    verifyApproval(proposal, { approvalId: request.id, proposalId: proposal.id, proposalHash: request.proposalHash, approverIdentityId: 'user-1', approvedAt: '2026-08-30T12:02:00.000Z', expiresAt: '2026-08-31T00:00:00.000Z' }, 'user-1', new Date('2026-08-30T13:00:00.000Z'))
  })

  it('rejects an approval when the proposal changes', () => {
    const request = createApprovalRequest(proposal, decision, 'user-1')
    expect(() => verifyApproval({ ...proposal, parameters: { repo: 'other-repo' } }, { approvalId: request.id, proposalId: proposal.id, proposalHash: request.proposalHash, approverIdentityId: 'user-1', approvedAt: '2026-08-30T12:02:00.000Z', expiresAt: '2026-08-31T00:00:00.000Z' }, 'user-1', new Date('2026-08-30T13:00:00.000Z'))).toThrow('proposal has changed')
  })
})
