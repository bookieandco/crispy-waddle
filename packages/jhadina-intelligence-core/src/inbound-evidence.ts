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
  claim(key: string): Promise<boolean>
  release(key: string): Promise<void>
}

async function appendRejectedInboundEvidence(input: {
  actorId: string
  observation: InboundTransportObservation
  ledger: ActionLedger
  rejectionCode: 'AUTHENTICATION_FAILED' | 'REPLAY_REJECTED'
}): Promise<void> {
  await input.ledger.append({
    id: `communication-inbound-rejected:${input.observation.observationId}:${input.rejectionCode}`,
    actionId: input.observation.observationId,
    userId: input.actorId,
    type: 'communication.inbound.rejected',
    status: 'denied',
    timestamp: input.observation.receivedAt,
    metadata: {
      transportId: input.observation.transportId,
      sourceRef: input.observation.sourceRef,
      authentication: input.observation.authentication,
      rejectionCode: input.rejectionCode,
      trustEffect: 'NONE',
      authorizationEffect: 'NONE',
    },
  })
}

export async function ingestInboundObservation(input: {
  actorId: string
  observation: InboundTransportObservation
  replayStore: ReplayStore
  ledger: ActionLedger
}): Promise<InboundTransportObservation> {
  const { observation, replayStore, ledger } = input
  if (!observation.observationId.trim() || !observation.replayKey.trim()) throw new Error('INBOUND_LINEAGE_REQUIRED')

  if (observation.authentication === 'failed') {
    await appendRejectedInboundEvidence({ ...input, rejectionCode: 'AUTHENTICATION_FAILED' })
    throw new Error('INBOUND_AUTHENTICATION_FAILED')
  }

  if (!(await replayStore.claim(observation.replayKey))) {
    await appendRejectedInboundEvidence({ ...input, rejectionCode: 'REPLAY_REJECTED' })
    throw new Error('INBOUND_REPLAY_REJECTED')
  }

  try {
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
  } catch (error) {
    await replayStore.release(observation.replayKey)
    throw error
  }

  return Object.freeze({ ...observation })
}

export class InMemoryReplayStore implements ReplayStore {
  private readonly keys = new Set<string>()
  async claim(key: string): Promise<boolean> {
    if (this.keys.has(key)) return false
    this.keys.add(key)
    return true
  }
  async release(key: string): Promise<void> { this.keys.delete(key) }
}
