import { describe, expect, it } from 'vitest'
import { DefaultCapabilityAuthorizer, type AuthenticatedIdentity, type CapabilityGrant } from './identity.js'

describe('capability authorization', () => {
  const identity: AuthenticatedIdentity = { type: 'agent', id: 'ask-jhadina', sessionId: 'session-1' }
  const grant: CapabilityGrant = {
    identityId: 'ask-jhadina', sessionId: 'session-1', capability: 'github.repo.read',
    grantId: 'grant-1', expiresAt: '2026-08-31T00:00:00.000Z',
  }

  it('authorizes a matching unexpired grant', () => {
    expect(new DefaultCapabilityAuthorizer([grant]).authorize(identity, 'github.repo.read').grantId).toBe('grant-1')
  })

  it('rejects a capability not granted to the identity/session', () => {
    expect(() => new DefaultCapabilityAuthorizer([grant]).authorize(identity, 'github.repo.write')).toThrow('Capability not authorized')
  })

  it('rejects an expired grant', () => {
    const expired = { ...grant, expiresAt: '2026-08-29T00:00:00.000Z' }
    expect(() => new DefaultCapabilityAuthorizer([expired]).authorize(identity, 'github.repo.read', new Date('2026-08-30T00:00:00.000Z'))).toThrow('Capability not authorized')
  })
})
