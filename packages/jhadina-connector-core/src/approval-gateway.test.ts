import { describe, expect, it } from 'vitest'
import { ConnectorGateway, ConnectorRegistry, type ConnectorAdapter } from './index.js'
import { DefaultPolicyEngine, type AuditReceipt, type AuditSink } from './action-governance.js'
import { createApprovalRequest, hashActionProposal, type ApprovalGrant } from './approval.js'
import type { AuthoritativeActionProposal } from './governed-action.js'

class MemoryAudit implements AuditSink { readonly receipts: AuditReceipt[] = []; record(r: AuditReceipt) { this.receipts.push(r) } }

const proposal: AuthoritativeActionProposal = {
  id: 'action-write-1', actor: { type: 'user', id: 'user-1' }, sessionId: 'session-1',
  intent: 'github.repo.update', capability: 'github.repo.update', target: 'github',
  parameters: { input: { content: 'approved' } }, evidence: ['user-request'], risk: 'critical',
  reversibility: 'irreversible', correlationId: 'corr-write-1', createdAt: '2026-08-30T12:00:00.000Z',
  authorization: { session: { sessionId: 'session-1', identityId: 'user-1', identityType: 'user', issuedAt: '2026-08-30T00:00:00.000Z', expiresAt: '2026-08-31T00:00:00.000Z', authenticationMethod: 'session', authContextHash: 'ctx' }, grant: { identityId: 'user-1', sessionId: 'session-1', capability: 'github.repo.update', grantId: 'grant-1', expiresAt: '2026-08-31T00:00:00.000Z' } },
}

const adapter: ConnectorAdapter = { state: 'connected', manifest: { id: 'github', provider: 'github', version: 1, operations: [{ name: 'repo.update', capability: 'github.repo.update', kind: 'update', reversibility: 'irreversible', description: 'Update repository' }] }, async execute() { return { ok: true } }, async verify(_op, output) { return output.ok } }

describe('gateway approval enforcement', () => {
  it('blocks an approval-required action without a grant', async () => {
    const registry = new ConnectorRegistry(); registry.register(adapter); const audit = new MemoryAudit()
    const gateway = new ConnectorGateway(registry, new DefaultPolicyEngine(), audit)
    const result = await gateway.execute({ proposal, connectorId: 'github', operation: 'repo.update', idempotencyKey: 'approval-missing' })
    expect(result.status).toBe('failed'); expect(result.error).toContain('approval_required')
  })

  it('executes only with an exact, unexpired approval', async () => {
    const registry = new ConnectorRegistry(); registry.register(adapter); const audit = new MemoryAudit(); const policy = new DefaultPolicyEngine()
    const request = createApprovalRequest(proposal, policy.decide(proposal), 'user-1')
    const approval: ApprovalGrant = { approvalId: request.id, proposalId: request.proposalId, proposalHash: hashActionProposal(proposal), approverIdentityId: 'user-1', approvedAt: '2026-08-30T12:01:00.000Z', expiresAt: '2026-08-31T00:00:00.000Z' }
    const result = await new ConnectorGateway(registry, policy, audit).execute({ proposal, connectorId: 'github', operation: 'repo.update', idempotencyKey: 'approval-valid', approval })
    expect(result.status).toBe('succeeded'); expect(result.verified).toBe(true)
  })
})
