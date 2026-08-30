import type { AuthoritativeActionProposal } from './governed-action.js'
import type { AuthenticatedSession } from './authenticated-session.js'
import type { CapabilityGrant } from './identity.js'
import { createAuthoritativeActionProposal } from './governed-action.js'

export interface AskIntent {
  readonly id: string
  readonly text: string
  readonly target: string
  readonly capability: string
  readonly parameters: Record<string, unknown>
  readonly evidence?: string[]
  readonly risk: 'low' | 'medium' | 'high' | 'critical'
  readonly reversibility: 'reversible' | 'partially_reversible' | 'irreversible'
  readonly correlationId: string
}

export function buildActionProposalFromAsk(
  intent: AskIntent,
  session: AuthenticatedSession,
  grant: CapabilityGrant,
): AuthoritativeActionProposal {
  if (intent.capability !== grant.capability) {
    throw new Error('Ask intent capability does not match authorized grant')
  }

  return createAuthoritativeActionProposal(session, grant, {
    id: intent.id,
    intent: intent.text,
    target: intent.target,
    parameters: intent.parameters,
    evidence: intent.evidence ?? ['ask-user-intent'],
    risk: intent.risk,
    reversibility: intent.reversibility,
    correlationId: intent.correlationId,
    createdAt: new Date().toISOString(),
  })
}
