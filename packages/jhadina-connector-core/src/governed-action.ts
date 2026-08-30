import type { ActionProposal } from './action-governance.js'
import type { AuthenticatedSession } from './authenticated-session.js'
import type { CapabilityGrant } from './identity.js'

export interface AuthoritativeActionProposal extends ActionProposal {
  readonly authorization: {
    readonly session: AuthenticatedSession
    readonly grant: CapabilityGrant
  }
}

export function createAuthoritativeActionProposal(
  session: AuthenticatedSession,
  grant: CapabilityGrant,
  input: Omit<ActionProposal, 'actor' | 'sessionId' | 'capability'>,
): AuthoritativeActionProposal {
  if (grant.identityId !== session.identityId || grant.sessionId !== session.sessionId) {
    throw new Error('Capability grant does not belong to authenticated session')
  }

  if (input.correlationId.trim() === '' || input.id.trim() === '') {
    throw new Error('Action proposal id and correlation id are required')
  }

  return {
    ...input,
    actor: { type: session.identityType, id: session.identityId },
    sessionId: session.sessionId,
    capability: grant.capability,
    authorization: { session, grant },
  }
}
