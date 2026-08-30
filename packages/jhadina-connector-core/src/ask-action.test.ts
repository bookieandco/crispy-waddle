import { describe, expect, it } from 'vitest'
import { buildActionProposalFromAsk, type AskIntent } from './ask-action.js'
import type { AuthenticatedSession } from './authenticated-session.js'
import type { CapabilityGrant } from './identity.js'

const session: AuthenticatedSession = {
  sessionId: 'session-1', identityId: 'user-1', identityType: 'user',
  issuedAt: '2026-08-30T00:00:00.000Z', expiresAt: '2026-08-31T00:00:00.000Z',
  authenticationMethod: 'session', authContextHash: 'trusted-context',
}
const grant: CapabilityGrant = {
  identityId: 'user-1', sessionId: 'session-1', capability: 'github.repo.read',
  grantId: 'grant-1', expiresAt: '2026-08-31T00:00:00.000Z',
}
const intent: AskIntent = {
  id: 'ask-1', text: 'Read the repository', target: 'github', capability: 'github.repo.read',
  parameters: { owner: 'bookieandco', repo: 'crispy-waddle' }, risk: 'low',
  reversibility: 'reversible', correlationId: 'corr-1',
}

describe('Ask action boundary', () => {
  it('creates an authoritative proposal without giving Ask execution authority', () => {
    const proposal = buildActionProposalFromAsk(intent, session, grant)
    expect(proposal.actor.id).toBe('user-1')
    expect(proposal.capability).toBe('github.repo.read')
    expect(proposal.authorization.grant.grantId).toBe('grant-1')
  })

  it('rejects an intent requesting a capability outside the grant', () => {
    expect(() => buildActionProposalFromAsk({ ...intent, capability: 'github.repo.write' }, session, grant))
      .toThrow('does not match authorized grant')
  })
})
