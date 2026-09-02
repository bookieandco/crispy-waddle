import type { EvidenceEnvelope, MarketObservation } from './contracts'

export type MemeMarketEventType = 'MARKET_OBSERVED'

export type MemeMarketEvent = {
  id: string
  type: MemeMarketEventType
  occurredAt: string
  receivedAt: string
  chainId: string
  subjectId: string
  observationId: string
  source: EvidenceEnvelope<MarketObservation>['source']
  payload: MarketObservation
  sourceRef?: string
  provenance?: Record<string, unknown>
}

function assertIsoTimestamp(value: string, field: string): void {
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new Error(`Invalid ${field} timestamp.`)
  }
}

/**
 * Converts normalized market evidence into the event-driven shape used by
 * the Meme Trader pipeline. This follows QuantTrader's useful event-driven
 * separation without importing its trading authority or brokerage model.
 */
export function marketObservationToEvent(
  evidence: EvidenceEnvelope<MarketObservation>,
): MemeMarketEvent {
  assertIsoTimestamp(evidence.observedAt, 'observedAt')
  assertIsoTimestamp(evidence.receivedAt, 'receivedAt')
  if (!evidence.observationId) throw new Error('observationId is required.')
  if (!evidence.chainId) throw new Error('chainId is required.')
  if (!evidence.subjectId) throw new Error('subjectId is required.')

  return {
    id: `meme-market:${evidence.observationId}`,
    type: 'MARKET_OBSERVED',
    occurredAt: evidence.observedAt,
    receivedAt: evidence.receivedAt,
    chainId: evidence.chainId,
    subjectId: evidence.subjectId,
    observationId: evidence.observationId,
    source: evidence.source,
    payload: evidence.payload,
    sourceRef: evidence.sourceRef,
    provenance: evidence.provenance,
  }
}

export type MarketEventHandler = (event: MemeMarketEvent) => void | Promise<void>

/**
 * Minimal in-process dispatcher for deterministic tests and composition.
 * Durable replay/offsets remain an Event Bus/Data Lake responsibility.
 */
export class MemeMarketEventDispatcher {
  private readonly handlers = new Set<MarketEventHandler>()

  subscribe(handler: MarketEventHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  async publish(event: MemeMarketEvent): Promise<void> {
    for (const handler of this.handlers) await handler(event)
  }
}
