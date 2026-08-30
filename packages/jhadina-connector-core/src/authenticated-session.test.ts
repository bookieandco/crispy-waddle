import { describe, expect, it } from 'vitest'
import { DefaultSessionVerifier, type AuthenticatedSession } from './authenticated-session.js'

describe('authenticated session', () => {
  const session: AuthenticatedSession = {
    sessionId: 'session-1', identityId: 'ask-jhadina', identityType: 'agent',
    issuedAt: '2026-08-30T00:00:00.000Z', expiresAt: '2026-08-31T00:00:00.000Z',
    authenticationMethod: 'session', authContextHash: 'auth-context-hash',
  }

  it('accepts a valid unexpired session', () => {
    expect(() => new DefaultSessionVerifier().verify(session, new Date('2026-08-30T12:00:00.000Z'))).not.toThrow()
  })

  it('rejects an expired session', () => {
    expect(() => new DefaultSessionVerifier().verify(session, new Date('2026-09-01T00:00:00.000Z'))).toThrow('invalid or expired')
  })
})
