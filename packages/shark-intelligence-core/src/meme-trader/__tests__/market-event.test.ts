import { describe, expect, it } from 'vitest'
import type { EvidenceEnvelope, MarketObservation } from '../contracts'
import { marketObservationToEvent, MemeMarketEventDispatcher } from '../market-event'

const evidence: EvidenceEnvelope<MarketObservation> = {
  observationId: 'obs-001',
  source: 'dexscreener',
  observedAt: '2026-09-02T12:00:00.000Z',
  receivedAt: '2026-09-02T12:00:01.000Z',
  chainId: 'solana',
  subjectId: 'token-001',
  payload: { liquidityUsd: 100_000, volume24hUsd: 500_000, buys24h: 120, sells24h: 80 },
  sourceRef: 'https://example.test/obs-001',
}

describe('marketObservationToEvent', () => {
  it('preserves point-in-time evidence and derives a deterministic event id', () => {
    const event = marketObservationToEvent(evidence)

    expect(event).toMatchObject({
      id: 'meme-market:obs-001',
      type: 'MARKET_OBSERVED',
      occurredAt: evidence.observedAt,
      receivedAt: evidence.receivedAt,
      observationId: evidence.observationId,
      chainId: evidence.chainId,
      subjectId: evidence.subjectId,
      source: 'dexscreener',
      payload: evidence.payload,
    })
  })

  it('rejects missing timestamps and identity fields', () => {
    expect(() => marketObservationToEvent({ ...evidence, observedAt: 'bad' })).toThrow()
    expect(() => marketObservationToEvent({ ...evidence, observationId: '' })).toThrow()
    expect(() => marketObservationToEvent({ ...evidence, subjectId: '' })).toThrow()
  })
})

describe('MemeMarketEventDispatcher', () => {
  it('delivers events to subscribed handlers and supports unsubscribe', async () => {
    const dispatcher = new MemeMarketEventDispatcher()
    const received: string[] = []
    const unsubscribe = dispatcher.subscribe((event) => received.push(event.id))

    await dispatcher.publish(marketObservationToEvent(evidence))
    unsubscribe()
    await dispatcher.publish(marketObservationToEvent({ ...evidence, observationId: 'obs-002' }))

    expect(received).toEqual(['meme-market:obs-001'])
  })
})
