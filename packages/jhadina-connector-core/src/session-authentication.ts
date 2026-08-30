import { createPublicKey, verify as verifySignature, type KeyObject } from 'node:crypto'
import type { AuthenticatedSession } from './authenticated-session.js'

export interface SignedAuthenticatedSession extends AuthenticatedSession {
  readonly issuer: string
  readonly keyId: string
  readonly algorithm: 'ed25519'
  readonly signature: string
  readonly signedPayload: string
}

export interface TrustedIssuer {
  readonly issuer: string
  readonly keyId: string
  readonly publicKey: KeyObject | string
}

export interface SessionAuthenticator {
  authenticate(session: SignedAuthenticatedSession, now?: Date): AuthenticatedSession
}

export class Ed25519SessionAuthenticator implements SessionAuthenticator {
  private readonly issuers: Map<string, TrustedIssuer>

  constructor(issuers: readonly TrustedIssuer[]) {
    this.issuers = new Map(issuers.map((issuer) => [`${issuer.issuer}:${issuer.keyId}`, issuer]))
  }

  authenticate(session: SignedAuthenticatedSession, now = new Date()): AuthenticatedSession {
    if (session.algorithm !== 'ed25519') throw new Error('Unsupported session signature algorithm')
    const issuer = this.issuers.get(`${session.issuer}:${session.keyId}`)
    if (!issuer) throw new Error('Untrusted session issuer')
    if (!session.signedPayload || !session.signature) throw new Error('Session signature is required')

    const publicKey = typeof issuer.publicKey === 'string' ? createPublicKey(issuer.publicKey) : issuer.publicKey
    const valid = verifySignature(null, Buffer.from(session.signedPayload), publicKey, Buffer.from(session.signature, 'base64url'))
    if (!valid) throw new Error('Invalid session signature')

    const issued = new Date(session.issuedAt).getTime()
    const expires = new Date(session.expiresAt).getTime()
    if (!Number.isFinite(issued) || !Number.isFinite(expires) || issued > now.getTime() || expires <= now.getTime()) {
      throw new Error('Authenticated session is invalid or expired')
    }

    return {
      sessionId: session.sessionId,
      identityId: session.identityId,
      identityType: session.identityType,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt,
      authenticationMethod: session.authenticationMethod,
      authContextHash: session.authContextHash,
    }
  }
}
