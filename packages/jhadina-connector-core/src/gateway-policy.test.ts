import { ConnectorGateway, ConnectorRegistry } from './index.js'
import { DefaultPolicyEngine } from './policy.js'
import { InMemoryAuditSink } from './audit.js'
import { createGitHubReadOnlyAdapter } from './github.js'

describe('ConnectorGateway policy boundary', () => {
  const setup = () => {
    const registry = new ConnectorRegistry()
    registry.register(createGitHubReadOnlyAdapter({
      async getRepository() {
        return { id: 1, name: 'crispy-waddle', fullName: 'bookieandco/crispy-waddle', private: true }
      },
    }))
    const audit = new InMemoryAuditSink()
    const gateway = new ConnectorGateway(registry, new DefaultPolicyEngine(), audit)
    return { gateway, audit }
  }

  it('blocks requests without identity', async () => {
    const { gateway, audit } = setup()
    const result = await gateway.execute({
      connectorId: 'github', operation: 'repo.read', capability: 'github.repo.read',
      input: { owner: 'bookieandco', repo: 'crispy-waddle' }, idempotencyKey: 'policy-1', correlationId: 'corr-1',
      actorId: '', sessionId: '', risk: 'low',
    })
    expect(result.status).toBe('failed')
    expect(audit.receipts[0]?.outcome).toBe('blocked')
  })

  it('allows a low-risk read with identity and records an audit receipt', async () => {
    const { gateway, audit } = setup()
    const result = await gateway.execute({
      connectorId: 'github', operation: 'repo.read', capability: 'github.repo.read',
      input: { owner: 'bookieandco', repo: 'crispy-waddle' }, idempotencyKey: 'policy-2', correlationId: 'corr-2',
      actorId: 'user', sessionId: 'session', risk: 'low',
    })
    expect(result.status).toBe('succeeded')
    expect(result.verified).toBe(true)
    expect(audit.receipts[0]?.outcome).toBe('succeeded')
    expect(audit.receipts[0]?.policyDecision).toBe('allow')
  })
})
