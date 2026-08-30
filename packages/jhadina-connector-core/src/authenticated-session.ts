export interface AuthenticatedSession {
  readonly sessionId: string
  readonly identityId: string
  readonly identityType: 'user' | 'agent'
  readonly issuedAt: string
  readonly expiresAt: string
  readonly authenticationMethod: 'session' | 'oauth' | 'device'
  readonly authContextHash: string
}

export interface SessionVerifier {
  verify(session: AuthenticatedSession, now?: Date): void
}

export class DefaultSessionVerifier implements SessionVerifier {
  verify(session: AuthenticatedSession, now = new Date()): void {
    if (!session.sessionId || !session.identityId || !session.authContextHash) {
      throw new Error('Invalid authenticated session')
    }

    const issued = new Date(session.issuedAt).getTime()
    const expires = new Date(session.expiresAt).getTime()
    const current = now.getTime()

    if (!Number.isFinite(issued) || !Number.isFinite(expires) || issued > current || expires <= current) {
      throw new Error('Authenticated session is invalid or expired')
    }
  }
}
