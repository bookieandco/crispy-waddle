import { describe, expect, it } from 'vitest'
import { generateKeyPairSync, sign } from 'node:crypto'
import { Ed25519SessionAuthenticator, type SignedAuthenticatedSession } from './session-authentication.js'

const { privateKey, publicKey } = generateKeyPairSync('ed25519')
const payload = 'jhadina-session-v1:user-1:session-1:2026-08-30T00:00:00.000Z:2026-08-31T00:00:00.000Z'
const session: SignedAuthenticatedSession = {
  sessionId: 'session-1', identityId: 'user-1', identityType: 'user',
  issuedAt: '2026-08-30T00:00:00.000Z', expiresAt: '2026-08-31T00:00:00.000Z',
  authenticationMethod: 'session', authContextHash: 'context-hash', issuer: 'jhadina-identity',
  keyId: 'key-1', algorithm: 'ed25519', signedPayload: payload,
  signature: sign(null, Buffer.from(payload), privateKey).toString('base64url'),
}

describe('signed authenticated session', () => {
  it('accepts a valid signature from a trusted issuer', () => {
    const result = new Ed25519SessionAuthenticator([{ issuer: 'jhadina-identity', keyId: 'key-1', publicKey }]).authenticate(session, new Date('2026-08-30T12:00:00.000Z'))
    expect(result.identityId).toBe('user-1')
  })

  it('rejects an untrusted issuer', () => {
    expect(() => new Ed25519SessionAuthenticator([]).authenticate(session)).toThrow('Untrusted session issuer')
  })

  it('rejects a tampered payload', () => {
    expect(() => new Ed25519SessionAuthenticator([{ issuer: 'jhadina-identity', keyId: 'key-1', publicKey }]).authenticate({ ...session, signedPayload: `${payload}:tampered` })).toThrow('Invalid session signature')
  })
})
