import type { ActionLedger } from '@jhadina/action-core'
import type { ObservationEnvelope } from './observation.js'

export async function appendObservationEvidence<T>(input: {
  ledger: ActionLedger
  actorId: string
  envelope: ObservationEnvelope<T>
}): Promise<void> {
  await input.ledger.append({
    id: `observation:${input.envelope.observationId}`,
    actionId: input.envelope.observationId,
    userId: input.actorId,
    type: `observation.${input.envelope.source.provider}.${input.envelope.source.capability}`,
    status: 'completed',
    timestamp: input.envelope.provenance.receivedAt,
    metadata: {
      subjectId: input.envelope.subjectId,
      source: input.envelope.source,
      provenance: input.envelope.provenance,
      limitations: input.envelope.limitations,
      trustEffect: input.envelope.trustEffect,
      authorizationEffect: input.envelope.authorizationEffect,
    },
  })
}
