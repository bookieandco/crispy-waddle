import type { ActionLedger } from '@jhadina/action-core'

export type InboundAuthenticationState = 'unverified' | 'authenticated' | 'failed'

export type InboundTransportObservation = Readonly<{
  observationId: string
  transportId: string
  sourceRef: string
  receivedAt: string
  authentication: InboundAuthenticationState
  replayKey: string
  payloadRef: string
}>

export interface ReplayStore {
  has(key: string): Promise<boolean>
  add(key: string): Promise<void>
}

export async function ingestInboundObservation(input: {
  actorId: string
  observation: InboundTransportObservation
  replayStore: ReplayStore
  ledger: ActionLedger
}): Promise<InboundTransportObservation> {
  const { observation, replayStore, ledger } = input
  if (!observation.observationId.trim() || !observation.replayKey.trim()) throw new Error('INBOUND_LINEAGE_REQUIRED')
  if (observation.authentication === 'failed') throw new Error('INBOUND_AUTHENTICATION_FAILED')
  if (await replayStore.has(observation.replayKey)) throw new Error('INBOUND_REPLAY_REJECTED')

  await ledger.append({
    id: `communication-inbound:${observation.observationId}`,
    actionId: observation.observationId,
    userId: input.actorId,
    type: 'communication.inbound.observed',
    status: 'completed',
    timestamp: observation.receivedAt,
    metadata: {
      transportId: observation.transportId,
      sourceRef: observation.sourceRef,
      authentication: observation.authentication,
      replayKey: observation.replayKey,
      payloadRef: observation.payloadRef,
      trustEffect: 'NONE',
      authorizationEffect: 'NONE',
    },
  })

  await replayStore.add(observation.replayKey)
  return Object.freeze({ ...observation })
}

export class InMemoryReplayStore implements ReplayStore {
  private readonly keys = new Set<string>()
  async has(key: string): Promise<boolean> { return this.keys.has(key) }
  async add(key: string): Promise<void> { this.keys.add(key) }
}
