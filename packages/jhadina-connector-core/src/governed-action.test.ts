import { describe, expect, it } from 'vitest'
import { createAuthoritativeActionProposal } from './governed-action.js'
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

const input = {
  id: 'action-1', intent: 'Read repository', target: 'github', parameters: {},
  evidence: ['user-request'], risk: 'low' as const, reversibility: 'reversible' as const,
  correlationId: 'corr-1', createdAt: '2026-08-30T12:00:00.000Z',
}

describe('authoritative ActionProposal', () => {
  it('derives actor, session and capability from trusted authorization context', () => {
    const proposal = createAuthoritativeActionProposal(session, grant, input)
    expect(proposal.actor).toEqual({ type: 'user', id: 'user-1' })
    expect(proposal.sessionId).toBe('session-1')
    expect(proposal.capability).toBe('github.repo.read')
    expect(proposal.authorization.grant.grantId).toBe('grant-1')
  })

  it('rejects a grant belonging to another identity or session', () => {
    expect(() => createAuthoritativeActionProposal(session, { ...grant, identityId: 'other-user' }, input))
      .toThrow('does not belong to authenticated session')
  })
})
