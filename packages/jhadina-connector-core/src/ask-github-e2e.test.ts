import { describe, expect, it } from 'vitest'
import { generateKeyPairSync, sign } from 'node:crypto'
import { buildActionProposalFromAsk } from './ask-action.js'
import { Ed25519SessionAuthenticator, type SignedAuthenticatedSession } from './session-authentication.js'
import { DefaultCapabilityAuthorizer } from './identity.js'
import { DefaultPolicyEngine, type AuditReceipt, type AuditSink } from './action-governance.js'
import { ConnectorGateway, ConnectorRegistry, type ConnectorAdapter } from './index.js'
import { AskExecutionPipeline } from './ask-pipeline.js'

class MemoryAudit implements AuditSink { readonly receipts: AuditReceipt[] = []; record(r: AuditReceipt) { this.receipts.push(r) } }

describe('Ask → identity → capability → policy → GitHub → verification → audit', () => {
  it('executes a read-only GitHub action only after every boundary passes', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519')
    const payload = 'session:user-1:session-1:2026-08-30T00:00:00.000Z:2026-08-31T00:00:00.000Z'
    const signed: SignedAuthenticatedSession = { sessionId: 'session-1', identityId: 'user-1', identityType: 'user', issuedAt: '2026-08-30T00:00:00.000Z', expiresAt: '2026-08-31T00:00:00.000Z', authenticationMethod: 'session', authContextHash: 'ctx', issuer: 'identity', keyId: 'k1', algorithm: 'ed25519', signedPayload: payload, signature: sign(null, Buffer.from(payload), privateKey).toString('base64url') }
    const session = new Ed25519SessionAuthenticator([{ issuer: 'identity', keyId: 'k1', publicKey }]).authenticate(signed, new Date('2026-08-30T12:00:00.000Z'))
    const grant = new DefaultCapabilityAuthorizer([{ identityId: 'user-1', sessionId: 'session-1', capability: 'github.repo.read', grantId: 'g1', expiresAt: '2026-08-31T00:00:00.000Z' }]).authorize(session, 'github.repo.read', new Date('2026-08-30T12:00:00.000Z'))
    const proposal = buildActionProposalFromAsk({ id: 'ask-1', text: 'Read this repository', target: 'github', capability: 'github.repo.read', parameters: { owner: 'bookieandco', repo: 'crispy-waddle' }, risk: 'low', reversibility: 'reversible', correlationId: 'corr-1' }, session, grant)
    const registry = new ConnectorRegistry()
    const adapter: ConnectorAdapter = { state: 'connected', manifest: { id: 'github', provider: 'github', version: 1, operations: [{ name: 'repo.read', capability: 'github.repo.read', kind: 'read', reversibility: 'reversible', description: 'Read repository' }] }, async execute() { return { ok: true } }, async verify(_operation, output) { return output.ok } }
    registry.register(adapter)
    const audit = new MemoryAudit()
    const gateway = new ConnectorGateway(registry, new DefaultPolicyEngine(), audit)
    const pipeline = new AskExecutionPipeline(new DefaultPolicyEngine(), gateway, audit)
    const result = await pipeline.execute(proposal, { connectorId: 'github', operation: 'repo.read', idempotencyKey: 'idem-1' })
    expect(result.response?.status).toBe('succeeded')
    expect(result.response?.verified).toBe(true)
    expect(audit.receipts.at(-1)?.status).toBe('executed')
  })
})
