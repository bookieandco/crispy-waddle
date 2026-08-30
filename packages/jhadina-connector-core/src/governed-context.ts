import type { ActionProposal } from './action-governance.js'
import type { AuthenticatedSession } from './authenticated-session.js'
import type { CapabilityGrant } from './identity.js'

export interface GovernedActionContext {
  readonly session: AuthenticatedSession
  readonly grant: CapabilityGrant
  readonly proposal: ActionProposal
}

export function createGovernedActionContext(
  session: AuthenticatedSession,
  grant: CapabilityGrant,
  proposal: Omit<ActionProposal, 'actor' | 'sessionId' | 'capability'>,
): GovernedActionContext {
  if (grant.identityId !== session.identityId || grant.sessionId !== session.sessionId) {
    throw new Error('Capability grant does not belong to authenticated session')
  }

  return {
    session,
    grant,
    proposal: {
      ...proposal,
      actor: { type: session.identityType, id: session.identityId },
      sessionId: session.sessionId,
      capability: grant.capability,
    },
  }
}
