export interface AuthenticatedIdentity {
  readonly type: 'user' | 'agent'
  readonly id: string
  readonly sessionId: string
}

export interface CapabilityGrant {
  readonly identityId: string
  readonly sessionId: string
  readonly capability: string
  readonly expiresAt: string
  readonly grantId: string
}

export interface CapabilityAuthorizer {
  authorize(identity: AuthenticatedIdentity, capability: string, now?: Date): CapabilityGrant
}

export class DefaultCapabilityAuthorizer implements CapabilityAuthorizer {
  constructor(private readonly grants: readonly CapabilityGrant[]) {}

  authorize(identity: AuthenticatedIdentity, capability: string, now = new Date()): CapabilityGrant {
    const grant = this.grants.find(
      (candidate) =>
        candidate.identityId === identity.id &&
        candidate.sessionId === identity.sessionId &&
        candidate.capability === capability &&
        new Date(candidate.expiresAt).getTime() > now.getTime(),
    )

    if (!grant) {
      throw new Error(`Capability not authorized: ${capability}`)
    }

    return grant
  }
}
