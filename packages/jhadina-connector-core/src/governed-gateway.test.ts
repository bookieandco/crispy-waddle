import { describe, expect, it } from 'vitest'
import { ConnectorGateway, ConnectorRegistry, type ConnectorAdapter } from './index.js'
import { DefaultPolicyEngine, type AuditReceipt, type AuditSink } from './action-governance.js'
import { createAuthoritativeActionProposal } from './governed-action.js'
import type { CapabilityGrant } from './identity.js'
import type { AuthenticatedSession } from './authenticated-session.js'

class MemoryAudit implements AuditSink { readonly receipts: AuditReceipt[] = []; record(receipt: AuditReceipt) { this.receipts.push(receipt) } }
const adapter: ConnectorAdapter = { state: 'connected', manifest: { id: 'github', provider: 'github', version: 1, operations: [{ name: 'repo.read', capability: 'github.repo.read', kind: 'read', reversibility: 'reversible', description: 'Read repository metadata' }] }, async execute() { return { owner: 'bookieandco', repo: 'crispy-waddle' } }, async verify(_operation, output) { return Boolean(output) } }
const session: AuthenticatedSession = { sessionId: 'session-1', identityId: 'ask-jhadina', identityType: 'agent', issuedAt: '2026-08-30T00:00:00.000Z', expiresAt: '2026-08-31T00:00:00.000Z', authenticationMethod: 'session', authContextHash: 'trusted' }
const grant: CapabilityGrant = { identityId: 'ask-jhadina', sessionId: 'session-1', capability: 'github.repo.read', grantId: 'grant-1', expiresAt: '2026-08-31T00:00:00.000Z' }
const input = { id: 'action-1', intent: 'github.repo.read', target: 'github', parameters: { input: {} }, evidence: ['user-request'], risk: 'low' as const, reversibility: 'reversible' as const, correlationId: 'corr-1', createdAt: '2026-08-30T12:00:00.000Z' }

describe('governed GitHub gateway', () => {
  it('executes only after an authoritative proposal passes policy, then verifies and audits', async () => {
    const registry = new ConnectorRegistry(); registry.register(adapter); const audit = new MemoryAudit(); const gateway = new ConnectorGateway(registry, new DefaultPolicyEngine(), audit)
    const proposal = createAuthoritativeActionProposal(session, grant, input)
    const result = await gateway.execute({ proposal, connectorId: 'github', operation: 'repo.read', idempotencyKey: 'id-2' })
    expect(result.status).toBe('succeeded'); expect(result.verified).toBe(true); expect(audit.receipts.at(-1)?.status).toBe('executed')
  })
  it('rejects execution when proposal intent does not match the connector operation', async () => {
    const registry = new ConnectorRegistry(); registry.register(adapter); const gateway = new ConnectorGateway(registry, new DefaultPolicyEngine(), new MemoryAudit())
    const proposal = createAuthoritativeActionProposal(session, grant, input)
    await expect(gateway.execute({ proposal, connectorId: 'github', operation: 'other', idempotencyKey: 'id-3' })).rejects.toThrow('Proposal intent does not match')
  })
})
