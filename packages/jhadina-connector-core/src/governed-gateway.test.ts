import { describe, expect, it } from 'vitest'
import { ConnectorGateway, ConnectorRegistry, type ConnectorAdapter, type ConnectorRequest } from './index.js'
import { DefaultPolicyEngine, type AuditReceipt, type AuditSink } from './action-governance.js'
import { DefaultCapabilityAuthorizer, type AuthenticatedIdentity, type CapabilityGrant } from './identity.js'

class MemoryAudit implements AuditSink {
  readonly receipts: AuditReceipt[] = []
  record(receipt: AuditReceipt) { this.receipts.push(receipt) }
}

const adapter: ConnectorAdapter = {
  state: 'connected',
  manifest: {
    id: 'github', provider: 'github', version: 1,
    operations: [{ name: 'repo.read', capability: 'github.repo.read', kind: 'read', reversibility: 'reversible', description: 'Read repository metadata' }],
  },
  async execute() { return { owner: 'bookieandco', repo: 'crispy-waddle' } },
  async verify(_operation, output) { return Boolean(output) },
}

const identity: AuthenticatedIdentity = { type: 'agent', id: 'ask-jhadina', sessionId: 'session-1' }
const grant: CapabilityGrant = { identityId: identity.id, sessionId: identity.sessionId, capability: 'github.repo.read', grantId: 'grant-1', expiresAt: '2026-08-31T00:00:00.000Z' }

describe('governed GitHub gateway', () => {
  it('requires an identity capability grant before execution', async () => {
    const registry = new ConnectorRegistry(); registry.register(adapter)
    const audit = new MemoryAudit()
    const authorizer = new DefaultCapabilityAuthorizer([])
    const gateway = new ConnectorGateway(registry, new DefaultPolicyEngine(), audit, authorizer)
    const request: ConnectorRequest = { connectorId: 'github', operation: 'repo.read', capability: 'github.repo.read', input: {}, idempotencyKey: 'id-1', correlationId: 'corr-1', actorId: identity.id, sessionId: identity.sessionId, risk: 'low' }
    await expect(gateway.execute(request)).rejects.toThrow('Capability not authorized')
    expect(audit.receipts).toHaveLength(0)
  })

  it('executes only after identity, capability, policy and verification pass', async () => {
    const registry = new ConnectorRegistry(); registry.register(adapter)
    const audit = new MemoryAudit()
    const authorizer = new DefaultCapabilityAuthorizer([grant])
    const gateway = new ConnectorGateway(registry, new DefaultPolicyEngine(), audit, authorizer)
    const request: ConnectorRequest = { connectorId: 'github', operation: 'repo.read', capability: 'github.repo.read', input: {}, idempotencyKey: 'id-2', correlationId: 'corr-2', actorId: identity.id, sessionId: identity.sessionId, risk: 'low' }
    const result = await gateway.execute(request)
    expect(result.status).toBe('succeeded')
    expect(result.verified).toBe(true)
    expect(audit.receipts.at(-1)?.status).toBe('executed')
  })
})
